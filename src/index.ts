import { Plugin } from "siyuan";
import { mount, unmount } from "svelte";
import Dashboard from "./components/Dashboard.svelte";
import { TaskStorage } from "./core/storage/TaskStorage";
import { Scheduler } from "./core/engine/Scheduler";
import { MigrationManager } from "./core/storage/MigrationManager";
import { EventService } from "./services/EventService";
import { registerCommands } from "./plugin/commands";
import { registerBlockMenu } from "./plugin/menus";
import { TopbarMenu } from "./plugin/topbar";
import { DOCK_TYPE, SCHEDULER_INTERVAL_MS, STORAGE_ACTIVE_KEY } from "./utils/constants";
import * as logger from "./utils/logger";
import "./index.scss";

export default class RecurringTasksPlugin extends Plugin {
  private storage!: TaskStorage;
  private scheduler!: Scheduler;
  private eventService!: EventService;
  private migrationManager!: MigrationManager;
  private topbarMenu!: TopbarMenu;
  private dashboardComponent: ReturnType<typeof mount> | null = null;
  private dockEl!: HTMLElement;

  async onload() {
    logger.info("Loading Recurring Tasks Plugin");

    // Initialize migration manager
    this.migrationManager = new MigrationManager(this);

    // Run migrations
    try {
      await this.migrationManager.migrate(STORAGE_ACTIVE_KEY);
    } catch (err) {
      logger.error("Migration failed, continuing with existing data", err);
    }

    // Initialize storage
    this.storage = new TaskStorage(this);
    await this.storage.init();

    // Initialize event service
    this.eventService = new EventService(this);
    await this.eventService.init();

    // Initialize scheduler (time-only) and bind its events to the orchestrator.
    this.scheduler = new Scheduler(this.storage, SCHEDULER_INTERVAL_MS, this);
    this.eventService.bindScheduler(this.scheduler);
    this.scheduler.start();

    // Recover missed tasks from previous session
    try {
      await this.scheduler.recoverMissedTasks();
    } catch (err) {
      logger.error("Failed to recover missed tasks", err);
    }

    // Register slash commands and hotkeys
    registerCommands(this, this.storage);

    // Register block context menu
    registerBlockMenu(this);

    // Initialize topbar menu
    this.topbarMenu = new TopbarMenu(this, this.storage);
    this.topbarMenu.init();

    // Add dock panel
    this.addDock({
      config: {
        position: "RightBottom",
        size: { width: 400, height: 600 },
        icon: "iconCalendar",
        title: "Recurring Tasks",
      },
      data: null,
      type: DOCK_TYPE,
      init: (dock) => {
        this.dockEl = dock.element;
        this.renderDashboard();
      },
      destroy: () => {
        this.destroyDashboard();
      },
    });

    // Add event listeners for custom events
    this.addEventListeners();

    logger.info("Recurring Tasks Plugin loaded successfully");
  }

  async onunload() {
    logger.info("Unloading Recurring Tasks Plugin");
    
    // Stop scheduler
    this.scheduler.stop();
    await this.eventService.shutdown();

    // Flush pending task writes
    await this.storage.flush();

    // Destroy topbar menu
    if (this.topbarMenu) {
      this.topbarMenu.destroy();
    }
    
    // Destroy dashboard
    this.destroyDashboard();

    // Remove event listeners
    this.removeEventListeners();
  }

  private renderDashboard() {
    if (this.dockEl && !this.dashboardComponent) {
      this.dashboardComponent = mount(Dashboard, {
        target: this.dockEl,
        props: {
          storage: this.storage,
          scheduler: this.scheduler,
          eventService: this.eventService,
        },
      });
    }
  }

  private destroyDashboard() {
    if (this.dashboardComponent) {
      unmount(this.dashboardComponent);
      this.dashboardComponent = null;
    }
  }

  private addEventListeners() {
    try {
      // Listen for custom events from commands and menus
      window.addEventListener("recurring-task-create", this.handleCreateTaskEvent);
      window.addEventListener("recurring-task-settings", this.handleSettingsEvent);
      window.addEventListener("recurring-task-complete", this.handleCompleteTaskEvent);
      window.addEventListener("task-snooze", this.handleSnoozeTaskEvent);
    } catch (err) {
      logger.error("Failed to add event listeners", err);
      this.removeEventListeners(); // Cleanup partial listeners
    }
  }

  private removeEventListeners() {
    window.removeEventListener("recurring-task-create", this.handleCreateTaskEvent);
    window.removeEventListener("recurring-task-settings", this.handleSettingsEvent);
    window.removeEventListener("recurring-task-complete", this.handleCompleteTaskEvent);
    window.removeEventListener("task-snooze", this.handleSnoozeTaskEvent);
  }

  private handleCreateTaskEvent = (event: Event) => {
    const customEvent = event as CustomEvent;
    logger.info("Create task event received", customEvent.detail);
    
    // Open the dock
    this.openDock();
    
    // Dispatch event to dashboard to open task form
    // This would need to be implemented in the Dashboard component
  };

  private handleSettingsEvent = (event: Event) => {
    const customEvent = event as CustomEvent;
    logger.info("Settings event received", customEvent.detail);
    
    // Open the dock
    this.openDock();
  };

  private handleCompleteTaskEvent = async (event: Event) => {
    const customEvent = event as CustomEvent;
    const { taskId } = customEvent.detail;
    
    try {
      const task = this.storage.getTask(taskId);
      if (task) {
        await this.eventService.handleTaskCompleted(task);
        await this.scheduler.markTaskDone(taskId);
        
        // Update topbar badge
        if (this.topbarMenu) {
          this.topbarMenu.update();
        }
        
        logger.info(`Task completed: ${task.name}`);
      }
    } catch (err) {
      logger.error("Failed to complete task", err);
    }
  };

  private handleSnoozeTaskEvent = async (event: Event) => {
    const customEvent = event as CustomEvent;
    const { taskId, minutes } = customEvent.detail;
    
    try {
      const task = this.storage.getTask(taskId);
      if (task) {
        await this.eventService.handleTaskSnoozed(task);
        await this.scheduler.delayTask(taskId, minutes);
        
        // Update topbar badge
        if (this.topbarMenu) {
          this.topbarMenu.update();
        }
        
        logger.info(`Task snoozed: ${task.name} for ${minutes} minutes`);
      }
    } catch (err) {
      logger.error("Failed to snooze task", err);
    }
  };
}
