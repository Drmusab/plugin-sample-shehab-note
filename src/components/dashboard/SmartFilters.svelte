<script lang="ts">
  import { searchStore, calculateFilterCounts, type SmartFilter } from '@/stores/searchStore';
  import type { Task } from '@/core/models/Task';
  
  export let tasks: Task[] = [];
  
  const filters: Array<{ id: SmartFilter; label: string; icon: string }> = [
    { id: 'today', label: 'Today', icon: '📅' },
    { id: 'overdue', label: 'Overdue', icon: '⚠️' },
    { id: 'high-priority', label: 'High Priority', icon: '🔴' },
    { id: 'recurring', label: 'Recurring', icon: '🔄' },
    { id: 'no-due-date', label: 'No Due Date', icon: '📌' },
    { id: 'completed', label: 'Completed', icon: '✅' }
  ];
  
  // Calculate counts reactively
  $: counts = calculateFilterCounts(tasks);
  
  function handleFilterClick(filterId: SmartFilter) {
    searchStore.toggleFilter(filterId);
  }
  
  function handleKeydown(e: KeyboardEvent, filterId: SmartFilter) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleFilterClick(filterId);
    }
  }
</script>

<div class="smart-filters">
  {#each filters as filter}
    <button
      class="filter-chip"
      class:active={$searchStore.activeFilters.has(filter.id)}
      on:click={() => handleFilterClick(filter.id)}
      on:keydown={(e) => handleKeydown(e, filter.id)}
      type="button"
      role="button"
      aria-pressed={$searchStore.activeFilters.has(filter.id)}
      aria-label={`Filter by ${filter.label}`}
    >
      <span class="icon" aria-hidden="true">{filter.icon}</span>
      <span class="label">{filter.label}</span>
      <span class="count">({counts[filter.id]})</span>
    </button>
  {/each}
  
  {#if $searchStore.activeFilters.size > 0}
    <button 
      class="clear-all-btn" 
      on:click={() => searchStore.clearFilters()}
      type="button"
      aria-label="Clear all filters"
    >
      Clear All
    </button>
  {/if}
</div>

<style>
  .smart-filters {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    padding: 0.75rem;
    border-bottom: 1px solid var(--background-modifier-border);
    background: var(--background-primary);
  }
  
  .filter-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.4rem 0.75rem;
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 16px;
    color: var(--text-normal);
    font-size: 0.85rem;
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;
  }
  
  .filter-chip:hover {
    background: var(--background-modifier-hover);
    border-color: var(--interactive-accent);
    transform: translateY(-1px);
  }
  
  .filter-chip:focus-visible {
    outline: 2px solid var(--interactive-accent);
    outline-offset: 2px;
  }
  
  .filter-chip.active {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border-color: var(--interactive-accent);
    font-weight: 500;
    animation: scaleIn 0.1s ease;
  }
  
  @keyframes scaleIn {
    from {
      transform: scale(0.95);
    }
    to {
      transform: scale(1);
    }
  }
  
  .filter-chip .icon {
    font-size: 0.9em;
    line-height: 1;
  }
  
  .filter-chip .label {
    line-height: 1;
  }
  
  .filter-chip .count {
    opacity: 0.8;
    font-size: 0.9em;
  }
  
  .clear-all-btn {
    padding: 0.4rem 0.75rem;
    background: transparent;
    border: 1px solid var(--background-modifier-border);
    border-radius: 16px;
    color: var(--text-muted);
    font-size: 0.85rem;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  
  .clear-all-btn:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
    border-color: var(--text-muted);
  }
  
  .clear-all-btn:focus-visible {
    outline: 2px solid var(--interactive-accent);
    outline-offset: 2px;
  }
  
  /* Mobile: Stack filters */
  @media (max-width: 768px) {
    .smart-filters {
      padding: 0.5rem;
      gap: 0.4rem;
    }
    
    .filter-chip {
      font-size: 0.8rem;
      padding: 0.35rem 0.6rem;
    }
  }
</style>
