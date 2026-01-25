import { ErrorLogEntry } from './ErrorLogger';
import { ErrorLoggingConfig } from '../config/WebhookConfig';

/**
 * Optional document logging to SiyuanNote
 */
export class DocumentLogger {
  constructor(private config: ErrorLoggingConfig) {}

  /**
   * Log error to SiyuanNote document
   */
  async logError(entry: ErrorLogEntry): Promise<void> {
    if (!this.config.enableDocumentLogging) {
      return;
    }

    if (this.config.format === 'daily-summary') {
      await this.appendToDailySummary(entry);
    } else {
      await this.createErrorDocument(entry);
    }
  }

  /**
   * Append to daily summary document
   */
  private async appendToDailySummary(entry: ErrorLogEntry): Promise<void> {
    // Placeholder: Integrate with SiyuanNote API
    console.log('Would append to daily summary:', entry);
  }

  /**
   * Create individual error document
   */
  private async createErrorDocument(entry: ErrorLogEntry): Promise<void> {
    // Placeholder: Integrate with SiyuanNote API
    console.log('Would create error document:', entry);
  }
}
