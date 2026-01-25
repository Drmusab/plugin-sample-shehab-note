<script lang="ts">
  import type { Task } from "@/core/models/Task";
  import { formatDateTime } from "@/utils/date";
  import { WEEKDAY_SHORT } from "@/utils/constants";

  interface Props {
    tasks: Task[];
    onEdit: (task: Task) => void;
    onDelete: (task: Task) => void;
    onDuplicate: (task: Task) => void;
    onToggleEnabled: (task: Task) => void;
    onBulkEnable: (taskIds: string[]) => void;
    onBulkDisable: (taskIds: string[]) => void;
    onBulkDelete: (taskIds: string[]) => void;
    onCreate: () => void;
  }

  let { tasks, onEdit, onDelete, onDuplicate, onToggleEnabled, onBulkEnable, onBulkDisable, onBulkDelete, onCreate }: Props = $props();

  let confirmingDelete: Task | null = $state(null);
  let confirmingBulkDelete = $state(false);
  let searchInput = $state("");
  let searchQuery = $state("");
  let selectedTaskIds = $state<Set<string>>(new Set());
  let focusedRowIndex = $state(0);
  let rowRefs = $state<HTMLTableRowElement[]>([]);
  let selectAllCheckbox: HTMLInputElement | null = $state(null);

  const sortedTasks = $derived(
    [...tasks].sort(
      (a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()
    )
  );
  const filteredTasks = $derived.by(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return sortedTasks;
    }
    return sortedTasks.filter((task) => {
      const haystack = [
        task.name,
        task.description,
        task.category,
        task.linkedBlockContent,
        task.tags?.join(" "),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  });
  const visibleTaskIds = $derived(filteredTasks.map((task) => task.id));
  const hasSelection = $derived(selectedTaskIds.size > 0);
  const allVisibleSelected = $derived(
    filteredTasks.length > 0 && filteredTasks.every((task) => selectedTaskIds.has(task.id))
  );
  const someVisibleSelected = $derived(
    filteredTasks.some((task) => selectedTaskIds.has(task.id)) && !allVisibleSelected
  );

  $effect(() => {
    const nextSelection = new Set(
      [...selectedTaskIds].filter((taskId) => tasks.some((task) => task.id === taskId))
    );
    if (nextSelection.size !== selectedTaskIds.size) {
      selectedTaskIds = nextSelection;
    }
  });

  $effect(() => {
    if (selectAllCheckbox) {
      selectAllCheckbox.indeterminate = someVisibleSelected;
    }
  });

  $effect(() => {
    if (focusedRowIndex >= filteredTasks.length) {
      focusedRowIndex = Math.max(0, filteredTasks.length - 1);
    }
  });

  $effect(() => {
    const timeoutId = window.setTimeout(() => {
      searchQuery = searchInput;
    }, 300);

    return () => {
      window.clearTimeout(timeoutId);
    };
  });

  function requestDelete(task: Task) {
    confirmingDelete = task;
  }

  function confirmDelete() {
    if (confirmingDelete) {
      onDelete(confirmingDelete);
      confirmingDelete = null;
    }
  }

  function cancelDelete() {
    confirmingDelete = null;
  }

  function toggleSelection(taskId: string) {
    const nextSelection = new Set(selectedTaskIds);
    if (nextSelection.has(taskId)) {
      nextSelection.delete(taskId);
    } else {
      nextSelection.add(taskId);
    }
    selectedTaskIds = nextSelection;
  }

  function toggleSelectAll() {
    const nextSelection = new Set(selectedTaskIds);
    if (allVisibleSelected) {
      visibleTaskIds.forEach((taskId) => nextSelection.delete(taskId));
    } else {
      visibleTaskIds.forEach((taskId) => nextSelection.add(taskId));
    }
    selectedTaskIds = nextSelection;
  }

  function focusRowAt(index: number) {
    if (filteredTasks.length === 0) {
      return;
    }
    const clampedIndex = Math.max(0, Math.min(index, filteredTasks.length - 1));
    focusedRowIndex = clampedIndex;
    rowRefs[clampedIndex]?.focus();
  }

  function handleRowKeydown(event: KeyboardEvent, index: number) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusRowAt(index + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusRowAt(index - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusRowAt(0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusRowAt(filteredTasks.length - 1);
    }
  }

  function confirmBulkDelete() {
    if (selectedTaskIds.size === 0) {
      confirmingBulkDelete = false;
      return;
    }
    onBulkDelete([...selectedTaskIds]);
    selectedTaskIds = new Set();
    confirmingBulkDelete = false;
  }

  function cancelBulkDelete() {
    confirmingBulkDelete = false;
  }

  function getFrequencyLabel(task: Task): string {
    const { type, interval } = task.frequency;
    const unit = type === "daily" ? "day" : type === "weekly" ? "week" : type === "monthly" ? "month" : "year";
    const base = interval === 1 ? `Every ${unit}` : `Every ${interval} ${unit}s`;
    if (type === "weekly") {
      return `${base} on ${task.frequency.weekdays
        .map((day) => WEEKDAY_SHORT[day] ?? day)
        .join(", ")}`;
    }
    if (type === "monthly") {
      return `${base} on day ${task.frequency.dayOfMonth}`;
    }
    if (type === "yearly") {
      const monthLabel = monthNames[task.frequency.month] ?? `Month ${task.frequency.month + 1}`;
      return `${base} on ${monthLabel} ${task.frequency.dayOfMonth}`;
    }
    return base;
  }

  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
</script>

<div class="all-tasks-tab">
  <div class="all-tasks-tab__header">
    <h2 class="all-tasks-tab__title">All Recurring Tasks</h2>
    <div class="all-tasks-tab__actions">
      <div class="all-tasks-tab__search">
        <span class="all-tasks-tab__search-icon">🔍</span>
        <input
          class="all-tasks-tab__search-input"
          type="search"
          placeholder="Search tasks (name, tags, block content)"
          aria-label="Search tasks"
          title="Searches task names, descriptions, tags, and linked block content."
          bind:value={searchInput}
          disabled={sortedTasks.length === 0}
        />
      </div>
      <button class="all-tasks-tab__create-btn" onclick={onCreate}>
        + Create New Task
      </button>
    </div>
  </div>

  <div class="all-tasks-tab__content">
    <div class="all-tasks-tab__bulk">
      <div class="all-tasks-tab__bulk-info">
        {selectedTaskIds.size} selected
      </div>
      <div class="all-tasks-tab__bulk-actions">
        <button
          class="all-tasks-tab__bulk-btn"
          onclick={() => onBulkEnable([...selectedTaskIds])}
          disabled={!hasSelection}
        >
          Enable
        </button>
        <button
          class="all-tasks-tab__bulk-btn"
          onclick={() => onBulkDisable([...selectedTaskIds])}
          disabled={!hasSelection}
        >
          Disable
        </button>
        <button
          class="all-tasks-tab__bulk-btn all-tasks-tab__bulk-btn--danger"
          onclick={() => (confirmingBulkDelete = true)}
          disabled={!hasSelection}
        >
          Delete
        </button>
      </div>
    </div>
    {#if sortedTasks.length === 0}
      <div class="all-tasks-tab__empty">
        <p>No recurring tasks yet.</p>
        <p class="all-tasks-tab__empty-subtitle">
          Create your first task to get started!
        </p>
      </div>
    {:else}
      <div class="all-tasks-tab__table-wrapper">
        {#if filteredTasks.length === 0}
          <div class="all-tasks-tab__empty">
            <p>No tasks match "{searchQuery.trim()}".</p>
            <p class="all-tasks-tab__empty-subtitle">
              Try a different search term.
            </p>
          </div>
        {:else}
          <table class="all-tasks-tab__table">
            <thead>
              <tr>
                <th class="all-tasks-tab__select-col">
                  <input
                    class="all-tasks-tab__select-all"
                    type="checkbox"
                    aria-label="Select all visible tasks"
                    bind:this={selectAllCheckbox}
                    checked={allVisibleSelected}
                    onclick={toggleSelectAll}
                    disabled={filteredTasks.length === 0}
                  />
                </th>
                <th>Task Name</th>
                <th>Next Due</th>
                <th>Frequency</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {#each filteredTasks as task, index (task.id)}
                <tr
                  class={task.enabled ? "" : "disabled"}
                  tabindex={index === focusedRowIndex ? 0 : -1}
                  bind:this={rowRefs[index]}
                  onkeydown={(event) => handleRowKeydown(event, index)}
                  onfocus={() => (focusedRowIndex = index)}
                  aria-selected={selectedTaskIds.has(task.id)}
                >
                  <td class="all-tasks-tab__select-col">
                    <input
                      type="checkbox"
                      aria-label={`Select ${task.name}`}
                      checked={selectedTaskIds.has(task.id)}
                      onclick={() => toggleSelection(task.id)}
                    />
                  </td>
                  <td class="task-name">{task.name}</td>
                  <td>{formatDateTime(new Date(task.dueAt))}</td>
                  <td>{getFrequencyLabel(task)}</td>
                  <td>
                    <label class="toggle-switch">
                      <input
                        type="checkbox"
                        checked={task.enabled}
                        onchange={() => onToggleEnabled(task)}
                      />
                      <span class="toggle-slider"></span>
                    </label>
                  </td>
                  <td>
                    <div class="task-actions">
                      <button
                        class="task-action-btn task-action-btn--edit"
                        onclick={() => onEdit(task)}
                        title="Edit"
                      >
                        ✏️
                      </button>
                      <button
                        class="task-action-btn task-action-btn--duplicate"
                        onclick={() => onDuplicate(task)}
                        title="Duplicate"
                      >
                        📄
                      </button>
                      <button
                        class="task-action-btn task-action-btn--delete"
                        onclick={() => requestDelete(task)}
                        title="Delete"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}
      </div>
    {/if}
  </div>
</div>

{#if confirmingDelete}
  <div class="delete-confirm-overlay">
    <div class="delete-confirm-dialog">
      <h3>Delete Task?</h3>
      <p>Are you sure you want to delete "{confirmingDelete.name}"? This action cannot be undone.</p>
      <div class="delete-confirm-actions">
        <button class="btn-cancel" onclick={cancelDelete}>Cancel</button>
        <button class="btn-delete" onclick={confirmDelete}>Delete</button>
      </div>
    </div>
  </div>
{/if}

{#if confirmingBulkDelete}
  <div class="delete-confirm-overlay">
    <div class="delete-confirm-dialog">
      <h3>Delete Selected Tasks?</h3>
      <p>Are you sure you want to delete {selectedTaskIds.size} task{selectedTaskIds.size === 1 ? "" : "s"}? This action cannot be undone.</p>
      <div class="delete-confirm-actions">
        <button class="btn-cancel" onclick={cancelBulkDelete}>Cancel</button>
        <button class="btn-delete" onclick={confirmBulkDelete}>Delete</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .all-tasks-tab {
    padding: 16px;
  }

  .all-tasks-tab__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    gap: 16px;
    flex-wrap: wrap;
  }

  .all-tasks-tab__title {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
    color: var(--b3-theme-on-surface);
  }

  .all-tasks-tab__actions {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }

  .all-tasks-tab__search {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    background: var(--b3-theme-surface-lighter);
    border: 1px solid var(--b3-border-color);
    border-radius: 8px;
    min-width: 220px;
  }

  .all-tasks-tab__search-icon {
    font-size: 14px;
    opacity: 0.7;
  }

  .all-tasks-tab__search-input {
    border: none;
    background: transparent;
    outline: none;
    color: var(--b3-theme-on-surface);
    font-size: 14px;
    width: 100%;
  }

  .all-tasks-tab__search-input::placeholder {
    color: var(--b3-theme-on-surface-light);
  }

  .all-tasks-tab__search-input:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  .all-tasks-tab__create-btn {
    padding: 10px 20px;
    background: var(--b3-theme-primary);
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
  }

  .all-tasks-tab__create-btn:hover {
    background: var(--b3-theme-primary-light);
  }

  .all-tasks-tab__content {
    overflow-x: auto;
  }

  .all-tasks-tab__bulk {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
    flex-wrap: wrap;
    color: var(--b3-theme-on-surface-light);
    font-size: 13px;
  }

  .all-tasks-tab__bulk-actions {
    display: flex;
    gap: 8px;
  }

  .all-tasks-tab__bulk-btn {
    padding: 6px 12px;
    border: 1px solid var(--b3-border-color);
    background: var(--b3-theme-surface);
    border-radius: 6px;
    font-size: 13px;
    cursor: pointer;
    color: var(--b3-theme-on-surface);
    transition: background 0.2s;
  }

  .all-tasks-tab__bulk-btn:hover:enabled {
    background: var(--b3-theme-surface-lighter);
  }

  .all-tasks-tab__bulk-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .all-tasks-tab__bulk-btn--danger {
    border-color: var(--b3-theme-error);
    color: var(--b3-theme-error);
  }

  .all-tasks-tab__empty {
    text-align: center;
    padding: 60px 20px;
    color: var(--b3-theme-on-surface-light);
  }

  .all-tasks-tab__empty p {
    margin: 0 0 8px 0;
    font-size: 18px;
  }

  .all-tasks-tab__empty-subtitle {
    font-size: 14px;
  }

  .all-tasks-tab__table-wrapper {
    background: var(--b3-theme-surface);
    border-radius: 8px;
    overflow: hidden;
  }

  .all-tasks-tab__table {
    width: 100%;
    border-collapse: collapse;
  }

  .all-tasks-tab__table thead {
    background: var(--b3-theme-surface-lighter);
  }

  .all-tasks-tab__table th {
    padding: 12px 16px;
    text-align: left;
    font-size: 14px;
    font-weight: 600;
    color: var(--b3-theme-on-surface);
    border-bottom: 1px solid var(--b3-border-color);
  }

  .all-tasks-tab__table td {
    padding: 12px 16px;
    font-size: 14px;
    color: var(--b3-theme-on-surface);
    border-bottom: 1px solid var(--b3-border-color);
  }

  .all-tasks-tab__table tr:focus {
    outline: 2px solid var(--b3-theme-primary);
    outline-offset: -2px;
  }

  .all-tasks-tab__table tr.disabled td {
    opacity: 0.5;
  }

  .all-tasks-tab__table .task-name {
    font-weight: 500;
  }

  .task-actions {
    display: flex;
    gap: 8px;
  }

  .all-tasks-tab__select-col {
    width: 40px;
    text-align: center;
    padding-left: 12px;
    padding-right: 12px;
  }

  .all-tasks-tab__select-all {
    cursor: pointer;
  }

  .task-action-btn {
    background: none;
    border: none;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 4px;
    transition: background 0.2s;
  }

  .task-action-btn:hover {
    background: var(--b3-theme-surface-lighter);
  }

  .toggle-switch {
    position: relative;
    display: inline-block;
    width: 44px;
    height: 24px;
  }

  .toggle-switch input {
    opacity: 0;
    width: 0;
    height: 0;
  }

  .toggle-slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: var(--b3-theme-surface-lighter);
    transition: 0.3s;
    border-radius: 24px;
  }

  .toggle-slider:before {
    position: absolute;
    content: "";
    height: 18px;
    width: 18px;
    left: 3px;
    bottom: 3px;
    background-color: white;
    transition: 0.3s;
    border-radius: 50%;
  }

  input:checked + .toggle-slider {
    background-color: var(--b3-theme-primary);
  }

  input:checked + .toggle-slider:before {
    transform: translateX(20px);
  }

  .delete-confirm-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .delete-confirm-dialog {
    background: var(--b3-theme-surface);
    border-radius: 8px;
    padding: 24px;
    max-width: 400px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  }

  .delete-confirm-dialog h3 {
    margin: 0 0 16px 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--b3-theme-on-surface);
  }

  .delete-confirm-dialog p {
    margin: 0 0 24px 0;
    font-size: 14px;
    color: var(--b3-theme-on-surface-light);
    line-height: 1.5;
  }

  .delete-confirm-actions {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
  }

  .btn-cancel,
  .btn-delete {
    padding: 8px 20px;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
  }

  .btn-cancel {
    background: var(--b3-theme-surface-lighter);
    color: var(--b3-theme-on-surface);
  }

  .btn-cancel:hover {
    background: var(--b3-theme-surface-light);
  }

  .btn-delete {
    background: var(--b3-theme-error);
    color: white;
  }

  .btn-delete:hover {
    background: var(--b3-theme-error-light);
  }
</style>
