import { Plugin } from "siyuan";
import { mount, unmount } from "svelte";
import Dashboard from "./components/Dashboard.svelte";
import QuickAddOverlay from "./components/cards/QuickAddOverlay.svelte";
import TaskEditorModal from "./components/TaskEditorModal.svelte";
import type { Task } from "./core/models/Task";
import type { Scheduler } from "./core/engine/Scheduler";
import type { TaskRepositoryProvider } from "./core/storage/TaskRepository";
import { MigrationManager } from "./core/storage/MigrationManager";
import { TaskManager } from "./core/managers/TaskManager";
import type { EventService } from "./services/EventService";
import { registerCommands } from "./plugin/commands";
import { registerBlockMenu } from "./plugin/menus";
import { TopbarMenu } from "./plugin/topbar";
import { DOCK_TYPE, STORAGE_ACTIVE_KEY } from "./utils/constants";
import * as logger from "./utils/logger";
import { showToast, toast } from "./utils/notifications";
import { pluginEventBus } from "./core/events/PluginEventBus";
import "./index.scss";

export default class RecurringTasksPlugin extends Plugin {
  private taskManager!: TaskManager;
  private repository!: TaskRepositoryProvider;
  private scheduler!: Scheduler;
  private eventService!: EventService;
  private migrationManager!: MigrationManager;
  private topbarMenu!: TopbarMenu;
  private dashboardComponent: ReturnType<typeof mount> | null = null;
  private dockEl!: HTMLElement;
  private quickAddComponent: ReturnType<typeof mount> | null = null;
  private quickAddContainer: HTMLElement | null = null;
  private taskEditorComponent: ReturnType<typeof mount> | null = null;
  private taskEditorContainer: HTMLElement | null = null;
  private pendingCompletionTimeouts: Map<string, number> = new Map();

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

    // Initialize task manager (storage + scheduler + events)
    const manager = TaskManager.getInstance(this);
    if (!manager) {
      throw new Error("TaskManager failed to initialize");
    }

    this.taskManager = manager;
    await this.taskManager.initialize();

    this.repository = this.taskManager.getRepository();
    this.scheduler = this.taskManager.getScheduler();
    this.eventService = this.taskManager.getEventService();

    // Start scheduler and recover missed tasks
    try {
      await this.taskManager.start();
    } catch (err) {
      logger.error("Failed to start TaskManager", err);
    }

    // Register slash commands and hotkeys
    registerCommands(this, this.repository, this.scheduler.getRecurrenceEngine());

    // Register block context menu
    registerBlockMenu(this);

    // Initialize topbar menu
    this.topbarMenu = new TopbarMenu(this, this.repository);
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
    
    this.pendingCompletionTimeouts.forEach((timeoutId) => {
      globalThis.clearTimeout(timeoutId);
    });
    this.pendingCompletionTimeouts.clear();

    if (this.taskManager) {
      await this.taskManager.destroy();
    }

    // Destroy topbar menu
    if (this.topbarMenu) {
      this.topbarMenu.destroy();
    }
    
    // Destroy dashboard
    this.destroyDashboard();
    this.closeQuickAdd();
    this.closeTaskEditor();

    // Remove event listeners
    this.removeEventListeners();
  }

  private renderDashboard() {
    if (this.dockEl && !this.dashboardComponent) {
      this.dashboardComponent = mount(Dashboard, {
        target: this.dockEl,
        props: {
          repository: this.repository,
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
      // Listen to pluginEventBus for internal communication
      pluginEventBus.on('task:create', (data) => {
        logger.info("Create task event received", data);
        this.openQuickAdd(data);
      });
      
      pluginEventBus.on('task:complete', async (data) => {
        await this.handleCompleteTask(data.taskId);
      });
      
      pluginEventBus.on('task:snooze', async (data) => {
        await this.handleSnoozeTask(data.taskId, data.minutes);
      });
      
      pluginEventBus.on('task:settings', () => {
        this.openDock();
      });
      
      pluginEventBus.on('task:refresh', () => {
        // Dashboard will handle its own refresh
      });

      // Also listen for window events for backward compatibility
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
    pluginEventBus.clear();
    window.removeEventListener("recurring-task-create", this.handleCreateTaskEvent);
    window.removeEventListener("recurring-task-settings", this.handleSettingsEvent);
    window.removeEventListener("recurring-task-complete", this.handleCompleteTaskEvent);
    window.removeEventListener("task-snooze", this.handleSnoozeTaskEvent);
  }

  private handleCreateTaskEvent = (event: Event) => {
    try {
      const customEvent = event as CustomEvent<{
        action?: string;
        suggestedName?: string;
        linkedBlockId?: string;
        linkedBlockContent?: string;
        suggestedTime?: string | null;
      }>;
      logger.info("Create task event received", customEvent.detail);

      this.openQuickAdd(customEvent.detail);
    } catch (err) {
      logger.error("Failed to handle create task event", err);
      toast.error("Failed to open task creator.");
    }
  };

  private handleSettingsEvent = (event: Event) => {
    try {
      const customEvent = event as CustomEvent<{ action?: string }>;
      logger.info("Settings event received", customEvent.detail);

      // Open the dock
      this.openDock();
    } catch (err) {
      logger.error("Failed to handle settings event", err);
      toast.error("Failed to open settings.");
    }
  };

  private handleCompleteTaskEvent = async (event: Event) => {
    try {
      const customEvent = event as CustomEvent<{ taskId?: string }>;
      const { taskId } = customEvent.detail ?? {};
      if (!taskId) {
        throw new Error("Missing taskId for completion event.");
      }
      await this.handleCompleteTask(taskId);
    } catch (err) {
      logger.error("Failed to complete task", err);
      toast.error("Failed to complete task.");
    }
  };

  private async handleCompleteTask(taskId: string): Promise<void> {
    const task = this.repository.getTask(taskId);
    if (task) {
      if (this.pendingCompletionTimeouts.has(taskId)) {
        toast.info(`Completion already pending for "${task.name}".`);
        return;
      }

      const timeoutId = globalThis.setTimeout(async () => {
        this.pendingCompletionTimeouts.delete(taskId);
        try {
          await this.eventService.handleTaskCompleted(task);
          await this.scheduler.markTaskDone(taskId);

          // Update topbar badge
          if (this.topbarMenu) {
            this.topbarMenu.update();
          }

          logger.info(`Task completed: ${task.name}`);
        } catch (err) {
          logger.error("Failed to finalize task completion", err);
          toast.error("Failed to complete task.");
        }
      }, 5000);

      this.pendingCompletionTimeouts.set(taskId, timeoutId);

      const undoCompletion = () => {
        const pending = this.pendingCompletionTimeouts.get(taskId);
        if (pending) {
          globalThis.clearTimeout(pending);
          this.pendingCompletionTimeouts.delete(taskId);
          toast.info(`Undo: "${task.name}" restored`);
        }
      };

      showToast({
        message: `Task "${task.name}" completed.`,
        type: "success",
        duration: 5000,
        actionLabel: "Undo",
        onAction: undoCompletion,
        showCountdown: true,
      });
    }
  }

  private handleSnoozeTaskEvent = async (event: Event) => {
    try {
      const customEvent = event as CustomEvent<{ taskId?: string; minutes?: number }>;
      const { taskId, minutes } = customEvent.detail ?? {};
      if (!taskId || typeof minutes !== "number") {
        throw new Error("Missing task snooze details.");
      }
      await this.handleSnoozeTask(taskId, minutes);
    } catch (err) {
      logger.error("Failed to snooze task", err);
      toast.error("Failed to snooze task.");
    }
  };

  private async handleSnoozeTask(taskId: string, minutes: number): Promise<void> {
    const task = this.repository.getTask(taskId);
    if (task) {
      await this.eventService.handleTaskSnoozed(task);
      await this.scheduler.delayTask(taskId, minutes);
      
      // Update topbar badge
      if (this.topbarMenu) {
        this.topbarMenu.update();
      }
      
      logger.info(`Task snoozed: ${task.name} for ${minutes} minutes`);
    }
  }

  private openQuickAdd(prefill?: {
    suggestedName?: string;
    linkedBlockId?: string;
    linkedBlockContent?: string;
    suggestedTime?: string | null;
  }) {
    if (this.quickAddComponent) {
      this.closeQuickAdd();
    }
    this.quickAddContainer = document.createElement("div");
    document.body.appendChild(this.quickAddContainer);
    this.quickAddComponent = mount(QuickAddOverlay, {
      target: this.quickAddContainer,
      props: {
        repository: this.repository,
        prefill,
        onClose: () => this.closeQuickAdd(),
        onAdvanced: () => {
          this.closeQuickAdd();
          this.openTaskEditor();
        },
      },
    });
  }

  private closeQuickAdd() {
    if (this.quickAddComponent) {
      unmount(this.quickAddComponent);
      this.quickAddComponent = null;
    }
    if (this.quickAddContainer) {
      this.quickAddContainer.remove();
      this.quickAddContainer = null;
    }
  }

  /**
   * Open the full task editor modal
   */
  openTaskEditor(task?: Task) {
    if (this.taskEditorComponent) {
      this.closeTaskEditor();
    }
    this.taskEditorContainer = document.createElement("div");
    document.body.appendChild(this.taskEditorContainer);
    this.taskEditorComponent = mount(TaskEditorModal, {
      target: this.taskEditorContainer,
      props: {
        repository: this.repository,
        task,
        onClose: () => this.closeTaskEditor(),
        onSave: () => {
          // Refresh dashboard
          window.dispatchEvent(new CustomEvent("recurring-task-refresh"));
        },
      },
    });
  }

  private closeTaskEditor() {
    if (this.taskEditorComponent) {
      unmount(this.taskEditorComponent);
      this.taskEditorComponent = null;
    }
    if (this.taskEditorContainer) {
      this.taskEditorContainer.remove();
      this.taskEditorContainer = null;
    }
  }
}
