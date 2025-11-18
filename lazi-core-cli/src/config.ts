import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Configuration management for Lazi Core-CLI
 * Handles storage directory location and config file
 */
export class Config {
  private static CONFIG_FILE = path.join(os.homedir(), '.lazi-config.json');
  private static DEFAULT_STORAGE_DIR = path.join(os.homedir(), '.lazi');

  /**
   * Get the storage directory path
   * Reads from config file if exists, otherwise returns default
   */
  static getStorageDir(): string {
    try {
      if (fs.existsSync(this.CONFIG_FILE)) {
        const config = JSON.parse(fs.readFileSync(this.CONFIG_FILE, 'utf-8'));
        if (config.storageDir) {
          return config.storageDir;
        }
      }
    } catch (error) {
      console.error('Warning: Error reading config file, using default storage location');
    }

    return this.DEFAULT_STORAGE_DIR;
  }

  /**
   * Set the storage directory path
   * Only creates config file if path is non-default
   */
  static setStorageDir(dir: string): void {
    const resolvedDir = path.resolve(dir);

    // If setting to default, remove config file
    if (resolvedDir === this.DEFAULT_STORAGE_DIR) {
      if (fs.existsSync(this.CONFIG_FILE)) {
        fs.unlinkSync(this.CONFIG_FILE);
      }
      return;
    }

    // Otherwise, write config file
    const config = { storageDir: resolvedDir };
    fs.writeFileSync(this.CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
  }

  /**
   * Check if using default storage location
   */
  static isDefaultLocation(): boolean {
    return this.getStorageDir() === this.DEFAULT_STORAGE_DIR;
  }

  /**
   * Get the config file path
   */
  static getConfigFile(): string {
    return this.CONFIG_FILE;
  }

  /**
   * Ensure storage directory exists
   */
  static ensureStorageDir(): void {
    const storageDir = this.getStorageDir();
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }

    // Ensure workflows subdirectory exists
    const workflowsDir = path.join(storageDir, 'workflows');
    if (!fs.existsSync(workflowsDir)) {
      fs.mkdirSync(workflowsDir, { recursive: true });
    }
  }
}
