<script lang="ts">
  import type { Task } from "@/core/models/Task";
  import type { TaskRepositoryProvider } from "@/core/storage/TaskRepository";

  interface Props {
    repository: TaskRepositoryProvider;
    selected: string[];
    excludeId?: string;
    onchange: (selected: string[]) => void;
    label?: string;
  }

  let {
    repository,
    selected = $bindable([]),
    excludeId,
    onchange,
    label = "Select tasks",
  }: Props = $props();

  let searchQuery = $state("");
  let showDropdown = $state(false);

  // Get all tasks except the current one
  const allTasks = $derived(
    repository
      .getAllTasks()
      .filter((task) => task.id !== excludeId)
  );

  // Filter tasks by search query
  const filteredTasks = $derived(
    searchQuery.trim()
      ? allTasks.filter((task) =>
          task.name.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : allTasks
  );

  // Get selected task objects
  const selectedTasks = $derived(
    allTasks.filter((task) => selected.includes(task.id))
  );

  function handleSelect(taskId: string) {
    if (!selected.includes(taskId)) {
      const newSelected = [...selected, taskId];
      selected = newSelected;
      onchange(newSelected);
    }
    searchQuery = "";
    showDropdown = false;
  }

  function handleRemove(taskId: string) {
    const newSelected = selected.filter((id) => id !== taskId);
    selected = newSelected;
    onchange(newSelected);
  }

  function handleFocus() {
    showDropdown = true;
  }

  function handleBlur() {
    // Delay to allow click events on dropdown items
    setTimeout(() => {
      showDropdown = false;
    }, 200);
  }
</script>

<div class="dependency-picker">
  <label class="dependency-picker__label">{label}</label>

  {#if selectedTasks.length > 0}
    <div class="dependency-picker__chips">
      {#each selectedTasks as task (task.id)}
        <div class="dependency-picker__chip">
          <span class="dependency-picker__chip-text">{task.name}</span>
          <button
            type="button"
            class="dependency-picker__chip-remove"
            onclick={() => handleRemove(task.id)}
            aria-label="Remove {task.name}"
          >
            ✕
          </button>
        </div>
      {/each}
    </div>
  {/if}

  <div class="dependency-picker__search-wrapper">
    <input
      type="text"
      class="dependency-picker__search"
      bind:value={searchQuery}
      onfocus={handleFocus}
      onblur={handleBlur}
      placeholder="Search tasks..."
    />

    {#if showDropdown && filteredTasks.length > 0}
      <div class="dependency-picker__dropdown">
        {#each filteredTasks.slice(0, 10) as task (task.id)}
          <button
            type="button"
            class="dependency-picker__option"
            class:selected={selected.includes(task.id)}
            onclick={() => handleSelect(task.id)}
            disabled={selected.includes(task.id)}
          >
            <span class="dependency-picker__option-name">{task.name}</span>
            {#if selected.includes(task.id)}
              <span class="dependency-picker__option-check">✓</span>
            {/if}
          </button>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .dependency-picker {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .dependency-picker__label {
    font-size: 14px;
    font-weight: 500;
    color: var(--b3-theme-on-surface);
  }

  .dependency-picker__chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .dependency-picker__chip {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    background: var(--b3-theme-primary);
    color: white;
    border-radius: 4px;
    font-size: 12px;
  }

  .dependency-picker__chip-text {
    max-width: 150px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .dependency-picker__chip-remove {
    border: none;
    background: transparent;
    color: white;
    cursor: pointer;
    font-size: 14px;
    padding: 0;
    line-height: 1;
    opacity: 0.8;
  }

  .dependency-picker__chip-remove:hover {
    opacity: 1;
  }

  .dependency-picker__search-wrapper {
    position: relative;
  }

  .dependency-picker__search {
    width: 100%;
    padding: 8px 12px;
    border-radius: 6px;
    border: 1px solid var(--b3-border-color);
    background: var(--b3-theme-background);
    color: var(--b3-theme-on-background);
    font-size: 14px;
  }

  .dependency-picker__search:focus {
    outline: none;
    border-color: var(--b3-theme-primary);
  }

  .dependency-picker__dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    margin-top: 4px;
    max-height: 200px;
    overflow-y: auto;
    background: var(--b3-theme-surface);
    border: 1px solid var(--b3-border-color);
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 10;
  }

  .dependency-picker__option {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
    border: none;
    background: transparent;
    color: var(--b3-theme-on-surface);
    text-align: left;
    cursor: pointer;
    font-size: 14px;
    transition: background 0.2s;
  }

  .dependency-picker__option:hover:not(:disabled) {
    background: var(--b3-theme-surface-lighter);
  }

  .dependency-picker__option:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .dependency-picker__option-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .dependency-picker__option-check {
    color: var(--b3-theme-primary);
    font-weight: bold;
  }
</style>
