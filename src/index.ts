import { GlobalFilter } from '@/core/filtering/GlobalFilter';
import type { GlobalFilterProfile } from '@/core/filtering/FilterRule';
import { Plugin } from "siyuan";
import { mount, unmount } from "svelte";
import Dashboard from "./components/Dashboard.svelte";
import QuickAddOverlay from "./components/cards/QuickAddOverlay.svelte";
import PostponeOverlay from "./components/cards/PostponeOverlay.svelte";
import TaskEditorModal from "./components/TaskEditorModal.svelte";
import type { Task } from "./core/models/Task";
import type { Scheduler } from "./core/engine/Scheduler";
import type { TaskRepositoryProvider } from "./core/storage/TaskRepository";
import { MigrationManager } from "./core/storage/MigrationManager";
import { TaskManager } from "./core/managers/TaskManager";
import type { EventService } from "./services/EventService";
import type { SettingsService } from "./core/settings/SettingsService";
import { registerCommands } from "./plugin/commands";
import { registerBlockMenu } from "./plugin/menus";
import { TopbarMenu } from "./plugin/topbar";
import { DOCK_TYPE, STORAGE_ACTIVE_KEY } from "./utils/constants";
import * as logger from "./utils/logger";
import { showToast, toast } from "./utils/notifications";
import { pluginEventBus } from "./core/events/PluginEventBus";
import { snoozeTask } from "./utils/snooze";
import type { ShortcutManager } from "./commands/ShortcutManager";
import { InlineQueryController } from "./core/inline-query/InlineQueryController";
import { handleCreateTaskFromBlock } from "./commands/CreateTaskFromBlock";
import { SiYuanApiAdapter } from "./core/api/SiYuanApiAdapter";
import { AutoTaskCreator } from "./features/AutoTaskCreator";
import { InlineToggleHandler } from "./commands/InlineToggleHandler";
import { TaskCommands } from "./commands/TaskCommands";
import "./index.scss";

export default class RecurringTasksPlugin extends Plugin {
  private taskManager!: TaskManager;
  private repository!: TaskRepositoryProvider;
  private scheduler!: Scheduler;
  private eventService!: EventService;
  private migrationManager!: MigrationManager;
  private topbarMenu!: TopbarMenu;
  private settingsService!: SettingsService;
  private dashboardComponent: ReturnType<typeof mount> | null = null;
  private dockEl!: HTMLElement;
  private quickAddComponent: ReturnType<typeof mount> | null = null;
  private quickAddContainer: HTMLElement | null = null;
  private taskEditorComponent: ReturnType<typeof mount> | null = null;
  private taskEditorContainer: HTMLElement | null = null;
  private postponeComponent: ReturnType<typeof mount> | null = null;
  private postponeContainer: HTMLElement | null = null;
  private pendingCompletionTimeouts: Map<string, number> = new Map();
  private shortcutManager: ShortcutManager | null = null;
  private inlineQueryController: InlineQueryController | null = null;
  private autoTaskCreator: AutoTaskCreator | null = null;
  private inlineToggleHandler: InlineToggleHandler | null = null;
  private checkboxClickListener: ((event: MouseEvent) => void) | null = null;

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
    const settingsService = this.taskManager.getSettingsService();
    this.settingsService = settingsService;

    // Start scheduler and recover missed tasks
    try {
      await this.taskManager.start();
    } catch (err) {
      logger.error("Failed to start TaskManager", err);
    }

    // Register slash commands and hotkeys
    this.shortcutManager = await registerCommands(
      this,
      this.repository,
      {
        createTask: (payload) => this.dispatchCreateTask(payload),
        completeTask: (taskId) => pluginEventBus.emit("task:complete", { taskId }),
        postponeTask: (taskId) => this.openPostponePicker(taskId),
        openDock: () => this.openDock(),
        openTaskEditor: () => this.openTaskEditor(),
        createTaskFromBlock: () => this.handleCreateTaskFromBlock(),
      },
      this.scheduler.getRecurrenceEngine(),
      () => settingsService.get()
    );

    // ========== Global Filter Profile Commands ==========
    
    /**
     * Command: Switch Global Filter Profile
     * Allows quick switching between filter profiles
     */
    this.addCommand({
      langString: 'switchGlobalFilterProfile',
      hotkey: '⌘⇧F', // Ctrl+Shift+F (configurable)
      callback: async () => {
        const globalFilter = GlobalFilter.getInstance();
        const config = globalFilter.getConfig();
        
        if (!config.enabled) {
          showMessage(
            this.i18n.globalFilterDisabled || 'Global Filter is disabled. Enable it in settings first.',
            3000,
            'info'
          );
          return;
        }
        
        if (config.profiles.length === 0) {
          showMessage(
            this.i18n.noProfiles || 'No profiles found. Create one in settings.',
            3000,
            'info'
          );
          return;
        }
        
        // Create menu for profile selection
        const menu = new Menu();
        
        config.profiles.forEach(profile => {
          menu.addItem({
            label: profile.name,
            icon: profile.id === config.activeProfileId ? 'iconCheck' : '',
            click: async () => {
              await this.switchToProfile(profile.id);
            },
          });
        });
        
        // Add separator and management options
        menu.addSeparator();
        
        menu.addItem({
          label: this.i18n.manageProfiles || 'Manage Profiles...',
          icon: 'iconSettings',
          click: () => {
            // Open settings to Global Filter section
            this.openSettings('global-filter');
          },
        });
        
        // Show menu at cursor or center of screen
        const rect = document.activeElement?.getBoundingClientRect();
        const x = rect ? rect.left : window.innerWidth / 2;
        const y = rect ? rect.bottom + 5 : 100;
        
        menu.showAtPosition({ x, y });
      },
    });
    
    /**
     * Command: Toggle Global Filter On/Off
     * Quick enable/disable without opening settings
     */
    this.addCommand({
      langString: 'toggleGlobalFilter',
      hotkey: '',
      callback: async () => {
        const globalFilter = GlobalFilter.getInstance();
        const config = globalFilter.getConfig();
        
        const newEnabled = !config.enabled;
        
        await this.settingsService.update({
          globalFilter: {
            ...config,
            enabled: newEnabled,
          },
        });
        
        globalFilter.updateConfig({
          ...config,
          enabled: newEnabled,
        });
        
        showMessage(
          newEnabled
            ? (this.i18n.globalFilterEnabled || 'Global Filter enabled')
            : (this.i18n.globalFilterDisabled || 'Global Filter disabled'),
          2000,
          'info'
        );
        
        // Refresh tasks to apply/remove filter
        pluginEventBus.emit('task:refresh', undefined);
      },
    });
    
    /**
     * Command: Show Global Filter Status
     * Display current profile and stats
     */
    this.addCommand({
      langString: 'showGlobalFilterStatus',
      hotkey: '',
      callback: async () => {
        const globalFilter = GlobalFilter.getInstance();
        const config = globalFilter.getConfig();
        const activeProfile = globalFilter.getActiveProfile();
        
        if (!config.enabled) {
          showMessage(
            this.i18n.globalFilterDisabled || 'Global Filter: Disabled',
            3000,
            'info'
          );
          return;
        }
        
        if (!activeProfile) {
          showMessage(
            this.i18n.noActiveProfile || 'No active profile',
            3000,
            'error'
          );
          return;
        }
        
        // Get task stats
        const allTasks = await this.repository.getAllTasks();
        const includedCount = allTasks.filter(t => globalFilter.shouldIncludeTask(t)).length;
        const excludedCount = allTasks.length - includedCount;
        
        const statusMessage = `
          <div style="padding: 10px;">
            <h3 style="margin: 0 0 10px 0;">Global Filter Status</h3>
            <p><strong>Active Profile:</strong> ${activeProfile.name}</p>
            ${activeProfile.description ? `<p style="color: var(--text-muted); font-size: 0.9em;">${activeProfile.description}</p>` : ''}
            <p><strong>Included Tasks:</strong> ${includedCount}</p>
            <p><strong>Excluded Tasks:</strong> ${excludedCount}</p>
            <p><strong>Total Tasks:</strong> ${allTasks.length}</p>
          </div>
        `;
        
        // Show in a dialog
        const dialog = new Dialog({
          title: 'Global Filter Status',
          content: statusMessage,
          width: '400px',
        });
        dialog.open();
      },
    });
    
    /**
     * Command: Create New Global Filter Profile
     * Quick profile creation from command palette
     */
    this.addCommand({
      langString: 'createGlobalFilterProfile',
      hotkey: '',
      callback: async () => {
        const profileName = await this.promptForInput(
          this.i18n.enterProfileName || 'Enter profile name:',
          ''
        );
        
        if (!profileName || profileName.trim() === '') {
          return;
        }
        
        const globalFilter = GlobalFilter.getInstance();
        const config = globalFilter.getConfig();
        
        const newProfile: GlobalFilterProfile = {
          id: `profile_${Date.now()}`,
          name: profileName.trim(),
          description: '',
          includePaths: [],
          excludePaths: [],
          includeTags: [],
          excludeTags: [],
          includeRegex: undefined,
          excludeRegex: undefined,
          regexTargets: ['taskText'],
          excludeStatusTypes: [],
        };
        
        const updatedConfig = {
          ...config,
          profiles: [...config.profiles, newProfile],
          activeProfileId: newProfile.id,
        };
        
        globalFilter.updateConfig(updatedConfig);
        await this.settingsService.update({ globalFilter: updatedConfig });
        
        showMessage(
          `Profile "${profileName}" created and activated`,
          2000,
          'info'
        );
        
        // Optionally open settings to configure the new profile
        const shouldConfigure = await this.confirmDialog(
          this.i18n.configureNewProfile || 'Configure new profile now?'
        );
        
        if (shouldConfigure) {
          this.openSettings('global-filter');
        }
      },
    });
    
    /**
     * Command: Explain Why Task Is Excluded (Debug Mode)
     * For the currently selected/focused task
     */
    this.addCommand({
      langString: 'explainTaskExclusion',
      hotkey: '',
      callback: async () => {
        const globalFilter = GlobalFilter.getInstance();
        const config = globalFilter.getConfig();
        
        if (!config.enabled) {
          showMessage(
            this.i18n.globalFilterDisabled || 'Global Filter is disabled',
            2000,
            'info'
          );
          return;
        }
        
        // Get currently focused task (you'll need to implement this based on your UI)
        const focusedTask = await this.getFocusedTask();
        
        if (!focusedTask) {
          showMessage(
            this.i18n.noTaskSelected || 'No task selected. Click on a task first.',
            3000,
            'info'
          );
          return;
        }
        
        const decision = globalFilter.explainTask(focusedTask);
        
        let explanationHTML = `
          <div style="padding: 10px;">
            <h3 style="margin: 0 0 10px 0;">Filter Explanation</h3>
            <p><strong>Task:</strong> ${focusedTask.name}</p>
        `;
        
        if (decision.included) {
          explanationHTML += `
            <p style="color: var(--text-success); font-weight: 600;">✓ Task is INCLUDED</p>
            <p>${decision.reason}</p>
          `;
        } else {
          explanationHTML += `
            <p style="color: var(--text-error); font-weight: 600;">✗ Task is EXCLUDED</p>
            <p><strong>Reason:</strong> ${decision.reason}</p>
          `;
          
          if (decision.matchedRule) {
            explanationHTML += `
              <p><strong>Matched Rule:</strong></p>
              <ul style="margin-left: 20px;">
                <li><strong>Type:</strong> ${decision.matchedRule.type}</li>
                <li><strong>Pattern:</strong> <code>${decision.matchedRule.pattern}</code></li>
                ${decision.matchedRule.target ? `<li><strong>Target:</strong> ${decision.matchedRule.target}</li>` : ''}
              </ul>
            `;
          }
        }
        
        explanationHTML += `</div>`;
        
        const dialog = new Dialog({
          title: 'Task Filter Explanation',
          content: explanationHTML,
          width: '500px',
        });
        dialog.open();
      },
    });
    
    // ========== End Global Filter Commands ==========

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

    this.inlineQueryController = new InlineQueryController({
      plugin: this,
      repository: this.repository,
      settingsService: this.settingsService,
      onEditTask: (task) => this.openTaskEditor(task),
      onToggleTask: (taskId) => pluginEventBus.emit("task:complete", { taskId }),
    });
    this.inlineQueryController.mount();

    // Initialize Auto Task Creator (Phase 3)
    this.autoTaskCreator = new AutoTaskCreator({
      repository: this.repository,
      settings: () => this.settingsService.get().inlineTasks,
      saveTask: async (task) => {
        await this.repository.createTask(task);
      },
    });
    this.setupAutoCreationEventHandlers();

    // Initialize Inline Toggle Handler (Phase 4)
    this.setupInlineToggleHandler();

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
    
    // Cleanup auto task creator
    if (this.autoTaskCreator) {
      this.autoTaskCreator.cleanup();
    }
    
    // Cleanup inline toggle handler
    if (this.inlineToggleHandler) {
      this.inlineToggleHandler.destroy();
    }
    
    // Remove checkbox click listener
    if (this.checkboxClickListener) {
      document.removeEventListener('click', this.checkboxClickListener, true);
      this.checkboxClickListener = null;
    }
    
    // Destroy dashboard
    this.destroyDashboard();
    this.closeQuickAdd();
    this.closeTaskEditor();
    this.closePostponePicker();

    // Remove event listeners
    this.removeEventListeners();

    if (this.shortcutManager) {
      this.shortcutManager.destroy();
      this.shortcutManager = null;
    }

    if (this.inlineQueryController) {
      this.inlineQueryController.destroy();
      this.inlineQueryController = null;
    }
  }

  private renderDashboard() {
    if (this.dockEl && !this.dashboardComponent) {
      this.dashboardComponent = mount(Dashboard, {
        target: this.dockEl,
        props: {
          repository: this.repository,
          scheduler: this.scheduler,
          eventService: this.eventService,
          shortcutManager: this.shortcutManager,
          settingsService: this.settingsService,
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
    
    // Remove auto-creation handlers
    if (this.autoCreationKeydownHandler) {
      document.removeEventListener("keydown", this.autoCreationKeydownHandler);
    }
    if (this.autoCreationBlurHandler) {
      document.removeEventListener("focusout", this.autoCreationBlurHandler, true);
    }
  }

  private autoCreationKeydownHandler: ((event: KeyboardEvent) => void) | null = null;
  private autoCreationBlurHandler: ((event: FocusEvent) => void) | null = null;

  // Shared regex pattern for checklist detection
  private static readonly CHECKLIST_PATTERN = /^-\s*\[\s*[x\s\-]\s*\]/i;

  /**
   * Setup event handlers for auto-creation (Phase 3)
   */
  private setupAutoCreationEventHandlers() {
    if (!this.autoTaskCreator) return;

    // Handler for Enter key
    this.autoCreationKeydownHandler = (event: KeyboardEvent) => {
      if (event.key !== "Enter") return;
      
      const target = event.target as HTMLElement;
      const blockElement = target.closest("[data-node-id]") as HTMLElement | null;
      
      if (!blockElement) return;
      
      const blockId = blockElement.getAttribute("data-node-id");
      const content = blockElement.textContent || "";
      
      if (!blockId || !RecurringTasksPlugin.CHECKLIST_PATTERN.test(content.trim())) {
        return;
      }
      
      // Trigger auto-creation on Enter
      this.autoTaskCreator.handleEnter(blockId, content.trim());
    };

    // Handler for blur/focusout
    this.autoCreationBlurHandler = (event: FocusEvent) => {
      const target = event.target as HTMLElement;
      const blockElement = target.closest("[data-node-id]") as HTMLElement | null;
      
      if (!blockElement) return;
      
      const blockId = blockElement.getAttribute("data-node-id");
      const content = blockElement.textContent || "";
      
      if (!blockId || !RecurringTasksPlugin.CHECKLIST_PATTERN.test(content.trim())) {
        return;
      }
      
      // Trigger auto-creation on blur
      this.autoTaskCreator.handleBlur(blockId, content.trim());
    };

    // Add event listeners
    document.addEventListener("keydown", this.autoCreationKeydownHandler);
    document.addEventListener("focusout", this.autoCreationBlurHandler, true);
    
    logger.info("Auto-creation event handlers registered");
  }

  /**
   * Setup inline toggle handler for checkbox clicks (Phase 4)
   */
  private setupInlineToggleHandler() {
    const settings = this.settingsService.get();
    
    // Check if inline toggle is enabled
    if (!settings.inlineTasks.enableInlineToggle) {
      logger.info('Inline toggle handler disabled in settings');
      return;
    }

    // Create TaskCommands for toggle handler
    const taskCommands = new TaskCommands(
      this.repository,
      this.scheduler.getRecurrenceEngine(),
      () => this.settingsService.get(),
      undefined
    );

    // Initialize handler
    this.inlineToggleHandler = new InlineToggleHandler({
      taskIndex: this.taskManager.getTaskIndex(),
      taskCommands: taskCommands,
    });

    // Listen for checkbox click events
    this.checkboxClickListener = async (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      
      // Check if click is on a checkbox
      if (target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'checkbox') {
        const blockElement = target.closest('[data-node-id]') as HTMLElement;
        if (!blockElement) return;
        
        const blockId = blockElement.getAttribute('data-node-id');
        if (!blockId) return;
        
        const newChecked = (target as HTMLInputElement).checked;
        
        // Handle async to avoid blocking UI
        this.inlineToggleHandler!.handleToggle(blockId, newChecked).catch(err => {
          logger.error('Failed to handle inline toggle', err);
          if (settings.inlineTasks.showToggleNotifications) {
            toast.error('Failed to update task');
          }
        });
      }
    };

    // Use capture phase to catch events before they bubble
    document.addEventListener('click', this.checkboxClickListener, true);
    
    logger.info('Inline toggle handler setup complete');
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

          pluginEventBus.emit("task:refresh", undefined);
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

  private openPostponePicker(taskId: string) {
    const task = this.repository.getTask(taskId);
    if (!task) {
      toast.error("Task not found");
      return;
    }

    if (this.postponeComponent) {
      this.closePostponePicker();
    }

    this.postponeContainer = document.createElement("div");
    document.body.appendChild(this.postponeContainer);
    this.postponeComponent = mount(PostponeOverlay, {
      target: this.postponeContainer,
      props: {
        taskName: task.name,
        onClose: () => this.closePostponePicker(),
        onSelect: (minutes: number) => {
          snoozeTask(taskId, minutes);
          this.closePostponePicker();
        },
      },
    });
  }

  private closePostponePicker() {
    if (this.postponeComponent) {
      unmount(this.postponeComponent);
      this.postponeComponent = null;
    }
    if (this.postponeContainer) {
      this.postponeContainer.remove();
      this.postponeContainer = null;
    }
  }

  private dispatchCreateTask(payload: {
    source: string;
    suggestedName?: string;
    linkedBlockId?: string;
    linkedBlockContent?: string;
    suggestedTime?: string | null;
  }): void {
    pluginEventBus.emit("task:create", payload);
    window.dispatchEvent(
      new CustomEvent("recurring-task-create", {
        detail: payload,
      })
    );
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

  /**
   * Handle create/edit task from block command
   * Parses inline task format and opens editor with pre-populated data
   */
  private async handleCreateTaskFromBlock(): Promise<void> {
    const apiAdapter = new SiYuanApiAdapter();
    
    await handleCreateTaskFromBlock({
      repository: this.repository,
      blockApi: apiAdapter,
      openTaskEditor: (task, initialData) => {
        // Open editor with the task
        this.openTaskEditor(task);
      }
    });
  }

  // ========== Helper Methods for Global Filter Commands ==========

  /**
   * Switch to a specific profile and refresh tasks
   */
  private async switchToProfile(profileId: string): Promise<void> {
    const globalFilter = GlobalFilter.getInstance();
    const config = globalFilter.getConfig();
    
    const profile = config.profiles.find(p => p.id === profileId);
    if (!profile) {
      showMessage(
        this.i18n.profileNotFound || 'Profile not found',
        2000,
        'error'
      );
      return;
    }
    
    // Update active profile
    globalFilter.setActiveProfile(profileId);
    
    // Save to settings
    await this.settingsService.update({
      globalFilter: {
        ...config,
        activeProfileId: profileId,
      },
    });
    
    // Show confirmation
    showMessage(
      `Switched to profile: ${profile.name}`,
      2000,
      'info'
    );
    
    // Refresh tasks to apply new filter
    pluginEventBus.emit('task:refresh', undefined);
  }

  /**
   * Open settings to a specific section
   */
  private openSettings(section?: string): void {
    // Implementation depends on your settings dialog structure
    // This is a placeholder - adjust to match your actual settings UI
    const settingsDialog = new SettingsDialog(this, this.settingsService);
    if (section) {
      settingsDialog.openToSection(section);
    }
    settingsDialog.open();
  }

  /**
   * Prompt user for text input
   */
  private async promptForInput(message: string, defaultValue: string): Promise<string | null> {
    return new Promise((resolve) => {
      const dialog = new Dialog({
        title: message,
        content: `
          <div style="padding: 10px;">
            <input 
              type="text" 
              id="input-value" 
              value="${defaultValue}" 
              style="width: 100%; padding: 8px; border: 1px solid var(--background-modifier-border); border-radius: 4px;"
            />
          </div>
        `,
        width: '400px',
      });
      
      dialog.element.querySelector('#input-value')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          const value = (dialog.element.querySelector('#input-value') as HTMLInputElement)?.value;
          dialog.destroy();
          resolve(value || null);
        }
      });
      
      // Add OK/Cancel buttons
      const footer = dialog.element.querySelector('.b3-dialog__footer');
      if (footer) {
        const okButton = document.createElement('button');
        okButton.textContent = 'OK';
        okButton.className = 'b3-button b3-button--primary';
        okButton.onclick = () => {
          const value = (dialog.element.querySelector('#input-value') as HTMLInputElement)?.value;
          dialog.destroy();
          resolve(value || null);
        };
        
        const cancelButton = document.createElement('button');
        cancelButton.textContent = 'Cancel';
        cancelButton.className = 'b3-button';
        cancelButton.onclick = () => {
          dialog.destroy();
          resolve(null);
        };
        
        footer.appendChild(cancelButton);
        footer.appendChild(okButton);
      }
      
      dialog.open();
    });
  }

  /**
   * Show confirmation dialog
   */
  private async confirmDialog(message: string): Promise<boolean> {
    return new Promise((resolve) => {
      const dialog = new Dialog({
        title: 'Confirm',
        content: `<div style="padding: 10px;">${message}</div>`,
        width: '350px',
      });
      
      const footer = dialog.element.querySelector('.b3-dialog__footer');
      if (footer) {
        const yesButton = document.createElement('button');
        yesButton.textContent = 'Yes';
        yesButton.className = 'b3-button b3-button--primary';
        yesButton.onclick = () => {
          dialog.destroy();
          resolve(true);
        };
        
        const noButton = document.createElement('button');
        noButton.textContent = 'No';
        noButton.className = 'b3-button';
        noButton.onclick = () => {
          dialog.destroy();
          resolve(false);
        };
        
        footer.appendChild(noButton);
        footer.appendChild(yesButton);
      }
      
      dialog.open();
    });
  }

  /**
   * Get currently focused/selected task
   * Implement based on your UI structure
   */
  private async getFocusedTask(): Promise<Task | null> {
    // This is a placeholder implementation
    // You'll need to adapt this to your actual UI structure
    
    // Example: Get task from active element data attribute
    const activeElement = document.activeElement;
    const taskId = activeElement?.getAttribute('data-task-id');
    
    if (taskId) {
      return this.repository.getTask(taskId) || null;
    }
    
    // Example: Get from currently open task editor
    if (this.taskEditorComponent) {
      // You'll need to expose the current task from your TaskEditorModal component
      // This depends on your Svelte component implementation
    }
    
    return null;
  }
  // ========== End Helper Methods ==========
}
