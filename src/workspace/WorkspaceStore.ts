import * as fs from 'fs/promises';
import * as path from 'path';
import { Workspace } from './WorkspaceManager';
import * as logger from '../utils/logger';


/**
 * Workspace storage
 */
export class WorkspaceStore {
  private storagePath: string;
  private cache: Map<string, Workspace> = new Map();

  constructor(dataDir: string) {
    this.storagePath = path.join(dataDir, 'workspaces.json');
  }

  /**
   * Initialize storage
   */
  async init(): Promise<void> {
    try {
      const data = await fs.readFile(this.storagePath, 'utf-8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        parsed.forEach((ws) => {
          if (ws && typeof ws.id === 'string') {
            this.cache.set(ws.id, ws);
          }
        });
      } else {
        logger.warn('Workspace storage corrupted; resetting cache', {
          storagePath: this.storagePath,
        });
        this.cache = new Map();
      }
    } catch (error) {
      // Start with empty cache
      const err = error as NodeJS.ErrnoException;
      if (err?.code !== 'ENOENT') {
        logger.warn('Failed to load workspace storage; starting fresh', {
          storagePath: this.storagePath,
          error,
        });
      }
      this.cache = new Map();
    }
  }

  /**
   * Save workspace
   */
  async saveWorkspace(workspace: Workspace): Promise<void> {
    this.cache.set(workspace.id, workspace);
    await this.persist();
  }

  /**
   * Get workspace by ID
   */
  async getWorkspace(id: string): Promise<Workspace | null> {
    return this.cache.get(id) || null;
  }

  /**
   * List all workspaces
   */
  async listWorkspaces(): Promise<Workspace[]> {
    return Array.from(this.cache.values());
  }

  /**
   * Delete workspace
   */
  async deleteWorkspace(id: string): Promise<void> {
    this.cache.delete(id);
    await this.persist();
  }

  /**
   * Persist to disk
   */
  private async persist(): Promise<void> {
    const workspaces = Array.from(this.cache.values());
    try {
      await fs.writeFile(
        this.storagePath,
        JSON.stringify(workspaces, null, 2),
        'utf-8'
      );
    } catch (error) {
      logger.error('Failed to persist workspace storage', {
        storagePath: this.storagePath,
        error,
      });
    }
  }
}
