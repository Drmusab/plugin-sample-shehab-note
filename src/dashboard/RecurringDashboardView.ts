/**
 * Recurring Task Dashboard View
 * 
 * This view provides a persistent dashboard for managing recurring tasks.
 * It mounts the Obsidian-Tasks EditTask component in a persistent sidebar view
 * instead of as a modal dialog.
 * 
 * Features:
 * - Error boundaries for robust component mounting
 * - Loading state indicators
 * - Proper cleanup on unmount
 * - Event-driven architecture
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
 * Dashboard view that mounts Obsidian-Tasks EditTask component with error handling
 */
export class RecurringDashboardView {
  private component: ReturnType<typeof mount> | null = null;
  private container: HTMLElement;
  private props: RecurringDashboardViewProps;
  private currentTask?: Task;
  private isLoading: boolean = false;
  private isMounted: boolean = false;

  constructor(
    container: HTMLElement,
    props: RecurringDashboardViewProps
  ) {
    this.container = container;
    this.props = props;
  }

  /**
   * Mount the dashboard view with full feature support and error boundary
   */
  mount(initialTask?: Task): void {
    if (this.component) {
      return;
    }

    try {
      // Set current task if provided
      if (initialTask) {
        this.currentTask = initialTask;
      }

      // Clear container
      this.container.innerHTML = "";
      
      // Set loading state AFTER clearing container
      this.setLoading(true);
      
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

      // Mount EditTask component with error boundary
      this.component = mount(EditTask, {
        target: wrapper,
        props: {
          task: obsidianTask,
          statusOptions: this.getStatusOptions(),
          allTasks: allObsidianTasks,
          onSubmit: this.handleSubmit.bind(this),
        },
      });

      this.isMounted = true;
      this.setLoading(false);
    } catch (error) {
      this.handleMountError(error);
    }
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
   * Unmount the dashboard view with proper cleanup
   */
  unmount(): void {
    try {
      if (this.component) {
        unmount(this.component);
        this.component = null;
      }
      this.container.replaceChildren();
      this.isMounted = false;
      this.isLoading = false;
    } catch (error) {
      console.error('Error during dashboard unmount:', error);
      // Continue cleanup even if unmount fails
      this.component = null;
      this.isMounted = false;
      this.isLoading = false;
    }
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

  /**
   * Set loading state and update UI
   */
  private setLoading(loading: boolean): void {
    this.isLoading = loading;
    
    if (loading) {
      // Show loading indicator
      const loadingDiv = document.createElement('div');
      loadingDiv.className = 'recurring-dashboard-loading';
      loadingDiv.innerHTML = `
        <div class="spinner"></div>
        <p>Loading task editor...</p>
      `;
      this.container.appendChild(loadingDiv);
    } else {
      // Remove loading indicator
      const loadingDiv = this.container.querySelector('.recurring-dashboard-loading');
      if (loadingDiv) {
        loadingDiv.remove();
      }
    }
  }

  /**
   * Handle component mounting errors with graceful degradation
   */
  private handleMountError(error: unknown): void {
    this.isLoading = false;
    this.isMounted = false;
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Failed to mount dashboard component:', error);
    
    // Show error message in UI - use textContent for XSS safety
    const errorContainer = document.createElement('div');
    errorContainer.className = 'recurring-dashboard-error';
    
    const errorIcon = document.createElement('div');
    errorIcon.className = 'error-icon';
    errorIcon.textContent = '⚠️';
    
    const errorTitle = document.createElement('h3');
    errorTitle.textContent = 'Failed to Load Task Editor';
    
    const errorText = document.createElement('p');
    errorText.textContent = errorMessage;
    
    const retryBtn = document.createElement('button');
    retryBtn.className = 'error-retry-btn';
    retryBtn.textContent = 'Retry';
    retryBtn.addEventListener('click', () => {
      this.container.innerHTML = '';
      this.mount(this.currentTask);
    });
    
    errorContainer.appendChild(errorIcon);
    errorContainer.appendChild(errorTitle);
    errorContainer.appendChild(errorText);
    errorContainer.appendChild(retryBtn);
    
    this.container.innerHTML = '';
    this.container.appendChild(errorContainer);
    
    // Also show toast notification
    toast.error(`Dashboard error: ${errorMessage}`);
  }
}
