/**
 * Recurring Task Dashboard View
 * 
 * This view provides a persistent dashboard for managing recurring tasks.
 * It mounts the Obsidian-Tasks EditTask component in a persistent sidebar view
 * instead of as a modal dialog.
 */

import { mount, unmount } from "svelte";
import EditTask from "@/vendor/obsidian-tasks/ui/EditTask.svelte";
import type { Task } from "@/core/models/Task";
import type { TaskRepositoryProvider } from "@/core/storage/TaskRepository";
import type { SettingsService } from "@/core/settings/SettingsService";
import type { PatternLearner } from "@/core/ml/PatternLearner";
import { TaskDraftAdapter } from "@/adapters/TaskDraftAdapter";
import { ObsidianTasksUIBridge } from "@/adapters/ObsidianTasksUIBridge";
import { pluginEventBus } from "@/core/events/PluginEventBus";

export interface RecurringDashboardViewProps {
  repository: TaskRepositoryProvider;
  settingsService: SettingsService;
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
   * Mount the dashboard view
   */
  mount(): void {
    if (this.component) {
      return;
    }

    // Clear container
    this.container.innerHTML = "";
    
    // Add dashboard wrapper
    const wrapper = document.createElement("div");
    wrapper.className = "recurring-dashboard-wrapper obsidian-tasks-modal";
    this.container.appendChild(wrapper);

    // Get all tasks for dependency resolution
    const allTasks = this.props.repository.getAllTasks();

    // Prepare EditableTask using TaskDraftAdapter
    const editableTask = this.currentTask
      ? TaskDraftAdapter.toEditableTask(this.currentTask, allTasks)
      : TaskDraftAdapter.createEmptyEditableTask();

    // Convert all tasks to Obsidian format for the UI
    const allObsidianTasks = allTasks.map(t => TaskDraftAdapter.toObsidianTaskStub(t));

    // Mount the Obsidian-Tasks EditTask component
    this.component = mount(EditTask, {
      target: wrapper,
      props: {
        task: editableTask,
        onSubmit: this.handleSubmit.bind(this),
        statusOptions: ObsidianTasksUIBridge.getStatusOptions(),
        allTasks: allObsidianTasks,
      },
    });
  }

  /**
   * Handle form submission from Obsidian-Tasks UI
   */
  private async handleSubmit(updatedTasks: any[]): Promise<void> {
    if (updatedTasks.length === 0) {
      this.handleClose();
      return;
    }

    // The first updated task is an EditableTask-like object
    const editableTask = updatedTasks[0];
    
    try {
      // Validate before conversion
      TaskDraftAdapter.validate(editableTask);
      
      // Convert EditableTask to Recurring Task using adapter
      const recurringTask = TaskDraftAdapter.fromEditableTask(
        editableTask,
        this.currentTask
      );

      await this.props.repository.saveTask(recurringTask);
      
      // Emit event for dashboard refresh
      pluginEventBus.emit('task:updated', { taskId: recurringTask.id });

      // Reset to new task form
      this.currentTask = undefined;
      this.refresh();
    } catch (error) {
      console.error('Failed to save task:', error);
      // TODO: Show error message to user
      throw error;
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

  private handleClose(): void {
    this.currentTask = undefined;
    this.refresh();
    
    if (this.props.onClose) {
      this.props.onClose();
    }
  }
}
