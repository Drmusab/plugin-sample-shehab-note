<script lang="ts">
  import type { TaskSuggestion } from '@/core/ai/SmartSuggestionEngine';
  import Icon from '@/components/ui/Icon.svelte';
  import type { IconCategory } from '@/assets/icons';

  interface Props {
    suggestions: TaskSuggestion[];
    onAccept: (suggestion: TaskSuggestion) => void;
    onDismiss: (suggestionId: string) => void;
  }

  let { suggestions = [], onAccept, onDismiss }: Props = $props();

  function getSuggestionIconInfo(type: string): { category: IconCategory; name: string; size: 16 | 20 | 24 } {
    switch (type) {
      case 'reschedule': return { category: 'status', name: 'clock', size: 16 };
      case 'urgency': return { category: 'status', name: 'warning', size: 16 };
      case 'consolidate': return { category: 'features', name: 'consolidate', size: 24 };
      case 'delegate': return { category: 'features', name: 'delegate', size: 24 };
      case 'frequency': return { category: 'features', name: 'analytics', size: 24 };
      case 'abandon': return { category: 'actions', name: 'delete', size: 16 };
      default: return { category: 'features', name: 'suggestion', size: 24 };
    }
  }

  function getSuggestionColor(type: string): string {
    switch (type) {
      case 'reschedule': return 'blue';
      case 'urgency': return 'red';
      case 'consolidate': return 'purple';
      case 'delegate': return 'orange';
      case 'frequency': return 'green';
      case 'abandon': return 'gray';
      default: return 'blue';
    }
  }
</script>

<div class="suggestions-panel">
  <h3>Smart Suggestions</h3>

  {#if suggestions.length === 0}
    <p class="no-suggestions">No suggestions at this time. Keep completing tasks to build pattern data!</p>
  {:else}
    <div class="suggestions-list">
      {#each suggestions as suggestion}
        {@const iconInfo = getSuggestionIconInfo(suggestion.type)}
        <div class="suggestion-card" data-type={suggestion.type} data-color={getSuggestionColor(suggestion.type)}>
          <div class="suggestion-header">
            <span class="suggestion-icon">
              <Icon category={iconInfo.category} name={iconInfo.name} size={iconInfo.size} alt={suggestion.type} />
            </span>
            <span class="suggestion-type">{suggestion.type}</span>
            <span class="confidence-badge" data-confidence={Math.round(suggestion.confidence * 100)}>
              {Math.round(suggestion.confidence * 100)}% confident
            </span>
          </div>

          <p class="suggestion-reason">{suggestion.reason}</p>

          <div class="suggestion-actions">
            <button 
              class="btn-apply"
              onclick={() => onAccept(suggestion)}
            >
              Apply
            </button>
            <button 
              class="btn-dismiss"
              onclick={() => onDismiss(suggestion.id)}
            >
              Dismiss
            </button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .suggestions-panel {
    padding: 1rem;
    background: var(--background-primary);
    border-radius: 8px;
  }

  h3 {
    margin: 0 0 1rem 0;
    font-size: 1.25rem;
    font-weight: 600;
  }

  .no-suggestions {
    color: var(--text-muted);
    text-align: center;
    padding: 2rem;
    font-style: italic;
  }

  .suggestions-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .suggestion-card {
    padding: 1rem;
    background: var(--background-secondary);
    border-radius: 6px;
    border-left: 3px solid var(--text-accent);
    transition: transform 0.2s ease;
  }

  .suggestion-card:hover {
    transform: translateX(2px);
  }

  .suggestion-card[data-color="blue"] {
    border-left-color: #3b82f6;
  }

  .suggestion-card[data-color="red"] {
    border-left-color: #ef4444;
  }

  .suggestion-card[data-color="purple"] {
    border-left-color: #8b5cf6;
  }

  .suggestion-card[data-color="orange"] {
    border-left-color: #f59e0b;
  }

  .suggestion-card[data-color="green"] {
    border-left-color: #10b981;
  }

  .suggestion-card[data-color="gray"] {
    border-left-color: #6b7280;
  }

  .suggestion-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .suggestion-icon {
    font-size: 1.25rem;
  }

  .suggestion-type {
    text-transform: capitalize;
    font-weight: 500;
    flex: 1;
  }

  .confidence-badge {
    padding: 0.25rem 0.5rem;
    background: var(--background-primary);
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 500;
  }

  .confidence-badge[data-confidence="100"],
  .confidence-badge[data-confidence="90"],
  .confidence-badge[data-confidence="85"] {
    color: #10b981;
  }

  .confidence-badge[data-confidence="75"],
  .confidence-badge[data-confidence="70"],
  .confidence-badge[data-confidence="65"] {
    color: #f59e0b;
  }

  .suggestion-reason {
    margin: 0 0 0.75rem 0;
    color: var(--text-normal);
    line-height: 1.5;
  }

  .suggestion-actions {
    display: flex;
    gap: 0.5rem;
  }

  .btn-apply,
  .btn-dismiss {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: 500;
    transition: opacity 0.2s ease;
  }

  .btn-apply {
    background: var(--text-accent);
    color: white;
  }

  .btn-apply:hover {
    opacity: 0.9;
  }

  .btn-dismiss {
    background: transparent;
    color: var(--text-muted);
    border: 1px solid var(--background-modifier-border);
  }

  .btn-dismiss:hover {
    background: var(--background-modifier-hover);
  }
</style>
