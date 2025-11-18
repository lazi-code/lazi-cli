# Script Builder

A visual editor for composing PowerShell (.ps1) and Bash (.sh) scripts using a node-based interface, with full CLI support for workflow and custom node management.

## Features

- **Visual canvas** powered by React Flow with pan/zoom, minimap, and smooth connections
- **Dual script support** - Generate PowerShell or Bash scripts from the same visual workflow
- **Lazi integration** - Access your registered commands as nodes and run scripts through Lazi with event logging
- **Custom node creation** - Build your own reusable nodes with complete control over fields, branching, and code generation
- **Execution History** - Browse past executions, view step code, build new scripts from selected steps, and run combined scripts
- **Run Script functionality** - Execute scripts directly from the UI with Lazi event logging
- **Rich operation catalog** - 28+ custom nodes grouped by category:
  - **Lazi** - Your registered Lazi commands (dynamically loaded)
  - **Custom** - Your custom-built nodes (user-defined categories)
  - **Input** - Read files, get user input, list files
  - **Processing** - String manipulation, run commands, loops over arrays
  - **Control Flow** - If-else conditionals, loops, switch-case, parallel execution
  - **Validation** - File existence checks, string validation, numeric comparisons
  - **Output** - Write files, print output, send emails
  - **Error Handling** - Try-catch blocks, logging, exit scripts
- **Smart form controls** that adapt to field types (text, number, select, boolean, textarea)
- **Live script preview** with copy and download functionality
- **Real code generation** - Step logs contain actual PowerShell/Bash code, not placeholders
- **Tree-based code generation** with support for branching and nested structures
- **Multiple output handles** for conditional branching (if-else, switch-case, loops, parallel execution)
- **Full CLI support** - Complete parity with GUI for workflow and node management

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

## Using the Script Builder GUI

1. **Select script type** - Choose PowerShell (.ps1) or Bash (.sh) using the radio buttons in the header
2. **Add operations** - Click items from the left palette to place nodes on the canvas
3. **Connect operations** - Drag from a node handle to another to define execution order
4. **Configure nodes** - Select any node to edit its options in the inspector panel
5. **Preview script** - The generated script appears in the inspector with syntax appropriate for the selected script type
6. **Export** - Use the "Copy" button to copy the script to your clipboard, or "Download" to save as .ps1 or .sh file
7. **Run Script** - Use the green "▶ Run Script" button to execute the script directly with Lazi event logging
8. **View History** - Click "📜 History" to browse past executions, view step code, and build new scripts from steps

## Execution History Modal

The Execution History modal provides powerful features for reviewing and reusing past workflow executions:

### Features

- **Browse Past Executions** - View all workflow runs with metadata (name, type, steps, timestamp)
- **View Step Code** - See the actual PowerShell or Bash code generated for each step
- **Multi-Select Steps** - Select steps from one or multiple different executions
- **Build Combined Scripts** - Combine selected steps into a new executable script
- **Run Combined Scripts** - Execute built scripts directly with event logging
- **Copy & Download** - Export combined scripts to clipboard or file

### Usage

1. Click the **"📜 History"** button in the header
2. **Select an event** from the left panel to view its steps
3. **Click a step** to view its generated code in the right panel
4. **Check multiple steps** to enter build mode
5. **Configure build options** (script type, name)
6. **Click "🔨 Build Script"** to combine selected steps
7. **Click "▶ Run Script"** to execute the combined script

### Build from Steps

The "Build from Steps" feature allows you to create new scripts by combining code from multiple workflow steps:

**Use Cases:**
- Reuse successful steps from different executions
- Create script variations by mixing different steps
- Build templates from tested workflow components
- Debug by isolating specific steps

**Workflow:**
1. Check the boxes next to steps you want to include
2. Click **"Build from Selected Steps"**
3. Choose script type (PowerShell or Bash)
4. Enter a script name
5. Preview the combined script in the code viewer
6. **Run**, **Copy**, or **Download** the result

**Example:**
```bash
# From Lazi CLI
lazi build --from-steps 248,249,252 -o combined.ps1 --name "Combined Workflow"
```

## Lazi Integration

ScriptBuilder integrates seamlessly with Lazi Core-CLI:

### Using Lazi Commands as Nodes

1. Register commands in Lazi:
```bash
lazi add backup "bash backup.sh {target}" -d "Backup files"
lazi add deploy "bash deploy.sh {env}" -d "Deploy to environment"
```

2. These commands automatically appear as nodes in ScriptBuilder's "Lazi" category

3. Configure parameters in the node inspector

4. Generated script includes `lazi run` commands:
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

Create your own reusable nodes with complete control over fields, outputs, and code generation.

### Creating a Custom Node

1. Click **"+ Create Custom Node"** button (GUI) or use CLI
2. Configure across 5 tabs:
   - **Basic Info** - Name, category, description, tags
   - **Fields** - Add configurable form fields (text, number, select, boolean, textarea)
   - **Branching** - Add output handles for conditional logic
   - **Code Generation** - Define PowerShell and Bash code templates or functions
   - **Preview** - Review configuration before creating

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

Organize nodes with custom categories:
- Assign custom colors for visual distinction
- Category order determined by creation order
- Cannot delete categories with nodes using them

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

## Operation Catalog

### Lazi Commands

Your registered Lazi commands dynamically loaded from `lazi list -v`:

- Appear in "Lazi" category (yellow badge)
- Parameters become form fields
- Generated code: `lazi run <name> [params]`

### Custom Nodes

Your custom-built nodes with user-defined categories and colors.

### Input Operations

- **Read File** - Read file contents into variable
- **Get User Input** - Prompt user for input
- **List Files** - Get list of files in directory

### Processing Operations

- **Run Command** - Execute shell command
- **String Replace** - Replace text in strings
- **String Split** - Split string into array
- **Loop Over Array** - Iterate over array elements

### Control Flow Operations

- **If-Else** - Conditional branching (true/false paths)
- **While Loop** - Repeat while condition is true
- **For Loop** - Iterate over numeric range
- **Switch-Case** - Branch on multiple values (up to 3 cases + default)
- **Parallel Execution** - Run multiple branches concurrently
- **Break/Continue** - Loop control statements

### Validation Operations

- **Check File Exists** - Verify file existence
- **Validate String** - Check string matches pattern
- **Compare Numbers** - Numeric comparisons

### Output Operations

- **Print Output** - Display message to console
- **Write File** - Write content to file
- **Append to File** - Append content to file
- **Send Email** - Send email notification (requires mail config)

### Error Handling Operations

- **Try-Catch** - Error handling blocks
- **Log Message** - Write to log file
- **Exit Script** - Terminate script with code

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

### Frontend (GUI)

- **React + TypeScript** - UI framework
- **React Flow** - Node-based canvas
- **Vite** - Build tool
- **Port**: 3002 (when GUI is running)

### Backend (Server)

- **Express** - REST API server
- **Endpoints**:
  - `/api/cmdregistry/commands` - Fetch Lazi commands
  - `/api/cmdregistry/events` - List execution events
  - `/api/cmdregistry/event/:id` - Get event details
  - `/api/cmdregistry/step/:logId` - Get step code
  - `/api/scripts/execute` - Execute script with event logging
  - `/api/custom-nodes` - CRUD for custom nodes
  - `/api/custom-categories` - CRUD for custom categories

### CLI

- **Node.js** - CLI runtime
- **Commander.js** - CLI framework
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

1. **Organize with Categories** - Use custom categories to group related nodes
2. **Test Code Generation** - Create test nodes to verify templates before using in workflows
3. **Use Lazi Commands** - Leverage tested Lazi commands instead of inline shell code
4. **Document with Descriptions** - Add clear descriptions to nodes and workflows
5. **Review Step Code** - Check execution history to verify generated code
6. **Build from History** - Reuse successful steps from past executions
7. **Version Control** - Commit `.lazi-custom-nodes.json` and workflow JSONs

## Troubleshooting

### Custom nodes not appearing

- Check `~/.lazi/.lazi-custom-nodes.json` exists and is valid JSON
- Ensure node has required fields: `id`, `name`, `category`, `generators`

### Lazi commands not loading

- Verify Lazi is installed: `lazi --version`
- Check Lazi has commands: `lazi list`
- Ensure server can execute `lazi list -v`

### Workflows not saving

- Check `~/.lazi/workflows/` directory exists
- Verify write permissions on directory
- Check disk space

### Event logs not showing in history

- Verify scripts run through ScriptBuilder (not manually)
- Check `~/.lazi/.lazi-log.txt` exists
- Use `lazi events` to list all events

## Development

### Build GUI

```bash
npm run build  # Builds with Vite to dist/
```

### Run in Development Mode

```bash
npm run dev    # Starts Vite dev server
```

### Project Structure

```
scriptbuilder/
├── ScriptBuilder.tsx              # Main React component
├── ExecutionHistoryModal.tsx     # History browser & build from steps
├── scriptCatalog.ts              # Operation definitions
├── customNodeTypes.ts            # Custom node type definitions
├── templateEngine.ts             # Template compiler (TypeScript)
├── templateEngine.js             # Template compiler (JavaScript for CLI)
├── customNodeLoader.ts           # Custom node loading
├── CustomNodeModal.tsx           # Custom node creation modal
├── cli.js                        # CLI tool
├── server.js                     # Express server
├── scriptbuilder-preset.json     # Lazi preset definition
├── package.json
├── vite.config.ts
├── tsconfig.json
└── README.md
```

## License

ISC

## Contributing

Feel free to submit issues and enhancement requests!
