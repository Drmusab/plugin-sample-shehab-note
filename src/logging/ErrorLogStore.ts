import * as fs from 'fs/promises';
import * as path from 'path';
import { ErrorLogEntry } from './ErrorLogger';

/**
 * Error log persistence (JSONL format)
 */
export class ErrorLogStore {
  private logDir: string;

  constructor(dataDir: string) {
    this.logDir = path.join(dataDir, 'logs');
  }

  /**
   * Initialize storage
   */
  async init(): Promise<void> {
    await fs.mkdir(this.logDir, { recursive: true });
  }

  /**
   * Append error to log file
   */
  async appendError(entry: ErrorLogEntry): Promise<void> {
    const logFile = this.getLogFile(entry.timestamp);
    const line = JSON.stringify(entry) + '\n';
    await fs.appendFile(logFile, line, 'utf-8');
  }

  /**
   * Update error entry (for resolved status)
   */
  async updateError(entry: ErrorLogEntry): Promise<void> {
    // For JSONL, we append updated version
    // Real implementation would use proper update mechanism
    await this.appendError(entry);
  }

  /**
   * Get log file path for date
   */
  private getLogFile(timestamp: string): string {
    const date = new Date(timestamp).toISOString().split('T')[0];
    return path.join(this.logDir, `errors-${date}.jsonl`);
  }

  /**
   * Rotate old logs (called periodically)
   */
  async rotateLogs(retentionDays: number): Promise<void> {
    const files = await fs.readdir(this.logDir);
    const now = Date.now();
    const maxAge = retentionDays * 24 * 60 * 60 * 1000;

    for (const file of files) {
      if (!file.startsWith('errors-')) continue;

      const filePath = path.join(this.logDir, file);
      const stats = await fs.stat(filePath);
      const age = now - stats.mtimeMs;

      if (age > maxAge) {
        await fs.unlink(filePath);
      }
    }
  }
}
