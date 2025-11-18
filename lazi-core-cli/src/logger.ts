import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { LogEntry } from './types';
import { Config } from './config';

const getLogFile = () => path.join(Config.getStorageDir(), '.lazi-log.txt');
const getCounterFile = () => path.join(Config.getStorageDir(), '.lazi-counter.txt');
const LOG_SEPARATOR = '---\n';

export class Logger {
  private getNextLogId(): number {
    try {
      Config.ensureStorageDir();
      const counterFile = getCounterFile();
      if (fs.existsSync(counterFile)) {
        const counter = parseInt(fs.readFileSync(counterFile, 'utf-8').trim(), 10);
        const nextId = counter + 1;
        fs.writeFileSync(counterFile, nextId.toString(), 'utf-8');
        return nextId;
      } else {
        fs.writeFileSync(counterFile, '1', 'utf-8');
        return 1;
      }
    } catch (error) {
      console.error('Error managing log counter:', error);
      return Date.now(); // Fallback to timestamp
    }
  }

  public writeLog(entry: LogEntry): number {
    try {
      Config.ensureStorageDir();
      const logId = entry.id || this.getNextLogId();
      const timestamp = new Date(entry.timestamp).toLocaleString();
      const session = entry.sessionInfo;
      const sessionLine = `Session: ${session.sessionId} | ${session.user}@${session.hostname} | ${session.workingDir}`;

      const logText = [
        `[Log-${logId}] [${timestamp}] ${entry.commandName} (${entry.commandExecuted})`,
        sessionLine,
        `Shell: ${session.shell}`,
        `Exit Code: ${entry.exitCode}`,
        entry.stdout ? `Output:\n${entry.stdout}` : 'Output: (no output)',
        entry.stderr ? `Errors:\n${entry.stderr}` : '',
        LOG_SEPARATOR
      ].filter(Boolean).join('\n');

      fs.appendFileSync(getLogFile(), logText, 'utf-8');
      return logId;
    } catch (error) {
      console.error('Error writing to log file:', error);
      return -1;
    }
  }

  public readLogs(count?: number): string {
    try {
      if (!fs.existsSync(getLogFile())) {
        return '';
      }

      const content = fs.readFileSync(getLogFile(), 'utf-8');
      // Normalize line endings
      const normalized = content.replace(/\r\n/g, '\n');

      if (!count) {
        return normalized;
      }

      // Split by separator and get last N entries
      const entries = normalized.split(LOG_SEPARATOR).filter(e => e.trim());
      const lastEntries = entries.slice(-count);

      return lastEntries.join(LOG_SEPARATOR) + (lastEntries.length > 0 ? LOG_SEPARATOR : '');
    } catch (error) {
      console.error('Error reading log file:', error);
      return '';
    }
  }

  public searchLogs(query: string): string {
    try {
      if (!fs.existsSync(getLogFile())) {
        return '';
      }

      const content = fs.readFileSync(getLogFile(), 'utf-8');
      // Normalize line endings
      const normalized = content.replace(/\r\n/g, '\n');
      const entries = normalized.split(LOG_SEPARATOR).filter(e => e.trim());

      const lowerQuery = query.toLowerCase();
      const matchingEntries = entries.filter(entry =>
        entry.toLowerCase().includes(lowerQuery)
      );

      return matchingEntries.join(LOG_SEPARATOR) + (matchingEntries.length > 0 ? LOG_SEPARATOR : '');
    } catch (error) {
      console.error('Error searching log file:', error);
      return '';
    }
  }

  public clearLogs(): void {
    try {
      if (fs.existsSync(getLogFile())) {
        fs.unlinkSync(getLogFile());
      }
    } catch (error) {
      console.error('Error clearing log file:', error);
      throw error;
    }
  }

  public getLogCount(): number {
    try {
      if (!fs.existsSync(getLogFile())) {
        return 0;
      }

      const content = fs.readFileSync(getLogFile(), 'utf-8');
      // Normalize line endings before splitting
      const normalized = content.replace(/\r\n/g, '\n');
      const entries = normalized.split(LOG_SEPARATOR).filter(e => e.trim());
      return entries.length;
    } catch (error) {
      return 0;
    }
  }

  public searchBySession(sessionId: string): string {
    try {
      if (!fs.existsSync(getLogFile())) {
        return '';
      }

      const content = fs.readFileSync(getLogFile(), 'utf-8');
      // Normalize line endings
      const normalized = content.replace(/\r\n/g, '\n');
      const entries = normalized.split(LOG_SEPARATOR).filter(e => e.trim());

      const matchingEntries = entries.filter(entry =>
        entry.includes(`Session: ${sessionId}`)
      );

      return matchingEntries.join(LOG_SEPARATOR) + (matchingEntries.length > 0 ? LOG_SEPARATOR : '');
    } catch (error) {
      console.error('Error searching logs by session:', error);
      return '';
    }
  }

  // ===== EVENT-BASED LOGGING METHODS =====

  /**
   * Start a script event - creates the parent event-start log entry
   * @param scriptContent - Optional full script content for rerun support
   * @returns Event ID (parent log ID)
   */
  public startEventLog(scriptName: string, scriptType: string, totalSteps: number, scriptContent?: string): number {
    try {
      const logId = this.getNextLogId();
      const timestamp = new Date().toLocaleString();

      const sessionInfo = {
        sessionId: process.ppid.toString(),
        workingDir: process.cwd(),
        user: os.userInfo().username,
        hostname: os.hostname(),
        shell: process.env.SHELL || process.env.ComSpec || 'unknown'
      };

      const sessionLine = `Session: ${sessionInfo.sessionId} | ${sessionInfo.user}@${sessionInfo.hostname} | ${sessionInfo.workingDir}`;

      const logText = [
        `[Log-${logId}] [${timestamp}] EVENT-START: ${scriptName}`,
        'Event-Type: event-start',
        `Script-Type: ${scriptType}`,
        `Total-Steps: ${totalSteps}`,
        sessionLine,
        `Shell: ${sessionInfo.shell}`,
        scriptContent ? `Script-Content:\n${scriptContent}` : '',
        LOG_SEPARATOR
      ].filter(Boolean).join('\n');

      fs.appendFileSync(getLogFile(), logText, 'utf-8');
      return logId;
    } catch (error) {
      console.error('Error writing event-start log:', error);
      return -1;
    }
  }

  /**
   * Log a step in the script event (metadata only, no output)
   * @returns Step log ID
   */
  public writeStepLog(parentEventId: number, stepNumber: number, stepName: string, stepCode?: string): number {
    try {
      Config.ensureStorageDir();
      const logId = this.getNextLogId();
      const timestamp = new Date().toLocaleString();

      const logTextParts = [
        `[Log-${logId}] [${timestamp}] STEP-${stepNumber}: ${stepName}`,
        'Event-Type: event-step',
        `Parent-Event: ${parentEventId}`
      ];

      if (stepCode) {
        logTextParts.push(`Step-Code:\n${stepCode}`);
      }

      logTextParts.push(LOG_SEPARATOR);

      const logText = logTextParts.join('\n');

      fs.appendFileSync(getLogFile(), logText, 'utf-8');
      return logId;
    } catch (error) {
      console.error('Error writing step log:', error);
      return -1;
    }
  }

  /**
   * End a script event - creates the final event-end log entry with full output
   * @returns Event-end log ID
   */
  public endEventLog(
    parentEventId: number,
    scriptName: string,
    overallExitCode: number,
    stdout: string,
    stderr: string,
    totalDuration: number
  ): number {
    try {
      const logId = this.getNextLogId();
      const timestamp = new Date().toLocaleString();

      const logText = [
        `[Log-${logId}] [${timestamp}] EVENT-END: ${scriptName}`,
        'Event-Type: event-end',
        `Parent-Event: ${parentEventId}`,
        `Overall-Exit-Code: ${overallExitCode}`,
        `Total-Duration: ${totalDuration.toFixed(2)}s`,
        stdout ? `Output:\n${stdout}` : 'Output: (no output)',
        stderr ? `Errors:\n${stderr}` : 'Errors: (none)',
        LOG_SEPARATOR
      ].join('\n');

      fs.appendFileSync(getLogFile(), logText, 'utf-8');
      return logId;
    } catch (error) {
      console.error('Error writing event-end log:', error);
      return -1;
    }
  }

  /**
   * Start a batch execution event
   * @returns Batch event ID
   */
  public writeBatchStart(totalCommands: number, sessionInfo: any): number {
    try {
      Config.ensureStorageDir();
      const logId = this.getNextLogId();
      const timestamp = new Date().toLocaleString();

      const logText = [
        `[Log-${logId}] [${timestamp}] EVENT-START: Batch Execution`,
        'Event-Type: batch-start',
        `Total-Commands: ${totalCommands}`,
        `Session: ${sessionInfo.sessionId} | ${sessionInfo.user}@${sessionInfo.hostname} | ${sessionInfo.workingDir}`,
        `Shell: ${sessionInfo.shell}`,
        LOG_SEPARATOR
      ].join('\n');

      fs.appendFileSync(getLogFile(), logText, 'utf-8');
      return logId;
    } catch (error) {
      console.error('Error writing batch start log:', error);
      return -1;
    }
  }

  /**
   * Log a step in batch execution
   * @returns Step log ID
   */
  public writeBatchStep(
    parentEventId: number,
    stepNumber: number,
    commandName: string,
    fullCommand: string,
    result: { exitCode: number; success: boolean; error?: string }
  ): number {
    try {
      Config.ensureStorageDir();
      const logId = this.getNextLogId();
      const timestamp = new Date().toLocaleString();

      const logText = [
        `[Log-${logId}] [${timestamp}] STEP-${stepNumber}: ${commandName}`,
        'Event-Type: batch-step',
        `Parent-Event: ${parentEventId}`,
        `Command: ${fullCommand}`,
        `Exit-Code: ${result.exitCode}`,
        `Status: ${result.success ? 'Success' : 'Failed'}`,
        result.error ? `Error: ${result.error}` : '',
        LOG_SEPARATOR
      ].filter(Boolean).join('\n');

      fs.appendFileSync(getLogFile(), logText, 'utf-8');
      return logId;
    } catch (error) {
      console.error('Error writing batch step log:', error);
      return -1;
    }
  }

  /**
   * End a batch execution event
   * @returns Event-end log ID
   */
  public writeBatchEnd(
    parentEventId: number,
    stats: { totalCommands: number; successful: number; failed: number; duration: string }
  ): number {
    try {
      Config.ensureStorageDir();
      const logId = this.getNextLogId();
      const timestamp = new Date().toLocaleString();

      const logText = [
        `[Log-${logId}] [${timestamp}] EVENT-END: Batch Execution`,
        'Event-Type: batch-end',
        `Parent-Event: ${parentEventId}`,
        `Total-Commands: ${stats.totalCommands}`,
        `Successful: ${stats.successful}`,
        `Failed: ${stats.failed}`,
        `Duration: ${stats.duration}`,
        LOG_SEPARATOR
      ].join('\n');

      fs.appendFileSync(getLogFile(), logText, 'utf-8');
      return logId;
    } catch (error) {
      console.error('Error writing batch end log:', error);
      return -1;
    }
  }

  /**
   * Get all log entries for a specific event (start, steps, end)
   * @returns Array of log entries as strings
   */
  public getEventLogs(parentEventId: number): string[] {
    try {
      if (!fs.existsSync(getLogFile())) {
        return [];
      }

      const content = fs.readFileSync(getLogFile(), 'utf-8');
      const normalized = content.replace(/\r\n/g, '\n');
      const entries = normalized.split(LOG_SEPARATOR).filter(e => e.trim());

      // Find event-start entry with this ID
      const eventStartEntry = entries.find(entry =>
        entry.includes(`[Log-${parentEventId}]`) && entry.includes('EVENT-START')
      );

      if (!eventStartEntry) {
        return [];
      }

      // Find all entries that reference this parent event
      const relatedEntries = entries.filter(entry =>
        entry.includes(`Parent-Event: ${parentEventId}`)
      );

      return [eventStartEntry, ...relatedEntries];
    } catch (error) {
      console.error('Error getting event logs:', error);
      return [];
    }
  }

  /**
   * Get all event-start entries (all script runs)
   * @returns Array of event-start log entries as strings
   */
  public getAllEvents(): string[] {
    try {
      if (!fs.existsSync(getLogFile())) {
        return [];
      }

      const content = fs.readFileSync(getLogFile(), 'utf-8');
      const normalized = content.replace(/\r\n/g, '\n');
      const entries = normalized.split(LOG_SEPARATOR).filter(e => e.trim());

      return entries.filter(entry => entry.includes('EVENT-START'));
    } catch (error) {
      console.error('Error getting all events:', error);
      return [];
    }
  }

  /**
   * Get a specific log entry by its ID
   * @param logId - The ID of the log entry to retrieve
   * @returns Object with command/event info, or null if not found
   */
  public getLogById(logId: number): {
    commandName: string;
    commandExecuted?: string;
    isEvent?: boolean;
    scriptType?: string;
    scriptContent?: string;
  } | null {
    try {
      if (!fs.existsSync(getLogFile())) {
        return null;
      }

      const content = fs.readFileSync(getLogFile(), 'utf-8');
      const normalized = content.replace(/\r\n/g, '\n');
      const entries = normalized.split(LOG_SEPARATOR).filter(e => e.trim());

      // Find the entry with matching log ID
      for (const entry of entries) {
        // Check if this entry has the matching log ID
        const logIdMatch = entry.match(/\[Log-(\d+)\]/);
        if (logIdMatch && parseInt(logIdMatch[1], 10) === logId) {
          // Check if this is an EVENT-START entry
          if (entry.includes('Event-Type: event-start')) {
            // Extract event information
            const scriptNameMatch = entry.match(/EVENT-START: (.+)/);
            const scriptTypeMatch = entry.match(/Script-Type: (.+)/);
            const scriptContentMatch = entry.match(/Script-Content:\n([\s\S]+?)(?=\n---|\n$)/);

            if (!scriptNameMatch || !scriptTypeMatch) {
              return null; // Missing required event fields
            }

            return {
              commandName: scriptNameMatch[1].trim(),
              isEvent: true,
              scriptType: scriptTypeMatch[1].trim(),
              scriptContent: scriptContentMatch ? scriptContentMatch[1].trim() : undefined
            };
          }

          // Skip other event types (event-step, event-end)
          if (entry.includes('Event-Type:')) {
            return null;
          }

          // Extract both command name and executed command
          // Format: [Log-N] [timestamp] commandName (actualCommand)
          const firstLine = entry.split('\n')[0];
          const fullMatch = firstLine.match(/\[Log-\d+\] \[.*?\] (.*?) \((.*?)\)$/);

          if (fullMatch && fullMatch[1] && fullMatch[2]) {
            return {
              commandName: fullMatch[1].trim(),
              commandExecuted: fullMatch[2].trim()
            };
          }

          // If no parentheses format found (e.g., quick commands), extract just the command
          const simpleMatch = firstLine.match(/\[Log-\d+\] \[.*?\] (.*)/);
          if (simpleMatch && simpleMatch[1]) {
            const cmd = simpleMatch[1].trim();
            return {
              commandName: cmd, // Use the command itself as the name
              commandExecuted: cmd
            };
          }
        }
      }

      return null; // Log ID not found
    } catch (error) {
      console.error('Error getting log by ID:', error);
      return null;
    }
  }

  /**
   * Get step code for a specific step log entry
   * @param logId - The ID of the step log entry
   * @returns Object with step info and code, or null if not found
   */
  public getStepCode(logId: number): {
    stepNumber: number;
    stepName: string;
    parentEvent: number;
    stepCode?: string;
  } | null {
    try {
      if (!fs.existsSync(getLogFile())) {
        return null;
      }

      const content = fs.readFileSync(getLogFile(), 'utf-8');
      const normalized = content.replace(/\r\n/g, '\n');
      const entries = normalized.split(LOG_SEPARATOR).filter(e => e.trim());

      // Find the entry with matching log ID
      for (const entry of entries) {
        const logIdMatch = entry.match(/\[Log-(\d+)\]/);
        if (logIdMatch && parseInt(logIdMatch[1], 10) === logId) {
          // Check if this is a step entry
          if (entry.includes('Event-Type: event-step')) {
            // Extract step information
            const firstLine = entry.split('\n')[0];
            const stepMatch = firstLine.match(/STEP-(\d+): (.+)/);
            const parentEventMatch = entry.match(/Parent-Event: (\d+)/);
            const stepCodeMatch = entry.match(/Step-Code:\n([\s\S]+?)(?=\n---|\n$)/);

            if (!stepMatch || !parentEventMatch) {
              return null; // Missing required step fields
            }

            return {
              stepNumber: parseInt(stepMatch[1], 10),
              stepName: stepMatch[2].trim(),
              parentEvent: parseInt(parentEventMatch[1], 10),
              stepCode: stepCodeMatch ? stepCodeMatch[1].trim() : undefined
            };
          }

          // Not a step entry
          return null;
        }
      }

      return null; // Log ID not found
    } catch (error) {
      console.error('Error getting step code:', error);
      return null;
    }
  }

  /**
   * Get all steps for a specific event
   * @param eventId - The parent event ID
   * @returns Array of steps with their info and code
   */
  public getStepsByEvent(eventId: number): Array<{
    logId: number;
    stepNumber: number;
    stepName: string;
    stepCode?: string;
  }> {
    try {
      if (!fs.existsSync(getLogFile())) {
        return [];
      }

      const content = fs.readFileSync(getLogFile(), 'utf-8');
      const normalized = content.replace(/\r\n/g, '\n');
      const entries = normalized.split(LOG_SEPARATOR).filter(e => e.trim());

      const steps: Array<{
        logId: number;
        stepNumber: number;
        stepName: string;
        stepCode?: string;
      }> = [];

      // Find all step entries with matching parent event
      for (const entry of entries) {
        if (entry.includes('Event-Type: event-step')) {
          const parentEventMatch = entry.match(/Parent-Event: (\d+)/);

          if (parentEventMatch && parseInt(parentEventMatch[1], 10) === eventId) {
            const logIdMatch = entry.match(/\[Log-(\d+)\]/);
            const firstLine = entry.split('\n')[0];
            const stepMatch = firstLine.match(/STEP-(\d+): (.+)/);
            const stepCodeMatch = entry.match(/Step-Code:\n([\s\S]+?)(?=\n---|\n$)/);

            if (logIdMatch && stepMatch) {
              steps.push({
                logId: parseInt(logIdMatch[1], 10),
                stepNumber: parseInt(stepMatch[1], 10),
                stepName: stepMatch[2].trim(),
                stepCode: stepCodeMatch ? stepCodeMatch[1].trim() : undefined
              });
            }
          }
        }
      }

      // Sort by step number
      return steps.sort((a, b) => a.stepNumber - b.stepNumber);
    } catch (error) {
      console.error('Error getting steps by event:', error);
      return [];
    }
  }
}
