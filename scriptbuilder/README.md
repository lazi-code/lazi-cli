# Script Builder

A CLI tool for composing PowerShell (.ps1) and Bash (.sh) scripts using JSON workflow definitions with template-based code generation.

## Features

- **Dual script support** - Generate PowerShell or Bash scripts from the same workflow definition
- **Lazi integration** - Execute your registered Lazi commands as workflow steps with event logging
- **Custom node creation** - Build your own reusable nodes with complete control over fields and code generation
- **Execution History** - Browse past executions, view step code, and build new scripts from selected steps
- **Workflow management** - Create, list, show, delete, and run workflows via CLI
- **Template engine** - Flexible template-based code generation supporting both simple templates and JavaScript functions
- **Real code generation** - Step logs contain actual PowerShell/Bash code, not placeholders
- **Custom node management** - Create, list, show, and delete custom nodes
- **Shared storage** - Uses `~/.lazi/` directory for workflows and custom nodes

## Getting Started

### Installation

```bash
cd scriptbuilder
npm install
```

### Quick Setup with Lazi

The easiest way to use ScriptBuilder is through Lazi's preset system:

```bash
# One-time setup
lazi setup scriptbuilder

# Now use scriptbuilder commands via Lazi
lazi run scriptbuilder-list
lazi run scriptbuilder-create my-workflow
lazi run scriptbuilder-run my-workflow
```

This registers 14 `scriptbuilder-*` commands for easy access.

### CLI Usage

You can also use the ScriptBuilder CLI directly:

```bash
# List workflows
node cli.js list

# Create workflow
node cli.js create my-workflow -t powershell

# Run workflow
node cli.js run my-workflow
```

## CLI Usage

Script Builder is a pure CLI tool. All workflow and node management is done through command-line commands.

### Basic Workflow

1. **Create a workflow** - Define script type (PowerShell or Bash)
2. **Add nodes** - Build workflow by adding nodes from Lazi commands, custom nodes, or built-in operations
3. **Connect nodes** - Define execution order by connecting nodes together
4. **Generate script** - Output the generated PowerShell or Bash script
5. **Run workflow** - Execute the workflow with Lazi event logging

### Build from Steps

The "Build from Steps" feature allows you to create new scripts by combining code from execution history:

**Use Cases:**
- Reuse successful steps from different executions
- Create script variations by mixing different steps
- Build templates from tested workflow components
- Debug by isolating specific steps

**Example:**
```bash
# View execution events
lazi events -n 10

# View specific event with step codes
lazi event 190 --with-code

# Build script from specific step IDs
lazi build --from-steps 248,249,252 -o combined.ps1 --name "Combined Workflow"
```

## Lazi Integration

ScriptBuilder integrates seamlessly with Lazi Core-CLI:

### Using Lazi Commands in Workflows

1. Register commands in Lazi:
```bash
lazi add backup "bash backup.sh {target}" -d "Backup files"
lazi add deploy "bash deploy.sh {env}" -d "Deploy to environment"
```

2. Add them to workflows:
```bash
scriptbuilder add-node my-workflow --command backup
scriptbuilder add-node my-workflow --command deploy
```

3. Generated script includes `lazi run` commands:
```bash
# Generated PowerShell
lazi run backup "/data/important"
lazi run deploy "production"
```

### Event Logging

When you run a script from ScriptBuilder, it creates structured event logs in Lazi:

- **EVENT-START** - Script metadata (name, type, total steps, full script content)
- **STEP logs** - One per workflow node with generated code
- **EVENT-END** - Results (exit code, output, duration)

View execution logs:
```bash
lazi events -n 10        # List recent events
lazi event 190           # View specific event
lazi event 190 --with-code  # Include step code
lazi step 248            # View individual step code
```

### Shared Storage

ScriptBuilder and Lazi share the same storage location:

- **Custom nodes**: `~/.lazi/.lazi-custom-nodes.json`
- **Workflows**: `~/.lazi/workflows/`
- **Event logs**: `~/.lazi/.lazi-log.txt`

This ensures zero duplication and seamless integration.

## CLI Commands

ScriptBuilder includes a full-featured CLI for workflow and node management.

### Workflow Management

```bash
# Create workflow
scriptbuilder create <name> [-t powershell|bash] [-d "description"]

# List workflows
scriptbuilder list

# Show workflow details
scriptbuilder show <name>

# Delete workflow
scriptbuilder delete <name>

# Generate script from workflow (no execution)
scriptbuilder generate <name> [-o output.ps1]

# Run workflow (executes with Lazi event logging)
scriptbuilder run <name>
```

**Examples:**

```bash
# Create a PowerShell workflow
scriptbuilder create backup-flow -t powershell -d "Database backup workflow"

# List all workflows
scriptbuilder list

# Generate script without running
scriptbuilder generate backup-flow -o backup.ps1

# Run workflow (creates event log in Lazi)
scriptbuilder run backup-flow
```

### Custom Node Management

```bash
# List custom nodes
scriptbuilder node list [-c category] [-v]

# Show custom node details
scriptbuilder node show <id>

# Delete custom node
scriptbuilder node delete <id>
```

**Examples:**

```bash
# List all custom nodes
scriptbuilder node list -v

# List nodes in specific category
scriptbuilder node list -c "Custom Utilities"

# Show node details
scriptbuilder node show custom-timestamp-logger

# Delete node
scriptbuilder node delete custom-old-node
```

### Workflow Node Management

```bash
# Add node to workflow
scriptbuilder add-node <workflow> [--log <id>] [--command <name>] [--type <type>]

# Connect nodes
scriptbuilder connect <workflow> <source-id> <target-id>

# Disconnect nodes
scriptbuilder disconnect <workflow> <source-id> <target-id>
```

**Examples:**

```bash
# Add node from Lazi log
scriptbuilder add-node my-flow --log 510

# Add node from Lazi command
scriptbuilder add-node my-flow --command backup

# Add custom node
scriptbuilder add-node my-flow --type custom-timestamp-logger

# Connect two nodes
scriptbuilder connect my-flow node1 node2
```

## Custom Node Creation

Create your own reusable nodes with complete control over fields and code generation by directly editing the custom nodes JSON file at `~/.lazi/.lazi-custom-nodes.json`.

### Creating a Custom Node

Custom nodes are defined in JSON format with the following structure:
- **Basic Info** - id, name, category, description, tags
- **Fields** - Configurable form fields (text, number, select, boolean, textarea)
- **Branching** - Output handles for conditional logic (optional)
- **Code Generation** - PowerShell and Bash code templates or functions

### Field Types

- **text** - Single-line text input
- **textarea** - Multi-line text input
- **number** - Numeric input
- **select** - Dropdown with predefined options
- **boolean** - Checkbox

### Code Generation Modes

**Template Mode (Simple):**
```bash
# PowerShell template
Write-Host "{{message}}"
$output = {{variableName}}

# Bash template
echo "{{message}}"
output={{variableName}}
```

**Function Mode (Advanced):**
```javascript
// PowerShell generator
(config, branches) => {
  let code = `Write-Host "${config.message}"\n`;
  if (branches?.['success']) {
    code += `if ($?) {\n`;
    code += `  ${branches['success']}\n`;
    code += `}\n`;
  }
  return code;
}
```

### Branching Support

Add multiple output handles for conditional logic:

- **if-else**: `true-path`, `false-path`
- **switch-case**: `case-1`, `case-2`, `default`
- **try-catch**: `try`, `catch`

**Example with branching:**
```bash
# Template using branches
if [ {{condition}} ]; then
  {{branches.true-path}}
else
  {{branches.false-path}}
fi
```

### Custom Categories

Organize nodes with custom categories defined in the `customCategories` section of `~/.lazi/.lazi-custom-nodes.json`

### Storage Format

Custom nodes are stored in `~/.lazi/.lazi-custom-nodes.json`:

```json
{
  "customNodes": {
    "custom-node-id": {
      "id": "custom-node-id",
      "name": "Node Name",
      "category": "Category Name",
      "description": "Description",
      "fields": [...],
      "outputHandles": [...],
      "generators": {
        "powershell": "template or function string",
        "bash": "template or function string"
      }
    }
  },
  "customCategories": {
    "Category Name": {
      "name": "Category Name",
      "color": "#3b82f6",
      "order": 999
    }
  }
}
```

## Node Types

### Lazi Commands

Your registered Lazi commands can be used as workflow nodes:
- Dynamically loaded from `lazi list -v`
- Parameters become configurable fields
- Generated code: `lazi run <name> [params]`

### Custom Nodes

User-defined reusable nodes with custom:
- Fields and parameters
- Code generation templates
- Categories for organization

Note: The template engine supports built-in operations, but the catalog and specific operations are defined in the workflow JSON files. Refer to the `templateEngine.js` file for details on code generation capabilities.

## CLI via Lazi Preset

When you run `lazi setup scriptbuilder`, it registers these commands:

**Core Commands:**
- `scriptbuilder` - Main CLI entry point
- `scriptbuilder-list` - List all workflows
- `scriptbuilder-show` - Show workflow details
- `scriptbuilder-create` - Create new workflow
- `scriptbuilder-delete` - Delete workflow
- `scriptbuilder-generate` - Generate script from workflow
- `scriptbuilder-run` - Execute workflow

**Node Management:**
- `scriptbuilder-add-node` - Add node to workflow
- `scriptbuilder-connect` - Connect two nodes
- `scriptbuilder-disconnect` - Disconnect two nodes
- `scriptbuilder-node-list` - List custom nodes
- `scriptbuilder-node-show` - Show custom node details
- `scriptbuilder-node-delete` - Delete custom node
- `scriptbuilder-node-create` - Create new custom node

**Usage:**
```bash
# Via Lazi
lazi run scriptbuilder-list
lazi run scriptbuilder-create my-workflow
lazi run scriptbuilder-run my-workflow

# Or directly
node scriptbuilder/cli.js list
node scriptbuilder/cli.js run my-workflow
```

## Architecture

### CLI Tool

- **Node.js** - CLI runtime
- **Commander.js** - CLI framework
- **Template Engine** - Code generation from workflow definitions
- **Shared storage** - Uses `~/.lazi/` for workflows and custom nodes

### Storage

**Workflows:** `~/.lazi/workflows/*.json`
```json
{
  "name": "my-workflow",
  "scriptType": "powershell",
  "description": "Description",
  "nodes": [...],
  "edges": [...]
}
```

**Custom Nodes:** `~/.lazi/.lazi-custom-nodes.json`
```json
{
  "customNodes": {...},
  "customCategories": {...}
}
```

**Event Logs:** `~/.lazi/.lazi-log.txt`

## Example Workflows

### Example 1: Backup with Validation

```
1. Check File Exists → /data/database.db
2. If-Else (on existence):
   - True: backup (Lazi command) → /backup/
   - False: Print Output → "Database not found"
3. Print Output → "Backup complete"
```

**Generated PowerShell:**
```powershell
if (Test-Path "/data/database.db") {
  lazi run backup "/backup/"
  Write-Host "Backup complete"
} else {
  Write-Host "Database not found"
}
```

### Example 2: Build and Deploy

```
1. build (Lazi command)
2. test (Lazi command)
3. If-Else (on test result):
   - True: deploy (Lazi command) → production
   - False: Log Message → "Tests failed"
```

**Generated Bash:**
```bash
lazi run build
lazi run test

if [ $? -eq 0 ]; then
  lazi run deploy production
else
  echo "Tests failed" >> deploy.log
fi
```

## Best Practices

1. **Organize with Categories** - Use custom categories in `.lazi-custom-nodes.json` to group related nodes
2. **Test Code Generation** - Create test workflows to verify templates before production use
3. **Use Lazi Commands** - Leverage tested Lazi commands instead of inline shell code
4. **Document with Descriptions** - Add clear descriptions to nodes and workflows in JSON definitions
5. **Review Step Code** - Check execution history with `lazi events` and `lazi event <id>` to verify generated code
6. **Build from History** - Reuse successful steps from past executions with `lazi build --from-steps`
7. **Version Control** - Commit `.lazi-custom-nodes.json` and workflow JSON files

## Troubleshooting

### Custom nodes not appearing

- Check `~/.lazi/.lazi-custom-nodes.json` exists and is valid JSON
- Ensure node has required fields: `id`, `name`, `category`, `generators`

### Lazi commands not loading in workflows

- Verify Lazi is installed: `lazi --version`
- Check Lazi has commands: `lazi list`
- Ensure CLI can execute `lazi list -v`

### Workflows not saving

- Check `~/.lazi/workflows/` directory exists
- Verify write permissions on directory
- Check disk space

### Event logs not showing

- Verify workflows run through `scriptbuilder run` or `lazi run scriptbuilder-run`
- Check `~/.lazi/.lazi-log.txt` exists
- Use `lazi events` to list all events

## Development

### Project Structure

```
scriptbuilder/
├── cli.js                        # CLI tool (main entry point)
├── templateEngine.js             # Template & function compiler
├── scriptbuilder-preset.json     # Lazi preset definition
├── package.json
└── README.md
```

### How It Works

1. **Workflows** are stored as JSON files in `~/.lazi/workflows/`
2. **Custom nodes** are defined in `~/.lazi/.lazi-custom-nodes.json`
3. **Template engine** (`templateEngine.js`) generates PowerShell/Bash code from workflow definitions
4. **CLI** (`cli.js`) provides commands for workflow and node management
5. **Execution** happens through Lazi with event logging to `~/.lazi/.lazi-log.txt`

## License

ISC

## Contributing

Feel free to submit issues and enhancement requests!
