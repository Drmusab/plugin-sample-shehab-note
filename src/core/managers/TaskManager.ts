import type { Plugin } from "siyuan";
import { TaskStorage } from "@/core/storage/TaskStorage";
import { Scheduler } from "@/core/engine/Scheduler";
import { EventService } from "@/services/EventService";
import * as logger from "@/utils/logger";

/**
 * TaskManager is a singleton that manages the lifecycle of all task-related services.
 * Based on patterns from siyuan-plugin-task-note-management (StatusManager, PomodoroRecordManager)
 */
export class TaskManager {
  private static instance: TaskManager | null = null;
  private plugin: Plugin | null;
  private isInitialized: boolean = false;
  
  // Core services
  private storage!: TaskStorage;
  private scheduler!: Scheduler;
  private eventService!: EventService;

  private constructor(plugin: Plugin | null) {
    this.plugin = plugin;
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(plugin?: Plugin): TaskManager {
    if (!TaskManager.instance) {
      TaskManager.instance = new TaskManager(plugin ?? null);
    } else if (plugin) {
      TaskManager.instance.setPlugin(plugin);
    }
    return TaskManager.instance;
  }

  /**
   * Configure the plugin instance before initialization.
   */
  public setPlugin(plugin: Plugin): void {
    this.plugin = plugin;
  }

  /**
   * Initialize all services
   */
  public async initialize(options: { intervalMs?: number } = {}): Promise<void> {
    if (this.isInitialized) {
      logger.warn("TaskManager already initialized");
      return;
    }

    logger.info("Initializing TaskManager");
    const plugin = this.ensurePlugin();

    // Initialize storage
    this.storage = new TaskStorage(plugin);
    await this.storage.init();

    // Initialize event service
    this.eventService = new EventService(plugin);
    await this.eventService.init();

    // Initialize scheduler
    this.scheduler = new Scheduler(this.storage, options.intervalMs, plugin);
    this.eventService.bindScheduler(this.scheduler);

    this.isInitialized = true;
    logger.info("TaskManager initialized successfully");
  }

  /**
   * Start the scheduler and recovery process
   */
  public async start(
    onTaskDue?: (task: any) => void,
    onTaskMissed?: (task: any) => void
  ): Promise<void> {
    if (!this.isInitialized) {
      throw new Error("TaskManager must be initialized before starting");
    }

    // Start scheduler
    if (onTaskDue) {
      this.scheduler.on("task:due", ({ task }) => onTaskDue(task));
    }
    if (onTaskMissed) {
      this.scheduler.on("task:overdue", ({ task }) => onTaskMissed(task));
    }
    this.scheduler.start();
    
    // Recover missed tasks from previous session
    try {
      await this.scheduler.recoverMissedTasks();
    } catch (err) {
      logger.error("Failed to recover missed tasks", err);
    }

    logger.info("TaskManager started");
  }

  /**
   * Destroy the manager and cleanup resources
   */
  public async destroy(): Promise<void> {
    if (!this.isInitialized) {
      TaskManager.instance = null;
      return;
    }

    logger.info("Destroying TaskManager");

    if (this.scheduler) {
      this.scheduler.stop();
    }

    if (this.eventService) {
      await this.eventService.shutdown();
    }

    if (this.storage) {
      await this.storage.flush();
    }

    this.isInitialized = false;
    TaskManager.instance = null;

    logger.info("TaskManager destroyed");
  }

  /**
   * Get the task storage instance
   */
  public getStorage(): TaskStorage {
    this.ensureInitialized();
    return this.storage;
  }

  /**
   * Get the scheduler instance
   */
  public getScheduler(): Scheduler {
    this.ensureInitialized();
    return this.scheduler;
  }

  /**
   * Get the event service instance
   */
  public getEventService(): EventService {
    this.ensureInitialized();
    return this.eventService;
  }

  /**
   * Check if the manager is initialized
   */
  public isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Ensure the manager is initialized before accessing services
   */
  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error("TaskManager is not initialized. Call initialize() first.");
    }
  }

  private ensurePlugin(): Plugin {
    if (!this.plugin) {
      throw new Error("TaskManager requires plugin instance before initialization.");
    }
    return this.plugin;
  }
}
