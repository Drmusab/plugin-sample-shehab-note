import type { SiYuanApiAdapter } from '@/core/api/SiYuanApiAdapter';

/**
 * SiYuan Block representation
 */
export interface Block {
  id: string;
  content: string;
  type: string;
  subtype?: string;
  parent_id?: string;
  root_id?: string;
  created: string;
  updated: string;
}

/**
 * Event emitter for block changes
 */
export class EventEmitter {
  private listeners: Map<string, Set<Function>> = new Map();

  on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  off(event: string, callback: Function): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.delete(callback);
    }
  }

  emit(event: string, data: any): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => callback(data));
    }
  }

  removeAllListeners(event?: string): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }
}

/**
 * SiYuan Block Watcher
 * Monitors changes to SiYuan blocks for dependency checking
 */
export class SiYuanBlockWatcher {
  private watchers = new Map<string, EventEmitter>();
  private pollIntervals = new Map<string, NodeJS.Timeout>();
  private blockCache = new Map<string, Block>();

  constructor(private siyuanAPI: SiYuanApiAdapter) {}

  /**
   * Watch for changes to a specific block
   */
  watchBlock(blockId: string, callback: (block: Block) => void): () => void {
    if (!this.watchers.has(blockId)) {
      const emitter = new EventEmitter();
      this.watchers.set(blockId, emitter);
      
      // Start polling for changes
      this.startPolling(blockId);
    }

    const emitter = this.watchers.get(blockId)!;
    emitter.on('change', callback);

    // Return cleanup function
    return () => {
      emitter.off('change', callback);
      
      // If no more listeners, stop polling
      if (!emitter['listeners'].get('change')?.size) {
        this.stopPolling(blockId);
      }
    };
  }

  /**
   * Get block content by ID
   */
  async getBlockContent(blockId: string): Promise<string | null> {
    try {
      const block = await this.fetchBlock(blockId);
      return block?.content || null;
    } catch (error) {
      console.error(`Error getting block content for ${blockId}:`, error);
      return null;
    }
  }

  /**
   * Get block attribute value
   */
  async getBlockAttribute(blockId: string, attr: string): Promise<string | null> {
    try {
      // Placeholder: Would use SiYuan API to get custom attributes
      // In real implementation: Query block attrs table
      return null;
    } catch (error) {
      console.error(`Error getting block attribute ${attr} for ${blockId}:`, error);
      return null;
    }
  }

  /**
   * Get backlinks to a block
   */
  async getBacklinks(blockId: string): Promise<Block[]> {
    try {
      // Placeholder: Would query SiYuan's refs table
      // In real implementation: SELECT * FROM refs WHERE def_block_id = ?
      return [];
    } catch (error) {
      console.error(`Error getting backlinks for ${blockId}:`, error);
      return [];
    }
  }

  /**
   * Query blocks using SiYuan SQL
   */
  async queryBlocks(sql: string): Promise<Block[]> {
    try {
      // Placeholder: Would use SiYuan's SQL API
      // In real implementation: Execute SQL query against SiYuan database
      return [];
    } catch (error) {
      console.error('Error querying blocks:', error);
      return [];
    }
  }

  /**
   * Stop watching a block
   */
  stopWatching(blockId: string): void {
    this.stopPolling(blockId);
    const emitter = this.watchers.get(blockId);
    if (emitter) {
      emitter.removeAllListeners();
      this.watchers.delete(blockId);
    }
  }

  /**
   * Stop all watchers and cleanup
   */
  cleanup(): void {
    // Stop all polling intervals
    for (const blockId of this.pollIntervals.keys()) {
      this.stopPolling(blockId);
    }

    // Clear all watchers
    for (const emitter of this.watchers.values()) {
      emitter.removeAllListeners();
    }
    this.watchers.clear();
    this.blockCache.clear();
  }

  // Private methods

  private startPolling(blockId: string): void {
    // Poll every 5 seconds for changes
    const intervalId = setInterval(async () => {
      try {
        const block = await this.fetchBlock(blockId);
        if (!block) return;

        const cached = this.blockCache.get(blockId);
        
        // Check if block has changed
        if (!cached || cached.updated !== block.updated || cached.content !== block.content) {
          this.blockCache.set(blockId, block);
          const emitter = this.watchers.get(blockId);
          if (emitter) {
            emitter.emit('change', block);
          }
        }
      } catch (error) {
        console.error(`Error polling block ${blockId}:`, error);
      }
    }, 5000);

    this.pollIntervals.set(blockId, intervalId);
  }

  private stopPolling(blockId: string): void {
    const intervalId = this.pollIntervals.get(blockId);
    if (intervalId) {
      clearInterval(intervalId);
      this.pollIntervals.delete(blockId);
    }
    this.blockCache.delete(blockId);
  }

  private async fetchBlock(blockId: string): Promise<Block | null> {
    try {
      // Placeholder: Would use SiYuan API to fetch block
      // In real implementation: Query blocks table
      // For now, return a mock block to avoid errors
      const mockBlock: Block = {
        id: blockId,
        content: '',
        type: 'paragraph',
        created: new Date().toISOString(),
        updated: new Date().toISOString()
      };
      return mockBlock;
    } catch (error) {
      console.error(`Error fetching block ${blockId}:`, error);
      return null;
    }
  }
}
