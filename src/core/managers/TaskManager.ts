import type { Plugin } from "siyuan";
import { TaskStorage } from "@/core/storage/TaskStorage";
import { TaskRepository, type TaskRepositoryProvider } from "@/core/storage/TaskRepository";
import { Scheduler } from "@/core/engine/Scheduler";
import { EventService } from "@/services/EventService";
import { SettingsService } from "@/core/settings/SettingsService";
import { GlobalFilter } from "@/core/filtering/GlobalFilter";
import { GlobalQuery } from "@/core/query/GlobalQuery";
import { SCHEDULER_INTERVAL_MS } from "@/utils/constants";
import * as logger from "@/utils/logger";
import { PatternLearner } from "@/core/ml/PatternLearner";
import { PatternLearnerStore } from "@/core/ml/PatternLearnerStore";

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
  private repository!: TaskRepositoryProvider;
  private scheduler!: Scheduler;
  private eventService!: EventService;
  private settingsService!: SettingsService;
  private patternLearner!: PatternLearner;

  private constructor(plugin: Plugin) {
    this.plugin = plugin;
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(plugin?: Plugin): TaskManager | null {
    if (!TaskManager.instance) {
      if (!plugin) {
        return null;
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

    // Initialize settings service
    this.settingsService = new SettingsService(this.plugin);
    await this.settingsService.load();
    const settings = this.settingsService.get();
    GlobalFilter.getInstance().initialize(settings.globalFilter);
    GlobalQuery.getInstance().initialize(settings.globalQuery);

    // Initialize storage
    this.storage = new TaskStorage(this.plugin);
    await this.storage.init();
    this.repository = new TaskRepository(this.storage);

    // Initialize event service
    this.eventService = new EventService(this.plugin);
    await this.eventService.init();

    // Initialize scheduler
    this.scheduler = new Scheduler(this.storage, SCHEDULER_INTERVAL_MS, this.plugin);
    this.eventService.bindScheduler(this.scheduler);

    // Initialize smart recurrence pattern learner
    const patternStore = new PatternLearnerStore(this.plugin);
    this.patternLearner = new PatternLearner({
      store: patternStore,
      repository: this.repository,
      settingsProvider: () => this.settingsService.get().smartRecurrence,
    });
    await this.patternLearner.load();

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
   * Get the task repository abstraction
   */
  public getRepository(): TaskRepositoryProvider {
    this.ensureInitialized();
    return this.repository;
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
   * Get the settings service instance
   */
  public getSettingsService(): SettingsService {
    this.ensureInitialized();
    return this.settingsService;
  }

  /**
   * Get the smart recurrence pattern learner
   */
  public getPatternLearner(): PatternLearner {
    this.ensureInitialized();
    return this.patternLearner;
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
