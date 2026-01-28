<script lang="ts">
  import { bulkSelectionStore, selectedCount } from '@/stores/bulkSelectionStore';
  import { bulkComplete, bulkSetPriority, bulkDelete } from '@/utils/bulkOperations';
  import { createEventDispatcher } from 'svelte';
  import type { Task } from '@/core/models/Task';
  import type { TaskPriority } from '@/core/models/Task';
  
  export let allTasks: Task[];
  export let onBulkUpdate: ((updatedTasks: Task[]) => void) | undefined = undefined;
  export let onBulkDelete: ((taskIds: string[]) => void) | undefined = undefined;
  
  const dispatch = createEventDispatcher();
  
  $: selectedTasks = allTasks.filter(t => $bulkSelectionStore.selectedIds.has(t.id));
  
  async function handleBulkComplete() {
    const result = bulkComplete(selectedTasks);
    if (result.success && onBulkUpdate) {
      onBulkUpdate(result.updatedTasks);
      bulkSelectionStore.clear();
    }
  }
  
  async function handleBulkSetPriority(priority: TaskPriority) {
    const result = bulkSetPriority(selectedTasks, priority);
    if (result.success && onBulkUpdate) {
      onBulkUpdate(result.updatedTasks);
      bulkSelectionStore.clear();
    }
  }
  
  async function handleBulkDelete() {
    const count = $selectedCount;
    const confirmed = confirm(`Delete ${count} task${count === 1 ? '' : 's'}?`);
    
    if (confirmed) {
      const taskIds = Array.from($bulkSelectionStore.selectedIds);
      const result = bulkDelete(taskIds);
      
      if (result.success && onBulkDelete) {
        onBulkDelete(result.taskIds);
        bulkSelectionStore.clear();
      }
    }
  }
  
  function handleSelectAll() {
    const taskIds = allTasks.map(t => t.id);
    bulkSelectionStore.selectAll(taskIds);
  }
  
  function handleClearSelection() {
    bulkSelectionStore.clear();
  }
  
  function handleCancel() {
    bulkSelectionStore.disableBulkMode();
  }
</script>

{#if $selectedCount > 0}
  <div class="bulk-actions-bar" role="toolbar" aria-label="Bulk actions toolbar">
    <div class="selection-info">
      <span class="count">{$selectedCount} selected</span>
      <button class="link-btn" on:click={handleSelectAll} type="button">
        Select all
      </button>
      <button class="link-btn" on:click={handleClearSelection} type="button">
        Clear
      </button>
    </div>
    
    <div class="actions">
      <button class="action-btn" on:click={handleBulkComplete} type="button" title="Mark as completed">
        ✓ Complete
      </button>
      
      <div class="dropdown">
        <button class="action-btn" type="button" title="Set priority">
          Priority ▼
        </button>
        <div class="dropdown-menu">
          <button on:click={() => handleBulkSetPriority('highest')} type="button">⏫ Highest</button>
          <button on:click={() => handleBulkSetPriority('high')} type="button">🔴 High</button>
          <button on:click={() => handleBulkSetPriority('medium')} type="button">🟡 Medium</button>
          <button on:click={() => handleBulkSetPriority('low')} type="button">🔵 Low</button>
          <button on:click={() => handleBulkSetPriority('lowest')} type="button">⏬ Lowest</button>
        </div>
      </div>
      
      <button class="action-btn danger" on:click={handleBulkDelete} type="button" title="Delete tasks">
        🗑️ Delete
      </button>
    </div>
    
    <button class="cancel-btn" on:click={handleCancel} type="button">
      Cancel
    </button>
  </div>
{/if}

<style>
  .bulk-actions-bar {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.75rem 1rem;
    background: var(--background-secondary);
    border-bottom: 2px solid var(--interactive-accent);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }
  
  .selection-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  
  .count {
    font-weight: 600;
    color: var(--text-normal);
    font-size: 0.9rem;
  }
  
  .link-btn {
    background: none;
    border: none;
    color: var(--interactive-accent);
    font-size: 0.85rem;
    cursor: pointer;
    padding: 0.25rem 0.5rem;
    text-decoration: underline;
    transition: opacity 0.15s;
  }
  
  .link-btn:hover {
    opacity: 0.8;
  }
  
  .actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex: 1;
  }
  
  .action-btn {
    padding: 0.4rem 0.75rem;
    border: 1px solid var(--background-modifier-border);
    border-radius: 3px;
    background: var(--interactive-normal);
    color: var(--text-normal);
    font-size: 0.85rem;
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;
  }
  
  .action-btn:hover {
    background: var(--interactive-hover);
    border-color: var(--interactive-accent);
  }
  
  .action-btn.danger {
    border-color: var(--text-error);
    color: var(--text-error);
  }
  
  .action-btn.danger:hover {
    background: var(--text-error);
    color: var(--text-on-accent);
  }
  
  .dropdown {
    position: relative;
    display: inline-block;
  }
  
  .dropdown-menu {
    display: none;
    position: absolute;
    top: 100%;
    left: 0;
    margin-top: 0.25rem;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
    min-width: 150px;
    z-index: 1000;
  }
  
  .dropdown:hover .dropdown-menu,
  .dropdown:focus-within .dropdown-menu {
    display: block;
  }
  
  .dropdown-menu button {
    display: block;
    width: 100%;
    padding: 0.5rem 0.75rem;
    border: none;
    background: none;
    color: var(--text-normal);
    font-size: 0.85rem;
    text-align: left;
    cursor: pointer;
    transition: background-color 0.15s;
  }
  
  .dropdown-menu button:hover {
    background: var(--background-modifier-hover);
  }
  
  .cancel-btn {
    padding: 0.4rem 0.75rem;
    border: 1px solid var(--background-modifier-border);
    border-radius: 3px;
    background: transparent;
    color: var(--text-muted);
    font-size: 0.85rem;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  
  .cancel-btn:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }
  
  /* Mobile: Stack layout */
  @media (max-width: 768px) {
    .bulk-actions-bar {
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    
    .actions {
      order: 3;
      width: 100%;
    }
  }
</style>
