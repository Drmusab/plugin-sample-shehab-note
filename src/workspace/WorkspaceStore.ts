import * as fs from 'fs/promises';
import * as path from 'path';
import { Workspace } from './WorkspaceManager';


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
      const workspaces: Workspace[] = JSON.parse(data);
      workspaces.forEach((ws) => this.cache.set(ws.id, ws));
    } catch (error) {
      // Start with empty cache
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
    await fs.writeFile(
      this.storagePath,
      JSON.stringify(workspaces, null, 2),
      'utf-8'
    );
  }
}
