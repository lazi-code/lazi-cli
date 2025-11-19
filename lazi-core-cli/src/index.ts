#!/usr/bin/env node

import { Command } from 'commander';
import { spawn, exec } from 'child_process';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { CommandRegistry } from './registry';
import { Logger } from './logger';
import { IdeasManager } from './ideas';
import { SessionInfo } from './types';
import { Config } from './config';

const program = new Command();
const registry = new CommandRegistry();
const logger = new Logger();
const ideasManager = new IdeasManager();

program
  .name('lazi')
  .description('Lazi Core-CLI - Command management and automation tool')
  .version('1.0.0');

// Add command
program
  .command('add')
  .description('Add a new command to the registry')
  .argument('<name>', 'Name/alias for the command')
  .argument('<command>', 'The actual command to save')
  .option('-d, --description <desc>', 'Description of the command')
  .option('-t, --tags <tags>', 'Comma-separated tags', (val) => val.split(',').map(t => t.trim()))
  .action((name, command, options) => {
    try {
      registry.addCommand(name, command, options.description, options.tags);
      console.log(chalk.green(`✓ Command '${name}' added successfully!`));
    } catch (error) {
      console.error(chalk.red('Error adding command:'), error);
      process.exit(1);
    }
  });

// List commands
program
  .command('list')
  .alias('ls')
  .description('List all saved commands')
  .option('-v, --verbose', 'Show detailed information')
  .action((options) => {
    const commands = registry.getAllCommands();

    if (commands.length === 0) {
      console.log(chalk.yellow('No commands saved yet. Use "lazi add" to add one.'));
      return;
    }

    console.log(chalk.bold(`\nSaved Commands (${commands.length}):\n`));

    commands.forEach((cmd) => {
      const paramInfo = cmd.parameters && cmd.parameters.length > 0
        ? ` ${chalk.yellow(`[${cmd.parameters.join(', ')}]`)}`
        : '';

      console.log(chalk.cyan(`  ${cmd.name}`) + paramInfo);
      console.log(`    ${chalk.gray(cmd.command)}`);

      if (options.verbose) {
        if (cmd.description) {
          console.log(`    ${chalk.dim(cmd.description)}`);
        }
        if (cmd.parameters && cmd.parameters.length > 0) {
          console.log(`    Parameters: ${chalk.yellow(cmd.parameters.join(', '))}`);
        }
        if (cmd.tags && cmd.tags.length > 0) {
          console.log(`    Tags: ${chalk.magenta(cmd.tags.join(', '))}`);
        }
        console.log(`    Created: ${chalk.dim(new Date(cmd.createdAt).toLocaleString())}`);
      }

      console.log('');
    });
  });

// Search commands
program
  .command('search')
  .alias('find')
  .description('Search for commands by name, description, or tags')
  .argument('<query>', 'Search query')
  .action((query) => {
    const results = registry.searchCommands(query);

    if (results.length === 0) {
      console.log(chalk.yellow(`No commands found matching '${query}'`));
      return;
    }

    console.log(chalk.bold(`\nFound ${results.length} command(s):\n`));

    results.forEach((cmd) => {
      const paramInfo = cmd.parameters && cmd.parameters.length > 0
        ? ` ${chalk.yellow(`[${cmd.parameters.join(', ')}]`)}`
        : '';

      console.log(chalk.cyan(`  ${cmd.name}`) + paramInfo);
      console.log(`    ${chalk.gray(cmd.command)}`);
      if (cmd.description) {
        console.log(`    ${chalk.dim(cmd.description)}`);
      }
      console.log('');
    });
  });

// Run command
program
  .command('run')
  .alias('exec')
  .description('Execute a saved command')
  .argument('<name>', 'Name of the command to run')
  .argument('[params...]', 'Parameters as key=value or positional values. Use -- to pass remaining args as-is')
  .option('-s, --show', 'Show the command before executing')
  .option('--no-log', 'Skip logging this execution')
  .allowUnknownOption() // Allow unknown options to pass through after --
  .action((name, params, options) => {
    const cmd = registry.getCommand(name);

    if (!cmd) {
      console.error(chalk.red(`Command '${name}' not found`));
      process.exit(1);
    }

    let finalCommand = cmd.command;

    // Determine which shell will be used for execution
    const isGitBash = process.env.SHELL?.includes('bash') || process.env.SHELL?.includes('sh');
    const useShell = (process.platform === 'win32' && isGitBash) ? process.env.SHELL :
                     (process.platform === 'win32' ? 'cmd.exe' : '/bin/sh');
    const isBashLike = useShell?.includes('bash') || useShell?.includes('/sh') || useShell === '/bin/sh';

    // Check if -- separator was used for pass-through mode
    const rawArgs = process.argv.slice(2); // Remove 'node' and script path
    const separatorIndex = rawArgs.indexOf('--');

    if (separatorIndex !== -1) {
      // Pass-through mode: everything after -- is passed as-is to the command
      const passThroughArgs = rawArgs.slice(separatorIndex + 1);

      // Helper function to quote arguments that contain spaces or special characters
      const quoteArg = (arg: string): string => {
        // If argument contains spaces, wrap in quotes appropriate for the shell
        if (arg.includes(' ')) {
          if (isBashLike) {
            // Bash/sh: use single quotes and escape any existing single quotes
            return `'${arg.replace(/'/g, "'\\''")}'`;
          } else {
            // Windows cmd.exe: use double quotes and escape existing double quotes
            return `"${arg.replace(/"/g, '""')}"`;
          }
        }
        return arg;
      };

      const quotedArgs = passThroughArgs.map(quoteArg).join(' ');

      // Convert Windows paths to forward slashes for bash compatibility
      let baseCommand = cmd.command;
      if (isBashLike && process.platform === 'win32') {
        baseCommand = cmd.command.replace(/\\/g, '/');
      }

      // If command has {args} placeholder, substitute it
      if (cmd.command.includes('{args}')) {
        finalCommand = baseCommand.replace('{args}', quotedArgs);
      } else {
        // Otherwise, append to command
        finalCommand = passThroughArgs.length > 0
          ? `${baseCommand} ${quotedArgs}`
          : baseCommand;
      }
    } else if (cmd.parameters && cmd.parameters.length > 0) {
      // Standard parameter substitution mode
      const paramValues: Record<string, string> = {};

      // Parse parameters - support both key=value and positional
      params.forEach((param: string, index: number) => {
        if (param.includes('=')) {
          const [key, ...valueParts] = param.split('=');
          paramValues[key] = valueParts.join('=');
        } else {
          // Positional parameter
          if (index < cmd.parameters!.length) {
            paramValues[cmd.parameters![index]] = param;
          }
        }
      });

      // Validate all parameters are provided
      const missingParams = cmd.parameters.filter(p => !paramValues[p]);
      if (missingParams.length > 0) {
        console.error(chalk.red(`Missing required parameters: ${missingParams.join(', ')}`));
        console.log(chalk.yellow(`\nRequired parameters: ${cmd.parameters.join(', ')}`));
        console.log(chalk.dim(`Usage: lazi run ${name} ${cmd.parameters.map(p => `<${p}>`).join(' ')}`));
        process.exit(1);
      }

      // Substitute parameters
      finalCommand = registry.substituteParameters(cmd.command, paramValues);
    } else {
      // No parameters and no pass-through mode - use command as-is
      finalCommand = cmd.command;
    }

    // Convert Windows paths to forward slashes for bash compatibility
    if (isBashLike && process.platform === 'win32') {
      finalCommand = finalCommand.replace(/\\/g, '/');
    }

    if (options.show) {
      console.log(chalk.dim(`Running: ${finalCommand}\n`));
    }

    // Capture session information
    const sessionInfo: SessionInfo = {
      sessionId: process.ppid?.toString() || process.pid.toString(),
      workingDir: process.cwd(),
      user: os.userInfo().username,
      hostname: os.hostname(),
      shell: useShell || 'unknown'
    };

    // Execute command and capture output (use the shell we determined earlier)
    const shellFlag = isBashLike ? '-c' : '/c';
    const childProcess = spawn(useShell!, [shellFlag, finalCommand], {
      stdio: ['inherit', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    // Capture and display stdout
    childProcess.stdout.on('data', (data) => {
      const text = data.toString();
      stdout += text;
      process.stdout.write(text);
    });

    // Capture and display stderr
    childProcess.stderr.on('data', (data) => {
      const text = data.toString();
      stderr += text;
      process.stderr.write(text);
    });

    childProcess.on('close', (exitCode) => {
      // Log the execution if logging is enabled
      if (options.log !== false) {
        const logId = logger.writeLog({
          id: 0, // Will be auto-assigned by logger
          timestamp: new Date().toISOString(),
          commandName: name,
          commandExecuted: finalCommand,
          exitCode: exitCode || 0,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          sessionInfo: sessionInfo
        });

        if (logId > 0) {
          console.log(chalk.dim(`\n[Logged as Log-${logId}]`));
        }
      }

      if (exitCode !== 0) {
        process.exit(exitCode || 1);
      }
    });

    childProcess.on('error', (error: Error) => {
      console.error(chalk.red('Command execution failed:'), error.message);
      process.exit(1);
    });
  });

// Quick command (run ad-hoc commands with logging)
program
  .command('quick')
  .alias('q')
  .description('Execute a one-off command and log it (not saved in registry)')
  .argument('<command>', 'Command to execute')
  .argument('[args...]', 'Additional arguments for the command')
  .option('-s, --show', 'Show the command before executing')
  .option('--no-log', 'Skip logging this execution')
  .action((command, args, options) => {
    // Build the full command string
    const fullCommand = args.length > 0 ? `${command} ${args.join(' ')}` : command;

    if (options.show) {
      console.log(chalk.dim(`Running: ${fullCommand}\n`));
    }

    // Capture session information
    const sessionInfo: SessionInfo = {
      sessionId: process.ppid?.toString() || process.pid.toString(),
      workingDir: process.cwd(),
      user: os.userInfo().username,
      hostname: os.hostname(),
      shell: process.env.SHELL || process.env.ComSpec || 'unknown'
    };

    // Execute command and capture output
    const shell = process.platform === 'win32' ? 'cmd.exe' : '/bin/sh';
    const shellFlag = process.platform === 'win32' ? '/c' : '-c';
    const childProcess = spawn(shell, [shellFlag, fullCommand], {
      stdio: ['inherit', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    // Capture and display stdout
    childProcess.stdout.on('data', (data) => {
      const text = data.toString();
      stdout += text;
      process.stdout.write(text);
    });

    // Capture and display stderr
    childProcess.stderr.on('data', (data) => {
      const text = data.toString();
      stderr += text;
      process.stderr.write(text);
    });

    childProcess.on('close', (exitCode) => {
      // Log the execution if logging is enabled
      if (options.log !== false) {
        const logId = logger.writeLog({
          id: 0, // Will be auto-assigned by logger
          timestamp: new Date().toISOString(),
          commandName: fullCommand,
          commandExecuted: fullCommand,
          exitCode: exitCode || 0,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          sessionInfo: sessionInfo
        });

        if (logId > 0) {
          console.log(chalk.dim(`\n[Logged as Log-${logId}]`));
        }
      }

      if (exitCode !== 0) {
        process.exit(exitCode || 1);
      }
    });

    childProcess.on('error', (error: Error) => {
      console.error(chalk.red('Command execution failed:'), error.message);
      process.exit(1);
    });
  });

// Rerun command (re-execute a command from logs)
program
  .command('rerun')
  .alias('replay')
  .description('Re-execute a previously logged command by its log ID')
  .argument('<id>', 'Log ID to re-run', parseInt)
  .argument('[params...]', 'Optional parameters to override (for registered commands only)')
  .option('-s, --show', 'Show the command before executing')
  .option('--no-log', 'Skip logging this re-execution')
  .action((logId, params, options) => {
    // Validate log ID
    if (isNaN(logId) || logId <= 0) {
      console.error(chalk.red('Invalid log ID. Must be a positive number.'));
      process.exit(1);
    }

    // Retrieve the command from the log
    const logEntry = logger.getLogById(logId);

    if (!logEntry) {
      console.error(chalk.red(`Log-${logId} not found or cannot be re-run`));
      process.exit(1);
    }

    // Handle event rerun (ScriptBuilder scripts)
    if (logEntry.isEvent) {
      if (!logEntry.scriptContent) {
        console.error(chalk.red(`Event Log-${logId} does not contain script content (may be from older version)`));
        console.log(chalk.yellow(`Script content storage was added recently. Events created before this won't have the script saved.`));
        process.exit(1);
      }

      console.log(chalk.cyan(`Re-running Event-${logId}: ${logEntry.commandName}`));

      if (options.show) {
        console.log(chalk.dim(`\nScript Content:\n${logEntry.scriptContent}\n`));
      }

      // Write script to temp file
      const tempDir = path.join(process.cwd(), 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const ext = logEntry.scriptType === 'powershell' ? '.ps1' : '.sh';
      const tempFile = path.join(tempDir, `rerun-${logId}-${Date.now()}${ext}`);
      fs.writeFileSync(tempFile, logEntry.scriptContent, 'utf-8');

      // Capture session information
      const sessionInfo: SessionInfo = {
        sessionId: process.ppid?.toString() || process.pid.toString(),
        workingDir: process.cwd(),
        user: os.userInfo().username,
        hostname: os.hostname(),
        shell: process.env.SHELL || process.env.ComSpec || 'unknown'
      };

      // Execute via PowerShell or Bash
      const shellCommand = logEntry.scriptType === 'powershell' ? 'powershell' : 'bash';
      const shellArgs = logEntry.scriptType === 'powershell'
        ? ['-ExecutionPolicy', 'Bypass', '-File', tempFile]
        : [tempFile];

      const childProcess = spawn(shellCommand, shellArgs, {
        stdio: ['inherit', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      childProcess.stdout!.on('data', (data: Buffer) => {
        const text = data.toString();
        stdout += text;
        process.stdout.write(text);
      });

      childProcess.stderr!.on('data', (data: Buffer) => {
        const text = data.toString();
        stderr += text;
        process.stderr.write(text);
      });

      childProcess.on('close', (exitCode: number | null) => {
        // Clean up temp file
        try {
          fs.unlinkSync(tempFile);
        } catch (e) {
          // Ignore cleanup errors
        }

        // Log the re-execution if logging is enabled
        if (options.log !== false) {
          const newLogId = logger.writeLog({
            id: 0,
            timestamp: new Date().toISOString(),
            commandName: `rerun-event-${logId} (${logEntry.commandName})`,
            commandExecuted: `Event rerun: ${logEntry.scriptType || 'unknown'} script`,
            exitCode: exitCode || 0,
            stdout: stdout.trim(),
            stderr: stderr.trim(),
            sessionInfo: sessionInfo
          });

          if (newLogId > 0) {
            console.log(chalk.dim(`\n[Logged as Log-${newLogId}]`));
          }
        }

        if (exitCode !== 0) {
          process.exit(exitCode || 1);
        }
      });

      childProcess.on('error', (error) => {
        console.error(chalk.red('Script execution failed:'), error.message);
        // Clean up temp file
        try {
          fs.unlinkSync(tempFile);
        } catch (e) {
          // Ignore cleanup errors
        }
        process.exit(1);
      });

      return; // Exit early for events
    }

    // Regular command rerun logic
    if (!logEntry.commandExecuted) {
      console.error(chalk.red(`Log-${logId} does not contain command information`));
      process.exit(1);
    }

    let finalCommand: string = logEntry.commandExecuted;
    let commandDisplayName = logEntry.commandName;

    // If parameters provided, try to override them (only works for registered commands)
    if (params && params.length > 0) {
      const cmd = registry.getCommand(logEntry.commandName);

      if (cmd && cmd.parameters && cmd.parameters.length > 0) {
        // Parse new parameters
        const paramValues: Record<string, string> = {};

        params.forEach((param: string, index: number) => {
          if (param.includes('=')) {
            const [key, ...valueParts] = param.split('=');
            paramValues[key] = valueParts.join('=');
          } else {
            // Positional parameter
            if (index < cmd.parameters!.length) {
              paramValues[cmd.parameters![index]] = param;
            }
          }
        });

        // Validate all parameters are provided
        const missingParams = cmd.parameters.filter(p => !paramValues[p]);
        if (missingParams.length > 0) {
          console.error(chalk.red(`Missing required parameters: ${missingParams.join(', ')}`));
          console.log(chalk.yellow(`\nRequired parameters: ${cmd.parameters.join(', ')}`));
          console.log(chalk.dim(`Usage: lazi rerun ${logId} ${cmd.parameters.map(p => `<${p}>`).join(' ')}`));
          process.exit(1);
        }

        // Substitute parameters
        finalCommand = registry.substituteParameters(cmd.command, paramValues);
        console.log(chalk.cyan(`Re-running Log-${logId} with new parameters`));
      } else {
        console.log(chalk.yellow(`Warning: Cannot override parameters for this command (not in registry or no parameters)`));
        console.log(chalk.cyan(`Re-running Log-${logId} with original command`));
      }
    } else {
      console.log(chalk.cyan(`Re-running Log-${logId}: ${commandDisplayName}`));
    }

    if (options.show) {
      console.log(chalk.dim(`Command: ${finalCommand}\n`));
    }

    // Capture session information
    const sessionInfo: SessionInfo = {
      sessionId: process.ppid?.toString() || process.pid.toString(),
      workingDir: process.cwd(),
      user: os.userInfo().username,
      hostname: os.hostname(),
      shell: process.env.SHELL || process.env.ComSpec || 'unknown'
    };

    // Execute command and capture output
    const shellCmd = process.platform === 'win32' ? 'cmd.exe' : '/bin/sh';
    const shellFlag = process.platform === 'win32' ? '/c' : '-c';
    const childProcess = spawn(shellCmd, [shellFlag, finalCommand], {
      stdio: ['inherit', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    // Capture and display stdout
    childProcess.stdout!.on('data', (data: Buffer) => {
      const text = data.toString();
      stdout += text;
      process.stdout.write(text);
    });

    // Capture and display stderr
    childProcess.stderr!.on('data', (data: Buffer) => {
      const text = data.toString();
      stderr += text;
      process.stderr.write(text);
    });

    childProcess.on('close', (exitCode: number | null) => {
      // Log the execution if logging is enabled
      if (options.log !== false) {
        const newLogId = logger.writeLog({
          id: 0, // Will be auto-assigned by logger
          timestamp: new Date().toISOString(),
          commandName: `rerun-${logId} (${commandDisplayName})`,
          commandExecuted: finalCommand,
          exitCode: exitCode || 0,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          sessionInfo: sessionInfo
        });

        if (newLogId > 0) {
          console.log(chalk.dim(`\n[Logged as Log-${newLogId}]`));
        }
      }

      if (exitCode !== 0) {
        process.exit(exitCode || 1);
      }
    });

    childProcess.on('error', (error: Error) => {
      console.error(chalk.red('Command execution failed:'), error.message);
      process.exit(1);
    });
  });

// Promote log entry to saved command
program
  .command('promote')
  .description('Promote a log entry to a saved command')
  .argument('<logId>', 'Log ID to promote', parseInt)
  .argument('<name>', 'Name for the new command')
  .option('-d, --description <desc>', 'Description of the command')
  .option('-t, --tags <tags>', 'Comma-separated tags', (val) => val.split(',').map(t => t.trim()))
  .action((logId, name, options) => {
    // Validate log ID
    if (isNaN(logId) || logId <= 0) {
      console.error(chalk.red('Invalid log ID. Must be a positive number.'));
      process.exit(1);
    }

    // Retrieve the log entry
    const logEntry = logger.getLogById(logId);

    if (!logEntry) {
      console.error(chalk.red(`Log-${logId} not found`));
      process.exit(1);
    }

    // Check if it's an event (ScriptBuilder script) - these can't be promoted
    if (logEntry.isEvent) {
      console.error(chalk.red(`Log-${logId} is a script event and cannot be promoted to a command.`));
      console.log(chalk.yellow(`Hint: Use 'lazi rerun ${logId}' to re-run the script.`));
      process.exit(1);
    }

    // Get the command to save
    const commandToSave = logEntry.commandExecuted || logEntry.commandName;

    if (!commandToSave) {
      console.error(chalk.red(`Log-${logId} does not contain a valid command`));
      process.exit(1);
    }

    // Check if command name already exists
    const existingCmd = registry.getCommand(name);
    if (existingCmd) {
      console.error(chalk.red(`Command '${name}' already exists. Choose a different name or delete it first.`));
      process.exit(1);
    }

    try {
      // Add the command to registry
      registry.addCommand(name, commandToSave, options.description, options.tags);
      console.log(chalk.green(`✓ Log-${logId} promoted to command '${name}'!`));
      console.log(chalk.dim(`Command: ${commandToSave}`));

      // Show parameter info if any were detected
      const cmd = registry.getCommand(name);
      if (cmd && cmd.parameters && cmd.parameters.length > 0) {
        console.log(chalk.yellow(`Detected parameters: ${cmd.parameters.join(', ')}`));
      }
    } catch (error) {
      console.error(chalk.red('Error promoting log entry:'), error);
      process.exit(1);
    }
  });

// Delete command
program
  .command('delete')
  .alias('rm')
  .description('Delete a command from the registry')
  .argument('<name>', 'Name of the command to delete')
  .action((name) => {
    const success = registry.deleteCommand(name);

    if (success) {
      console.log(chalk.green(`✓ Command '${name}' deleted successfully!`));
    } else {
      console.error(chalk.red(`Command '${name}' not found`));
      process.exit(1);
    }
  });

// Edit command
program
  .command('edit')
  .description('Edit an existing command')
  .argument('<name>', 'Name of the command to edit')
  .option('-c, --command <cmd>', 'New command string')
  .option('-d, --description <desc>', 'New description')
  .option('-t, --tags <tags>', 'New comma-separated tags', (val) => val.split(',').map(t => t.trim()))
  .action((name, options) => {
    const updates: any = {};

    if (options.command) updates.command = options.command;
    if (options.description) updates.description = options.description;
    if (options.tags) updates.tags = options.tags;

    if (Object.keys(updates).length === 0) {
      console.error(chalk.red('No updates provided. Use -c, -d, or -t options.'));
      process.exit(1);
    }

    const success = registry.updateCommand(name, updates);

    if (success) {
      console.log(chalk.green(`✓ Command '${name}' updated successfully!`));
    } else {
      console.error(chalk.red(`Command '${name}' not found`));
      process.exit(1);
    }
  });

// Show command details
program
  .command('show')
  .description('Show details of a specific command')
  .argument('<name>', 'Name of the command')
  .action((name) => {
    const cmd = registry.getCommand(name);

    if (!cmd) {
      console.error(chalk.red(`Command '${name}' not found`));
      process.exit(1);
    }

    console.log(chalk.bold(`\n${cmd.name}\n`));
    console.log(`Command:     ${chalk.gray(cmd.command)}`);
    if (cmd.description) {
      console.log(`Description: ${cmd.description}`);
    }
    if (cmd.parameters && cmd.parameters.length > 0) {
      console.log(`Parameters:  ${chalk.yellow(cmd.parameters.join(', '))}`);
      console.log(`Usage:       ${chalk.dim(`lazi run ${cmd.name} ${cmd.parameters.map(p => `<${p}>`).join(' ')}`)}`);
    }
    if (cmd.tags && cmd.tags.length > 0) {
      console.log(`Tags:        ${chalk.magenta(cmd.tags.join(', '))}`);
    }

    // Display attached ideas
    const attachedIdeas = ideasManager.getIdeasForCommand(name);
    if (attachedIdeas) {
      console.log(chalk.cyan(`\nAttached Notes:`));
      const ideas = attachedIdeas.split('---\n').filter(e => e.trim());
      ideas.forEach(idea => {
        const lines = idea.split('\n');
        const textLine = lines.find(l => l.startsWith('Text:'));
        const tagsLine = lines.find(l => l.startsWith('Tags:'));
        if (textLine) {
          console.log(`  • ${textLine.replace('Text: ', '')}`);
          if (tagsLine) {
            console.log(`    ${chalk.dim(tagsLine)}`);
          }
        }
      });
    }

    console.log(`\nCreated:     ${new Date(cmd.createdAt).toLocaleString()}`);
    console.log(`Updated:     ${new Date(cmd.updatedAt).toLocaleString()}`);
    console.log('');
  });

// Logs command
program
  .command('logs')
  .description('View command execution logs')
  .option('-n, --count <number>', 'Number of recent entries to show', '20')
  .option('-s, --search <query>', 'Search logs by command name')
  .option('--session <sessionId>', 'Filter logs by session ID')
  .option('--with-ideas', 'Show attached ideas for each log entry')
  .option('-c, --clear', 'Clear all logs')
  .action((options) => {
    if (options.clear) {
      logger.clearLogs();
      console.log(chalk.green('✓ Logs cleared successfully!'));
      return;
    }

    let logs: string;

    if (options.session) {
      logs = logger.searchBySession(options.session);
      if (!logs) {
        console.log(chalk.yellow(`No logs found for session '${options.session}'`));
        return;
      }
      console.log(chalk.bold(`\nLog Entries for Session ${options.session}:\n`));
    } else if (options.search) {
      logs = logger.searchLogs(options.search);
      if (!logs) {
        console.log(chalk.yellow(`No logs found matching '${options.search}'`));
        return;
      }
      console.log(chalk.bold('\nMatching Log Entries:\n'));
    } else {
      const count = parseInt(options.count, 10);
      logs = logger.readLogs(count);

      if (!logs) {
        console.log(chalk.yellow('No logs found. Run some commands to see logs here.'));
        return;
      }

      const totalCount = logger.getLogCount();
      console.log(chalk.bold(`\nShowing last ${Math.min(count, totalCount)} of ${totalCount} log entries:\n`));
    }

    // If --with-ideas flag is set, attach ideas to log entries
    if (options.withIdeas) {
      const logEntries = logs.split('---\n').filter(e => e.trim());
      const enrichedEntries: string[] = [];

      logEntries.forEach(entry => {
        const logIdMatch = entry.match(/\[Log-(\d+)\]/);
        if (logIdMatch) {
          const logId = parseInt(logIdMatch[1], 10);
          const attachedIdeas = ideasManager.getIdeasForLog(logId);

          if (attachedIdeas) {
            enrichedEntries.push(entry.trim() + '\n\n' + chalk.cyan('Attached Ideas:\n') + attachedIdeas);
          } else {
            enrichedEntries.push(entry.trim());
          }
        } else {
          enrichedEntries.push(entry.trim());
        }
      });

      console.log(enrichedEntries.join('\n---\n') + '\n---\n');
    } else {
      console.log(logs);
    }
  });

// Events command - list all script run events
program
  .command('events')
  .description('View all script run events')
  .option('-n, --count <number>', 'Number of recent events to show', '20')
  .action((options) => {
    const allEvents = logger.getAllEvents();

    if (allEvents.length === 0) {
      console.log(chalk.yellow('No script events found. Run scripts from ScriptBuilder to see events here.'));
      return;
    }

    const count = parseInt(options.count, 10);
    const recentEvents = allEvents.slice(-count).reverse();

    console.log(chalk.bold(`\nShowing last ${Math.min(count, allEvents.length)} of ${allEvents.length} script events:\n`));

    recentEvents.forEach(event => {
      // Extract event information
      const logIdMatch = event.match(/\[Log-(\d+)\]/);
      const nameMatch = event.match(/EVENT-START: (.+?)$/m);
      const scriptTypeMatch = event.match(/Script-Type: (.+?)$/m);
      const stepsMatch = event.match(/Total-Steps: (\d+)/);

      if (logIdMatch && nameMatch) {
        const logId = logIdMatch[1];
        const scriptName = nameMatch[1];
        const scriptType = scriptTypeMatch ? scriptTypeMatch[1] : 'unknown';
        const totalSteps = stepsMatch ? stepsMatch[1] : '?';

        console.log(chalk.cyan(`[Event-${logId}] `) + chalk.bold(scriptName));
        console.log(chalk.gray(`  Type: ${scriptType} | Steps: ${totalSteps}`));
        console.log();
      }
    });
  });

// Event details command - show full details of a specific event
program
  .command('event')
  .description('View detailed information about a specific script event')
  .argument('<id>', 'Event ID to view', parseInt)
  .option('--with-code', 'Display code for each step')
  .action((id: number, options: { withCode?: boolean }) => {
    const eventLogs = logger.getEventLogs(id);

    if (eventLogs.length === 0) {
      console.log(chalk.red(`Event ${id} not found`));
      return;
    }

    console.log(chalk.bold(`\nEvent Details for Event-${id}:\n`));
    console.log(chalk.gray('='.repeat(60)));
    console.log();

    // If --with-code flag is set, get step information
    let steps: Array<{
      logId: number;
      stepNumber: number;
      stepName: string;
      stepCode?: string;
    }> = [];

    if (options.withCode) {
      steps = logger.getStepsByEvent(id);
    }

    eventLogs.forEach((entry, index) => {
      if (entry.includes('EVENT-START')) {
        console.log(chalk.bold.green('▶ EVENT START'));
      } else if (entry.includes('EVENT-END')) {
        console.log(chalk.bold.blue('■ EVENT END'));
      } else if (entry.includes('STEP-')) {
        const stepMatch = entry.match(/STEP-(\d+): (.+?)$/m);
        if (stepMatch) {
          const stepNum = parseInt(stepMatch[1], 10);
          console.log(chalk.yellow(`  Step ${stepMatch[1]}: ${stepMatch[2]}`));

          // If --with-code, display the step code
          if (options.withCode) {
            const step = steps.find(s => s.stepNumber === stepNum);
            if (step && step.stepCode) {
              console.log(chalk.gray('  Code:'));
              console.log(chalk.gray('  ' + '-'.repeat(56)));
              // Indent each line of code
              const indentedCode = step.stepCode.split('\n').map(line => '  ' + line).join('\n');
              console.log(chalk.white(indentedCode));
              console.log(chalk.gray('  ' + '-'.repeat(56)));
            }
          }
        }
      }

      console.log(chalk.gray(entry.trim()));

      if (index < eventLogs.length - 1) {
        console.log();
        console.log(chalk.gray('-'.repeat(60)));
        console.log();
      }
    });

    console.log();
    console.log(chalk.gray('='.repeat(60)));
  });

// Step command - view individual step details
program
  .command('step')
  .description('View details of a specific workflow step')
  .argument('<id>', 'Step log ID', parseInt)
  .action((id: number) => {
    const stepInfo = logger.getStepCode(id);

    if (!stepInfo) {
      console.log(chalk.red(`Step log ${id} not found or is not a step entry`));
      return;
    }

    console.log(chalk.bold(`\nStep Details for Log-${id}:\n`));
    console.log(chalk.gray('='.repeat(60)));
    console.log();

    console.log(chalk.cyan('Step Number:'), chalk.white(stepInfo.stepNumber.toString()));
    console.log(chalk.cyan('Step Name:'), chalk.white(stepInfo.stepName));
    console.log(chalk.cyan('Parent Event:'), chalk.white(stepInfo.parentEvent.toString()));
    console.log();

    if (stepInfo.stepCode) {
      console.log(chalk.bold.green('Generated Code:'));
      console.log(chalk.gray('-'.repeat(60)));
      console.log(stepInfo.stepCode);
      console.log(chalk.gray('-'.repeat(60)));
    } else {
      console.log(chalk.yellow('No code stored for this step'));
    }

    console.log();
    console.log(chalk.gray(`View parent event: ${chalk.white(`lazi event ${stepInfo.parentEvent}`)}`));
    console.log();
    console.log(chalk.gray('='.repeat(60)));
  });

// Build command - combine multiple steps into a script
program
  .command('build')
  .description('Build a script by combining code from multiple workflow steps')
  .requiredOption('--from-steps <ids>', 'Comma-separated step log IDs (e.g., "191,192,195")')
  .option('--type <powershell|bash>', 'Script type (powershell or bash), inferred from first step if not specified')
  .option('-o, --output <file>', 'Output file path (prints to stdout if not specified)')
  .option('--name <name>', 'Script name for header comment (defaults to "Combined Script")')
  .action((options: { fromSteps: string; type?: string; output?: string; name?: string }) => {
    // Parse step IDs
    const stepIdsStr = options.fromSteps.split(',').map(s => s.trim());
    const stepIds = stepIdsStr.map(s => parseInt(s, 10));

    // Validate all are numbers
    if (stepIds.some(id => isNaN(id))) {
      console.log(chalk.red('Error: All step IDs must be valid numbers'));
      console.log(chalk.yellow('Example: --from-steps 191,192,195'));
      return;
    }

    // Retrieve all steps
    console.log(chalk.cyan(`\nBuilding script from ${stepIds.length} steps...\n`));

    const steps: Array<{
      logId: number;
      stepNumber: number;
      stepName: string;
      stepCode?: string;
      scriptType?: string;
    }> = [];

    let errors = false;

    for (const id of stepIds) {
      const stepInfo = logger.getStepCode(id);

      if (!stepInfo) {
        console.log(chalk.red(`  ✗ Log-${id}: Not found or not a step entry`));
        errors = true;
        continue;
      }

      if (!stepInfo.stepCode) {
        console.log(chalk.yellow(`  ⚠ Log-${id}: No code stored (skipping)`));
        continue;
      }

      // Get parent event to determine script type
      const eventLogs = logger.getEventLogs(stepInfo.parentEvent);
      let scriptType = 'powershell'; // default

      if (eventLogs.length > 0) {
        const eventStart = eventLogs[0];
        const scriptTypeMatch = eventStart.match(/Script-Type: (.+)/);
        if (scriptTypeMatch) {
          scriptType = scriptTypeMatch[1].trim();
        }
      }

      steps.push({
        logId: id,
        stepNumber: stepInfo.stepNumber,
        stepName: stepInfo.stepName,
        stepCode: stepInfo.stepCode,
        scriptType
      });

      console.log(chalk.green(`  ✓ Step ${steps.length} from Log-${id}: ${stepInfo.stepName}`));
    }

    if (errors) {
      console.log();
      console.log(chalk.red('Build aborted due to errors'));
      return;
    }

    if (steps.length === 0) {
      console.log();
      console.log(chalk.red('No valid steps found with code. Nothing to build.'));
      return;
    }

    // Determine script type
    const scriptType = options.type || steps[0].scriptType || 'powershell';

    // Check for mixed script types
    const types = new Set(steps.map(s => s.scriptType));
    if (types.size > 1 && !options.type) {
      console.log();
      console.log(chalk.yellow(`Warning: Steps have different script types: ${Array.from(types).join(', ')}`));
      console.log(chalk.yellow(`Using type from first step: ${scriptType}`));
      console.log(chalk.yellow(`Use --type flag to override`));
    }

    // Generate script
    const scriptName = options.name || 'Combined Script';
    const timestamp = new Date().toLocaleString();
    const sourceSteps = stepIds.join(', ');

    let script = '';

    // Add header based on script type
    if (scriptType === 'powershell') {
      script += '# PowerShell Script\n';
      script += '# Generated by Lazi Core-CLI\n';
    } else {
      script += '#!/bin/bash\n';
      script += '# Generated by Lazi Core-CLI\n';
      script += 'set -e\n';
    }

    script += `# Script Name: ${scriptName}\n`;
    script += `# Generated: ${timestamp}\n`;
    script += `# Source Steps: ${sourceSteps}\n`;
    script += '\n';

    // Add each step's code
    steps.forEach((step, index) => {
      script += `# Step ${index + 1} (from Log-${step.logId}: ${step.stepName})\n`;
      script += `${step.stepCode}\n`;
      script += '\n';
    });

    // Output script
    if (options.output) {
      try {
        fs.writeFileSync(options.output, script, 'utf-8');
        console.log();
        console.log(chalk.green(`Script written to ${options.output}`));
      } catch (error) {
        console.log();
        console.log(chalk.red(`Error writing file: ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
    } else {
      console.log();
      console.log(chalk.gray('='.repeat(60)));
      console.log(script);
      console.log(chalk.gray('='.repeat(60)));
    }
  });

// Idea commands
const ideaCommand = program.command('idea').description('Manage ideas and notes');

// Add idea
ideaCommand
  .command('add')
  .description('Add a new idea or note (text, tags, or both)')
  .argument('[text]', 'The idea or note text (optional if tags provided)')
  .option('-t, --tags <tags>', 'Comma-separated tags', (val) => val.split(',').map(t => t.trim()))
  .option('-l, --log <logId>', 'Attach to a log entry', parseInt)
  .option('-c, --command <name>', 'Attach to a command definition')
  .option('--type <type>', 'Attachment type for log: command or output')
  .action((text, options) => {
    try {
      // Validate mutually exclusive options
      if (options.log && options.command) {
        console.error(chalk.red('Cannot use both --log and --command options together'));
        process.exit(1);
      }

      if (options.type && !options.log) {
        console.error(chalk.red('--type can only be used with --log option'));
        process.exit(1);
      }

      // Require at least text or tags
      if (!text && (!options.tags || options.tags.length === 0)) {
        console.error(chalk.red('Must provide either text, tags, or both'));
        console.log(chalk.yellow('Examples:'));
        console.log(chalk.dim('  lazi idea add "Some text"'));
        console.log(chalk.dim('  lazi idea add -t "tag1,tag2"'));
        console.log(chalk.dim('  lazi idea add "Some text" -t "tag1,tag2"'));
        process.exit(1);
      }

      const attachmentType = options.type as 'command' | 'output' | undefined;
      const ideaId = ideasManager.addIdea(
        text,
        options.tags,
        options.log,
        attachmentType,
        options.command
      );

      if (ideaId > 0) {
        if (text && options.tags) {
          console.log(chalk.green(`✓ Idea-${ideaId} added with text and tags!`));
        } else if (text) {
          console.log(chalk.green(`✓ Idea-${ideaId} added with text!`));
        } else {
          console.log(chalk.green(`✓ Idea-${ideaId} added with tags only!`));
        }

        if (options.log) {
          console.log(chalk.dim(`Attached to Log-${options.log}`));
        } else if (options.command) {
          console.log(chalk.dim(`Attached to command '${options.command}'`));
        }
      } else {
        console.error(chalk.red('Failed to add idea'));
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red('Error adding idea:'), error);
      process.exit(1);
    }
  });

// Add property-based idea
ideaCommand
  .command('add-prop')
  .description('Add a single property idea (key-value pair)')
  .argument('<property>', 'Property as key=value (e.g., Server=prod)')
  .option('-l, --log <logId>', 'Attach to a log entry', parseInt)
  .option('-c, --command <name>', 'Attach to a command definition')
  .option('--type <type>', 'Attachment type for log: command or output')
  .action((property, options) => {
    try {
      // Validate mutually exclusive options
      if (options.log && options.command) {
        console.error(chalk.red('Cannot use both --log and --command options together'));
        process.exit(1);
      }

      if (options.type && !options.log) {
        console.error(chalk.red('--type can only be used with --log option'));
        process.exit(1);
      }

      // Parse key=value pair
      if (!property.includes('=')) {
        console.error(chalk.red(`Invalid property format: "${property}". Expected key=value`));
        console.log(chalk.yellow('Example: lazi idea add-prop Server=production-01'));
        process.exit(1);
      }

      const [key, ...valueParts] = property.split('=');
      const value = valueParts.join('='); // Handle values with = in them

      const attachmentType = options.type as 'command' | 'output' | undefined;
      const ideaId = ideasManager.addPropertyIdea(
        key,
        value,
        options.log,
        attachmentType,
        options.command
      );

      if (ideaId > 0) {
        console.log(chalk.green(`✓ Property Idea-${ideaId} added: ${key}=${value}`));

        if (options.log) {
          console.log(chalk.dim(`Attached to Log-${options.log}`));
        } else if (options.command) {
          console.log(chalk.dim(`Attached to command '${options.command}'`));
        }
      } else {
        console.error(chalk.red('Failed to add property idea'));
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red('Error adding property idea:'), error);
      process.exit(1);
    }
  });

// List ideas
ideaCommand
  .command('list')
  .alias('ls')
  .description('List all ideas')
  .option('--standalone', 'Show only standalone ideas')
  .option('--attached', 'Show only attached ideas')
  .option('--command-level', 'Show only command-attached ideas')
  .option('--log-level', 'Show only log-attached ideas')
  .action((options) => {
    let ideas: string;
    let filterType: 'standalone' | 'attached' | 'command-level' | 'log-level' | undefined;

    if (options.standalone) {
      filterType = 'standalone';
    } else if (options.attached) {
      filterType = 'attached';
    } else if (options.commandLevel) {
      filterType = 'command-level';
    } else if (options.logLevel) {
      filterType = 'log-level';
    }

    ideas = ideasManager.getIdeas(filterType);

    if (!ideas) {
      console.log(chalk.yellow('No ideas found. Use "lazi idea add" to create one.'));
      return;
    }

    const count = ideasManager.getIdeaCount();
    let title = `\nAll Ideas (${count}):\n`;

    if (options.standalone) {
      title = `\nStandalone Ideas:\n`;
    } else if (options.attached) {
      title = `\nAttached Ideas:\n`;
    } else if (options.commandLevel) {
      title = `\nCommand-Level Ideas:\n`;
    } else if (options.logLevel) {
      title = `\nLog-Level Ideas:\n`;
    }

    console.log(chalk.bold(title));
    console.log(ideas);
  });

// Search ideas
ideaCommand
  .command('search')
  .description('Search ideas by text or tags')
  .argument('<query>', 'Search query')
  .action((query) => {
    const results = ideasManager.searchIdeas(query);

    if (!results) {
      console.log(chalk.yellow(`No ideas found matching '${query}'`));
      return;
    }

    console.log(chalk.bold(`\nMatching Ideas:\n`));
    console.log(results);
  });

// Delete idea(s)
ideaCommand
  .command('delete')
  .alias('rm')
  .description('Delete one or more ideas')
  .argument('<ideaIds...>', 'IDs of ideas to delete (space-separated)')
  .action((ideaIdsRaw) => {
    // Parse all IDs to integers
    const ideaIds = ideaIdsRaw.map((id: string) => parseInt(id, 10));

    let successCount = 0;
    let failedIds: number[] = [];

    for (const ideaId of ideaIds) {
      if (isNaN(ideaId) || ideaId <= 0) {
        console.error(chalk.red(`Invalid idea ID: ${ideaId}`));
        failedIds.push(ideaId);
        continue;
      }

      const success = ideasManager.deleteIdea(ideaId);
      if (success) {
        successCount++;
        console.log(chalk.green(`✓ Idea-${ideaId} deleted`));
      } else {
        failedIds.push(ideaId);
        console.log(chalk.red(`✗ Idea-${ideaId} not found`));
      }
    }

    console.log('');
    if (successCount > 0) {
      console.log(chalk.green(`${successCount} idea(s) deleted successfully`));
    }
    if (failedIds.length > 0) {
      console.log(chalk.yellow(`${failedIds.length} idea(s) failed: ${failedIds.join(', ')}`));
      process.exit(1);
    }
  });

// Clear all ideas
ideaCommand
  .command('clear')
  .description('Clear all ideas')
  .action(() => {
    ideasManager.clearIdeas();
    console.log(chalk.green('✓ All ideas cleared successfully!'));
  });

// ============================================================
// CONFIG COMMANDS
// ============================================================

// Show current storage location
program
  .command('config')
  .description('View current storage configuration')
  .action(() => {
    const storageDir = Config.getStorageDir();
    const isDefault = Config.isDefaultLocation();
    const configFile = Config.getConfigFile();

    console.log(chalk.bold('\nStorage Configuration:\n'));
    console.log(chalk.cyan('  Storage Directory:'), storageDir);
    console.log(chalk.cyan('  Using Default:'), isDefault ? chalk.green('Yes') : chalk.yellow('No'));

    if (!isDefault && fs.existsSync(configFile)) {
      console.log(chalk.cyan('  Config File:'), configFile);
    }

    console.log('');
  });

// Migrate storage to new location
program
  .command('migrate-storage')
  .description('Migrate storage to a new location')
  .argument('[path]', 'New storage directory path (omit to reset to default)')
  .option('--reset', 'Reset to default location (~/.lazi)')
  .action(async (newPath, options) => {
    const currentDir = Config.getStorageDir();
    let targetDir: string;

    // Determine target directory
    if (options.reset || !newPath) {
      targetDir = path.join(os.homedir(), '.lazi');
      console.log(chalk.cyan('Resetting to default storage location...'));
    } else {
      targetDir = path.resolve(newPath);
    }

    // Check if it's the same directory
    if (currentDir === targetDir) {
      console.log(chalk.yellow('Already using this storage location!'));
      return;
    }

    console.log(chalk.bold('\nStorage Migration:\n'));
    console.log(chalk.cyan('  From:'), currentDir);
    console.log(chalk.cyan('  To:'), targetDir);
    console.log('');

    // Check if current storage exists
    if (!fs.existsSync(currentDir)) {
      console.log(chalk.yellow('Current storage directory does not exist. Creating new storage at target location...'));
      Config.setStorageDir(targetDir);
      Config.ensureStorageDir();
      console.log(chalk.green(`✓ Storage location set to: ${targetDir}`));
      return;
    }

    // Create target directory if it doesn't exist
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // Check if target is empty
    const targetContents = fs.readdirSync(targetDir);
    if (targetContents.length > 0) {
      console.error(chalk.red('Error: Target directory is not empty!'));
      console.log(chalk.yellow('Please choose an empty directory or delete the contents first.'));
      process.exit(1);
    }

    try {
      // Copy all files from current to target
      console.log(chalk.cyan('Copying files...'));
      const files = fs.readdirSync(currentDir);

      for (const file of files) {
        const sourcePath = path.join(currentDir, file);
        const targetPath = path.join(targetDir, file);

        const stat = fs.statSync(sourcePath);
        if (stat.isDirectory()) {
          fs.cpSync(sourcePath, targetPath, { recursive: true });
        } else {
          fs.copyFileSync(sourcePath, targetPath);
        }
      }

      console.log(chalk.green('✓ Files copied successfully'));

      // Update config to point to new location
      Config.setStorageDir(targetDir);
      console.log(chalk.green('✓ Storage location updated'));

      // Ask if user wants to delete old storage
      const readline = await import('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      rl.question(chalk.yellow(`\nDelete old storage at ${currentDir}? [y/N]: `), (answer) => {
        if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
          try {
            fs.rmSync(currentDir, { recursive: true, force: true });
            console.log(chalk.green('✓ Old storage deleted'));
          } catch (error) {
            console.error(chalk.red('Error deleting old storage:'), error);
          }
        } else {
          console.log(chalk.dim('Old storage kept at:'), currentDir);
        }

        console.log(chalk.green(`\n✓ Migration complete! Storage now at: ${targetDir}\n`));
        rl.close();
      });

    } catch (error) {
      console.error(chalk.red('Error during migration:'), error);
      console.log(chalk.yellow('\nMigration failed. Your original storage is intact.'));
      process.exit(1);
    }
  });

// ============================================================
// SETUP COMMAND (Preset Installation)
// ============================================================

program
  .command('setup')
  .description('Set up tool integrations (e.g., scriptbuilder)')
  .argument('<tool>', 'Tool name (e.g., "scriptbuilder")')
  .option('--remove', 'Remove all commands from this setup')
  .option('--preset <path>', 'Path to preset file (auto-discovers if not specified)')
  .action((toolName, options) => {
    const presetSourceName = `${toolName}-preset`;

    // Handle removal
    if (options.remove) {
      const count = registry.deleteCommandsBySource(presetSourceName);
      if (count > 0) {
        console.log(chalk.green(`✓ Removed ${count} command(s) from ${toolName} setup`));
      } else {
        console.log(chalk.yellow(`No commands found from ${toolName} setup`));
      }
      return;
    }

    // Auto-discover preset file
    let presetPath = options.preset;

    if (!presetPath) {
      const searchPaths = [
        // Relative to current directory
        path.join(process.cwd(), toolName, `${toolName}-preset.json`),
        // Sibling directory
        path.join(process.cwd(), '..', toolName, `${toolName}-preset.json`),
        // Relative to compiled bin directory (when in development)
        path.join(__dirname, '..', '..', toolName, `${toolName}-preset.json`)
      ];

      for (const searchPath of searchPaths) {
        if (fs.existsSync(searchPath)) {
          presetPath = searchPath;
          console.log(chalk.dim(`Found preset: ${presetPath}`));
          break;
        }
      }

      if (!presetPath) {
        console.error(chalk.red(`Error: Could not find ${toolName}-preset.json`));
        console.log(chalk.yellow('\nSearched in:'));
        searchPaths.forEach(p => console.log(chalk.dim(`  - ${p}`)));
        console.log(chalk.yellow('\nUse --preset <path> to specify the location manually.'));
        process.exit(1);
      }
    }

    // Verify preset file exists
    if (!fs.existsSync(presetPath)) {
      console.error(chalk.red(`Error: Preset file not found: ${presetPath}`));
      process.exit(1);
    }

    // Load preset
    let preset: any;
    try {
      const content = fs.readFileSync(presetPath, 'utf-8');
      preset = JSON.parse(content);
    } catch (error) {
      console.error(chalk.red('Error reading preset file:'), error);
      process.exit(1);
    }

    // Validate preset structure
    if (!preset.commands || !Array.isArray(preset.commands)) {
      console.error(chalk.red('Error: Invalid preset file - missing "commands" array'));
      process.exit(1);
    }

    // Detect tool path (directory containing the preset file)
    const toolPath = path.dirname(presetPath);
    console.log(chalk.dim(`Tool path: ${toolPath}`));

    // Check if setup already exists
    const existing = registry.getCommandsBySource(presetSourceName);
    if (existing.length > 0) {
      console.log(chalk.yellow(`\n⚠️  ${toolName} is already set up (${existing.length} commands)`));
      console.log(chalk.yellow('Run with --remove first to uninstall, then set up again.'));
      return;
    }

    // Display setup info
    console.log(chalk.bold(`\n🔧 ${preset.name} Setup\n`));
    if (preset.description) {
      console.log(chalk.dim(preset.description));
    }
    console.log(chalk.cyan(`\nThis will register ${preset.commands.length} command(s):\n`));

    preset.commands.forEach((cmd: any) => {
      console.log(chalk.dim(`  - ${cmd.name}`));
    });

    console.log('');

    // Register all commands
    let registered = 0;
    let failed = 0;

    for (const cmdDef of preset.commands) {
      try {
        // Substitute {SCRIPTBUILDER_PATH} with actual path
        const command = cmdDef.command.replace(/\{SCRIPTBUILDER_PATH\}/g, toolPath);

        registry.addCommand(
          cmdDef.name,
          command,
          cmdDef.description,
          cmdDef.tags,
          presetSourceName
        );

        registered++;
      } catch (error) {
        console.error(chalk.red(`✗ Failed to register ${cmdDef.name}:`), error);
        failed++;
      }
    }

    // Summary
    console.log(chalk.green(`\n✓ Setup complete! Registered ${registered}/${preset.commands.length} command(s)`));
    if (failed > 0) {
      console.log(chalk.red(`✗ ${failed} command(s) failed`));
    }

    console.log(chalk.dim(`\nTo remove: lazi setup ${toolName} --remove\n`));
  });

// ============================================================
// BATCH EXECUTION SYSTEM
// ============================================================

/**
 * Detect and execute batch commands before Commander parses
 * Example: lazi add cmd1 "echo hi" THEN idea add "note" THEN quick "test"
 */
const rawArgs = process.argv.slice(2);

// List of top-level commands that can be batched
const BATCH_COMMANDS = [
  'add', 'delete', 'run', 'quick', 'rerun', 'list', 'logs', 'events',
  'show', 'idea', 'promote', 'step', 'event', 'build'
];

/**
 * Split arguments into separate command batches using THEN separator
 */
function splitBatchCommands(args: string[]): string[][] {
  const batches: string[][] = [];
  let current: string[] = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === 'THEN') {
      // End current batch, start new one
      if (current.length > 0) {
        batches.push(current);
        current = [];
      }
    } else {
      current.push(args[i]);
    }
  }

  // Don't forget the last batch
  if (current.length > 0) {
    batches.push(current);
  }

  return batches;
}

const commandBatches = splitBatchCommands(rawArgs);

// If multiple commands detected, enter batch execution mode
if (commandBatches.length > 1) {
  (async () => {
    console.log(chalk.cyan(`\n🔄 Batch execution detected: ${commandBatches.length} commands\n`));

    // Create batch event start
    const eventId = logger.writeBatchStart(commandBatches.length, {
      sessionId: process.ppid?.toString() || process.pid.toString(),
      workingDir: process.cwd(),
      user: os.userInfo().username,
      hostname: os.hostname(),
      shell: process.env.SHELL || process.env.ComSpec || 'unknown'
    });

    let successCount = 0;
    let failureCount = 0;
    const startTime = Date.now();

    // Execute each command sequentially
    for (let i = 0; i < commandBatches.length; i++) {
      const batch = commandBatches[i];
      const stepNumber = i + 1;
      const commandName = batch[0];

      console.log(chalk.bold(`\n[${stepNumber}/${commandBatches.length}] ${commandName} ${batch.slice(1).join(' ')}`));
      console.log(chalk.gray('─'.repeat(60)));

      try {
        // Execute this command by spawning the actual compiled JS file
        // Using __filename ensures we use the real file, not npm wrapper
        const scriptPath = __filename; // In compiled version, this is bin/index.js

        await new Promise<void>((resolve) => {
          const child = spawn(process.execPath, [scriptPath, ...batch], {
            stdio: 'inherit'
          });

          child.on('close', (exitCode) => {
            const success = exitCode === 0;

            if (success) {
              successCount++;
            } else {
              failureCount++;
            }

            // Log this step
            logger.writeBatchStep(eventId, stepNumber, commandName, batch.join(' '), {
              exitCode: exitCode || 0,
              success
            });

            resolve();
          });

          child.on('error', (error) => {
            failureCount++;
            const errorMessage = error.message;
            console.error(chalk.red(`✗ Error: ${errorMessage}`));

            logger.writeBatchStep(eventId, stepNumber, commandName, batch.join(' '), {
              exitCode: 1,
              success: false,
              error: errorMessage
            });

            resolve();
          });
        });

      } catch (error) {
        failureCount++;
        const errorMessage = error instanceof Error ? error.message : String(error);

        console.error(chalk.red(`✗ Error: ${errorMessage}`));

        logger.writeBatchStep(eventId, stepNumber, commandName, batch.join(' '), {
          exitCode: 1,
          success: false,
          error: errorMessage
        });

        // Continue on error (don't stop)
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    // Write batch end event
    logger.writeBatchEnd(eventId, {
      totalCommands: commandBatches.length,
      successful: successCount,
      failed: failureCount,
      duration: `${duration}s`
    });

    // Summary
    console.log(chalk.gray('\n' + '─'.repeat(60)));
    console.log(chalk.bold('\n📊 Batch Execution Summary'));
    console.log(chalk.green(`  ✓ Successful: ${successCount}/${commandBatches.length}`));
    if (failureCount > 0) {
      console.log(chalk.red(`  ✗ Failed: ${failureCount}/${commandBatches.length}`));
    }
    console.log(chalk.cyan(`  ⏱  Duration: ${duration}s`));
    console.log(chalk.dim(`\n[Logged as Event-${eventId}]`));
    console.log(chalk.dim(`View with: lazi event ${eventId}\n`));

    process.exit(failureCount > 0 ? 1 : 0);
  })();
}

// ============================================================
// END BATCH EXECUTION SYSTEM
// ============================================================

// Only call program.parse() if NOT in batch mode
if (commandBatches.length === 1) {
  program.parse();
}
