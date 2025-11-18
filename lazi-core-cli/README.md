# Lazi Core-CLI

A powerful CLI tool to save, manage, and execute your commonly used commands with automatic logging, session tracking, and notes. Never forget those complex commands again!

## Features

- 📝 Save commands with descriptive names
- 🔍 Search and filter commands by name, tags, or description
- ⚡ Execute saved commands instantly
- 🎯 Support for parameterized commands with placeholders
- 🏷️ Organize commands with tags
- 📋 List all commands with detailed information
- ✏️ Edit existing commands
- 📊 Automatic execution logging with session tracking
- 💡 Attach notes to commands and specific executions
- 🔎 Search and filter execution logs
- 🔗 Batch execution with `THEN` separator
- 📁 Configurable storage location
- 🔌 Preset system for tool integrations

## Installation

### Local Installation

```bash
# Clone or navigate to the project directory
cd lazi-core-cli

# Install dependencies
npm install

# Build the project
npm run build

# Link globally
npm link
```

The `lazi` command will now be available globally in your terminal.

### Uninstall

```bash
npm unlink -g lazi-core-cli
```

## Core Usage

### Add a Command

Save a new command to the registry:

```bash
lazi add <name> <command> [options]
```

**Options:**
- `-d, --description <desc>` - Description of the command
- `-t, --tags <tags>` - Comma-separated tags

**Examples:**

```bash
# Simple command
lazi add ports "lsof -i -P | grep LISTEN"

# With description and tags
lazi add docker-clean "docker system prune -af" \
  -d "Clean up Docker system" \
  -t "docker,cleanup,maintenance"

# Parameterized command
lazi add mkfile "touch {filename}" -d "Create a new file"

# Multiple parameters
lazi add gitcommit "git commit -m {message}" -d "Git commit with message"
```

### List Commands

View all saved commands:

```bash
lazi list           # Short format
lazi ls             # Alias for list
lazi list --verbose # Detailed format with metadata
lazi list -v        # Short flag
```

**Output:**
```
Saved Commands (3):

  git-status
    git status -sb

  mkfile [filename]
    touch {filename}

  mvfile [source, dest]
    mv {source} {dest}
```

### Run a Command

Execute a saved command (automatically logged):

```bash
lazi run <name> [params...] [options]
lazi exec <name> [params...]  # Alias
```

**Options:**
- `-s, --show` - Show the command before executing
- `--no-log` - Skip logging this execution

**Examples:**

```bash
# Simple command
lazi run docker-clean
# Output: [Logged as Log-5]

# With show option
lazi run ports --show

# Parameterized command (positional)
lazi run mkfile test.txt

# Parameterized command (named)
lazi run mkfile filename=test.txt

# Multiple parameters (positional)
lazi run mvfile old.txt new.txt

# Skip logging
lazi run ports --no-log
```

### Quick Commands

Run ad-hoc commands with automatic logging (not saved to registry):

```bash
lazi quick <command> [args...]
lazi q <command> [args...]  # Alias
```

**Examples:**

```bash
lazi quick "echo Hello World"
# Output: [Logged as Log-42]

lazi quick "npm install"
lazi quick "git status"
```

### Rerun a Command from Logs

Re-execute any previously logged command by its log ID, optionally with different parameters:

```bash
lazi rerun <log-id> [params...] [options]
lazi replay <log-id> [params...]  # Alias
```

**Options:**
- `-s, --show` - Show the command before executing
- `--no-log` - Skip logging this re-execution

**Examples:**

```bash
# View recent logs to find the ID
lazi logs -n 10

# Rerun a command with same parameters
lazi rerun 150
# Output: Re-running Log-150: mkfile
# [Logged as Log-160]

# Rerun with different parameters (registered commands only)
lazi rerun 150 newfile.txt
# Output: Re-running Log-150 with new parameters

# Show command before running
lazi rerun 150 --show

# Skip logging the rerun
lazi rerun 150 --no-log
```

**How it works:**
- **For registered commands with parameters**: You can provide new parameters to override the originals
- **For quick commands or commands without parameters**: Runs the exact command that was logged
- **For events (ScriptBuilder scripts)**: Re-executes the entire script from the event log
- **Supports both positional and named parameters**: Same syntax as `lazi run`

### Promote Command

Convert a logged command into a saved registry entry:

```bash
lazi promote <log-id> <name> [options]
```

**Options:**
- `-d, --description <desc>` - Description
- `-t, --tags <tags>` - Comma-separated tags

**Examples:**

```bash
# Run an ad-hoc command
lazi quick "echo Hello {name}"
# [Logged as Log-475]

# Promote to saved command
lazi promote 475 greet -d "Greet someone" -t "greeting"
# Detected parameters: name

# Now use as regular command
lazi run greet Claude
```

### Batch Execution

Chain multiple commands with the `THEN` separator:

```bash
lazi <command1> THEN <command2> THEN <command3>
```

**Features:**
- Works with ANY lazi command
- Continue-on-error: all commands execute even if some fail
- Creates event-based logs with EVENT-START, STEP, and EVENT-END entries
- Full session tracking

**Examples:**

```bash
# Add and run in one go
lazi add demo "echo {msg}" -d "Demo" THEN run demo "Hello!"

# Multi-step workflow
lazi quick "echo Step 1" THEN quick "echo Step 2" THEN quick "echo Step 3"

# Mixed command types
lazi idea add "Testing batch" -t "test" THEN logs -n 5 THEN events -n 3

# Continue-on-error
lazi quick "echo Success 1" THEN show nonexistent THEN quick "echo Success 2"
# All 3 commands execute, summary shows 2/3 successful
```

### Search Commands

Find commands by name, description, or tags:

```bash
lazi search <query>
lazi find <query>    # Alias
```

**Examples:**

```bash
lazi search docker
lazi search cleanup
lazi search git
```

### Show Command Details

Display detailed information about a specific command, including attached notes:

```bash
lazi show <name>
```

**Output:**
```
docker-clean

Command:     docker system prune -af
Description: Clean Docker system
Tags:        docker, cleanup

Attached Notes:
  • Requires admin privileges
    Tags: warning, admin
  • May take 5+ minutes on large systems
    Tags: performance

Created:     9/30/2025, 10:52:30 PM
Updated:     9/30/2025, 10:52:30 PM
```

### Edit a Command

Update an existing command:

```bash
lazi edit <name> [options]
```

**Options:**
- `-c, --command <cmd>` - New command string
- `-d, --description <desc>` - New description
- `-t, --tags <tags>` - New comma-separated tags

**Examples:**

```bash
# Update command
lazi edit mkfile -c "touch {filename} && chmod 644 {filename}"

# Update description
lazi edit mkfile -d "Create a new file with 644 permissions"

# Update multiple fields
lazi edit docker-clean \
  -d "Deep clean Docker system" \
  -t "docker,cleanup,maintenance,disk"
```

### Delete a Command

Remove a command from the registry:

```bash
lazi delete <name>
lazi rm <name>       # Alias
```

**Example:**

```bash
lazi delete old-command
```

## Parameterized Commands

Commands can include placeholders using `{parameter}` syntax. These placeholders are automatically detected and can be filled in at runtime.

### Creating Parameterized Commands

```bash
# Single parameter
lazi add mkfile "touch {filename}"

# Multiple parameters
lazi add mvfile "mv {source} {dest}"

# Complex parameters
lazi add docker-exec "docker exec -it {container} {command}"

# With quotes in the command
lazi add gitcommit "git commit -m '{message}'"
```

### Running Parameterized Commands

**Positional Arguments:**
```bash
# Parameters are matched in order
lazi run mkfile test.txt
lazi run mvfile old.txt new.txt
lazi run docker-exec mycontainer bash
```

**Named Arguments:**
```bash
# Explicitly specify parameter names
lazi run mkfile filename=test.txt
lazi run mvfile source=old.txt dest=new.txt
lazi run docker-exec container=mycontainer command=/bin/sh
```

**Parameter Validation:**
If required parameters are missing, you'll get a helpful error:
```bash
$ lazi run mvfile onefile
Missing required parameters: dest

Required parameters: source, dest
Usage: lazi run mvfile <source> <dest>
```

## Execution Logs

Every command execution is automatically logged with rich context including session information.

### View Logs

```bash
lazi logs                    # Show last 20 entries
lazi logs -n 50              # Show last 50 entries
lazi logs --with-ideas       # Include attached ideas
```

**Log Output:**
```
[Log-5] [10/1/2025, 4:50:09 PM] docker-clean (docker system prune -af)
Session: 23488 | user@hostname | /home/user/projects
Shell: /bin/bash
Exit Code: 0
Output:
Total reclaimed space: 2.1GB
---
```

### Search Logs

```bash
# Search by command name or output
lazi logs --search docker

# Filter by session ID
lazi logs --session 23488
```

### Clear Logs

```bash
lazi logs --clear
```

## Event-Based Logging

For complex operations like batch execution or script workflows, Lazi supports **event-based logging** where multiple log entries are grouped together as a single event.

### Event Structure

An event consists of three types of log entries:

1. **EVENT-START** - Initial entry recording event metadata
   - Script name and type
   - Total number of steps
   - Session information

2. **STEP logs** - One entry for each step in the workflow
   - Step number and name
   - Generated code for that specific step
   - Linked to parent event via event ID
   - Metadata only (no execution output)

3. **EVENT-END** - Final entry with complete results
   - Overall exit code
   - Total duration
   - Complete stdout/stderr output
   - Linked to parent event

### Viewing Events

List all script execution events:

```bash
lazi events           # Show last 20 events
lazi events -n 50     # Show last 50 events
```

**Example Output:**
```
Script Execution Events (3):

[Log-190] [1/6/2025, 3:22:15 PM] EVENT-START: Data Processing Workflow
Script-Type: powershell
Total-Steps: 4
---

[Log-195] [1/6/2025, 3:25:40 PM] EVENT-START: File Validation
Script-Type: powershell
Total-Steps: 3
---
```

### View Specific Event

See complete event tree with all steps and results:

```bash
lazi event <id>
lazi event <id> --with-code  # Include step code
```

### View Individual Step Details

View detailed information about a specific workflow step:

```bash
lazi step <log-id>
```

**Example Output:**
```
Step Details for Log-191:

============================================================

Step Number: 1
Step Name: Get User Input
Parent Event: 190

Generated Code:
------------------------------------------------------------
$userInput = Read-Host -Prompt "Enter your name:"
------------------------------------------------------------

View parent event: lazi event 190

============================================================
```

### Build Scripts from Steps

Combine code from multiple workflow steps into a single executable script:

```bash
lazi build --from-steps <step-ids> [options]
```

**Options:**
- `--from-steps <ids>` (required) - Comma-separated step log IDs
- `--type <powershell|bash>` (optional) - Script type, inferred from first step if not specified
- `-o, --output <file>` (optional) - Write to file, prints to stdout if not specified
- `--name <name>` (optional) - Script name for header comment

**Examples:**

```bash
# Print combined script to stdout
lazi build --from-steps 248,249

# Save to file
lazi build --from-steps 191,192,195 -o my-script.ps1

# Override script type to bash
lazi build --from-steps 191,192,195 --type bash -o my-script.sh

# Custom script name
lazi build --from-steps 248,249 --name "Data Processing" -o process.ps1
```

## Ideas & Notes

Attach notes and ideas to commands or specific executions. Notes help you remember important details, warnings, or observations.

### Text Ideas

```bash
# Standalone idea
lazi idea add "Research docker volume cleanup strategies" -t "todo,docker"

# Attached to command
lazi idea add "Requires admin privileges" --command docker-clean -t "warning"

# Attached to log entry
lazi idea add "This freed 2GB of space" --log 5 --type output -t "result"
```

### Tags-Only Ideas

```bash
lazi idea add -t "urgent,review,important"
```

### Property Ideas

```bash
lazi idea add-prop Server=production-01
lazi idea add-prop Port=8080 --command backup
```

### Managing Ideas

**List Ideas:**
```bash
lazi idea list                # All ideas
lazi idea ls                  # Alias

lazi idea list --standalone   # Only unattached ideas
lazi idea list --command-level # Only command-attached
lazi idea list --log-level    # Only log-attached
lazi idea list --attached     # All attached ideas
```

**Search Ideas:**
```bash
lazi idea search docker
lazi idea search warning
```

**Delete Ideas:**
```bash
lazi idea delete 3            # Delete Idea-3
lazi idea delete 10 11 12     # Delete multiple
lazi idea rm 3                # Alias
lazi idea clear               # Delete all ideas
```

## Storage Configuration

Lazi uses configurable storage with sensible defaults.

### View Configuration

```bash
lazi config
```

**Output:**
```
Storage Configuration:

  Storage Directory: C:\Users\user\.lazi
  Using Default: Yes
```

### Migrate Storage

Change storage location:

```bash
# Migrate to custom location
lazi migrate-storage /path/to/storage

# Reset to default (~/.lazi)
lazi migrate-storage --reset
```

**What it does:**
- Copies all files from current to target location
- Updates configuration
- Prompts to delete old storage (optional)

## Preset System

Quick setup of tool integrations.

### Set Up Integration

```bash
lazi setup <tool>
```

**Example:**
```bash
# Set up ScriptBuilder integration
lazi setup scriptbuilder
# Registers 14 scriptbuilder-* commands

# Now use scriptbuilder via lazi
lazi run scriptbuilder-list
lazi run scriptbuilder-create my-workflow
```

### Remove Integration

```bash
lazi setup <tool> --remove
```

**Example:**
```bash
lazi setup scriptbuilder --remove
# Deletes all scriptbuilder-* commands
```

## Storage

### Files Created

All data is stored in the configured location (default: `~/.lazi/`):

- **`.lazi.json`** - Command definitions
- **`.lazi-log.txt`** - Execution logs with session info
- **`.lazi-ideas.txt`** - Ideas and notes
- **`.lazi-counter.txt`** - Log ID counter
- **`.lazi-idea-counter.txt`** - Idea ID counter
- **`.lazi-custom-nodes.json`** - ScriptBuilder custom nodes
- **`workflows/`** - ScriptBuilder workflow JSONs

### Configuration File

**Location:** `~/.lazi-config.json` (only created when using non-default location)

```json
{
  "storageDir": "/custom/path/to/storage"
}
```

### Manual Editing

You can manually edit the registry file if needed:

```bash
# macOS/Linux
nano ~/.lazi/.lazi.json

# Windows
notepad %USERPROFILE%\.lazi\.lazi.json
```

### Backup

To backup your data:

```bash
# macOS/Linux
cp -r ~/.lazi ~/backup/

# Windows
xcopy %USERPROFILE%\.lazi %USERPROFILE%\backup\ /E /I
```

## Command Examples

Here are some useful commands to get you started:

### Git Commands

```bash
lazi add gs "git status -sb" -d "Git status short" -t "git"
lazi add gp "git push" -d "Git push" -t "git"
lazi add gl "git log --oneline --graph -10" -d "Git log graph" -t "git"
lazi add gitco "git checkout {branch}" -d "Git checkout branch" -t "git"
lazi add gitclone "git clone {url}" -d "Git clone repository" -t "git"

# Add helpful notes
lazi idea add "Always check status before committing" --command gs -t "best-practice"
```

### Docker Commands

```bash
lazi add dps "docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'" \
  -d "Docker ps formatted" -t "docker"

lazi add docker-clean "docker system prune -af" \
  -d "Clean Docker system" -t "docker,cleanup"

lazi add docker-stop-all "docker stop \$(docker ps -q)" \
  -d "Stop all containers" -t "docker"

lazi add docker-exec "docker exec -it {container} bash" \
  -d "Execute bash in container" -t "docker"

# Add warnings
lazi idea add "Requires admin/sudo privileges" --command docker-clean -t "warning"
```

### System Commands

```bash
lazi add ports "lsof -i -P | grep LISTEN" \
  -d "Show listening ports" -t "network,debug"

lazi add diskspace "df -h" \
  -d "Show disk space" -t "system,disk"

lazi add processes "ps aux | grep {name}" \
  -d "Find process by name" -t "system,process"

lazi add mkcd "mkdir -p {dir} && cd {dir}" \
  -d "Make directory and cd into it" -t "filesystem"
```

## Development

### Scripts

- `npm run build` - Compile TypeScript to JavaScript
- `npm run dev` - Watch mode for development
- `npm test` - Run tests (placeholder)

### Project Structure

```
lazi-core-cli/
├── src/
│   ├── index.ts       # CLI entry point and command definitions
│   ├── config.ts      # Configuration management
│   ├── registry.ts    # Registry management and CRUD operations
│   ├── logger.ts      # Execution logging with session tracking
│   ├── ideas.ts       # Ideas/notes management
│   └── types.ts       # TypeScript type definitions
├── bin/               # Compiled JavaScript output
├── package.json
├── tsconfig.json
├── CLAUDE.md
└── README.md
```

## Troubleshooting

### Command not found after installation

Make sure you ran `npm link` and that npm's global bin directory is in your PATH.

Check npm's bin directory:
```bash
npm bin -g
```

### Parameters not being substituted

- Ensure parameters are wrapped in curly braces: `{param}`
- Check that parameter names match when using named arguments
- Use `--show` flag to see the final command before execution

### Log or idea not found

Make sure you're using the correct ID number. View logs or ideas to find the correct ID:
```bash
lazi logs
lazi idea list
```

### Storage file issues

If you encounter issues with storage files:

```bash
# View configuration
lazi config

# View files
ls -la ~/.lazi/

# Reset to default location
lazi migrate-storage --reset

# Or manually delete (WARNING: loses all data!)
rm -rf ~/.lazi/
```

## License

ISC

## Contributing

Feel free to submit issues and enhancement requests!
