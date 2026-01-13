<script lang="ts">
  import type { Task } from "@/core/models/Task";
  import { calculateTaskHealth } from "@/core/models/Task";
  import { eventBus } from "@/core/EventBus";
  import { formatDateTime, isOverdue, isToday } from "@/utils/date";
  import { PRIORITY_COLORS, SNOOZE_OPTIONS } from "@/utils/constants";

  interface Props {
    task: Task;
    onDone: (task: Task) => void;
    onDelay: (task: Task) => void;
    onSkip: (task: Task) => void;
    onEdit?: (task: Task) => void;
    timezoneHandler?: any; // TimezoneHandler instance
  }

  let { task, onDone, onDelay, onSkip, onEdit, timezoneHandler }: Props = $props();

  const dueDate = $derived(new Date(task.dueAt));
  const overdue = $derived(isOverdue(dueDate));
  const today = $derived(isToday(dueDate));
  const statusClass = $derived(
    overdue ? "task-card--overdue" : today ? "task-card--today" : ""
  );

  const priorityColor = $derived(
    task.priority ? PRIORITY_COLORS[task.priority] : PRIORITY_COLORS.normal
  );

  const relativeTime = $derived(() => {
    if (timezoneHandler) {
      return timezoneHandler.getRelativeTime(dueDate);
    }
    return "";
  });

  const hasStreak = $derived((task.currentStreak || 0) > 0);
  const streakEmoji = $derived(() => {
    const streak = task.currentStreak || 0;
    if (streak >= 10) return "🔥🔥";
    if (streak >= 5) return "🔥";
    if (streak >= 3) return "⚡";
    return "✨";
  });

  const health = $derived(calculateTaskHealth(task));
  const healthClass = $derived(
    health >= 80 ? "health--good" :
    health >= 50 ? "health--fair" :
    "health--poor"
  );

  let showSnoozeMenu = $state(false);

  function handleDone() {
    onDone(task);
  }

  function handleDelay() {
    onDelay(task);
  }

  function handleEdit() {
    if (onEdit) {
      onEdit(task);
    }
  }

  function handleSkip() {
    onSkip(task);
  }

  function toggleSnoozeMenu() {
    showSnoozeMenu = !showSnoozeMenu;
  }

  function handleSnooze(minutes: number) {
    // Dispatch custom event for snoozing
    eventBus.emit("task-snooze", { taskId: task.id, minutes });
    showSnoozeMenu = false;
  }
</script>

<div class="task-card {statusClass}">
  <div class="task-card__header">
    <div class="task-card__title-row">
      <div
        class="task-card__priority-indicator"
        style="background-color: {priorityColor}"
        title="Priority: {task.priority || 'normal'}"
      ></div>
      <h3 class="task-card__name">{task.name}</h3>
      {#if hasStreak}
        <span class="task-card__streak" title="{task.currentStreak} day streak">
          {streakEmoji()} {task.currentStreak}
        </span>
      {/if}
    </div>
    {#if onEdit}
      <button class="task-card__edit-btn" onclick={handleEdit} title="Edit">
        ✏️
      </button>
    {/if}
  </div>

  <div class="task-card__details">
    <div class="task-card__due">
      <span class="task-card__label">Due:</span>
      <span class="task-card__value">{formatDateTime(dueDate)}</span>
      {#if timezoneHandler}
        <span class="task-card__relative">{relativeTime()}</span>
      {/if}
    </div>

    {#if task.lastCompletedAt}
      <div class="task-card__last-completed">
        <span class="task-card__label">Last completed:</span>
        <span class="task-card__value">
          {formatDateTime(new Date(task.lastCompletedAt))}
        </span>
      </div>
    {/if}

    {#if task.linkedBlockId}
      <div class="task-card__linked-block">
        <button class="task-card__block-link" title="Go to linked block">
          📝 Go to Block
        </button>
      </div>
    {/if}
  </div>

  <div class="task-card__health {healthClass}" title="Task health: {health}%">
    <div class="task-card__health-bar" style="width: {health}%"></div>
  </div>

  <div class="task-card__actions">
    <div class="task-card__snooze-container">
      <button
        class="task-card__action task-card__action--snooze"
        onclick={toggleSnoozeMenu}
        aria-label="Snooze task"
      >
        🕒 Snooze
      </button>
      {#if showSnoozeMenu}
        <div class="task-card__snooze-menu">
          {#each SNOOZE_OPTIONS as option}
            <button
              class="task-card__snooze-option"
              onclick={() => handleSnooze(option.minutes)}
            >
              {option.label}
            </button>
          {/each}
        </div>
      {/if}
    </div>
    <button 
      class="task-card__action task-card__action--delay" 
      onclick={handleDelay}
      aria-label="Delay task to tomorrow"
    >
      🕒 Tomorrow
    </button>
    <button 
      class="task-card__action task-card__action--skip" 
      onclick={handleSkip}
      aria-label="Skip this occurrence"
    >
      ⏭️ Skip
    </button>
    <button 
      class="task-card__action task-card__action--done" 
      onclick={handleDone}
      aria-label="Mark task as done"
    >
      ✅ Done
    </button>
  </div>
</div>

<style>
  .task-card {
    background: var(--b3-theme-surface);
    border: 1px solid var(--b3-border-color);
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 12px;
    transition: all 0.2s ease;
    position: relative;
  }

  .task-card:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .task-card--overdue {
    border-left: 4px solid var(--b3-theme-error);
  }

  .task-card--today {
    border-left: 4px solid var(--b3-theme-primary);
  }

  .task-card__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }

  .task-card__title-row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
  }

  .task-card__priority-indicator {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .task-card__name {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--b3-theme-on-surface);
    flex: 1;
  }

  .task-card__streak {
    font-size: 14px;
    font-weight: 600;
    color: var(--b3-theme-primary);
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .task-card__edit-btn {
    background: none;
    border: none;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 4px;
    transition: background 0.2s;
  }

  .task-card__edit-btn:hover {
    background: var(--b3-theme-surface-lighter);
  }

  .task-card__details {
    margin-bottom: 12px;
    font-size: 14px;
  }

  .task-card__due,
  .task-card__last-completed {
    margin-bottom: 6px;
  }

  .task-card__label {
    color: var(--b3-theme-on-surface-light);
    margin-right: 8px;
  }

  .task-card__value {
    color: var(--b3-theme-on-surface);
    font-weight: 500;
  }

  .task-card__relative {
    color: var(--b3-theme-on-surface-light);
    font-size: 12px;
    margin-left: 8px;
  }

  .task-card__linked-block {
    margin-top: 8px;
  }

  .task-card__block-link {
    background: var(--b3-theme-surface-lighter);
    border: 1px solid var(--b3-border-color);
    color: var(--b3-theme-on-surface);
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
    transition: background 0.2s;
  }

  .task-card__block-link:hover {
    background: var(--b3-theme-surface-light);
  }

  .task-card__actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .task-card__snooze-container {
    position: relative;
  }

  .task-card__action {
    flex: 1;
    min-width: 80px;
    padding: 8px 12px;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .task-card__action--snooze {
    background: var(--b3-theme-surface-lighter);
    color: var(--b3-theme-on-surface);
  }

  .task-card__action--snooze:hover {
    background: var(--b3-theme-surface-light);
  }

  .task-card__action--delay {
    background: var(--b3-theme-surface-lighter);
    color: var(--b3-theme-on-surface);
  }

  .task-card__action--delay:hover {
    background: var(--b3-theme-surface-light);
  }

  .task-card__action--skip {
    background: var(--b3-theme-surface-lighter);
    color: var(--b3-theme-on-surface);
  }

  .task-card__action--skip:hover {
    background: var(--b3-theme-surface-light);
  }

  .task-card__action--done {
    background: var(--b3-theme-primary);
    color: white;
  }

  .task-card__action--done:hover {
    background: var(--b3-theme-primary-light);
  }

  .task-card__snooze-menu {
    position: absolute;
    bottom: 100%;
    left: 0;
    margin-bottom: 4px;
    background: var(--b3-theme-surface);
    border: 1px solid var(--b3-border-color);
    border-radius: 6px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    z-index: 100;
    min-width: 150px;
  }

  .task-card__snooze-option {
    display: block;
    width: 100%;
    padding: 8px 12px;
    background: none;
    border: none;
    text-align: left;
    cursor: pointer;
    font-size: 14px;
    color: var(--b3-theme-on-surface);
    transition: background 0.2s;
  }

  .task-card__snooze-option:hover {
    background: var(--b3-theme-surface-lighter);
  }

  .task-card__snooze-option:first-child {
    border-radius: 6px 6px 0 0;
  }

  .task-card__snooze-option:last-child {
    border-radius: 0 0 6px 6px;
  }

  .task-card__health {
    height: 4px;
    background: var(--b3-border-color);
    border-radius: 2px;
    overflow: hidden;
    margin-top: 8px;
    margin-bottom: 8px;
  }

  .task-card__health-bar {
    height: 100%;
    transition: width 0.3s ease;
  }

  .health--good .task-card__health-bar {
    background: #4caf50;
  }

  .health--fair .task-card__health-bar {
    background: #ff9800;
  }

  .health--poor .task-card__health-bar {
    background: #f44336;
  }
</style>
