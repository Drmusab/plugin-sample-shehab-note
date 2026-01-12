import type { Plugin } from "siyuan";
import { TaskStorage } from "@/core/storage/TaskStorage";
import { Scheduler } from "@/core/engine/Scheduler";
import { NotificationState } from "@/core/engine/NotificationState";
import { EventService } from "@/services/EventService";
import { NOTIFICATION_STATE_KEY } from "@/utils/constants";
import * as logger from "@/utils/logger";

/**
 * TaskManager is a singleton that manages the lifecycle of all task-related services.
 * Based on patterns from siyuan-plugin-task-note-management (StatusManager, PomodoroRecordManager)
 */
export class TaskManager {
  private static instance: TaskManager | null = null;
  private plugin: Plugin;
  private isInitialized: boolean = false;
  
  // Core services
  private storage!: TaskStorage;
  private scheduler!: Scheduler;
  private eventService!: EventService;
  private notificationState!: NotificationState;

  private constructor(plugin: Plugin) {
    this.plugin = plugin;
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(plugin?: Plugin): TaskManager {
    if (!TaskManager.instance) {
      if (!plugin) {
        throw new Error('TaskManager requires plugin instance for initialization');
      }
      TaskManager.instance = new TaskManager(plugin);
    }
    return TaskManager.instance;
  }

  /**
   * Initialize all services
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn("TaskManager already initialized");
      return;
    }

    logger.info("Initializing TaskManager");

    // Initialize storage
    this.storage = new TaskStorage(this.plugin);
    await this.storage.init();

    // Initialize notification state
    this.notificationState = new NotificationState(this.plugin, NOTIFICATION_STATE_KEY);
    await this.notificationState.load();

    // Initialize event service
    this.eventService = new EventService(this.plugin);
    await this.eventService.init();

    // Initialize scheduler
    this.scheduler = new Scheduler(this.storage, this.notificationState);

    this.isInitialized = true;
    logger.info("TaskManager initialized successfully");
  }

  /**
   * Start the scheduler and recovery process
   */
  public async start(
    onTaskDue: (task: any) => void,
    onTaskMissed?: (task: any) => void
  ): Promise<void> {
    if (!this.isInitialized) {
      throw new Error("TaskManager must be initialized before starting");
    }

    // Start scheduler
    this.scheduler.start(onTaskDue, onTaskMissed);
    
    // Recover missed tasks from previous session
    await this.scheduler.recoverMissedTasks();

    logger.info("TaskManager started");
  }

  /**
   * Destroy the manager and cleanup resources
   */
  public async destroy(): Promise<void> {
    logger.info("Destroying TaskManager");

    if (this.scheduler) {
      this.scheduler.stop();
    }

    if (this.eventService) {
      this.eventService.stopQueueWorker();
    }

    if (this.notificationState) {
      await this.notificationState.forceSave();
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
   * Get the notification state instance
   */
  public getNotificationState(): NotificationState {
    this.ensureInitialized();
    return this.notificationState;
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
}
