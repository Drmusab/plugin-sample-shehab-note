import type { Task } from "@/core/models/Task";
import type { Plugin } from "siyuan";
import {
  BLOCK_ATTR_TASK_ID,
  BLOCK_ATTR_TASK_DUE,
  BLOCK_ATTR_TASK_ENABLED,
  STORAGE_ACTIVE_KEY,
  STORAGE_ARCHIVE_KEY,
  STORAGE_LEGACY_BACKUP_KEY,
  STORAGE_LEGACY_KEY,
} from "@/utils/constants";
import { ActiveTaskStore } from "@/core/storage/ActiveTaskStore";
import { ArchiveTaskStore, type ArchiveQuery } from "@/core/storage/ArchiveTaskStore";
import * as logger from "@/utils/logger";

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
 * TaskStorage manages task persistence using SiYuan storage API.
 * Active tasks are loaded on startup, while archived tasks are stored in
 * chunked files and loaded on demand to keep startup fast.
 */
export interface TaskStorageProvider {
  loadActive(): Promise<Map<string, Task>>;
  saveActive(tasks: Map<string, Task>): Promise<void>;
  archiveTask(task: Task): Promise<void>;
  loadArchive(filter?: ArchiveQuery): Promise<Task[]>;
}

export class TaskStorage implements TaskStorageProvider {
  private plugin: Plugin;
  private activeTasks: Map<string, Task>;
  private blockIndex: Map<string, string> = new Map(); // blockId -> taskId
  private taskBlockIndex: Map<string, string> = new Map(); // taskId -> blockId
  private activeStore: ActiveTaskStore;
  private archiveStore: ArchiveTaskStore;

  constructor(plugin: Plugin) {
    this.plugin = plugin;
    this.activeTasks = new Map();
    this.activeStore = new ActiveTaskStore(plugin);
    this.archiveStore = new ArchiveTaskStore(plugin);
  }

  /**
   * Initialize storage by loading tasks from disk
   */
  async init(): Promise<void> {
    await this.migrateLegacyStorage();
    this.activeTasks = await this.activeStore.loadActive();
    logger.info(`Loaded ${this.activeTasks.size} active tasks from storage`);
    this.rebuildBlockIndex();
  }

  /**
   * Rebuild the block index from existing tasks
   */
  private rebuildBlockIndex(): void {
    this.blockIndex.clear();
    this.taskBlockIndex.clear();
    for (const task of this.activeTasks.values()) {
      if (task.linkedBlockId) {
        this.blockIndex.set(task.linkedBlockId, task.id);
        this.taskBlockIndex.set(task.id, task.linkedBlockId);
      }
    }
    logger.info(`Rebuilt block index with ${this.blockIndex.size} entries`);
  }

  /**
   * Save all tasks to disk
   */
  async save(): Promise<void> {
    await this.activeStore.saveActive(this.activeTasks);
  }

  /**
   * Get all tasks
   */
  getAllTasks(): Task[] {
    return Array.from(this.activeTasks.values());
  }

  /**
   * Get a task by ID
   */
  getTask(id: string): Task | undefined {
    return this.activeTasks.get(id);
  }

  /**
   * Get a task by linked block ID
   */
  getTaskByBlockId(blockId: string): Task | undefined {
    const taskId = this.blockIndex.get(blockId);
    return taskId ? this.activeTasks.get(taskId) : undefined;
  }

  /**
   * Add or update a task
   */
  async saveTask(task: Task): Promise<void> {
    const previousBlockId = this.taskBlockIndex.get(task.id);
    if (previousBlockId && previousBlockId !== task.linkedBlockId) {
      this.blockIndex.delete(previousBlockId);
      this.taskBlockIndex.delete(task.id);
    }

    // Add new block index entry if task has linkedBlockId
    if (task.linkedBlockId) {
      this.blockIndex.set(task.linkedBlockId, task.id);
      this.taskBlockIndex.set(task.id, task.linkedBlockId);
    }

    task.updatedAt = new Date().toISOString();
    this.activeTasks.set(task.id, task);
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
    const task = this.activeTasks.get(id);
    
    // Remove from block index if task has linkedBlockId
    if (task?.linkedBlockId) {
      this.blockIndex.delete(task.linkedBlockId);
    }
    this.taskBlockIndex.delete(id);
    
    this.activeTasks.delete(id);
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
    this.activeTasks.clear();
    await this.save();
  }

  async loadActive(): Promise<Map<string, Task>> {
    return this.activeStore.loadActive();
  }

  async saveActive(tasks: Map<string, Task>): Promise<void> {
    await this.activeStore.saveActive(tasks);
  }

  async archiveTask(task: Task): Promise<void> {
    await this.archiveStore.archiveTask(task);
  }

  async loadArchive(filter?: ArchiveQuery): Promise<Task[]> {
    return this.archiveStore.loadArchive(filter);
  }

  private async migrateLegacyStorage(): Promise<void> {
    const existingActive = await this.plugin.loadData(STORAGE_ACTIVE_KEY);
    if (existingActive && Array.isArray(existingActive.tasks)) {
      return;
    }

    const legacyData = await this.plugin.loadData(STORAGE_LEGACY_KEY);
    if (!legacyData) {
      return;
    }

    const legacyTasks = Array.isArray(legacyData.tasks) ? legacyData.tasks : Array.isArray(legacyData) ? legacyData : [];
    if (legacyTasks.length === 0) {
      return;
    }

    await this.plugin.saveData(STORAGE_LEGACY_BACKUP_KEY, legacyData);
    logger.info(`Created legacy backup at ${STORAGE_LEGACY_BACKUP_KEY}`);

    const archivedTasks = legacyTasks.filter((task: Task) => !task.enabled && task.lastCompletedAt);
    const activeTasks = legacyTasks.filter((task: Task) => !archivedTasks.includes(task));

    const activeMap = new Map(activeTasks.map((task: Task) => [task.id, task]));
    await this.activeStore.saveActive(activeMap);

    if (archivedTasks.length > 0) {
      await this.archiveStore.archiveTasks(archivedTasks);
    }

    logger.info("Legacy storage migration complete", {
      activeCount: activeTasks.length,
      archivedCount: archivedTasks.length,
      legacyKey: STORAGE_LEGACY_KEY,
      activeKey: STORAGE_ACTIVE_KEY,
      archiveIndexKey: STORAGE_ARCHIVE_KEY,
    });
  }
}
