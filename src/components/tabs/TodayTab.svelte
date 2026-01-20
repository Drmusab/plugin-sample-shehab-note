<script lang="ts">
  import type { Task } from "@/core/models/Task";
  import type { TimezoneHandler } from "@/core/engine/TimezoneHandler";
  import TaskCard from "../cards/TaskCard.svelte";

  interface Props {
    tasks: Task[];
    onDone: (task: Task) => void;
    onDelay: (task: Task) => void;
    onSkip: (task: Task) => void;
    onEdit?: (task: Task) => void;
    timezoneHandler?: TimezoneHandler;
  }

  let { tasks, onDone, onDelay, onSkip, onEdit, timezoneHandler }: Props = $props();

  const sortedTasks = $derived(
    [...tasks].sort(
      (a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()
    )
  );

  let focusedIndex = $state(0);
  let cardRefs = $state<HTMLDivElement[]>([]);

  $effect(() => {
    if (focusedIndex >= sortedTasks.length) {
      focusedIndex = Math.max(0, sortedTasks.length - 1);
    }
  });

  function focusCardAt(index: number) {
    if (sortedTasks.length === 0) {
      return;
    }
    const clampedIndex = Math.max(0, Math.min(index, sortedTasks.length - 1));
    focusedIndex = clampedIndex;
    cardRefs[clampedIndex]?.focus();
  }

  function handleCardKeydown(event: KeyboardEvent, index: number) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusCardAt(index + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusCardAt(index - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusCardAt(0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusCardAt(sortedTasks.length - 1);
    }
  }
</script>

<div class="today-tab">
  <div class="today-tab__header">
    <h2 class="today-tab__title">Today & Overdue Tasks</h2>
    <p class="today-tab__subtitle">
      {tasks.length} task{tasks.length !== 1 ? "s" : ""} requiring attention
    </p>
  </div>

  <div class="today-tab__content" role="list" aria-label="Today and overdue tasks">
    {#if sortedTasks.length === 0}
      <div class="today-tab__empty">
        <p>🎉 No tasks due today or overdue!</p>
        <p class="today-tab__empty-subtitle">You're all caught up.</p>
      </div>
    {:else}
      {#each sortedTasks as task, index (task.id)}
        <div
          class="today-tab__card-wrapper"
          role="listitem"
          tabindex={index === focusedIndex ? 0 : -1}
          bind:this={cardRefs[index]}
          onkeydown={(event) => handleCardKeydown(event, index)}
          onfocus={() => (focusedIndex = index)}
        >
          <TaskCard {task} {onDone} {onDelay} {onSkip} {onEdit} {timezoneHandler} />
        </div>
      {/each}
    {/if}
  </div>
</div>

<style>
  .today-tab {
    padding: 16px;
  }

  .today-tab__header {
    margin-bottom: 20px;
  }

  .today-tab__title {
    margin: 0 0 8px 0;
    font-size: 20px;
    font-weight: 600;
    color: var(--b3-theme-on-surface);
  }

  .today-tab__subtitle {
    margin: 0;
    font-size: 14px;
    color: var(--b3-theme-on-surface-light);
  }

  .today-tab__content {
    max-width: 800px;
  }

  .today-tab__card-wrapper:focus {
    outline: 2px solid var(--b3-theme-primary);
    outline-offset: 4px;
    border-radius: 10px;
  }

  .today-tab__empty {
    text-align: center;
    padding: 60px 20px;
    color: var(--b3-theme-on-surface-light);
  }

  .today-tab__empty p {
    margin: 0 0 8px 0;
    font-size: 18px;
  }

  .today-tab__empty-subtitle {
    font-size: 14px;
  }
</style>
