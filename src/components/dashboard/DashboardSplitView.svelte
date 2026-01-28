<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import TaskListPane from './TaskListPane.svelte';
  import TaskEditorPane from './TaskEditorPane.svelte';
  import type { Task } from '@/vendor/obsidian-tasks/types/Task';
  import type { Status } from '@/vendor/obsidian-tasks/types/Status';
  import { selectedTaskStore, selectTask, clearSelection } from '@/stores/selectedTask';
  
  export let tasks: Task[] = [];
  export let statusOptions: Status[] = [];
  export let initialTaskId: string | undefined = undefined;
  export let onTaskSaved: ((task: Task) => Promise<void>) | undefined = undefined;
  export let onNewTask: (() => void) | undefined = undefined;
  export let onClose: (() => void) | undefined = undefined;
  
  // Subscribe to selectedTaskStore
  $: currentTask = $selectedTaskStore;
  
  onMount(() => {
    // Pre-select initial task if provided
    if (initialTaskId) {
      const task = tasks.find(t => t.id === initialTaskId);
      if (task) {
        selectTask(task);
      }
    }
  });
  
  onDestroy(() => {
    // Clean up is handled automatically by Svelte for $ subscriptions
  });
  
  function handleTaskSelect(task: Task) {
    selectTask(task);
  }
  
  async function handleTaskSave(updatedTasks: Task[]): Promise<void> {
    if (updatedTasks.length === 0) return;
    
    const updatedTask = updatedTasks[0];
    
    // Call the onTaskSaved callback if provided
    if (onTaskSaved) {
      await onTaskSaved(updatedTask);
    }
    
    // Update the selected task in store with the new data
    selectTask(updatedTask);
    
    // Update the task in the tasks array
    const index = tasks.findIndex(t => t.id === updatedTask.id);
    if (index !== -1) {
      tasks[index] = updatedTask;
      tasks = [...tasks]; // Trigger reactivity
    }
  }
  
  function handleNewTask() {
    if (onNewTask) {
      onNewTask();
    }
  }
  
  function handleClose() {
    clearSelection();
    if (onClose) {
      onClose();
    }
  }
</script>

<div class="dashboard-split-view">
  <TaskListPane 
    {tasks}
    selectedTaskId={currentTask?.id}
    onTaskSelect={handleTaskSelect}
    onNewTask={handleNewTask}
  />
  
  <TaskEditorPane 
    task={currentTask}
    allTasks={tasks}
    {statusOptions}
    onSave={handleTaskSave}
    onNewTask={handleNewTask}
  />
</div>

<style>
  .dashboard-split-view {
    display: grid;
    grid-template-columns: 40% 60%;
    gap: 0;
    height: 100%;
    width: 100%;
    overflow: hidden;
  }
  
  /* Mobile layout: stacked */
  @media (max-width: 768px) {
    .dashboard-split-view {
      grid-template-columns: 1fr;
      grid-template-rows: 300px 1fr;
    }
  }
  
  /* Tablet layout: adjust proportions */
  @media (min-width: 769px) and (max-width: 1024px) {
    .dashboard-split-view {
      grid-template-columns: 35% 65%;
    }
  }
  
  /* Large desktop: wider task list */
  @media (min-width: 1400px) {
    .dashboard-split-view {
      grid-template-columns: 45% 55%;
    }
  }
</style>
