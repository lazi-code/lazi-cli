# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is the **App** repository, which contains a command management and automation ecosystem. The main components are:

- **lazi-core-cli/** - Core CLI tool for managing and executing command shortcuts
- **scriptbuilder/** - CLI tool for composing PowerShell and Bash scripts using JSON workflow definitions

Each subdirectory has its own README.md and/or CLAUDE.md with detailed documentation. This file provides high-level guidance for working across the entire repository.

## Quick Start

### Building and Installing

```bash
# Build and install Lazi Core-CLI
cd lazi-core-cli
npm install
npm run build
npm link  # Installs globally as 'lazi'

# Install scriptbuilder dependencies
cd ../scriptbuilder
npm install
```

### Common Development Commands

**lazi-core-cli:**
```bash
cd lazi-core-cli
npm run build        # Compile TypeScript (src/ → bin/)
npm run dev          # Watch mode for development
npm link             # Install globally
```

**scriptbuilder:**
```bash
cd scriptbuilder
node cli.js list     # List workflows
node cli.js run <workflow-name>  # Run a workflow
```

### Running Tests

Currently, both projects have placeholder test scripts:
```bash
npm test  # Shows "No tests yet" message
```

## Key Concepts

The repository implements an integrated ecosystem where tools work together through command registration, event-based logging, and shared storage.

## Components

This repository contains two main tools:

1. **lazi-core-cli/** - Core CLI tool ("lazi" command) for managing and executing command shortcuts with logging and batch execution
2. **scriptbuilder/** - CLI tool for composing PowerShell and Bash scripts using JSON workflow definitions with Lazi integration

## Architecture Highlights

### Configurable Storage (lazi-core-cli)

Lazi uses a configurable storage system:

**Default Location:** `~/.lazi/`

**Configuration:**
- Config file: `~/.lazi-config.json` (only created when using non-default location)
- Commands: `lazi config` (view), `lazi migrate-storage` (change location)

**Storage Files:**
- `.lazi.json` - Command definitions
- `.lazi-log.txt` - Execution logs
- `.lazi-ideas.txt` - Ideas/notes
- `.lazi-counter.txt` - Log ID counter
- `.lazi-idea-counter.txt` - Idea ID counter
- `.lazi-custom-nodes.json` - ScriptBuilder custom nodes
- `workflows/` - ScriptBuilder workflow JSON files

### Batch Execution System (lazi-core-cli)

Lazi implements a sophisticated batch execution system that allows chaining commands with the `THEN` separator:

**Location:** `lazi-core-cli/src/index.ts` (lines ~1360-1520)

**How it works:**
1. Intercepts `process.argv` BEFORE Commander.js parsing
2. Splits on `THEN` separator using `splitBatchCommands(args)`
3. Spawns separate Node processes for each batch using `__filename` to bypass npm wrapper
4. Creates event logs (EVENT-START, STEPs, EVENT-END) for tracking
5. Continue-on-error behavior: all commands execute even if some fail

**Example:**
```bash
lazi add demo "echo test" THEN run demo THEN logs -n 5
```

### Integration: lazi ↔ scriptbuilder

**Shared Storage:**
- Custom nodes: `~/.lazi/.lazi-custom-nodes.json`
- Workflows: `~/.lazi/workflows/`
- Event logs: `~/.lazi/.lazi-log.txt`

**ScriptBuilder CLI:**
- Uses Lazi commands as nodes via `lazi list -v`
- Creates/manages custom nodes through shared storage file
- Executes scripts with Lazi event logging
- Stores step code in event logs for reuse

**Single Source of Truth:**
ScriptBuilder reads `.lazi-custom-nodes.json` from the shared storage:
```
~/.lazi/.lazi-custom-nodes.json
    ├── ScriptBuilder CLI (via fs.readFileSync)
    └── Lazi CLI (via Config.getStorageDir())
```

### Session Tracking (lazi-core-cli)

Every command execution captures rich session context:

**Location:** `lazi-core-cli/src/logger.ts`

```typescript
const sessionInfo = {
  sessionId: process.ppid?.toString() || process.pid.toString(),
  workingDir: process.cwd(),
  user: os.userInfo().username,
  hostname: os.hostname(),
  shell: process.env.SHELL || process.env.ComSpec || 'unknown'
};
```

This enables filtering logs by session, tracking command history per terminal session, and debugging execution context issues.

### Event-Based Logging

Multi-step operations (batch execution, workflow runs) create structured event logs:

**Structure:**
- **EVENT-START**: Metadata (total steps, script type, session info, full script content)
- **STEP logs**: One per step with generated code (PowerShell/Bash)
- **EVENT-END**: Results (exit code, stdout, stderr, duration)

**Benefits:**
- Group related executions together
- Track workflow progress step-by-step
- Rerun entire events with `lazi rerun <event-id>`
- Build new scripts from successful steps

## Directory Structure

```
App/
├── lazi-core-cli/            [CORE CLI TOOL]
│   ├── src/                  [TypeScript source]
│   ├── bin/                  [Compiled JavaScript]
│   ├── package.json
│   ├── tsconfig.json
│   ├── CLAUDE.md             [Lazi-specific docs]
│   └── README.md
│
├── scriptbuilder/            [CLI SCRIPT BUILDER]
│   ├── cli.js                [CLI tool for workflow & node management]
│   ├── templateEngine.js     [Template & function compiler]
│   ├── scriptbuilder-preset.json  [Preset for lazi setup command]
│   ├── package.json
│   ├── README.md
│   └── node_modules/
│
└── CLAUDE.md                 [This file - repository overview]
```

## 1. lazi-core-cli (Core CLI)

### Purpose
Command registry and execution engine with parameterization, logging, and session tracking.

### Key Features
- **Command Shortcuts**: Save frequently used commands with aliases
- **Parameterization**: `{placeholder}` syntax for dynamic values
- **Automatic Logging**: All executions logged with session context
- **Event-Based Logging**: Group multi-step operations with EVENT-START, STEP, and EVENT-END entries
- **Ideas/Notes System**: Attach notes to commands or specific executions
- **Batch Execution**: Chain commands with `THEN` separator
- **Configurable Storage**: Default `~/.lazi/` or custom location
- **Preset System**: Quick setup of tool integrations (e.g., ScriptBuilder)

### Installation
```bash
cd lazi-core-cli
npm install
npm run build
npm link  # Installs globally as 'lazi'
```

### Core Commands
```bash
lazi add <name> "<command>" -d "description" -t "tags"
lazi list [-v]
lazi run <name> [params...]
lazi quick <command> [args...]   # Run ad-hoc command with logging
lazi rerun <log-id> [params...]  # Re-execute from logs (supports events and param override)
lazi show <name>
lazi delete <name>
lazi logs [-n count] [--search query] [--session id]
lazi events [-n count]           # List script execution events
lazi event <id>                  # View specific event details
lazi idea add "text" [--command name] [--log id]
lazi config                      # View storage configuration
lazi migrate-storage [path]      # Change storage location
lazi setup <tool> [--remove]     # Set up tool integrations
```

### Preset System

Lazi includes a preset system for quick setup of tool integrations:

```bash
# Set up ScriptBuilder integration
lazi setup scriptbuilder
# Registers 14 scriptbuilder-* commands

# Remove ScriptBuilder integration
lazi setup scriptbuilder --remove
# Deletes all scriptbuilder-* commands
```

**How it works:**
- Preset files define commands with `{TOOL_PATH}` placeholder
- Auto-discovery checks multiple paths to find preset files
- Commands tracked with `source` field for clean bulk removal

**ScriptBuilder Preset Commands:**
All commands use consistent `scriptbuilder-` prefix:
- scriptbuilder (main CLI entry)
- scriptbuilder-list, scriptbuilder-show, scriptbuilder-create, scriptbuilder-delete
- scriptbuilder-generate, scriptbuilder-run
- scriptbuilder-add-node, scriptbuilder-connect, scriptbuilder-disconnect
- scriptbuilder-node-list, scriptbuilder-node-show, scriptbuilder-node-delete, scriptbuilder-node-create

## 2. scriptbuilder (CLI Workflow Tool)

### Purpose
CLI tool for creating PowerShell and Bash scripts using JSON workflow definitions with integrated access to Lazi commands.

### Key Features
- **Dual script support** - Generate PowerShell or Bash scripts from the same workflow definition
- **Lazi integration** - Use your registered commands as workflow steps
- **Workflow management** - Create, list, show, delete, and run workflows
- **Custom Node Creation** - Build reusable nodes with complete control over fields and code generation
- **Execution History** - Browse past executions with `lazi events` and build new scripts from steps
- **Template Engine** - Flexible code generation supporting templates and JavaScript functions
- **Shared Storage** - Uses `.lazi-custom-nodes.json` and `~/.lazi/workflows/` for data

### Installation
```bash
cd scriptbuilder
npm install
```

### CLI Usage

**Workflow Management:**
```bash
scriptbuilder create <name> [-t powershell|bash] [-d "description"]
scriptbuilder list
scriptbuilder show <name>
scriptbuilder delete <name>
scriptbuilder run <name>
scriptbuilder generate <name> [-o output.ps1]
```

**Custom Node Management:**
```bash
scriptbuilder node list [-c category] [-v]
scriptbuilder node show <id>
scriptbuilder node delete <id>
```

**Build from Steps:**
```bash
# View step details and code
lazi step <log-id>

# View event with all step codes
lazi event <id> --with-code

# Build script from multiple steps
lazi build --from-steps <ids> [--type powershell|bash] [-o output.ps1] [--name "Script Name"]
```

### Lazi Integration

**How it works:**
1. ScriptBuilder can use commands from Lazi registry as workflow steps
2. Parameters from Lazi commands are defined in the JSON workflow definition
3. Generated scripts include `lazi run <name> [params]` commands
4. Execution logs are stored in Lazi with event-based structure

**Example workflow:**
```bash
# 1. Register a command in Lazi
lazi add backup "bash backup.sh {target}"

# 2. Add it to a ScriptBuilder workflow
scriptbuilder add-node my-workflow --command backup

# 3. Generated PowerShell script includes:
lazi run backup "/data/important"

# 4. Generated Bash script includes:
lazi run backup "/data/important"
```

## Data Files (Storage)

### Configuration File
**Location:** `~/.lazi-config.json` (only created when using non-default location)
**Format:** JSON object with `storageDir` property
```json
{
  "storageDir": "/custom/path/to/storage"
}
```

### Command Registry
**Location:** `~/.lazi/.lazi.json`
**Format:** JSON object with `commands` property
```json
{
  "commands": {
    "name": {
      "name": "string",
      "command": "string",
      "description": "string?",
      "tags": "string[]?",
      "parameters": "string[]?",
      "source": "string?",
      "createdAt": "ISO date",
      "updatedAt": "ISO date"
    }
  }
}
```

### Custom Nodes
**Location:** `~/.lazi/.lazi-custom-nodes.json`
**Format:** JSON object with `customNodes` and `customCategories` properties
**Used By:** ScriptBuilder for custom node definitions and categories

### Execution Logs
**Location:** `~/.lazi/.lazi-log.txt`
**Format:** Text file with `---\n` separators
**Entry Structure:**
```
[Log-N] [timestamp] commandName (actualCommand)
Session: PID | user@host | workingDir
Shell: shellPath
Exit Code: number
Output:
stdout content
Errors:
stderr content
---
```

### Ideas/Notes
**Location:** `~/.lazi/.lazi-ideas.txt`
**Format:** Text file with `---\n` separators

## Common Workflows

### Workflow: Adding a New Command

```bash
# Simple command
lazi add ports "lsof -i -P | grep LISTEN" -d "Show listening ports" -t "network"

# Parameterized command
lazi add deploy "bash deploy.sh {environment} {version}" -d "Deploy to environment" -t "deployment"

# Run it
lazi run deploy production v2.1.0

# Review logs
lazi logs -n 5
```

### Workflow: Setting Up ScriptBuilder

```bash
# One-time setup
lazi setup scriptbuilder

# Now use scriptbuilder commands via Lazi
lazi run scriptbuilder-list
lazi run scriptbuilder-create my-workflow
lazi run scriptbuilder-run my-workflow

# Or use ScriptBuilder CLI directly
node scriptbuilder/cli.js list
```

### Workflow: Building Scripts from History

```bash
# Run some commands
lazi quick "echo Step 1"
lazi quick "echo Step 2"
lazi quick "echo Step 3"

# View events
lazi events -n 5

# View specific event with step codes
lazi event 190 --with-code

# Build new script from specific steps
lazi build --from-steps 248,249,252 -o my-script.ps1 --name "Combined Script"
```

## Development & Maintenance

### Building Lazi
```bash
cd lazi-core-cli
npm run build        # Compile TypeScript
npm run dev          # Watch mode
```

### Debugging
```bash
# View recent logs
lazi logs -n 50

# Search for errors
lazi logs --search "Error"

# Check specific session
lazi logs --session <PID>

# View storage configuration
lazi config
```

## Best Practices

1. **Command Naming**
   - Use lowercase with hyphens: `kill-server`, `backup-db`
   - Prefix by category if many commands: `db-backup`, `db-restore`
   - Use descriptive tags for searchability

2. **Parameter Usage**
   - Use meaningful parameter names: `{environment}` not `{env}`
   - Document required parameters in description
   - Attach ideas with usage examples

3. **Storage Location**
   - Default `~/.lazi/` works for most use cases
   - Use custom location for shared team storage or specific project needs
   - Migrate with `lazi migrate-storage /path/to/location`

4. **Logging & Ideas**
   - Attach ideas to commands for static notes (prerequisites, warnings)
   - Attach ideas to logs for execution-specific observations
   - Use tags to categorize ideas for searching

5. **ScriptBuilder Integration**
   - Use `lazi setup scriptbuilder` for quick setup
   - Access commands via `lazi run scriptbuilder-*` or directly via `node cli.js`
   - Build new scripts from successful workflow steps using `lazi build --from-steps`

## Troubleshooting

### "Command not found" after npm link
```bash
# Unlink and relink
npm unlink -g lazi-core-cli
cd lazi-core-cli
npm link
```

### Storage file issues
```bash
# View current configuration
lazi config

# View storage files
ls -la ~/.lazi/

# Migrate to new location if needed
lazi migrate-storage /new/path

# Reset to default
lazi migrate-storage --reset
```

## Summary

The App ecosystem provides a comprehensive command management and automation solution:
- **lazi-core-cli**: Command storage, execution, logging, batch operations
- **scriptbuilder**: CLI-based workflow builder with JSON definitions and Lazi integration

Together, they enable powerful workflows for command automation, scripting with custom operations, and execution history management.
