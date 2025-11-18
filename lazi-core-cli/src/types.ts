export interface Command {
  name: string;
  command: string;
  description?: string;
  tags?: string[];
  parameters?: string[];
  source?: string; // e.g., "scriptbuilder-preset" for commands from setup
  createdAt: string;
  updatedAt: string;
}

export interface Registry {
  commands: Record<string, Command>;
}

export interface SessionInfo {
  sessionId: string;
  workingDir: string;
  user: string;
  hostname: string;
  shell: string;
}

export interface LogEntry {
  id: number;
  timestamp: string;
  commandName: string;
  commandExecuted: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  sessionInfo: SessionInfo;
  // Event-based logging fields (optional for backward compatibility)
  eventType?: 'single' | 'event-start' | 'event-step' | 'event-end';
  parentEventId?: number;
  scriptName?: string;
  stepNumber?: number;
  stepName?: string;
  totalSteps?: number;
  duration?: number; // in seconds
  scriptContent?: string; // Full script content for event reruns
}

export interface Idea {
  id: number;
  createdAt: string;
  tags?: string[];
  attachedToLogId?: number;
  attachedToCommandName?: string;
  attachmentType?: 'command' | 'output';
  // Either text-based OR property-based
  text?: string;
  properties?: Record<string, string>;
}
