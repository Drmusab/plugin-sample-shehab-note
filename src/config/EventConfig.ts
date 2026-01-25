/**
 * Event system configuration
 */
export interface EventConfig {
  /** Enable outbound webhooks */
  enabled: boolean;

  /** Retry configuration */
  retry: {
    maxAttempts: number;
    initialDelayMs: number;
    maxDelayMs: number;
    backoffMultiplier: number;
  };

  /** Delivery configuration */
  delivery: {
    timeoutMs: number;
    maxConcurrent: number;
    batchSize: number;
  };

  /** Queue configuration */
  queue: {
    maxSize: number;
    persistToDisk: boolean;
    retentionDays: number;
  };

  /** Signature configuration */
  signature: {
    algorithm: 'sha256';
    headerName: string;
  };
}

/**
 * Default event configuration
 */
export const DEFAULT_EVENT_CONFIG: EventConfig = {
  enabled: true,
  retry: {
    maxAttempts: 5,
    initialDelayMs: 1000, // 1 second
    maxDelayMs: 3600000, // 1 hour
    backoffMultiplier: 2,
  },
  delivery: {
    timeoutMs: 10000, // 10 seconds
    maxConcurrent: 10,
    batchSize: 50,
  },
  queue: {
    maxSize: 10000,
    persistToDisk: true,
    retentionDays: 7,
  },
  signature: {
    algorithm: 'sha256',
    headerName: 'X-Webhook-Signature',
  },
};
