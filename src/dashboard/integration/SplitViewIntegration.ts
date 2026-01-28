/**
 * Example Integration: DashboardSplitView with RecurringDashboardView
 * 
 * This file demonstrates how to integrate the new DashboardSplitView component
 * into the existing RecurringDashboardView system.
 * 
 * Usage:
 * 1. Enable feature flag in settings: `useSplitViewDashboard: true`
 * 2. Use `mountSplitView()` instead of `mount()` in RecurringDashboardView
 * 
 * Benefits:
 * - Auto-save on task edits (no Apply button needed)
 * - Keyboard navigation in task list
 * - Better mobile responsive layout
 * - Cleaner separation of concerns
 */

import { mount, unmount } from "svelte";
import DashboardSplitView from "@/components/dashboard/DashboardSplitView.svelte";
import type { Task as RecurringTask } from "@/core/models/Task";
import type { Task as ObsidianTask } from "@/vendor/obsidian-tasks/types/Task";
import { TaskDraftAdapter } from "@/adapters/TaskDraftAdapter";
import { StatusRegistry } from "@/vendor/obsidian-tasks/types/Status";
import { toast } from "@/utils/notifications";
import type { RecurringDashboardViewProps } from "@/dashboard/RecurringDashboardView";

/**
 * Mount the new DashboardSplitView component
 * 
 * This is an alternative to the existing mount() method that uses the new
 * split-view dashboard components.
 * 
 * @param container - The HTML element to mount the dashboard in
 * @param props - Dashboard configuration props
 * @param initialTask - Optional task to pre-select
 * @returns Cleanup function to unmount the component
 */
export function mountSplitView(
  container: HTMLElement,
  props: RecurringDashboardViewProps,
  initialTask?: RecurringTask
): () => void {
  // Clear container
  container.innerHTML = "";
  
  // Get all tasks and convert to Obsidian format
  const allTasks = props.repository.getAllTasks();
  const obsidianTasks: ObsidianTask[] = allTasks.map(task => 
    TaskDraftAdapter.toObsidianTaskStub(task)
  );
  
  // Get status options
  const statusOptions = StatusRegistry.getInstance().registeredStatuses;
  
  // Handle task save
  async function handleTaskSaved(obsidianTask: ObsidianTask): Promise<void> {
    try {
      // Note: Using 'as any' here because the repository interface expects RecurringTask
      // but we're working with ObsidianTask. In production, you should implement proper
      // conversion using TaskDraftAdapter.fromEditableTask() as shown in
      // RecurringDashboardView.handleSubmit()
      await props.repository.saveTask(obsidianTask as any);
      
      toast.success("Task saved");
    } catch (error) {
      console.error('Failed to save task:', error);
      toast.error(`Failed to save task: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  // Handle new task creation
  function handleNewTask(): void {
    toast.info('New task creation - implement as needed');
  }
  
  // Handle close
  function handleClose(): void {
    if (props.onClose) {
      props.onClose();
    }
  }
  
  // Mount the component
  const component = mount(DashboardSplitView, {
    target: container,
    props: {
      tasks: obsidianTasks,
      statusOptions,
      initialTaskId: initialTask?.id,
      onTaskSaved: handleTaskSaved,
      onNewTask: handleNewTask,
      onClose: handleClose,
    },
  });
  
  // Return cleanup function
  return () => {
    unmount(component);
    container.replaceChildren();
  };
}
