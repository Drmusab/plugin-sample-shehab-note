/**
 * Recurring Task Dashboard View
 * 
 * This view provides a persistent dashboard for managing recurring tasks.
 * It mounts the Obsidian-Tasks EditTask component in a persistent sidebar view
 * instead of as a modal dialog.
 */

import { mount, unmount } from "svelte";
import EditTask from "@/vendor/obsidian-tasks/ui/EditTask.svelte";
import { EditableTask } from "@/vendor/obsidian-tasks/ui/EditableTask";
import type { Task } from "@/core/models/Task";
import type { TaskRepositoryProvider } from "@/core/storage/TaskRepository";
import type { SettingsService } from "@/core/settings/SettingsService";
import type { PatternLearner } from "@/core/ml/PatternLearner";
import type { RecurrenceEngineRRULE } from "@/core/engine/recurrence/RecurrenceEngineRRULE";
import { TaskDraftAdapter } from "@/adapters/TaskDraftAdapter";
import { StatusRegistry } from "@/vendor/obsidian-tasks/types/Status";
import { pluginEventBus } from "@/core/events/PluginEventBus";
import { toast } from "@/utils/notifications";

export interface RecurringDashboardViewProps {
  repository: TaskRepositoryProvider;
  settingsService: SettingsService;
  recurrenceEngine: RecurrenceEngineRRULE;
  patternLearner?: PatternLearner;
  onClose?: () => void;
}

/**
 * Dashboard view that mounts Obsidian-Tasks EditTask component
 */
export class RecurringDashboardView {
  private component: ReturnType<typeof mount> | null = null;
  private container: HTMLElement;
  private props: RecurringDashboardViewProps;
  private currentTask?: Task;

  constructor(
    container: HTMLElement,
    props: RecurringDashboardViewProps
  ) {
    this.container = container;
    this.props = props;
  }

  /**
   * Mount the dashboard view with full feature support
   */
  mount(initialTask?: Task): void {
    if (this.component) {
      return;
    }

    // Set current task if provided
    if (initialTask) {
      this.currentTask = initialTask;
    }

    // Clear container
    this.container.innerHTML = "";
    
    // Create wrapper with proper styling
    const wrapper = document.createElement("div");
    wrapper.className = "recurring-dashboard-wrapper tasks-modal";
    this.container.appendChild(wrapper);

    // Get all tasks for dependency resolution
    const allTasks = this.getAllTasks();

    // Convert task using TaskDraftAdapter - EditTask expects Task, not EditableTask
    const obsidianTask = this.currentTask
      ? TaskDraftAdapter.toObsidianTaskStub(this.currentTask)
      : TaskDraftAdapter.toObsidianTaskStub(this.createEmptyTask());

    // Convert all tasks to Obsidian format for the UI
    const allObsidianTasks = allTasks.map(task => 
      TaskDraftAdapter.toObsidianTaskStub(task)
    );

    // Mount EditTask component
    this.component = mount(EditTask, {
      target: wrapper,
      props: {
        task: obsidianTask,
        statusOptions: this.getStatusOptions(),
        allTasks: allObsidianTasks,
        onSubmit: this.handleSubmit.bind(this),
      },
    });
  }

  /**
   * Create an empty task for new task creation
   */
  private createEmptyTask(): Task {
    const now = new Date().toISOString();
    return {
      id: this.generateTaskId(),
      name: '',
      dueAt: now,
      frequency: { type: 'daily', interval: 1 },
      enabled: true,
      status: 'todo',
      priority: 'normal',
      createdAt: now,
      updatedAt: now,
      completionCount: 0,
      missCount: 0,
      currentStreak: 0,
      bestStreak: 0,
      recentCompletions: [],
      snoozeCount: 0,
      maxSnoozes: 3,
      version: 1,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
  }

  /**
   * Generate a unique task ID
   */
  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get all tasks from repository
   */
  private getAllTasks(): Task[] {
    return this.props.repository.getAllTasks();
  }

  /**
   * Get status options for the status picker
   */
  private getStatusOptions() {
    return StatusRegistry.getInstance().registeredStatuses;
  }

  /**
   * Handle form submission from Obsidian-Tasks UI with validation
   */
  private async handleSubmit(updatedTasks: any[]): Promise<void> {
    if (updatedTasks.length === 0) {
      this.handleClose();
      return;
    }

    // The first updated task is an ObsidianTask object
    const obsidianTask = updatedTasks[0];
    
    try {
      // Convert ObsidianTask to EditableTask, then to Recurring Task
      // We need to reconstruct EditableTask from the obsidian task
      const allTasks = this.getAllTasks();
      const allObsidianTasks = allTasks.map(t => TaskDraftAdapter.toObsidianTaskStub(t));
      const editableTask = EditableTask.fromTask(obsidianTask, allObsidianTasks);
      
      // Convert EditableTask to Recurring Task using adapter
      const recurringTask = TaskDraftAdapter.fromEditableTask(
        editableTask,
        this.currentTask
      );

      // Validate recurrence logic with RecurrenceEngine
      if (recurringTask.frequency) {
        try {
          const nextOccurrence = this.props.recurrenceEngine.calculateNext(
            new Date(recurringTask.dueAt),
            recurringTask.frequency
          );
          
          if (!nextOccurrence) {
            toast.error('Invalid recurrence rule: cannot calculate next occurrence');
            return;
          }
        } catch (error) {
          toast.error('Invalid recurrence rule: ' + (error instanceof Error ? error.message : String(error)));
          return;
        }
      }

      // Save to repository
      await this.props.repository.saveTask(recurringTask);
      
      // Emit success event
      pluginEventBus.emit('task:saved', { 
        task: recurringTask,
        isNew: !this.currentTask 
      });
      
      toast.success(
        this.currentTask 
          ? `Task "${recurringTask.name}" updated` 
          : `Task "${recurringTask.name}" created`
      );
      
      // Close or refresh based on context
      if (this.props.onClose) {
        this.props.onClose();
      } else {
        // Reset to new task form
        this.currentTask = undefined;
        this.refresh();
      }
    } catch (error) {
      console.error('Failed to save task:', error);
      toast.error(`Failed to save task: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Unmount the dashboard view
   */
  unmount(): void {
    if (this.component) {
      unmount(this.component);
      this.component = null;
    }
    this.container.replaceChildren();
  }

  /**
   * Refresh the dashboard (unmount and remount)
   */
  refresh(): void {
    this.unmount();
    this.mount();
  }

  /**
   * Load a task for editing
   */
  loadTask(task: Task): void {
    this.currentTask = task;
    this.refresh();
  }

  /**
   * Clear current task and show new task form
   */
  createNewTask(): void {
    this.currentTask = undefined;
    this.refresh();
  }

  private handleClose(): void {
    this.currentTask = undefined;
    
    if (this.props.onClose) {
      this.props.onClose();
    } else {
      this.refresh();
    }
  }
}
