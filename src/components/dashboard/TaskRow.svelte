<script lang="ts">
  import type { Task } from '@/vendor/obsidian-tasks/types/Task';
  import { formatDueDate, isOverdue } from './utils';
  
  export let task: Task;
  export let selected: boolean = false;
  
  // Get priority icon
  function getPriorityIcon(priority: any): string {
    const priorityStr = priority?.toString() || '';
    if (priorityStr.includes('⏫')) return '⏫';
    if (priorityStr.includes('🔺')) return '🔺';
    if (priorityStr.includes('🔼')) return '🔼';
    if (priorityStr.includes('🔽')) return '🔽';
    if (priorityStr.includes('⏬')) return '⏬';
    return '';
  }
  
  $: dueLabel = formatDueDate(task.dueDate);
  $: overdue = isOverdue(task.dueDate);
  $: priorityIcon = getPriorityIcon(task.priority);
</script>

<button 
  class="task-row" 
  class:selected
  class:overdue
  type="button"
  aria-label={`Select task: ${task.description}`}
>
  <div class="task-title">
    {task.description}
  </div>
  <div class="task-meta">
    {#if priorityIcon}
      <span class="priority-icon" title="Priority">{priorityIcon}</span>
    {/if}
    {#if dueLabel}
      <span class="due-date" class:overdue>{dueLabel}</span>
    {/if}
    {#if task.recurrence}
      <span class="recurrence-icon" title="Recurring">🔁</span>
    {/if}
  </div>
</button>

<style>
  .task-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1rem;
    border: none;
    background: transparent;
    cursor: pointer;
    width: 100%;
    text-align: left;
    border-radius: 4px;
    transition: all 0.15s ease;
    border-left: 3px solid transparent;
  }
  
  .task-row:hover {
    background: var(--background-modifier-hover);
  }
  
  .task-row.selected {
    background: var(--interactive-accent-hover);
    border-left-color: var(--interactive-accent);
    font-weight: 500;
  }
  
  .task-row:focus-visible {
    outline: 2px solid var(--interactive-accent);
    outline-offset: -2px;
  }
  
  .task-title {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin-right: 0.5rem;
  }
  
  .task-meta {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    font-size: 0.85em;
    color: var(--text-muted);
    flex-shrink: 0;
  }
  
  .due-date.overdue {
    color: var(--text-error);
    font-weight: 500;
  }
  
  .priority-icon,
  .recurrence-icon {
    font-size: 0.9em;
  }
</style>
