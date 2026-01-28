<script lang="ts">
  import TaskRow from './TaskRow.svelte';
  import type { Task } from '@/vendor/obsidian-tasks/types/Task';
  import { onMount, onDestroy } from 'svelte';
  import { clearSelection } from '@/stores/selectedTask';
  
  export let tasks: Task[];
  export let selectedTaskId: string | undefined = undefined;
  export let onTaskSelect: (task: Task) => void;
  export let onNewTask: () => void;
  
  let focusIndex = 0;
  let taskRowsContainer: HTMLElement;
  let containerElement: HTMLElement;
  
  // Reset focus index when tasks change
  $: if (tasks) {
    focusIndex = 0;
  }
  
  function handleKeydown(e: KeyboardEvent) {
    // Only handle keyboard events when the container has focus
    if (!containerElement?.contains(document.activeElement)) {
      return;
    }
    
    if (tasks.length === 0) return;
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        focusIndex = Math.min(focusIndex + 1, tasks.length - 1);
        scrollToIndex(focusIndex);
        focusTaskAtIndex(focusIndex);
        break;
      
      case 'ArrowUp':
        e.preventDefault();
        focusIndex = Math.max(focusIndex - 1, 0);
        scrollToIndex(focusIndex);
        focusTaskAtIndex(focusIndex);
        break;
      
      case 'Enter':
        e.preventDefault();
        if (tasks[focusIndex]) {
          onTaskSelect(tasks[focusIndex]);
        }
        break;
      
      case 'Escape':
        e.preventDefault();
        clearSelection();
        break;
    }
  }
  
  function scrollToIndex(index: number) {
    if (!taskRowsContainer) return;
    const rows = taskRowsContainer.querySelectorAll('.task-row');
    const row = rows[index] as HTMLElement;
    if (row) {
      row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }
  
  function focusTaskAtIndex(index: number) {
    if (!taskRowsContainer) return;
    const rows = taskRowsContainer.querySelectorAll('.task-row');
    const row = rows[index] as HTMLElement;
    if (row) {
      row.focus();
    }
  }
  
  function handleTaskClick(task: Task) {
    onTaskSelect(task);
  }
  
  onMount(() => {
    // Add keyboard listener to the container instead of window
    if (containerElement) {
      containerElement.addEventListener('keydown', handleKeydown);
    }
  });
  
  onDestroy(() => {
    if (containerElement) {
      containerElement.removeEventListener('keydown', handleKeydown);
    }
  });
</script>

<div class="task-list-pane" bind:this={containerElement}>
  <div class="task-list-header">
    <div class="task-count">
      {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
    </div>
    <button class="new-task-btn" on:click={onNewTask}>
      + New Task
    </button>
  </div>
  
  <div class="task-rows" bind:this={taskRowsContainer}>
    {#if tasks.length === 0}
      <div class="no-tasks">
        <p>No tasks found</p>
      </div>
    {:else}
      {#each tasks as task, index (task.id)}
        <div on:click={() => handleTaskClick(task)} role="button" tabindex="0">
          <TaskRow 
            {task} 
            selected={task.id === selectedTaskId}
          />
        </div>
      {/each}
    {/if}
  </div>
</div>

<style>
  .task-list-pane {
    overflow-y: auto;
    border-right: 1px solid var(--background-modifier-border);
    height: 100%;
    display: flex;
    flex-direction: column;
  }
  
  .task-list-header {
    position: sticky;
    top: 0;
    background: var(--background-primary);
    padding: 0.75rem;
    border-bottom: 1px solid var(--background-modifier-border);
    display: flex;
    gap: 0.5rem;
    align-items: center;
    justify-content: space-between;
    z-index: 1;
  }
  
  .task-count {
    flex: 1;
    font-size: 0.9rem;
    color: var(--text-muted);
    font-weight: 500;
  }
  
  .new-task-btn {
    padding: 0.5rem 1rem;
    background-color: var(--interactive-accent);
    color: var(--text-on-accent);
    border: none;
    border-radius: 4px;
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
    transition: background-color 0.2s;
  }
  
  .new-task-btn:hover {
    background-color: var(--interactive-accent-hover);
  }
  
  .task-rows {
    padding: 0.5rem;
    overflow-y: auto;
    flex: 1;
  }
  
  .no-tasks {
    padding: 2rem 1rem;
    text-align: center;
    color: var(--text-muted);
  }
  
  .no-tasks p {
    margin: 0;
    font-size: 0.95rem;
  }
</style>
