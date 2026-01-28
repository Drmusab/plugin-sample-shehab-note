<script lang="ts">
  import { searchStore } from '@/stores/searchStore';
  
  let inputElement: HTMLInputElement;
  let query = '';
  
  // Subscribe to store
  $: currentQuery = $searchStore.query;
  
  // Sync local state with store
  $: query = currentQuery;
  
  function handleInput(e: Event) {
    const target = e.currentTarget as HTMLInputElement;
    searchStore.setQuery(target.value);
  }
  
  function handleClear() {
    searchStore.setQuery('');
    inputElement?.focus();
  }
  
  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      handleClear();
    }
  }
  
  // Focus handler (will be called by keyboard shortcut)
  export function focus() {
    inputElement?.focus();
  }
</script>

<div class="quick-search">
  <span class="search-icon" aria-hidden="true">🔍</span>
  <input
    bind:this={inputElement}
    type="text"
    placeholder="Search tasks... (Ctrl+K)"
    bind:value={query}
    on:input={handleInput}
    on:keydown={handleKeydown}
    class="search-input"
    aria-label="Search tasks"
  />
  {#if query}
    <button 
      class="clear-btn" 
      on:click={handleClear}
      aria-label="Clear search"
      type="button"
    >
      ×
    </button>
  {/if}
</div>

<style>
  .quick-search {
    position: relative;
    display: flex;
    align-items: center;
    padding: 0.5rem;
    background: var(--background-primary);
    border-bottom: 1px solid var(--background-modifier-border);
  }
  
  .search-icon {
    position: absolute;
    left: 1rem;
    font-size: 1rem;
    color: var(--text-muted);
    pointer-events: none;
  }
  
  .search-input {
    flex: 1;
    padding: 0.5rem 2.5rem 0.5rem 2.5rem;
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    background: var(--background-primary);
    color: var(--text-normal);
    font-size: 0.9rem;
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  
  .search-input:focus {
    outline: none;
    border-color: var(--interactive-accent);
    box-shadow: 0 0 0 2px var(--interactive-accent-hover);
  }
  
  .search-input::placeholder {
    color: var(--text-muted);
  }
  
  .clear-btn {
    position: absolute;
    right: 1rem;
    background: transparent;
    border: none;
    color: var(--text-muted);
    font-size: 1.5rem;
    line-height: 1;
    cursor: pointer;
    padding: 0.25rem 0.5rem;
    border-radius: 3px;
    transition: background-color 0.15s, color 0.15s;
  }
  
  .clear-btn:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }
  
  .clear-btn:focus-visible {
    outline: 2px solid var(--interactive-accent);
    outline-offset: 2px;
  }
</style>
