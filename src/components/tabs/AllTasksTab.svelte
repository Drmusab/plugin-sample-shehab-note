<script lang="ts">
  import type { Task } from "@/core/models/Task";
  import { formatDateTime } from "@/utils/date";
  import { confirm } from "@/utils/notifications";

  interface Props {
    tasks: Task[];
    onEdit: (task: Task) => void;
    onDelete: (task: Task) => void;
    onToggleEnabled: (task: Task) => void;
    onCreate: () => void;
  }

  let { tasks, onEdit, onDelete, onToggleEnabled, onCreate }: Props = $props();

  const sortedTasks = $derived(
    [...tasks].sort(
      (a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()
    )
  );

  function handleDelete(task: Task) {
    if (confirm(`Are you sure you want to delete "${task.name}"?`)) {
      onDelete(task);
    }
  }

  function getFrequencyLabel(task: Task): string {
    const { type, interval } = task.frequency;
    const unit = type === "daily" ? "day" : type === "weekly" ? "week" : "month";
    const base = interval === 1 ? `Every ${unit}` : `Every ${interval} ${unit}s`;
    if (type === "weekly") {
      const weekdayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
      return `${base} on ${task.frequency.weekdays
        .map((day) => weekdayNames[day] ?? day)
        .join(", ")}`;
    }
    if (type === "monthly") {
      return `${base} on day ${task.frequency.dayOfMonth}`;
    }
    return base;
  }
</script>

<div class="all-tasks-tab">
  <div class="all-tasks-tab__header">
    <h2 class="all-tasks-tab__title">All Recurring Tasks</h2>
    <button class="all-tasks-tab__create-btn" onclick={onCreate}>
      + Create New Task
    </button>
  </div>

  <div class="all-tasks-tab__content">
    {#if sortedTasks.length === 0}
      <div class="all-tasks-tab__empty">
        <p>No recurring tasks yet.</p>
        <p class="all-tasks-tab__empty-subtitle">
          Create your first task to get started!
        </p>
      </div>
    {:else}
      <div class="all-tasks-tab__table-wrapper">
        <table class="all-tasks-tab__table">
          <thead>
            <tr>
              <th>Task Name</th>
              <th>Next Due</th>
              <th>Frequency</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {#each sortedTasks as task (task.id)}
              <tr class={task.enabled ? "" : "disabled"}>
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
                      class="task-action-btn task-action-btn--delete"
                      onclick={() => handleDelete(task)}
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
      </div>
    {/if}
  </div>
</div>

<style>
  .all-tasks-tab {
    padding: 16px;
  }

  .all-tasks-tab__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
  }

  .all-tasks-tab__title {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
    color: var(--b3-theme-on-surface);
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
</style>
