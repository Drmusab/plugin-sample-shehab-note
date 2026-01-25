import * as fs from 'fs/promises';
import * as path from 'path';
import { ApiKey } from './ApiKeyManager';
import * as logger from '../utils/logger';

/**
 * API key storage (encrypted at rest)
 */
export class KeyStore {
  private storagePath: string;
  private cache: Map<string, ApiKey> = new Map();

  constructor(dataDir: string) {
    this.storagePath = path.join(dataDir, 'api-keys.json');
  }

  /**
   * Initialize storage
   */
  async init(): Promise<void> {
    try {
      const data = await fs.readFile(this.storagePath, 'utf-8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        parsed.forEach((key) => {
          if (key && typeof key.id === 'string') {
            this.cache.set(key.id, key);
          }
        });
      } else {
        logger.warn('API key storage corrupted; resetting cache', {
          storagePath: this.storagePath,
        });
        this.cache = new Map();
      }
    } catch (error) {
      // File doesn't exist yet, start with empty cache
      const err = error as NodeJS.ErrnoException;
      if (err?.code !== 'ENOENT') {
        logger.warn('Failed to load API key storage; starting fresh', {
          storagePath: this.storagePath,
          error,
        });
      }
      this.cache = new Map();
    }
  }

  /**
   * Save API key
   */
  async saveKey(key: ApiKey): Promise<void> {
    this.cache.set(key.id, key);
    await this.persist();
  }

  /**
   * Find key by hash
   */
  async findKeyByHash(keyHash: string): Promise<ApiKey | null> {
    for (const key of this.cache.values()) {
      if (key.keyHash === keyHash) {
        return key;
      }
    }
    return null;
  }

  /**
   * Get key by ID
   */
  async getKey(keyId: string): Promise<ApiKey | null> {
    return this.cache.get(keyId) || null;
  }

  /**
   * List keys by workspace
   */
  async listKeysByWorkspace(workspaceId: string): Promise<ApiKey[]> {
    return Array.from(this.cache.values()).filter(
      (key) => key.workspaceId === workspaceId
    );
  }

  /**
   * Update last used timestamp
   */
  async updateLastUsed(keyId: string): Promise<void> {
    const key = this.cache.get(keyId);
    if (key) {
      key.lastUsedAt = new Date().toISOString();
      await this.persist();
    }
  }

  /**
   * Revoke key
   */
  async revokeKey(keyId: string): Promise<void> {
    const key = this.cache.get(keyId);
    if (key) {
      key.revoked = true;
      key.revokedAt = new Date().toISOString();
      await this.persist();
    }
  }

  /**
   * Persist to disk
   */
  private async persist(): Promise<void> {
    const keys = Array.from(this.cache.values());
    try {
      await fs.writeFile(this.storagePath, JSON.stringify(keys, null, 2), 'utf-8');
    } catch (error) {
      logger.error('Failed to persist API key storage', {
        storagePath: this.storagePath,
        error,
      });
    }
  }
}
