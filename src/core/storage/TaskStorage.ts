import type { Task } from "@/core/models/Task";
import type { Plugin } from "siyuan";
import { STORAGE_KEY, BLOCK_ATTR_TASK_ID, BLOCK_ATTR_TASK_DUE, BLOCK_ATTR_TASK_ENABLED } from "@/utils/constants";

/**
 * Helper to safely access SiYuan's setBlockAttrs function
 */
function getSetBlockAttrs(): ((blockId: string, attrs: Record<string, string>) => Promise<void>) | null {
  if (typeof (globalThis as any).setBlockAttrs === 'function') {
    return (globalThis as any).setBlockAttrs;
  }
  return null;
}

/**
 * TaskStorage manages task persistence using SiYuan storage API
 * Enhanced with block index for fast lookups and block attribute sync
 */
export class TaskStorage {
  private plugin: Plugin;
  private tasks: Map<string, Task>;
  private blockIndex: Map<string, string> = new Map(); // blockId -> taskId

  constructor(plugin: Plugin) {
    this.plugin = plugin;
    this.tasks = new Map();
  }

  /**
   * Initialize storage by loading tasks from disk
   */
  async init(): Promise<void> {
    try {
      const data = await this.plugin.loadData(STORAGE_KEY);
      if (data && Array.isArray(data.tasks)) {
        this.tasks = new Map(data.tasks.map((task: Task) => [task.id, task]));
        console.log(`Loaded ${this.tasks.size} tasks from storage`);
        this.rebuildBlockIndex();
      }
    } catch (err) {
      console.error("Failed to load tasks:", err);
      this.tasks = new Map();
    }
  }

  /**
   * Rebuild the block index from existing tasks
   */
  private rebuildBlockIndex(): void {
    this.blockIndex.clear();
    for (const task of this.tasks.values()) {
      if (task.linkedBlockId) {
        this.blockIndex.set(task.linkedBlockId, task.id);
      }
    }
    console.log(`Rebuilt block index with ${this.blockIndex.size} entries`);
  }

  /**
   * Save all tasks to disk
   */
  async save(): Promise<void> {
    try {
      const tasks = Array.from(this.tasks.values());
      await this.plugin.saveData(STORAGE_KEY, { tasks });
      console.log(`Saved ${tasks.length} tasks to storage`);
    } catch (err) {
      console.error("Failed to save tasks:", err);
      throw err;
    }
  }

  /**
   * Get all tasks
   */
  getAllTasks(): Task[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Get a task by ID
   */
  getTask(id: string): Task | undefined {
    return this.tasks.get(id);
  }

  /**
   * Get a task by linked block ID
   */
  getTaskByBlockId(blockId: string): Task | undefined {
    const taskId = this.blockIndex.get(blockId);
    return taskId ? this.tasks.get(taskId) : undefined;
  }

  /**
   * Add or update a task
   */
  async saveTask(task: Task): Promise<void> {
    // Find and remove old block index entry for this task (if any)
    // We need to search through the index because the task object may have been mutated
    for (const [blockId, taskId] of this.blockIndex.entries()) {
      if (taskId === task.id && blockId !== task.linkedBlockId) {
        this.blockIndex.delete(blockId);
      }
    }
    
    // Add new block index entry if task has linkedBlockId
    if (task.linkedBlockId) {
      this.blockIndex.set(task.linkedBlockId, task.id);
    }

    task.updatedAt = new Date().toISOString();
    this.tasks.set(task.id, task);
    await this.save();
    
    // Sync to block attributes for persistence
    if (task.linkedBlockId) {
      await this.syncTaskToBlockAttrs(task);
    }
  }

  /**
   * Sync task data to block attributes
   * This ensures task information persists even if plugin data is lost
   */
  private async syncTaskToBlockAttrs(task: Task): Promise<void> {
    if (!task.linkedBlockId) {
      return;
    }

    try {
      const setBlockAttrs = getSetBlockAttrs();
      if (setBlockAttrs) {
        await setBlockAttrs(task.linkedBlockId, {
          [BLOCK_ATTR_TASK_ID]: task.id,
          [BLOCK_ATTR_TASK_DUE]: task.dueAt,
          [BLOCK_ATTR_TASK_ENABLED]: task.enabled ? 'true' : 'false',
        });
      }
    } catch (err) {
      // Fail silently as this is a best-effort enhancement
      console.warn('Failed to sync task to block attrs:', err);
    }
  }

  /**
   * Delete a task
   */
  async deleteTask(id: string): Promise<void> {
    const task = this.tasks.get(id);
    
    // Remove from block index if task has linkedBlockId
    if (task?.linkedBlockId) {
      this.blockIndex.delete(task.linkedBlockId);
    }
    
    this.tasks.delete(id);
    await this.save();
  }

  /**
   * Get enabled tasks
   */
  getEnabledTasks(): Task[] {
    return this.getAllTasks().filter((task) => task.enabled);
  }

  /**
   * Get tasks due today or earlier
   */
  getTodayAndOverdueTasks(): Task[] {
    const now = new Date();
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);

    return this.getEnabledTasks().filter((task) => {
      const dueDate = new Date(task.dueAt);
      return dueDate <= endOfToday;
    });
  }

  /**
   * Get tasks in a date range
   */
  getTasksInRange(startDate: Date, endDate: Date): Task[] {
    return this.getEnabledTasks().filter((task) => {
      const dueDate = new Date(task.dueAt);
      return dueDate >= startDate && dueDate <= endDate;
    });
  }

  /**
   * Clear all tasks (for testing/reset)
   */
  async clearAll(): Promise<void> {
    this.tasks.clear();
    await this.save();
  }
}
