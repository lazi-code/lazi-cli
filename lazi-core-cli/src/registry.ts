import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Command, Registry } from './types';
import { Config } from './config';

const getRegistryFile = () => path.join(Config.getStorageDir(), '.lazi.json');

export class CommandRegistry {
  private registry: Registry;

  constructor() {
    this.registry = this.loadRegistry();
  }

  private extractParameters(command: string): string[] {
    const paramRegex = /\{([^}]+)\}/g;
    const params: string[] = [];
    let match;

    while ((match = paramRegex.exec(command)) !== null) {
      params.push(match[1]);
    }

    return params;
  }

  public substituteParameters(command: string, params: Record<string, string>): string {
    let result = command;

    for (const [key, value] of Object.entries(params)) {
      result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
    }

    return result;
  }

  private loadRegistry(): Registry {
    try {
      Config.ensureStorageDir();
      const registryFile = getRegistryFile();
      if (fs.existsSync(registryFile)) {
        const data = fs.readFileSync(registryFile, 'utf-8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('Error loading registry:', error);
    }
    return { commands: {} };
  }

  private saveRegistry(): void {
    try {
      Config.ensureStorageDir();
      const registryFile = getRegistryFile();
      fs.writeFileSync(registryFile, JSON.stringify(this.registry, null, 2), 'utf-8');
    } catch (error) {
      console.error('Error saving registry:', error);
      throw error;
    }
  }

  addCommand(name: string, command: string, description?: string, tags?: string[], source?: string): void {
    const now = new Date().toISOString();
    const parameters = this.extractParameters(command);

    this.registry.commands[name] = {
      name,
      command,
      description,
      tags,
      parameters: parameters.length > 0 ? parameters : undefined,
      source,
      createdAt: now,
      updatedAt: now
    };
    this.saveRegistry();
  }

  getCommand(name: string): Command | undefined {
    return this.registry.commands[name];
  }

  getAllCommands(): Command[] {
    return Object.values(this.registry.commands);
  }

  deleteCommand(name: string): boolean {
    if (this.registry.commands[name]) {
      delete this.registry.commands[name];
      this.saveRegistry();
      return true;
    }
    return false;
  }

  updateCommand(name: string, updates: Partial<Omit<Command, 'name' | 'createdAt'>>): boolean {
    if (this.registry.commands[name]) {
      this.registry.commands[name] = {
        ...this.registry.commands[name],
        ...updates,
        updatedAt: new Date().toISOString()
      };
      this.saveRegistry();
      return true;
    }
    return false;
  }

  searchCommands(query: string): Command[] {
    const lowerQuery = query.toLowerCase();
    return this.getAllCommands().filter(cmd =>
      cmd.name.toLowerCase().includes(lowerQuery) ||
      cmd.command.toLowerCase().includes(lowerQuery) ||
      cmd.description?.toLowerCase().includes(lowerQuery) ||
      cmd.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }

  getCommandsBySource(source: string): Command[] {
    return this.getAllCommands().filter(cmd => cmd.source === source);
  }

  deleteCommandsBySource(source: string): number {
    const commandsToDelete = this.getCommandsBySource(source);
    commandsToDelete.forEach(cmd => {
      delete this.registry.commands[cmd.name];
    });

    if (commandsToDelete.length > 0) {
      this.saveRegistry();
    }

    return commandsToDelete.length;
  }
}
