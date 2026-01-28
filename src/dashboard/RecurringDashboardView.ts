/**
 * Recurring Task Dashboard View
 * 
 * This view provides a persistent dashboard for managing recurring tasks.
 * It mounts the TaskEditorModal component in a persistent sidebar view
 * instead of as a modal dialog.
 */

import { mount, unmount } from "svelte";
import TaskEditorModal from "@/components/TaskEditorModal.svelte";
import type { Task } from "@/core/models/Task";
import type { TaskRepositoryProvider } from "@/core/storage/TaskRepository";
import type { SettingsService } from "@/core/settings/SettingsService";
import type { PatternLearner } from "@/core/ml/PatternLearner";

export interface RecurringDashboardViewProps {
  repository: TaskRepositoryProvider;
  settingsService: SettingsService;
  patternLearner?: PatternLearner;
  onClose?: () => void;
}

/**
 * Dashboard view that mounts the task editor as a persistent interface
 */
export class RecurringDashboardView {
  private component: ReturnType<typeof mount> | null = null;
  private container: HTMLElement;
  private props: RecurringDashboardViewProps;

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
    wrapper.className = "recurring-dashboard-wrapper";
    this.container.appendChild(wrapper);

    // Mount the task editor component
    this.component = mount(TaskEditorModal, {
      target: wrapper,
      props: {
        repository: this.props.repository,
        settingsService: this.props.settingsService,
        patternLearner: this.props.patternLearner,
        task: undefined, // Create new task
        onClose: () => {
          this.handleClose();
        },
        onSave: (task: Task) => {
          this.handleSave(task);
        },
      },
    });
  }

  /**
   * Unmount the dashboard view
   */
  unmount(): void {
    if (this.component) {
      unmount(this.component);
      this.component = null;
    }
    // Use modern DOM API for cleaner cleanup
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
    this.unmount();
    
    const wrapper = document.createElement("div");
    wrapper.className = "recurring-dashboard-wrapper";
    this.container.appendChild(wrapper);

    this.component = mount(TaskEditorModal, {
      target: wrapper,
      props: {
        repository: this.props.repository,
        settingsService: this.props.settingsService,
        patternLearner: this.props.patternLearner,
        task,
        onClose: () => {
          this.handleClose();
        },
        onSave: (updatedTask: Task) => {
          this.handleSave(updatedTask);
        },
      },
    });
  }

  private handleClose(): void {
    // Reset to new task form after close
    this.refresh();
    
    if (this.props.onClose) {
      this.props.onClose();
    }
  }

  private handleSave(task: Task): void {
    // Reset to new task form after save
    this.refresh();
  }
}
