<script lang="ts">
  import { bulkSelectionStore } from '@/stores/bulkSelectionStore';
  
  function handleToggle() {
    if ($bulkSelectionStore.enabled) {
      bulkSelectionStore.disableBulkMode();
    } else {
      bulkSelectionStore.enableBulkMode();
    }
  }
</script>

<button
  class="bulk-mode-toggle"
  class:active={$bulkSelectionStore.enabled}
  on:click={handleToggle}
  type="button"
  aria-label="Toggle bulk selection mode"
  aria-pressed={$bulkSelectionStore.enabled}
  title={$bulkSelectionStore.enabled ? 'Exit bulk mode' : 'Enter bulk mode'}
>
  {#if $bulkSelectionStore.enabled}
    <span class="icon">☑️</span>
    <span class="label">Exit Bulk</span>
  {:else}
    <span class="icon">☐</span>
    <span class="label">Bulk Mode</span>
  {/if}
</button>

<style>
  .bulk-mode-toggle {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    background: var(--interactive-normal);
    color: var(--text-normal);
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  
  .bulk-mode-toggle:hover {
    background: var(--interactive-hover);
    border-color: var(--interactive-accent);
  }
  
  .bulk-mode-toggle.active {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border-color: var(--interactive-accent);
  }
  
  .bulk-mode-toggle:focus-visible {
    outline: 2px solid var(--interactive-accent);
    outline-offset: 2px;
  }
  
  .icon {
    font-size: 1em;
    line-height: 1;
  }
  
  .label {
    line-height: 1;
  }
</style>
