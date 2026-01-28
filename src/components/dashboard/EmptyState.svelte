<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  const dispatch = createEventDispatcher<{
    newTask: void;
  }>();
  
  function handleNewTask() {
    dispatch('newTask');
  }
</script>

<div class="empty-state">
  <div class="empty-icon">📝</div>
  <h3>Select a task to edit</h3>
  <p>Choose a task from the list on the left, or create a new one.</p>
  <button class="empty-state-btn" on:click={handleNewTask}>
    + Create New Task
  </button>
</div>

<style>
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    text-align: center;
    color: var(--text-muted);
    padding: 2rem;
  }
  
  .empty-icon {
    font-size: 4rem;
    margin-bottom: 1rem;
    opacity: 0.5;
  }
  
  h3 {
    margin: 0.5rem 0;
    color: var(--text-normal);
    font-size: 1.25rem;
    font-weight: 500;
  }
  
  p {
    margin-bottom: 1.5rem;
    color: var(--text-muted);
    font-size: 0.95rem;
  }
  
  .empty-state-btn {
    padding: 0.5rem 1.5rem;
    background-color: var(--interactive-accent);
    color: var(--text-on-accent);
    border: none;
    border-radius: 4px;
    font-size: 0.95rem;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.2s;
  }
  
  .empty-state-btn:hover {
    background-color: var(--interactive-accent-hover);
  }
  
  .empty-state-btn:active {
    transform: translateY(1px);
  }
</style>
