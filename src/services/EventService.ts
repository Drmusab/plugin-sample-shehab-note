import type { Plugin } from "siyuan";
import type { Task } from "@/core/models/Task";
import type { NotificationConfig, TaskEventPayload, TaskEventType, QueueItem } from "./types";
import { createTaskSnapshot } from "./types";
import {
  DEFAULT_NOTIFICATION_CONFIG,
  EVENT_DEDUPE_LIMIT,
  EVENT_QUEUE_INTERVAL_MS,
  EVENT_QUEUE_KEY,
  PLUGIN_EVENT_SOURCE,
  PLUGIN_EVENT_VERSION,
  SETTINGS_KEY,
} from "@/utils/constants";

const RETRY_BASE_DELAY_MS = 30 * 1000;
const RETRY_MAX_DELAY_MS = 30 * 60 * 1000;

type Fetcher = typeof fetch;

/**
 * EventService emits structured task events to n8n and manages retry queue.
 */
export class EventService {
  private plugin: Plugin;
  private config: NotificationConfig;
  private queue: QueueItem[] = [];
  private dedupeKeys: Set<string> = new Set();
  private flushIntervalId: number | null = null;
  private fetcher: Fetcher;

  constructor(plugin: Plugin, fetcher: Fetcher = fetch) {
    this.plugin = plugin;
    this.fetcher = fetcher;
    this.config = { ...DEFAULT_NOTIFICATION_CONFIG };
  }

  /**
   * Initialize the event service
   */
  async init(): Promise<void> {
    await this.loadConfig();
    await this.loadQueue();
    await this.flushQueueOnStartup();
    this.startQueueWorker();
  }

  /**
   * Flush queue on startup to handle pending events from previous session
   */
  async flushQueueOnStartup(): Promise<void> {
    if (this.queue.length > 0) {
      console.log(`Found ${this.queue.length} pending events from previous session`);
      await this.flushQueue();
    }
  }

  /**
   * Load configuration from storage
   */
  private async loadConfig(): Promise<void> {
    try {
      const data = await this.plugin.loadData(SETTINGS_KEY);
      if (data) {
        this.config = { ...DEFAULT_NOTIFICATION_CONFIG, ...data };
      }
    } catch (err) {
      console.error("Failed to load event config:", err);
    }
  }

  /**
   * Save configuration to storage
   */
  async saveConfig(config: NotificationConfig): Promise<void> {
    this.config = config;
    await this.plugin.saveData(SETTINGS_KEY, config);
  }

  /**
   * Load queued events and dedupe keys from storage
   */
  private async loadQueue(): Promise<void> {
    try {
      const data = await this.plugin.loadData(EVENT_QUEUE_KEY);
      if (data) {
        this.queue = Array.isArray(data.queue) ? data.queue : [];
        const dedupe = Array.isArray(data.dedupeKeys) ? data.dedupeKeys : [];
        this.dedupeKeys = new Set(dedupe);
      }
    } catch (err) {
      console.error("Failed to load event queue:", err);
      this.queue = [];
      this.dedupeKeys = new Set();
    }
  }

  /**
   * Persist queue and dedupe keys
   */
  private async persistQueue(): Promise<void> {
    const dedupeKeys = Array.from(this.dedupeKeys).slice(-EVENT_DEDUPE_LIMIT);
    await this.plugin.saveData(EVENT_QUEUE_KEY, {
      queue: this.queue,
      dedupeKeys,
    });
  }

  /**
   * Start queue worker to retry failed events
   */
  private startQueueWorker(): void {
    if (this.flushIntervalId !== null) {
      return;
    }

    this.flushQueue();
    this.flushIntervalId = setInterval(() => {
      this.flushQueue();
    }, EVENT_QUEUE_INTERVAL_MS) as unknown as number;
  }

  /**
   * Stop queue worker
   */
  stopQueueWorker(): void {
    if (this.flushIntervalId !== null) {
      clearInterval(this.flushIntervalId);
      this.flushIntervalId = null;
    }
  }

  /**
   * Emit a task event to n8n
   */
  async emitTaskEvent(event: TaskEventType, task: Task, escalationLevel: number = 0): Promise<void> {
    if (!this.config.n8n.enabled || !this.config.n8n.webhookUrl) {
      return;
    }

    const dedupeKey = this.buildDedupeKey(event, task);
    if (this.isDuplicate(dedupeKey)) {
      return;
    }

    const payload = this.buildPayload(event, task, dedupeKey, 1, escalationLevel);
    const success = await this.sendPayload(payload);

    if (success) {
      this.markDelivered(dedupeKey);
      await this.persistQueue();
    } else {
      this.enqueue(payload);
    }
  }

  /**
   * Test connection with n8n webhook
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    if (!this.config.n8n.enabled || !this.config.n8n.webhookUrl) {
      return { success: false, message: 'n8n webhook not configured' };
    }

    try {
      const dedupeKey = `test.ping:${new Date().toISOString()}`;
      const payload: TaskEventPayload = {
        event: "test.ping",
        source: PLUGIN_EVENT_SOURCE,
        version: PLUGIN_EVENT_VERSION,
        occurredAt: new Date().toISOString(),
        delivery: {
          dedupeKey,
          attempt: 1,
        },
      };

      const response = await this.fetcher(this.config.n8n.webhookUrl, {
        method: 'POST',
        headers: await this.buildHeaders(payload),
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        return { success: true, message: 'Connection successful' };
      } else {
        return { 
          success: false, 
          message: `HTTP ${response.status}: ${response.statusText}` 
        };
      }
    } catch (err: any) {
      return { 
        success: false, 
        message: `Connection failed: ${err.message}` 
      };
    }
  }

  /**
   * Flush queued events
   */
  async flushQueue(): Promise<void> {
    if (!this.config.n8n.enabled || !this.config.n8n.webhookUrl) {
      return;
    }

    const now = Date.now();
    let updated = false;
    const remaining: QueueItem[] = [];

    for (const item of this.queue) {
      if (new Date(item.nextAttemptAt).getTime() > now) {
        remaining.push(item);
        continue;
      }

      const payload = {
        ...item.payload,
        delivery: {
          ...item.payload.delivery,
          attempt: item.attempt,
        },
      };

      const success = await this.sendPayload(payload);
      if (success) {
        this.markDelivered(payload.delivery.dedupeKey);
        updated = true;
      } else {
        const nextAttempt = item.attempt + 1;
        const nextDelay = this.getRetryDelay(nextAttempt);
        remaining.push({
          ...item,
          attempt: nextAttempt,
          nextAttemptAt: new Date(now + nextDelay).toISOString(),
        });
        updated = true;
      }
    }

    if (updated) {
      this.queue = remaining;
      await this.persistQueue();
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): NotificationConfig {
    return { ...this.config };
  }

  private buildPayload(
    event: TaskEventType,
    task: Task,
    dedupeKey: string,
    attempt: number,
    escalationLevel: number = 0
  ): TaskEventPayload {
    const now = new Date();
    const dueDate = new Date(task.dueAt);
    const delayMs = now.getTime() - dueDate.getTime();

    return {
      event,
      source: PLUGIN_EVENT_SOURCE,
      version: PLUGIN_EVENT_VERSION,
      occurredAt: now.toISOString(),
      task: createTaskSnapshot(task),
      context: {
        timezone: task.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        delayMs: delayMs > 0 ? delayMs : undefined,
        previousDueAt: task.lastCompletedAt,
        nextDueAt: undefined, // Can be set after reschedule
      },
      routing: {
        escalationLevel,
        channels: task.notificationChannels || [],
      },
      delivery: {
        dedupeKey,
        attempt,
      },
    };
  }

  private buildDedupeKey(event: TaskEventType, task: Task): string {
    const dueAtKey = new Date(task.dueAt).toISOString().slice(0, 16);
    return `${event}:${task.id}:${dueAtKey}`;
  }

  private isDuplicate(dedupeKey: string): boolean {
    if (this.dedupeKeys.has(dedupeKey)) {
      return true;
    }

    return this.queue.some(
      (item) => item.payload.delivery.dedupeKey === dedupeKey
    );
  }

  private markDelivered(dedupeKey: string): void {
    this.dedupeKeys.add(dedupeKey);
    if (this.dedupeKeys.size > EVENT_DEDUPE_LIMIT) {
      const keys = Array.from(this.dedupeKeys).slice(-EVENT_DEDUPE_LIMIT);
      this.dedupeKeys = new Set(keys);
    }
  }

  private enqueue(payload: TaskEventPayload): void {
    const now = Date.now();
    this.queue.push({
      id: `${payload.delivery.dedupeKey}:${payload.delivery.attempt}`,
      payload,
      attempt: payload.delivery.attempt,
      nextAttemptAt: new Date(now + this.getRetryDelay(payload.delivery.attempt)).toISOString(),
    });
    void this.persistQueue();
  }

  private getRetryDelay(attempt: number): number {
    const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
    return Math.min(delay, RETRY_MAX_DELAY_MS);
  }

  /**
   * Generate HMAC signature for payload
   */
  private async generateSignature(payload: string, secret: string): Promise<string> {
    try {
      // Use Web Crypto API if available
      if (typeof crypto !== "undefined" && crypto.subtle) {
        const encoder = new TextEncoder();
        const keyData = encoder.encode(secret);
        const messageData = encoder.encode(payload);
        
        const key = await crypto.subtle.importKey(
          "raw",
          keyData,
          { name: "HMAC", hash: "SHA-256" },
          false,
          ["sign"]
        );
        
        const signature = await crypto.subtle.sign("HMAC", key, messageData);
        const hashArray = Array.from(new Uint8Array(signature));
        return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
      }
      
      // If crypto API is not available, fail gracefully
      console.warn("Web Crypto API not available - signature generation disabled");
      return "";
    } catch (err) {
      console.error("Failed to generate signature:", err);
      return "";
    }
  }

  /**
   * Build headers for webhook request
   */
  private async buildHeaders(payload: TaskEventPayload): Promise<Record<string, string>> {
    const payloadStr = JSON.stringify(payload);
    const timestamp = new Date().toISOString();
    
    // Generate HMAC signature if secret is configured
    let signature = "";
    if (this.config.n8n.sharedSecret) {
      signature = await this.generateSignature(
        payloadStr + timestamp,
        this.config.n8n.sharedSecret
      );
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Shehab-Event": payload.event,
      "X-Shehab-Timestamp": timestamp,
    };

    if (signature) {
      headers["X-Shehab-Signature"] = signature;
    }

    // Legacy header for backward compatibility
    if (this.config.n8n.sharedSecret) {
      headers["X-Shehab-Note-Secret"] = this.config.n8n.sharedSecret;
    }

    return headers;
  }

  private async sendPayload(
    payload: TaskEventPayload,
    expectOkResponse = false
  ): Promise<boolean> {
    try {
      const payloadStr = JSON.stringify(payload);
      const headers = await this.buildHeaders(payload);

      const response = await this.fetcher(this.config.n8n.webhookUrl, {
        method: "POST",
        headers,
        body: payloadStr,
      });

      if (!response.ok) {
        console.error("n8n webhook failed:", response.statusText);
        return false;
      }

      if (expectOkResponse) {
        const data = await response.json().catch(() => null);
        return Boolean(data && data.ok);
      }

      return true;
    } catch (error) {
      console.error("Failed to send n8n event:", error);
      return false;
    }
  }
}
