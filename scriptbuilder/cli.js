#!/usr/bin/env node

import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { compileGenerator } from './templateEngine.js';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { Config } = require('../lazi-core-cli/bin/config.js');

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const program = new Command();
const WORKFLOWS_DIR = path.join(Config.getStorageDir(), 'workflows');
const CUSTOM_NODES_FILE = path.join(Config.getStorageDir(), '.lazi-custom-nodes.json');

// Load custom nodes catalog (shared with GUI)
let customNodesData = { customNodes: {}, customCategories: {} };
try {
  const content = fs.readFileSync(CUSTOM_NODES_FILE, 'utf-8');
  customNodesData = JSON.parse(content);
} catch (error) {
  console.warn('Warning: Could not load custom nodes file:', error.message);
}

// Ensure storage and workflows directory exist
Config.ensureStorageDir();

// Helper: Load workflow
function loadWorkflow(name) {
  const filePath = path.join(WORKFLOWS_DIR, `${name}.json`);

  if (!fs.existsSync(filePath)) {
    console.error(`Error: Workflow '${name}' not found`);
    process.exit(1);
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Error loading workflow: ${error.message}`);
    process.exit(1);
  }
}

// Helper: Generate code for a single node using custom nodes catalog
function generateNodeCode(node, scriptType) {
  if (!node || !node.data || !node.data.script) {
    return '# No script data available';
  }

  const operationId = node.data.script.id;
  const config = node.data.config || {};

  // Handle special case: log-based nodes
  if (operationId === 'cmdregistry-log') {
    const logId = config.logId;
    if (!logId) {
      return '# Error: No log ID specified for cmdregistry-log node';
    }

    try {
      // Read log file directly (synchronous)
      const logFilePath = path.join(__dirname, '..', 'lazi-core-cli', 'storage', '.lazi-log.txt');

      if (!fs.existsSync(logFilePath)) {
        return `# Error: Log file not found`;
      }

      const logContent = fs.readFileSync(logFilePath, 'utf-8');
      const normalized = logContent.replace(/\r\n/g, '\n');
      const entries = normalized.split('---\n').filter(e => e.trim());

      // Find the entry with matching log ID
      let commandExecuted = null;
      for (const entry of entries) {
        const logIdMatch = entry.match(/\[Log-(\d+)\]/);
        if (logIdMatch && parseInt(logIdMatch[1], 10) === logId) {
          // Skip event entries
          if (entry.includes('Event-Type:')) {
            continue;
          }

          // Extract command
          const firstLine = entry.split('\n')[0];
          const fullMatch = firstLine.match(/\[Log-\d+\] \[.*?\] (.*?) \((.*?)\)$/);

          if (fullMatch && fullMatch[2]) {
            commandExecuted = fullMatch[2].trim();
            break;
          }

          // Try simple match for QUICK commands
          const simpleMatch = firstLine.match(/\[Log-\d+\] \[.*?\] (.*)/);
          if (simpleMatch && simpleMatch[1]) {
            commandExecuted = simpleMatch[1].trim();
            break;
          }
        }
      }

      if (!commandExecuted) {
        return `# Error: Log-${logId} not found or contains no command`;
      }

      // Return the command from the log
      return `# From Log-${logId}\n${commandExecuted}`;
    } catch (error) {
      return `# Error retrieving command from Log-${logId}: ${error.message}`;
    }
  }

  // Handle special case: lazi command nodes
  if (operationId.startsWith('lazi-')) {
    const commandName = operationId.replace('lazi-', '');

    // Build lazi run command with parameters
    const params = Object.values(config).filter(v => v !== undefined && v !== '');
    const paramsStr = params.length > 0 ? ' ' + params.join(' ') : '';

    return `# Run lazi command: ${commandName}\nlazi run ${commandName}${paramsStr}`;
  }

  // Look up the operation in custom nodes
  // Try exact match first, then try with "custom-test-" prefix for backwards compatibility
  let customNode = customNodesData.customNodes[operationId];

  if (!customNode && !operationId.startsWith('custom-')) {
    customNode = customNodesData.customNodes[`custom-test-${operationId}`];
  }

  if (!customNode || !customNode.generators || !customNode.generators[scriptType]) {
    return `# TODO: Unknown operation ${operationId}`;
  }

  try {
    const generatorString = customNode.generators[scriptType];

    // Compile the generator (auto-detects template vs function)
    const generator = compileGenerator(generatorString);

    // Call the generator with config (no branches for now in CLI context)
    return generator(config, {});
  } catch (error) {
    return `# Error generating code for ${operationId}: ${error.message}`;
  }
}

// Helper: Generate script from workflow
function generateScript(workflow, scriptType) {
  const nodes = workflow.nodes || [];
  const edges = workflow.edges || [];

  // Build dependency graph
  const nodeMap = new Map();
  nodes.forEach(node => nodeMap.set(node.id, node));

  const dependencies = new Map();
  nodes.forEach(node => dependencies.set(node.id, []));

  edges.forEach(edge => {
    const deps = dependencies.get(edge.target);
    if (deps) deps.push(edge.source);
  });

  // Topological sort
  const visited = new Set();
  const sorted = [];

  function visit(nodeId) {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);

    const deps = dependencies.get(nodeId) || [];
    deps.forEach(depId => visit(depId));

    sorted.push(nodeId);
  }

  nodes.forEach(node => visit(node.id));

  // Generate script
  let script = '';

  if (scriptType === 'powershell') {
    script += '# PowerShell Script\n';
    script += '# Generated by ScriptBuilder CLI\n\n';
  } else {
    script += '#!/bin/bash\n';
    script += '# Generated by ScriptBuilder CLI\n';
    script += 'set -e\n\n';
  }

  sorted.forEach(nodeId => {
    const node = nodeMap.get(nodeId);
    if (!node || !node.data || !node.data.script) return;

    script += `# ${node.data.script.name}\n`;
    script += `# Step: ${node.id}\n`;
    script += `${generateNodeCode(node, scriptType)}\n\n`;
  });

  return script;
}

program
  .name('scriptbuilder')
  .description('ScriptBuilder CLI - Manage and execute visual workflows')
  .version('1.0.0');

// List command
program
  .command('list')
  .description('List all saved workflows')
  .action(() => {
    try {
      const files = fs.readdirSync(WORKFLOWS_DIR);
      const workflows = files.filter(f => f.endsWith('.json'));

      if (workflows.length === 0) {
        console.log('\nNo saved workflows found.');
        console.log('Save workflows from the ScriptBuilder GUI or create JSON files in:');
        console.log(`  ${WORKFLOWS_DIR}\n`);
        return;
      }

      console.log(`\nSaved Workflows (${workflows.length}):\n`);

      workflows.forEach(file => {
        try {
          const content = fs.readFileSync(path.join(WORKFLOWS_DIR, file), 'utf-8');
          const workflow = JSON.parse(content);
          const name = path.basename(file, '.json');
          const type = workflow.metadata?.scriptType || 'unknown';
          const nodeCount = (workflow.nodes || []).length;
          const created = workflow.metadata?.createdAt ? new Date(workflow.metadata.createdAt).toLocaleDateString() : 'Unknown';

          console.log(`  ${name}`);
          console.log(`    Type: ${type}, Nodes: ${nodeCount}, Created: ${created}`);
        } catch (err) {
          console.log(`  ${path.basename(file, '.json')} (error reading file)`);
        }
      });

      console.log('');
    } catch (error) {
      console.error('Error listing workflows:', error.message);
      process.exit(1);
    }
  });

// Show command
program
  .command('show')
  .description('Display workflow details')
  .argument('<name>', 'Workflow name')
  .action((name) => {
    const workflow = loadWorkflow(name);

    console.log(`\nWorkflow: ${name}`);
    console.log(`Script Type: ${workflow.metadata?.scriptType || 'unknown'}`);
    console.log(`Nodes: ${(workflow.nodes || []).length}`);
    console.log(`Edges: ${(workflow.edges || []).length}`);

    if (workflow.metadata?.description) {
      console.log(`Description: ${workflow.metadata.description}`);
    }

    if (workflow.metadata?.createdAt) {
      console.log(`Created: ${new Date(workflow.metadata.createdAt).toLocaleString()}`);
    }

    console.log('\nNodes:');
    (workflow.nodes || []).forEach((node, index) => {
      const nodeName = node.data?.script?.name || 'Unknown';
      console.log(`  ${index + 1}. ${nodeName} (${node.id})`);
    });

    console.log('');
  });

// Delete command
program
  .command('delete')
  .alias('rm')
  .description('Delete a workflow')
  .argument('<name>', 'Workflow name')
  .action((name) => {
    const filePath = path.join(WORKFLOWS_DIR, `${name}.json`);

    if (!fs.existsSync(filePath)) {
      console.error(`Error: Workflow '${name}' not found`);
      process.exit(1);
    }

    try {
      fs.unlinkSync(filePath);
      console.log(`Workflow '${name}' deleted successfully`);
    } catch (error) {
      console.error(`Error deleting workflow: ${error.message}`);
      process.exit(1);
    }
  });

// Generate command
program
  .command('generate')
  .description('Generate script from workflow')
  .argument('<name>', 'Workflow name')
  .option('-o, --output <file>', 'Output file path')
  .option('--type <powershell|bash>', 'Override script type')
  .option('--print', 'Print to stdout (default if no -o)')
  .action((name, options) => {
    const workflow = loadWorkflow(name);
    const scriptType = options.type || workflow.metadata?.scriptType || 'powershell';

    const script = generateScript(workflow, scriptType);

    if (options.output) {
      try {
        fs.writeFileSync(options.output, script, 'utf-8');
        console.log(`Script written to ${options.output}`);
      } catch (error) {
        console.error(`Error writing file: ${error.message}`);
        process.exit(1);
      }
    } else {
      console.log(script);
    }
  });

// Run command
program
  .command('run')
  .description('Execute a workflow')
  .argument('<name>', 'Workflow name')
  .option('-s, --show', 'Show script before executing')
  .option('--no-log', 'Skip event logging')
  .action(async (name, options) => {
    const workflow = loadWorkflow(name);
    const scriptType = workflow.metadata?.scriptType || 'powershell';
    const nodes = workflow.nodes || [];

    console.log(`Loading workflow: ${name}`);
    console.log(`Script type: ${scriptType}`);
    console.log(`Nodes: ${nodes.length}`);

    const script = generateScript(workflow, scriptType);

    if (options.show) {
      console.log('\nGenerated Script:');
      console.log('---');
      console.log(script);
      console.log('---\n');
    }

    // Write to temp file
    const tempDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const ext = scriptType === 'powershell' ? '.ps1' : '.sh';
    const tempFile = path.join(tempDir, `cli-${name}-${Date.now()}${ext}`);
    fs.writeFileSync(tempFile, script, 'utf-8');

    // Create event log if logging enabled
    let eventId = null;
    if (options.log !== false) {
      try {
        const loggerModule = await import('../lazi-core-cli/bin/logger.js');
        const logger = new loggerModule.Logger();
        eventId = logger.startEventLog(`CLI: ${name}`, scriptType, nodes.length, script);

        // Create step logs with generated code for each node
        nodes.forEach((node, index) => {
          const nodeName = node.data?.script?.name || `Step ${index + 1}`;
          const nodeCode = generateNodeCode(node, scriptType);
          logger.writeStepLog(eventId, index + 1, nodeName, nodeCode);
        });
      } catch (error) {
        console.warn('Warning: Could not create event log:', error.message);
      }
    }

    // Execute script
    const startTime = Date.now();
    const shellCmd = scriptType === 'powershell' ? 'powershell' : 'bash';
    const shellArgs = scriptType === 'powershell'
      ? ['-ExecutionPolicy', 'Bypass', '-File', tempFile]
      : [tempFile];

    console.log(`\nExecuting workflow...\n`);

    const childProcess = spawn(shellCmd, shellArgs, {
      stdio: ['inherit', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    childProcess.stdout.on('data', (data) => {
      const text = data.toString();
      stdout += text;
      process.stdout.write(text);
    });

    childProcess.stderr.on('data', (data) => {
      const text = data.toString();
      stderr += text;
      process.stderr.write(text);
    });

    childProcess.on('close', async (exitCode) => {
      // Clean up temp file
      try {
        fs.unlinkSync(tempFile);
      } catch (e) {
        // Ignore cleanup errors
      }

      const duration = (Date.now() - startTime) / 1000;

      // Create event-end log
      if (eventId && options.log !== false) {
        try {
          const loggerModule = await import('../lazi-core-cli/bin/logger.js');
          const logger = new loggerModule.Logger();
          logger.endEventLog(eventId, `CLI: ${name}`, exitCode || 0, stdout, stderr, duration);

          console.log(`\n[Logged as Event-${eventId}]`);
          console.log(`View with: lazi event ${eventId}`);
        } catch (error) {
          // Ignore logging errors
        }
      }

      console.log(`\nExecution completed in ${duration.toFixed(2)}s`);

      if (exitCode !== 0) {
        process.exit(exitCode || 1);
      }
    });

    childProcess.on('error', (error) => {
      console.error('Execution failed:', error.message);

      // Clean up temp file
      try {
        fs.unlinkSync(tempFile);
      } catch (e) {
        // Ignore cleanup errors
      }

      process.exit(1);
    });
  });

// Create workflow command
program
  .command('create')
  .description('Create a new workflow')
  .argument('<name>', 'Workflow name')
  .option('-t, --type <powershell|bash>', 'Script type', 'powershell')
  .option('-d, --description <text>', 'Workflow description')
  .action((name, options) => {
    const filePath = path.join(WORKFLOWS_DIR, `${name}.json`);

    if (fs.existsSync(filePath)) {
      console.error(`Error: Workflow '${name}' already exists`);
      process.exit(1);
    }

    const workflow = {
      metadata: {
        name,
        scriptType: options.type,
        description: options.description || `Workflow: ${name}`,
        createdAt: new Date().toISOString()
      },
      nodes: [],
      edges: []
    };

    try {
      fs.writeFileSync(filePath, JSON.stringify(workflow, null, 2), 'utf-8');
      console.log(`Workflow '${name}' created successfully at ${filePath}`);
      console.log(`Edit the workflow JSON file to add nodes and edges`);
    } catch (error) {
      console.error(`Error creating workflow: ${error.message}`);
      process.exit(1);
    }
  });

// Custom nodes management commands
const nodeCmd = program.command('node').description('Manage custom nodes');

nodeCmd
  .command('list')
  .description('List all custom nodes')
  .option('-c, --category <name>', 'Filter by category')
  .option('-v, --verbose', 'Show detailed information')
  .action((options) => {
    const nodes = Object.values(customNodesData.customNodes);

    if (nodes.length === 0) {
      console.log('No custom nodes found');
      return;
    }

    let filtered = nodes;
    if (options.category) {
      filtered = nodes.filter(n => n.category === options.category);
    }

    if (options.verbose) {
      filtered.forEach(node => {
        console.log(`\n${node.name} (${node.id})`);
        console.log(`  Category: ${node.category}`);
        console.log(`  Description: ${node.description}`);
        console.log(`  Fields: ${node.fields.length}`);
        console.log(`  Has Branching: ${node.outputHandles ? 'Yes' : 'No'}`);
        if (node.metadata?.tags) {
          console.log(`  Tags: ${node.metadata.tags.join(', ')}`);
        }
      });
    } else {
      console.log(`\nFound ${filtered.length} custom node(s):\n`);
      const grouped = {};
      filtered.forEach(node => {
        if (!grouped[node.category]) grouped[node.category] = [];
        grouped[node.category].push(node);
      });

      Object.entries(grouped).forEach(([category, nodeList]) => {
        console.log(`${category}:`);
        nodeList.forEach(node => {
          console.log(`  - ${node.name} (${node.id})`);
        });
      });
    }
  });

nodeCmd
  .command('show')
  .description('Show details of a custom node')
  .argument('<id>', 'Node ID')
  .action((id) => {
    const node = customNodesData.customNodes[id];

    if (!node) {
      console.error(`Error: Node '${id}' not found`);
      process.exit(1);
    }

    console.log(`\n${node.name}`);
    console.log(`ID: ${node.id}`);
    console.log(`Category: ${node.category}`);
    console.log(`Description: ${node.description}`);

    console.log(`\nFields (${node.fields.length}):`);
    node.fields.forEach((field, i) => {
      console.log(`  ${i + 1}. ${field.label} (${field.key})`);
      console.log(`     Type: ${field.type}`);
      if (field.defaultValue !== undefined) {
        console.log(`     Default: ${field.defaultValue}`);
      }
    });

    if (node.outputHandles) {
      console.log(`\nOutput Handles:`);
      node.outputHandles.forEach(handle => {
        console.log(`  - ${handle.label} (${handle.id})`);
      });
    }

    if (node.metadata?.tags) {
      console.log(`\nTags: ${node.metadata.tags.join(', ')}`);
    }

    console.log(`\nCreated: ${node.metadata?.createdAt || 'N/A'}`);
    console.log(`Updated: ${node.metadata?.updatedAt || 'N/A'}`);
  });

nodeCmd
  .command('create')
  .description('Create a new custom node')
  .argument('<name>', 'Node name')
  .requiredOption('-c, --category <name>', 'Category name')
  .requiredOption('-d, --description <text>', 'Node description')
  .option('--fields <json>', 'Fields as JSON array (e.g. \'[{"key":"msg","label":"Message","type":"text"}]\')')
  .option('--handles <json>', 'Output handles as JSON array (e.g. \'[{"id":"true-path","label":"True","position":"right"}]\')')
  .option('--ps-gen <code>', 'PowerShell generator (template or function string)')
  .option('--bash-gen <code>', 'Bash generator (template or function string)')
  .option('--tags <tags>', 'Comma-separated tags')
  .option('--color <hex>', 'Category color (hex format, e.g. #3b82f6)')
  .action((name, options) => {
    // Generate node ID
    const nodeId = `custom-${name.toLowerCase().replace(/\s+/g, '-')}`;

    // Check if node already exists
    if (customNodesData.customNodes[nodeId]) {
      console.error(`Error: Node with ID '${nodeId}' already exists`);
      process.exit(1);
    }

    // Parse fields
    let fields = [];
    if (options.fields) {
      try {
        fields = JSON.parse(options.fields);
        if (!Array.isArray(fields)) {
          throw new Error('Fields must be an array');
        }
      } catch (error) {
        console.error(`Error parsing fields: ${error.message}`);
        process.exit(1);
      }
    }

    // Parse output handles
    let outputHandles = null;
    if (options.handles) {
      try {
        outputHandles = JSON.parse(options.handles);
        if (!Array.isArray(outputHandles)) {
          throw new Error('Handles must be an array');
        }
      } catch (error) {
        console.error(`Error parsing handles: ${error.message}`);
        process.exit(1);
      }
    }

    // Parse tags
    const tags = options.tags ? options.tags.split(',').map(t => t.trim()) : [];

    // Create custom node
    const customNode = {
      id: nodeId,
      name,
      category: options.category,
      description: options.description,
      fields,
      outputHandles,
      generators: {
        powershell: options.psGen || `# TODO: Implement PowerShell generator`,
        bash: options.bashGen || `# TODO: Implement Bash generator`
      },
      metadata: {
        tags,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    };

    // Add to custom nodes
    customNodesData.customNodes[nodeId] = customNode;

    // Create or update category if color specified
    if (options.color) {
      if (!customNodesData.customCategories) {
        customNodesData.customCategories = {};
      }

      if (!customNodesData.customCategories[options.category]) {
        const existingCategories = Object.keys(customNodesData.customCategories);
        customNodesData.customCategories[options.category] = {
          name: options.category,
          color: options.color,
          order: existingCategories.length + 999
        };
      } else {
        customNodesData.customCategories[options.category].color = options.color;
      }
    }

    // Save to file
    try {
      fs.writeFileSync(CUSTOM_NODES_FILE, JSON.stringify(customNodesData, null, 2), 'utf-8');
      console.log(`✓ Custom node '${name}' created successfully!`);
      console.log(`  ID: ${nodeId}`);
      console.log(`  Category: ${options.category}`);
      console.log(`  Fields: ${fields.length}`);
      if (outputHandles) {
        console.log(`  Output Handles: ${outputHandles.length}`);
      }
    } catch (error) {
      console.error(`Error saving custom node: ${error.message}`);
      process.exit(1);
    }
  });

nodeCmd
  .command('delete')
  .description('Delete a custom node')
  .argument('<id>', 'Node ID')
  .action((id) => {
    if (!customNodesData.customNodes[id]) {
      console.error(`Error: Node '${id}' not found`);
      process.exit(1);
    }

    delete customNodesData.customNodes[id];

    try {
      fs.writeFileSync(CUSTOM_NODES_FILE, JSON.stringify(customNodesData, null, 2), 'utf-8');
      console.log(`Custom node '${id}' deleted successfully`);
    } catch (error) {
      console.error(`Error saving custom nodes file: ${error.message}`);
      process.exit(1);
    }
  });

// Add node to workflow command
program
  .command('add-node')
  .description('Add a node to an existing workflow')
  .argument('<workflow>', 'Workflow name')
  .option('--type <type>', 'Node type (custom node ID or lazi-log)')
  .option('--log <logId>', 'Log ID to use (creates lazi-log node)', parseInt)
  .option('--command <name>', 'Cmdregistry command name to use')
  .option('--config <json>', 'Node configuration as JSON string')
  .option('--name <name>', 'Display name for the node')
  .action((workflowName, options) => {
    const filePath = path.join(WORKFLOWS_DIR, `${workflowName}.json`);

    if (!fs.existsSync(filePath)) {
      console.error(`Error: Workflow '${workflowName}' not found`);
      process.exit(1);
    }

    let workflow;
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      workflow = JSON.parse(content);
    } catch (error) {
      console.error(`Error loading workflow: ${error.message}`);
      process.exit(1);
    }

    // Determine node type and configuration
    let nodeType, nodeName, nodeConfig;

    if (options.log) {
      // Log-based node
      nodeType = 'lazi-log';
      nodeName = options.name || `Log-${options.log}`;
      nodeConfig = { logId: options.log };
    } else if (options.command) {
      // Cmdregistry command node
      nodeType = `lazi-${options.command}`;
      nodeName = options.name || options.command;
      nodeConfig = options.config ? JSON.parse(options.config) : {};
    } else if (options.type) {
      // Custom node
      nodeType = options.type;
      nodeName = options.name || options.type;
      nodeConfig = options.config ? JSON.parse(options.config) : {};
    } else {
      console.error('Error: Must specify --log, --command, or --type');
      console.log('\nExamples:');
      console.log('  Add log-based node:    scriptbuilder add-node my-flow --log 510');
      console.log('  Add lazi node:  scriptbuilder add-node my-flow --command backup');
      console.log('  Add custom node:       scriptbuilder add-node my-flow --type custom-test-print-output --config \'{"message":"Hello"}\'');
      process.exit(1);
    }

    // Create new node
    const nodeId = `node-${Date.now()}`;
    const newNode = {
      id: nodeId,
      type: 'scriptNode',
      data: {
        script: {
          id: nodeType,
          name: nodeName
        },
        config: nodeConfig
      }
    };

    // Add node to workflow
    workflow.nodes.push(newNode);

    // Auto-connect to previous node if exists
    if (workflow.nodes.length > 1) {
      const prevNode = workflow.nodes[workflow.nodes.length - 2];
      workflow.edges.push({
        id: `edge-${Date.now()}`,
        source: prevNode.id,
        target: nodeId
      });
    }

    // Save workflow
    try {
      fs.writeFileSync(filePath, JSON.stringify(workflow, null, 2), 'utf-8');
      console.log(`✓ Node '${nodeName}' added to workflow '${workflowName}'`);
      console.log(`  Node ID: ${nodeId}`);
      console.log(`  Type: ${nodeType}`);
      console.log(`  Total nodes: ${workflow.nodes.length}`);
    } catch (error) {
      console.error(`Error saving workflow: ${error.message}`);
      process.exit(1);
    }
  });

// Connect nodes command
program
  .command('connect')
  .description('Manually connect two nodes in a workflow')
  .argument('<workflow>', 'Workflow name')
  .argument('<source>', 'Source node ID')
  .argument('<target>', 'Target node ID')
  .option('--handle <id>', 'Source output handle ID (for branching nodes)')
  .action((workflowName, sourceId, targetId, options) => {
    const filePath = path.join(WORKFLOWS_DIR, `${workflowName}.json`);

    if (!fs.existsSync(filePath)) {
      console.error(`Error: Workflow '${workflowName}' not found`);
      process.exit(1);
    }

    let workflow;
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      workflow = JSON.parse(content);
    } catch (error) {
      console.error(`Error loading workflow: ${error.message}`);
      process.exit(1);
    }

    // Validate nodes exist
    const sourceNode = workflow.nodes.find(n => n.id === sourceId);
    const targetNode = workflow.nodes.find(n => n.id === targetId);

    if (!sourceNode) {
      console.error(`Error: Source node '${sourceId}' not found`);
      process.exit(1);
    }

    if (!targetNode) {
      console.error(`Error: Target node '${targetId}' not found`);
      process.exit(1);
    }

    // Check if connection already exists
    const existingEdge = workflow.edges.find(
      e => e.source === sourceId && e.target === targetId &&
           (!options.handle || e.sourceHandle === options.handle)
    );

    if (existingEdge) {
      console.error('Error: Connection already exists');
      process.exit(1);
    }

    // Create new edge
    const newEdge = {
      id: `edge-${Date.now()}`,
      source: sourceId,
      target: targetId
    };

    // Add source handle if specified
    if (options.handle) {
      newEdge.sourceHandle = options.handle;
    }

    workflow.edges.push(newEdge);

    // Save workflow
    try {
      fs.writeFileSync(filePath, JSON.stringify(workflow, null, 2), 'utf-8');
      console.log(`✓ Connected: ${sourceId} → ${targetId}`);
      if (options.handle) {
        console.log(`  Via handle: ${options.handle}`);
      }
      console.log(`  Total edges: ${workflow.edges.length}`);
    } catch (error) {
      console.error(`Error saving workflow: ${error.message}`);
      process.exit(1);
    }
  });

// Disconnect nodes command
program
  .command('disconnect')
  .description('Remove a connection between two nodes')
  .argument('<workflow>', 'Workflow name')
  .argument('<source>', 'Source node ID')
  .argument('<target>', 'Target node ID')
  .option('--handle <id>', 'Source output handle ID (for branching nodes)')
  .action((workflowName, sourceId, targetId, options) => {
    const filePath = path.join(WORKFLOWS_DIR, `${workflowName}.json`);

    if (!fs.existsSync(filePath)) {
      console.error(`Error: Workflow '${workflowName}' not found`);
      process.exit(1);
    }

    let workflow;
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      workflow = JSON.parse(content);
    } catch (error) {
      console.error(`Error loading workflow: ${error.message}`);
      process.exit(1);
    }

    // Find and remove edge
    const initialLength = workflow.edges.length;
    workflow.edges = workflow.edges.filter(
      e => !(e.source === sourceId && e.target === targetId &&
             (!options.handle || e.sourceHandle === options.handle))
    );

    if (workflow.edges.length === initialLength) {
      console.error('Error: Connection not found');
      process.exit(1);
    }

    // Save workflow
    try {
      fs.writeFileSync(filePath, JSON.stringify(workflow, null, 2), 'utf-8');
      console.log(`✓ Disconnected: ${sourceId} ✗ ${targetId}`);
      console.log(`  Total edges: ${workflow.edges.length}`);
    } catch (error) {
      console.error(`Error saving workflow: ${error.message}`);
      process.exit(1);
    }
  });

program.parse(process.argv);
