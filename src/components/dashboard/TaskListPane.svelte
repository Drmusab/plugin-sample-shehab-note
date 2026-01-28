<script lang="ts">
  import TaskRow from './TaskRow.svelte';
  import type { Task } from '@/vendor/obsidian-tasks/types/Task';
  import { onMount, onDestroy } from 'svelte';
  import { isToday, isUpcoming, isOverdue } from './utils';
  import { clearSelection } from '@/stores/selectedTask';
  
  export let tasks: Task[];
  export let selectedTaskId: string | undefined = undefined;
  export let onTaskSelect: (task: Task) => void;
  export let onNewTask: () => void;
  
  type FilterType = 'all' | 'today' | 'upcoming' | 'recurring' | 'overdue';
  
  let filter: FilterType = 'all';
  let focusIndex = 0;
  let taskRowsContainer: HTMLElement;
  let containerElement: HTMLElement;
  
  // Filter tasks based on selected filter
  $: filteredTasks = filterTasks(tasks, filter);
  
  // Calculate task counts for each filter
  $: taskCounts = {
    all: tasks.length,
    today: tasks.filter(t => isToday(t.dueDate)).length,
    upcoming: tasks.filter(t => isUpcoming(t.dueDate)).length,
    recurring: tasks.filter(t => t.recurrence).length,
    overdue: tasks.filter(t => isOverdue(t.dueDate)).length,
  };
  
  // Reset focus index when filter changes
  $: if (filter) {
    focusIndex = 0;
  }
  
  function filterTasks(tasks: Task[], filter: FilterType): Task[] {
    switch (filter) {
      case 'today':
        return tasks.filter(t => isToday(t.dueDate));
      case 'upcoming':
        return tasks.filter(t => isUpcoming(t.dueDate));
      case 'recurring':
        return tasks.filter(t => t.recurrence);
      case 'overdue':
        return tasks.filter(t => isOverdue(t.dueDate));
      case 'all':
      default:
        return tasks;
    }
  }
  
  function handleKeydown(e: KeyboardEvent) {
    // Only handle keyboard events when the container has focus
    if (!containerElement?.contains(document.activeElement)) {
      return;
    }
    
    if (filteredTasks.length === 0) return;
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        focusIndex = Math.min(focusIndex + 1, filteredTasks.length - 1);
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
        if (filteredTasks[focusIndex]) {
          onTaskSelect(filteredTasks[focusIndex]);
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
    <select bind:value={filter} class="filter-select">
      <option value="all">All Tasks ({taskCounts.all})</option>
      <option value="today">Today ({taskCounts.today})</option>
      <option value="upcoming">Upcoming ({taskCounts.upcoming})</option>
      <option value="recurring">Recurring ({taskCounts.recurring})</option>
      <option value="overdue">Overdue ({taskCounts.overdue})</option>
    </select>
    <button class="new-task-btn" on:click={onNewTask}>
      + New Task
    </button>
  </div>
  
  <div class="task-rows" bind:this={taskRowsContainer}>
    {#if filteredTasks.length === 0}
      <div class="no-tasks">
        <p>No tasks found</p>
      </div>
    {:else}
      {#each filteredTasks as task, index (task.id)}
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
    z-index: 1;
  }
  
  .filter-select {
    flex: 1;
    padding: 0.5rem;
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    background: var(--background-primary);
    color: var(--text-normal);
    font-size: 0.9rem;
    cursor: pointer;
  }
  
  .filter-select:focus {
    outline: 2px solid var(--interactive-accent);
    outline-offset: -2px;
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
