<script lang="ts">
  import type { Task } from "@/core/models/Task";
  import { calculateTaskHealth, normalizePriority } from "@/core/models/Task";
  import { calculateUrgencyScore } from "@/core/urgency/UrgencyScoreCalculator";
  import type { UrgencySettings } from "@/core/urgency/UrgencySettings";
  import { tick, getContext } from "svelte";
  import { fetchBlockEmbed, fetchBlockPreview } from "@/utils/blocks";
  import { daysBetween, formatDateTime, isOverdue, isToday } from "@/utils/date";
  import { PRIORITY_COLORS, SNOOZE_OPTIONS } from "@/utils/constants";
  import { URGENCY_SETTINGS_CONTEXT_KEY } from "@/core/urgency/UrgencyContext";
  import Icon from "@/components/ui/Icon.svelte";

  interface Props {
    task: Task;
    onDone:  (task: Task) => void;
    onDelay: (task: Task) => void;
    onSkip: (task: Task) => void;
    onEdit?:  (task: Task) => void;
    timezoneHandler?:  any; // TimezoneHandler instance
  }

  let { task, onDone, onDelay, onSkip, onEdit, timezoneHandler }: Props = $props();

  const dueDate = $derived(new Date(task.dueAt));
  const overdue = $derived(isOverdue(dueDate));
  const today = $derived(isToday(dueDate));
  const overdueDays = $derived(
    overdue ?  daysBetween(new Date(task.dueAt), new Date()) : 0
  );
  const statusClass = $derived(
    overdue ? "task-card--overdue" : today ? "task-card--today" : ""
  );
  const overdueTint = $derived(() => {
    if (! overdue) {
      return "";
    }
    const strength = Math.min(0.45, 0.12 + overdueDays * 0.05);
    return `rgba(244, 67, 54, ${strength})`;
  });
  const overdueBorder = $derived(() => {
    if (!overdue) {
      return "";
    }
    const strength = Math.min(0.8, 0.3 + overdueDays * 0.08);
    return `rgba(244, 67, 54, ${strength})`;
  });

  const priorityColor = $derived(() => {
    const priority = normalizePriority(task.priority) || "normal";
    return PRIORITY_COLORS[priority];
  });

  const relativeTime = $derived(() => {
    if (timezoneHandler) {
      return timezoneHandler.getRelativeTime(dueDate);
    }
    return "";
  });

  const hasStreak = $derived((task. currentStreak || 0) > 0);

  const health = $derived(calculateTaskHealth(task));
  const healthClass = $derived(
    health >= 80 ?  "health--good" : 
    health >= 50 ? "health--fair" :
    "health--poor"
  );

  const urgencySettings = getContext<UrgencySettings | undefined>(URGENCY_SETTINGS_CONTEXT_KEY);
  const urgencyScore = $derived(calculateUrgencyScore(task, { settings: urgencySettings }));

  let showSnoozeMenu = $state(false);
  let firstSnoozeOption:  HTMLButtonElement | null = $state(null);
  let snoozeMenuIndex = $state(-1);
  // Plain array - refs don't need to be reactive state
  let snoozeOptionRefs: HTMLButtonElement[] = [];
  let showBlockPreview = $state(false);
  let blockPreview = $state<string | null>(null);
  let blockPreviewHtml = $state<string | null>(null);
  let blockPreviewLoading = $state(false);
  const blockIdLabel = $derived(() => {
    if (! task.linkedBlockId) {
      return "";
    }
    return task.linkedBlockId. length > 10
      ? `${task.linkedBlockId.slice(0, 10)}…`
      : task.linkedBlockId;
  });
  const blockPreviewText = $derived(() => {
    if (!blockPreview) {
      return "";
    }
    const trimmed = blockPreview.replace(/\s+/g, " ").trim();
    return trimmed.length > 220 ? `${trimmed.slice(0, 220)}…` : trimmed;
  });

  const quickSnoozeOptions = $derived(() =>
    SNOOZE_OPTIONS.filter((option) =>
      [15, 60, 120]. includes(option.minutes)
    )
  );
  const snoozeMenuId = $derived(() => `snooze-menu-${task.id}`);

  $effect(() => {
    blockPreview = task.linkedBlockContent ??  null;
    blockPreviewHtml = null;
    blockPreviewLoading = false;
  });

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

  async function toggleSnoozeMenu() {
    showSnoozeMenu = !showSnoozeMenu;
    if (showSnoozeMenu) {
      await tick();
      snoozeMenuIndex = -1;
      snoozeOptionRefs = [];
      firstSnoozeOption?. focus();
    }
  }

  function handleSnooze(minutes: number) {
    // Dispatch custom event for snoozing
    const event = new CustomEvent("task-snooze", {
      detail: { taskId: task.id, minutes },
    });
    window.dispatchEvent(event);
    showSnoozeMenu = false;
    snoozeMenuIndex = -1;
  }

  function handleSnoozeMenuKeydown(event: KeyboardEvent) {
    const options = quickSnoozeOptions;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      snoozeMenuIndex = Math.min(snoozeMenuIndex + 1, options.length - 1);
      snoozeOptionRefs[snoozeMenuIndex]?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      snoozeMenuIndex = Math.max(snoozeMenuIndex - 1, 0);
      snoozeOptionRefs[snoozeMenuIndex]?.focus();
    } else if (event.key === "Escape") {
      showSnoozeMenu = false;
      snoozeMenuIndex = -1;
    } else if (event.key === "Home") {
      event.preventDefault();
      snoozeMenuIndex = 0;
      snoozeOptionRefs[0]?.focus();
    } else if (event.key === "End") {
      event.preventDefault();
      snoozeMenuIndex = options.length - 1;
      snoozeOptionRefs[snoozeMenuIndex]?.focus();
    }
  }

  function handleSnoozeKeydown(event: KeyboardEvent) {
    if (event.key === "Escape" && showSnoozeMenu) {
      showSnoozeMenu = false;
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      void toggleSnoozeMenu();
    }
  }

  async function handleBlockPreviewOpen() {
    showBlockPreview = true;
    if (! task.linkedBlockId || blockPreviewLoading || blockPreviewHtml) {
      return;
    }
    blockPreviewLoading = true;
    const [html, content] = await Promise.all([
      fetchBlockEmbed(task.linkedBlockId),
      fetchBlockPreview(task.linkedBlockId),
    ]);
    blockPreviewHtml = html;
    blockPreview = content;
    blockPreviewLoading = false;
  }

  function handleBlockPreviewClose() {
    showBlockPreview = false;
  }
  
  // Sanitize task name for ARIA label
  const ariaLabel = $derived(() => {
    const sanitized = task.name. replace(/[<>"&]/g, (char) => {
      const entities:  Record<string, string> = {
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        '&': '&amp;',
      };
      return entities[char] || char;
    });
    return `Task:  ${sanitized}`;
  });
</script>

<div
  class="task-card {statusClass}"
  style="--overdue-tint: {overdueTint}; --overdue-border: {overdueBorder};"
  role="article"
  aria-label={ariaLabel()}
  tabindex="0"
  data-task-id={task.id}
  onkeydown={(event) => {
    if (event.key === "Escape" && showSnoozeMenu) {
      showSnoozeMenu = false;
    }
  }}
>
  <div class="task-card__header">
    <div class="task-card__title-row">
      <div
        class="task-card__priority-indicator"
        style="background-color: {priorityColor}"
        title="Priority:  {task.priority || 'normal'}"
      ></div>
      <h3 class="task-card__name">{task.name}</h3>
      {#if hasStreak}
        <span class="task-card__streak" title="{task.currentStreak} day streak">
          <Icon category="status" name="streak" size={16} alt="Streak" /> {task.currentStreak}
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
    <div class="task-card__urgency" title="Urgency score: {urgencyScore}">
      <span class="task-card__label">Urgency:</span>
      <span class="task-card__value">{urgencyScore}</span>
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
        <button
          class="task-card__block-link"
          title={`Linked block: ${task.linkedBlockId}`}
          onmouseenter={handleBlockPreviewOpen}
          onmouseleave={handleBlockPreviewClose}
          onfocus={handleBlockPreviewOpen}
          onblur={handleBlockPreviewClose}
        >
          📝 Block {blockIdLabel}
        </button>
        {#if showBlockPreview}
          <div class="task-card__block-preview" role="tooltip">
            {#if blockPreviewLoading}
              Loading preview…
            {:else if blockPreviewHtml}
              <div class="task-card__block-preview-html">
                {@html blockPreviewHtml}
              </div>
            {:else if blockPreview}
              {blockPreviewText}
            {:else}
              No preview available. 
            {/if}
          </div>
        {/if}
      </div>
    {/if}
  </div>

  <div class="task-card__health {healthClass}" title="Task health:  {health}%">
    <div class="task-card__health-bar" style="width: {health}%"></div>
  </div>

  <div class="task-card__actions">
    <div class="task-card__snooze-container">
      <button
        class="task-card__action task-card__action--snooze"
        onclick={toggleSnoozeMenu}
        onkeydown={handleSnoozeKeydown}
        aria-label="Snooze task"
        aria-haspopup="menu"
        aria-expanded={showSnoozeMenu}
        aria-controls={snoozeMenuId}
      >
        🕒 Snooze
      </button>
      <div class="task-card__snooze-quick">
        {#each quickSnoozeOptions as option}
          <button
            class="task-card__snooze-chip"
            onclick={() => handleSnooze(option.minutes)}
            aria-label={`Snooze for ${option.label}`}
          >
            {option.label}
          </button>
        {/each}
        <button
          class="task-card__snooze-chip task-card__snooze-chip--tomorrow"
          onclick={handleDelay}
          aria-label="Snooze until tomorrow"
        >
          Tomorrow
        </button>
      </div>
      {#if showSnoozeMenu}
        <div
          id={snoozeMenuId}
          class="task-card__snooze-menu"
          onkeydown={handleSnoozeMenuKeydown}
          role="menu"
          tabindex="0"
          aria-label="Snooze options"
        >
          {#each SNOOZE_OPTIONS as option, index}
            <button
              class="task-card__snooze-option"
              bind:this={snoozeOptionRefs[index]}
              onclick={() => handleSnooze(option. minutes)}
              role="menuitem"
              tabindex={index === 0 ? 0 : -1}
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
    box-shadow:  0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .task-card:focus {
    outline: 2px solid var(--b3-theme-primary);
    outline-offset: 2px;
  }

  .task-card--overdue {
    border-left: 4px solid var(--overdue-border, var(--b3-theme-error));
    background: var(--overdue-tint, transparent);
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
    flex:  1;
  }

  .task-card__priority-indicator {
    width: 8px;
    height: 8px;
    border-radius:  50%;
    flex-shrink: 0;
  }

  .task-card__name {
    margin: 0;
    font-size: 16px;
    font-weight:  600;
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
  .task-card__last-completed,
  .task-card__urgency {
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
    margin-left:  8px;
  }

  .task-card__linked-block {
    margin-top: 8px;
    position: relative;
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

  .task-card__block-preview {
    position: absolute;
    top: 100%;
    left: 0;
    margin-top: 6px;
    padding: 8px 10px;
    max-width: 280px;
    background: var(--b3-theme-surface);
    border: 1px solid var(--b3-border-color);
    border-radius: 6px;
    color: var(--b3-theme-on-surface);
    font-size: 12px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
    z-index: 120;
    white-space: pre-wrap;
  }

  .task-card__block-preview-html {
    font-size: 12px;
    color: var(--b3-theme-on-surface);
  }

  .task-card__actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .task-card__snooze-container {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
</style>
