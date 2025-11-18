# CLAUDE.md

This file provides guidance to Claude Code when working with the lazi-core-cli project.

## Project Overview

**Lazi Core-CLI** is a TypeScript-based CLI tool for managing command shortcuts with:
- Command registry with parameterization (`{placeholder}` syntax)
- Automatic execution logging with session tracking
- Ideas/notes system (text, tags-only, and property-based)
- Event-based logging for multi-step operations
- Universal batch execution with `THEN` separator
- Configurable storage location
- Integration with ScriptBuilder workflows via preset system

## Quick Start

```bash
npm install           # Install dependencies
npm run build         # Compile TypeScript (src/ → bin/)
npm link              # Install globally as 'lazi'
npm run dev           # Watch mode for development
```

## Core Features

### 1. Command Registry

Save frequently-used commands with aliases:

```bash
# Add command
lazi add backup "bash backup.sh {target}" -d "Backup files" -t "backup,utility"

# Run with parameter substitution
lazi run backup /data/important

# List commands
lazi list -v

# Show details
lazi show backup

# Delete command
lazi delete backup
```

**Parameter substitution:**
- Auto-extracts `{placeholder}` from command strings
- Supports positional: `lazi run cmd arg1 arg2`
- Supports named: `lazi run cmd param1=value1 param2=value2`

### 2. Quick Commands & Logging

Run ad-hoc commands with automatic logging:

```bash
lazi quick "echo Hello World"
# Output: [Logged as Log-123]

# View logs
lazi logs -n 10
lazi logs --search "echo"
lazi logs --session 12345

# Rerun from logs
lazi rerun 123
```

**All executions are automatically logged** with:
- Unique log ID
- Timestamp
- Session info (PID, user, hostname, working directory, shell)
- Exit code
- stdout/stderr

### 3. Batch Execution

Chain multiple commands with `THEN` separator:

```bash
# Add command and run it immediately
lazi add demo "echo {msg}" -d "Demo" THEN run demo "Hello!"

# Multi-step workflows
lazi quick "echo Step 1" THEN quick "echo Step 2" THEN quick "echo Step 3"

# Mixed command types
lazi idea add "Testing batch" -t "test" THEN logs -n 5 THEN events -n 3

# Continue-on-error behavior
lazi quick "echo Success 1" THEN show nonexistent THEN quick "echo Success 2"
# All 3 commands execute, summary shows 2/3 successful
```

**Batch features:**
- Works with ANY lazi command
- Continue-on-error (failed commands don't stop execution)
- Event-based logging (EVENT-START, STEP entries, EVENT-END)
- Full session tracking
- View with `lazi event <id>`

### 4. Ideas/Notes System

Three types of ideas for organizing information:

**Text ideas:**
```bash
lazi idea add "Remember to test thoroughly" -t "reminder,important"
lazi idea add "This needs review" --command backup
lazi idea add "Error at 3pm" --log 123 --type output
```

**Tags-only ideas:**
```bash
lazi idea add -t "urgent,review,important"
```

**Property ideas:**
```bash
lazi idea add-prop Server=production-01
lazi idea add-prop Port=8080 --command backup
```

**Manage ideas:**
```bash
lazi idea list
lazi idea list --command-level
lazi idea list --log-level
lazi idea delete 10 11 12  # Multi-delete
```

### 5. Promote Command

Convert logged commands to saved registry entries:

```bash
# Run ad-hoc command
lazi quick "echo Hello {name}"
# [Logged as Log-475]

# Promote to saved command
lazi promote 475 greet -d "Greet someone" -t "greeting"
# Detected parameters: name

# Now use as regular command
lazi run greet Claude
```

### 6. Configurable Storage

Lazi uses configurable storage with sensible defaults:

**Default location:** `~/.lazi/`

**Commands:**
```bash
# View current configuration
lazi config

# Migrate to custom location
lazi migrate-storage /path/to/storage

# Reset to default
lazi migrate-storage --reset
```

**How it works:**
- Default: `~/.lazi/` (no config file needed)
- Custom: Creates `~/.lazi-config.json` with `storageDir` setting
- Auto-creates workflows subdirectory

### 7. Event-Based Logging

For multi-step operations (batch execution, ScriptBuilder workflows):

**Event structure:**
- **EVENT-START**: Metadata (total commands/steps, session info)
- **STEP logs**: One per command/step (exit code, status)
- **EVENT-END**: Summary (successes, failures, duration)

**View events:**
```bash
lazi events -n 10
lazi event 567
```

**Rerun events:**
```bash
lazi rerun 567  # Re-execute entire batch or workflow
```

### 8. Preset System

Quick setup of tool integrations:

```bash
# Set up ScriptBuilder integration
lazi setup scriptbuilder
# Registers 14 scriptbuilder-* commands

# Remove integration
lazi setup scriptbuilder --remove
# Deletes all scriptbuilder-* commands
```

**How it works:**
- Preset files define commands with `{TOOL_PATH}` placeholder
- Auto-discovery checks multiple paths
- Commands tagged with `source` field for bulk operations
- Clean removal preserves other commands

## Architecture

### File Structure

```
lazi-core-cli/
├── src/
│   ├── index.ts          # CLI interface (Commander.js)
│   ├── config.ts         # Storage configuration management
│   ├── registry.ts       # Command CRUD operations
│   ├── logger.ts         # Execution logging
│   ├── ideas.ts          # Ideas/notes management
│   └── types.ts          # TypeScript interfaces
├── bin/                  # Compiled JavaScript
├── package.json
├── tsconfig.json
├── CLAUDE.md
└── README.md
```

### Storage Location

**Default:** `~/.lazi/`

**Files:**
- `.lazi.json` - Command definitions
- `.lazi-log.txt` - Execution logs
- `.lazi-ideas.txt` - Ideas/notes
- `.lazi-counter.txt` - Log ID counter
- `.lazi-idea-counter.txt` - Idea ID counter
- `.lazi-custom-nodes.json` - ScriptBuilder custom nodes
- `workflows/` - ScriptBuilder workflow JSONs

**Config file:** `~/.lazi-config.json` (only when using custom location)

### Storage Format

**Commands (.lazi.json):**
```json
{
  "commands": {
    "backup": {
      "name": "backup",
      "command": "bash backup.sh {target}",
      "description": "Backup files",
      "tags": ["backup", "utility"],
      "parameters": ["target"],
      "source": "scriptbuilder-preset",
      "createdAt": "2025-11-17T...",
      "updatedAt": "2025-11-17T..."
    }
  }
}
```

**Logs (.lazi-log.txt):**
```
[Log-123] [11/17/2025, 5:00:00 PM] backup (bash backup.sh /data)
Session: 12345 | user@host | /working/dir
Shell: /bin/bash
Exit Code: 0
Output:
Backup complete!
Errors:

---
```

**Event logs (batch/workflow):**
```
[Log-567] [timestamp] EVENT-START: Batch Execution
Event-Type: batch-start
Total-Commands: 3
Session: 12345 | user@host | /working/dir
Shell: /bin/bash
---
[Log-568] [timestamp] STEP-1: add
Event-Type: batch-step
Parent-Event: 567
Command: add demo "echo test"
Exit-Code: 0
Status: Success
---
[Log-569] [timestamp] EVENT-END: Batch Execution
Event-Type: batch-end
Parent-Event: 567
Total-Commands: 3
Successful: 3
Failed: 0
Duration: 2.45s
---
```

**Ideas (.lazi-ideas.txt):**
```
[Idea-18] [timestamp]
Text: Remember to backup before deployments
Tags: reminder, important
---
[Idea-19] [timestamp]
Tags: urgent, review
Attached-To: Command[backup]
---
[Idea-20] [timestamp]
Server: production-01
Attached-To: Log-123 (output)
---
```

## Key Implementation Details

### Batch Execution System

**Location:** `src/index.ts` (lines ~1360-1520)

**How it works:**
1. Intercepts `process.argv` BEFORE Commander.js parsing
2. Splits on `THEN` separator: `splitBatchCommands(args)`
3. For each batch:
   - Spawns new Node process: `spawn(process.execPath, [__filename, ...batch])`
   - Uses `__filename` to bypass npm wrapper symlink
   - Captures exit code and tracks success/failure
4. Creates event logs (EVENT-START, STEPs, EVENT-END)
5. Continue-on-error: all commands execute regardless of failures
6. Only calls `program.parse()` if NOT in batch mode

**Key code:**
```typescript
const commandBatches = splitBatchCommands(rawArgs);

if (commandBatches.length > 1) {
  (async () => {
    const eventId = logger.writeBatchStart(commandBatches.length, sessionInfo);

    for (let i = 0; i < commandBatches.length; i++) {
      const batch = commandBatches[i];
      await new Promise<void>((resolve) => {
        const child = spawn(process.execPath, [__filename, ...batch], {
          stdio: 'inherit'
        });
        child.on('close', (exitCode) => {
          logger.writeBatchStep(eventId, i+1, batch[0], batch.join(' '), {
            exitCode: exitCode || 0,
            success: exitCode === 0
          });
          resolve();
        });
      });
    }

    logger.writeBatchEnd(eventId, stats);
    process.exit(failureCount > 0 ? 1 : 0);
  })();
}
```

### Configuration System

**Location:** `src/config.ts`

```typescript
export class Config {
  private static CONFIG_FILE = path.join(os.homedir(), '.lazi-config.json');
  private static DEFAULT_STORAGE_DIR = path.join(os.homedir(), '.lazi');

  static getStorageDir(): string {
    // Reads from config file if exists, otherwise returns default
  }

  static setStorageDir(dir: string): void {
    // Only creates config file if path is non-default
  }

  static ensureStorageDir(): void {
    // Creates storage dir and workflows subdirectory
  }
}
```

### Parameter Substitution

**Location:** `src/registry.ts`

**Extraction:**
```typescript
extractParameters(command: string): string[] {
  const regex = /\{([^}]+)\}/g;
  const params: string[] = [];
  let match;
  while ((match = regex.exec(command)) !== null) {
    params.push(match[1]);
  }
  return params;
}
```

**Substitution:**
```typescript
substituteParameters(command: string, params: Record<string, string>): string {
  let result = command;
  for (const [key, value] of Object.entries(params)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }
  return result;
}
```

### Session Tracking

**Location:** `src/logger.ts`

Captures session context for every execution:
```typescript
const sessionInfo = {
  sessionId: process.ppid?.toString() || process.pid.toString(),
  workingDir: process.cwd(),
  user: os.userInfo().username,
  hostname: os.hostname(),
  shell: process.env.SHELL || process.env.ComSpec || 'unknown'
};
```

### ID Generation

**Location:** `src/logger.ts`, `src/ideas.ts`

Counter-based IDs:
```typescript
private getNextLogId(): number {
  const counterFile = path.join(Config.getStorageDir(), '.lazi-counter.txt');
  let counter = 1;

  if (fs.existsSync(counterFile)) {
    counter = parseInt(fs.readFileSync(counterFile, 'utf-8').trim(), 10) + 1;
  }

  fs.writeFileSync(counterFile, counter.toString(), 'utf-8');
  return counter;
}
```

## ScriptBuilder Integration

Lazi integrates with ScriptBuilder CLI for visual workflow automation.

### Preset Setup

```bash
# One-time setup
lazi setup scriptbuilder
# Registers 14 scriptbuilder-* commands

# Use via lazi
lazi run scriptbuilder-list
lazi run scriptbuilder-create my-workflow

# Or use ScriptBuilder CLI directly
node scriptbuilder/cli.js list
```

### Shared Storage

Both tools use the same storage location:
- Custom nodes: `~/.lazi/.lazi-custom-nodes.json`
- Workflows: `~/.lazi/workflows/`
- Event logs: `~/.lazi/.lazi-log.txt`

### Log-Based Nodes

ScriptBuilder can use commands directly from log history:

```bash
# Run a command
lazi quick "npm install"
# [Logged as Log-510]

# Add that exact command to workflow
node scriptbuilder/cli.js add-node my-flow --log 510

# Generated code: npm install
```

## Testing

```bash
# Basic functionality
lazi add test "echo {msg}" -d "Test command" -t "test"
lazi run test "Hello World"
lazi show test
lazi delete test

# Quick commands and promotion
lazi quick "echo Testing"
lazi logs -n 1
lazi promote <log-id> promoted-cmd -d "Promoted command"

# Ideas (all three types)
lazi idea add "Text idea" -t "tag1,tag2"
lazi idea add -t "tag-only,urgent"
lazi idea add-prop Server=prod-01

# Batch execution
lazi add cmd1 "echo 1" THEN add cmd2 "echo 2" THEN list
lazi quick "echo A" THEN quick "echo B" THEN logs -n 2

# Batch with errors (continue-on-error)
lazi quick "echo Success" THEN show nonexistent THEN quick "echo Done"

# Event viewing
lazi events -n 5
lazi event <id>
lazi rerun <event-id>

# Storage configuration
lazi config
lazi migrate-storage /custom/path
lazi migrate-storage --reset

# Preset system
lazi setup scriptbuilder
lazi setup scriptbuilder --remove
```

## Common Modifications

### Adding New Commands

1. Add command to `src/index.ts`:
```typescript
program
  .command('mycommand')
  .description('Description')
  .argument('<arg>', 'Argument description')
  .option('-f, --flag', 'Flag description')
  .action((arg, options) => {
    // Implementation
  });
```

2. Use existing modules: `registry`, `logger`, `ideasManager`, `Config`
3. Rebuild: `npm run build`

### Adding Variadic Arguments

Use `...` suffix for multiple arguments:
```typescript
program
  .command('delete')
  .argument('<names...>', 'Command names to delete')
  .action((names) => {
    // names is an array
    names.forEach(name => registry.deleteCommand(name));
  });
```

### Extending Storage

**JSON files (registry):**
- Update interfaces in `types.ts`
- Modify load/save methods in `registry.ts`
- Use `Config.getStorageDir()` for paths

**Text files (logs/ideas):**
- Update format strings in `logger.ts` or `ideas.ts`
- Maintain `---\n` separator for entries
- Use getter functions for file paths

## Dependencies

- **commander**: CLI framework
- **chalk**: Terminal colors
- **Node built-ins**: fs, path, os, child_process

TypeScript compiled to CommonJS (ES2020 target).

## Troubleshooting

**"Command not found" after npm link:**
```bash
npm unlink -g lazi-core-cli
cd lazi-core-cli
npm link
```

**Batch execution not working:**
- Ensure using `THEN` separator (not `&&` - shell interprets that)
- Check that `npm run build` completed successfully
- Verify `__filename` points to `bin/index.js`

**Parameters not substituting:**
- Ensure command uses `{placeholder}` syntax
- Check parameter names match: `{target}` not `{Target}`
- Verify command exists: `lazi show <name>`

**Logs not appearing:**
- Check storage location: `lazi config`
- Check `~/.lazi/.lazi-log.txt` exists
- Don't use `--no-log` flag unless intended
- Verify file permissions

**Storage location issues:**
- View config: `lazi config`
- Reset to default: `lazi migrate-storage --reset`
- Ensure target directory has write permissions

## Development Tips

- Use `npm run dev` for watch mode during development
- Test with `npm link` before committing
- Log format uses `---\n` as separator - maintain consistency
- All IDs are auto-generated from counter files - never hardcode
- Session tracking is automatic - leverage it for debugging
- Batch execution uses same logging as ScriptBuilder for consistency
- Storage paths use `Config.getStorageDir()` - never hardcode paths
- Config file only created when needed - reduces clutter
