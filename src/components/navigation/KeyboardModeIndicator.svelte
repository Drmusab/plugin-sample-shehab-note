<script lang="ts">
  import type { NavigationMode } from '@/core/navigation/KeyboardNavigationController';

  interface Props {
    mode: NavigationMode;
    commandBuffer: string;
    selectedCount?: number;
  }

  let { mode, commandBuffer = '', selectedCount = 0 }: Props = $props();
</script>

<div class="mode-indicator" data-mode={mode}>
  <span class="mode-label">
    {#if mode === 'normal'}
      <span class="mode-text">-- NORMAL --</span>
    {:else if mode === 'insert'}
      <span class="mode-text">-- INSERT --</span>
    {:else if mode === 'visual'}
      <span class="mode-text">-- VISUAL -- {selectedCount} selected</span>
    {:else if mode === 'command'}
      <span class="mode-text">:{commandBuffer}</span>
    {/if}
  </span>

  {#if mode === 'normal'}
    <div class="quick-hints">
      <span class="hint"><kbd>j/k</kbd> move</span>
      <span class="hint"><kbd>x</kbd> toggle</span>
      <span class="hint"><kbd>dd</kbd> delete</span>
      <span class="hint"><kbd>i</kbd> edit</span>
      <span class="hint"><kbd>/</kbd> search</span>
      <span class="hint"><kbd>:</kbd> command</span>
      <span class="hint"><kbd>?</kbd> help</span>
    </div>
  {/if}
</div>

<style>
  .mode-indicator {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 0.5rem 1rem;
    background: var(--background-secondary);
    border-top: 2px solid var(--background-modifier-border);
    font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
    display: flex;
    justify-content: space-between;
    align-items: center;
    z-index: 1000;
    transition: border-top-color 0.2s ease;
  }

  .mode-indicator[data-mode="normal"] {
    border-top-color: #3b82f6;
  }

  .mode-indicator[data-mode="insert"] {
    border-top-color: #10b981;
  }

  .mode-indicator[data-mode="visual"] {
    border-top-color: #8b5cf6;
  }

  .mode-indicator[data-mode="command"] {
    border-top-color: #f59e0b;
  }

  .mode-label {
    font-weight: 600;
    font-size: 0.875rem;
  }

  .mode-text {
    color: var(--text-normal);
  }

  .mode-indicator[data-mode="insert"] .mode-text {
    color: #10b981;
  }

  .mode-indicator[data-mode="visual"] .mode-text {
    color: #8b5cf6;
  }

  .mode-indicator[data-mode="command"] .mode-text {
    color: #f59e0b;
  }

  .quick-hints {
    display: flex;
    gap: 1rem;
    font-size: 0.75rem;
  }

  .hint {
    color: var(--text-muted);
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  kbd {
    padding: 0.125rem 0.375rem;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 3px;
    font-family: inherit;
    font-size: 0.75rem;
    font-weight: 600;
  }

  @media (max-width: 768px) {
    .quick-hints {
      display: none;
    }

    .mode-indicator {
      justify-content: center;
    }
  }
</style>
