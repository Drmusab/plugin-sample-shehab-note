import { Plugin } from "siyuan";
import { mount, unmount } from "svelte";
import Dashboard from "./components/Dashboard.svelte";
import { taskManager } from "./core";
import { eventBus } from "./core/EventBus";
import type { PluginEvents, RecurringTaskCreatePayload } from "./core/EventBus";
import { TaskService } from "./core/TaskService";
import { RecurringTaskService } from "./core/RecurringTaskService";
import { MigrationManager } from "./core/storage/MigrationManager";
import { registerCommands } from "./plugin/commands";
import { registerBlockMenu } from "./plugin/menus";
import { TopbarMenu } from "./plugin/topbar";
import { DOCK_TYPE, SCHEDULER_INTERVAL_MS, STORAGE_ACTIVE_KEY } from "./utils/constants";
import * as logger from "./utils/logger";
import "./index.scss";

export default class RecurringTasksPlugin extends Plugin {
  private taskService!: TaskService;
  private recurringTaskService!: RecurringTaskService;
  private migrationManager!: MigrationManager;
  private topbarMenu!: TopbarMenu;
  private dashboardComponent: ReturnType<typeof mount> | null = null;
  private dockEl!: HTMLElement;
  private eventUnsubscribers: Array<() => void> = [];

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

    taskManager.setPlugin(this);
    await taskManager.initialize({ intervalMs: SCHEDULER_INTERVAL_MS });
    await taskManager.start();

    this.taskService = new TaskService(taskManager.getStorage());
    this.recurringTaskService = new RecurringTaskService(
      taskManager.getScheduler(),
      taskManager.getEventService()
    );

    // Register slash commands and hotkeys
    registerCommands(this);

    // Register block context menu
    registerBlockMenu(this);

    // Initialize topbar menu
    this.topbarMenu = new TopbarMenu(this, this.taskService);
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
    
    if (taskManager.isReady()) {
      await taskManager.destroy();
    }

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
          taskService: this.taskService,
          recurringTaskService: this.recurringTaskService,
          eventService: taskManager.getEventService(),
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
      this.eventUnsubscribers = [
        eventBus.on("recurring-task-create", this.handleCreateTaskEvent),
        eventBus.on("recurring-task-settings", this.handleSettingsEvent),
        eventBus.on("recurring-task-complete", this.handleCompleteTaskEvent),
        eventBus.on("task-snooze", this.handleSnoozeTaskEvent),
      ];
    } catch (err) {
      logger.error("Failed to add event listeners", err);
      this.removeEventListeners(); // Cleanup partial listeners
    }
  }

  private removeEventListeners() {
    this.eventUnsubscribers.forEach((unsubscribe) => unsubscribe());
    this.eventUnsubscribers = [];
  }

  private handleCreateTaskEvent = (payload: RecurringTaskCreatePayload) => {
    logger.info("Create task event received", payload);
    
    // Open the dock
    this.openDock();
    
    // Dispatch event to dashboard to open task form
    // This would need to be implemented in the Dashboard component
  };

  private handleSettingsEvent = (payload: PluginEvents["recurring-task-settings"]) => {
    logger.info("Settings event received", payload);
    
    // Open the dock
    this.openDock();
  };

  private handleCompleteTaskEvent = async (
    payload: PluginEvents["recurring-task-complete"]
  ) => {
    const { taskId } = payload;
    
    try {
      const task = taskManager.getStorage().getTask(taskId);
      if (task) {
        await taskManager.getEventService().handleTaskCompleted(task);
        await taskManager.getScheduler().markTaskDone(taskId);
        
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

  private handleSnoozeTaskEvent = async (payload: PluginEvents["task-snooze"]) => {
    const { taskId, minutes } = payload;
    
    try {
      const task = taskManager.getStorage().getTask(taskId);
      if (task) {
        await taskManager.getEventService().handleTaskSnoozed(task);
        await taskManager.getScheduler().delayTask(taskId, minutes);
        
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
