import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Idea } from './types';
import { Config } from './config';

const getIdeasFile = () => path.join(Config.getStorageDir(), '.lazi-ideas.txt');
const getIdeaCounterFile = () => path.join(Config.getStorageDir(), '.lazi-idea-counter.txt');
const IDEA_SEPARATOR = '---\n';

export class IdeasManager {
  private getNextIdeaId(): number {
    try {
      Config.ensureStorageDir();
      if (fs.existsSync(getIdeaCounterFile())) {
        const counter = parseInt(fs.readFileSync(getIdeaCounterFile(), 'utf-8').trim(), 10);
        const nextId = counter + 1;
        fs.writeFileSync(getIdeaCounterFile(), nextId.toString(), 'utf-8');
        return nextId;
      } else {
        fs.writeFileSync(getIdeaCounterFile(), '1', 'utf-8');
        return 1;
      }
    } catch (error) {
      console.error('Error managing idea counter:', error);
      return Date.now(); // Fallback to timestamp
    }
  }

  public addIdea(
    text?: string,
    tags?: string[],
    attachedToLogId?: number,
    attachmentType?: 'command' | 'output',
    attachedToCommandName?: string
  ): number {
    try {
      const ideaId = this.getNextIdeaId();
      const createdAt = new Date().toLocaleString();

      let attachmentLine = '';
      if (attachedToLogId) {
        attachmentLine = `Attached-To: Log-${attachedToLogId} (${attachmentType || 'general'})`;
      } else if (attachedToCommandName) {
        attachmentLine = `Attached-To: Command[${attachedToCommandName}]`;
      }

      const ideaText = [
        `[Idea-${ideaId}] [${createdAt}]`,
        text ? `Text: ${text}` : '',
        attachmentLine,
        tags && tags.length > 0 ? `Tags: ${tags.join(', ')}` : '',
        IDEA_SEPARATOR
      ].filter(Boolean).join('\n');

      fs.appendFileSync(getIdeasFile(), ideaText, 'utf-8');
      return ideaId;
    } catch (error) {
      console.error('Error adding idea:', error);
      return -1;
    }
  }

  public addPropertyIdea(
    key: string,
    value: string,
    attachedToLogId?: number,
    attachmentType?: 'command' | 'output',
    attachedToCommandName?: string
  ): number {
    try {
      const ideaId = this.getNextIdeaId();
      const createdAt = new Date().toLocaleString();

      let attachmentLine = '';
      if (attachedToLogId) {
        attachmentLine = `Attached-To: Log-${attachedToLogId} (${attachmentType || 'general'})`;
      } else if (attachedToCommandName) {
        attachmentLine = `Attached-To: Command[${attachedToCommandName}]`;
      }

      const ideaText = [
        `[Idea-${ideaId}] [${createdAt}]`,
        `${key}: ${value}`,
        attachmentLine,
        IDEA_SEPARATOR
      ].filter(Boolean).join('\n');

      fs.appendFileSync(getIdeasFile(), ideaText, 'utf-8');
      return ideaId;
    } catch (error) {
      console.error('Error adding property idea:', error);
      return -1;
    }
  }

  public getIdeas(filter?: 'standalone' | 'attached' | 'command-level' | 'log-level'): string {
    try {
      if (!fs.existsSync(getIdeasFile())) {
        return '';
      }

      const content = fs.readFileSync(getIdeasFile(), 'utf-8');

      if (!filter) {
        return content;
      }

      const entries = content.split(IDEA_SEPARATOR).filter(e => e.trim());
      let filtered: string[];

      if (filter === 'standalone') {
        filtered = entries.filter(entry => !entry.includes('Attached-To:'));
      } else if (filter === 'attached') {
        filtered = entries.filter(entry => entry.includes('Attached-To:'));
      } else if (filter === 'command-level') {
        filtered = entries.filter(entry => entry.includes('Attached-To: Command['));
      } else if (filter === 'log-level') {
        filtered = entries.filter(entry => entry.includes('Attached-To: Log-'));
      } else {
        filtered = entries;
      }

      return filtered.join(IDEA_SEPARATOR) + (filtered.length > 0 ? IDEA_SEPARATOR : '');
    } catch (error) {
      console.error('Error reading ideas:', error);
      return '';
    }
  }

  public searchIdeas(query: string): string {
    try {
      if (!fs.existsSync(getIdeasFile())) {
        return '';
      }

      const content = fs.readFileSync(getIdeasFile(), 'utf-8');
      const entries = content.split(IDEA_SEPARATOR).filter(e => e.trim());

      const lowerQuery = query.toLowerCase();
      const matchingEntries = entries.filter(entry =>
        entry.toLowerCase().includes(lowerQuery)
      );

      return matchingEntries.join(IDEA_SEPARATOR) + (matchingEntries.length > 0 ? IDEA_SEPARATOR : '');
    } catch (error) {
      console.error('Error searching ideas:', error);
      return '';
    }
  }

  public getIdeasForLog(logId: number): string {
    try {
      if (!fs.existsSync(getIdeasFile())) {
        return '';
      }

      const content = fs.readFileSync(getIdeasFile(), 'utf-8');
      const entries = content.split(IDEA_SEPARATOR).filter(e => e.trim());

      const matchingEntries = entries.filter(entry =>
        entry.includes(`Attached-To: Log-${logId}`)
      );

      return matchingEntries.join(IDEA_SEPARATOR) + (matchingEntries.length > 0 ? IDEA_SEPARATOR : '');
    } catch (error) {
      console.error('Error getting ideas for log:', error);
      return '';
    }
  }

  public getIdeasForCommand(commandName: string): string {
    try {
      if (!fs.existsSync(getIdeasFile())) {
        return '';
      }

      const content = fs.readFileSync(getIdeasFile(), 'utf-8');
      const entries = content.split(IDEA_SEPARATOR).filter(e => e.trim());

      const matchingEntries = entries.filter(entry =>
        entry.includes(`Attached-To: Command[${commandName}]`)
      );

      return matchingEntries.join(IDEA_SEPARATOR) + (matchingEntries.length > 0 ? IDEA_SEPARATOR : '');
    } catch (error) {
      console.error('Error getting ideas for command:', error);
      return '';
    }
  }

  public deleteIdea(ideaId: number): boolean {
    try {
      if (!fs.existsSync(getIdeasFile())) {
        return false;
      }

      const content = fs.readFileSync(getIdeasFile(), 'utf-8');
      const entries = content.split(IDEA_SEPARATOR).filter(e => e.trim());

      const filtered = entries.filter(entry => !entry.includes(`[Idea-${ideaId}]`));

      if (filtered.length === entries.length) {
        return false; // Idea not found
      }

      const newContent = filtered.join(IDEA_SEPARATOR) + (filtered.length > 0 ? IDEA_SEPARATOR : '');
      fs.writeFileSync(getIdeasFile(), newContent, 'utf-8');
      return true;
    } catch (error) {
      console.error('Error deleting idea:', error);
      return false;
    }
  }

  public getIdeaCount(): number {
    try {
      if (!fs.existsSync(getIdeasFile())) {
        return 0;
      }

      const content = fs.readFileSync(getIdeasFile(), 'utf-8');
      const entries = content.split(IDEA_SEPARATOR).filter(e => e.trim());
      return entries.length;
    } catch (error) {
      return 0;
    }
  }

  public clearIdeas(): void {
    try {
      if (fs.existsSync(getIdeasFile())) {
        fs.unlinkSync(getIdeasFile());
      }
      if (fs.existsSync(getIdeaCounterFile())) {
        fs.unlinkSync(getIdeaCounterFile());
      }
    } catch (error) {
      console.error('Error clearing ideas:', error);
      throw error;
    }
  }
}
