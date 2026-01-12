<script lang="ts">
  import type { Task } from "@/core/models/Task";
  import TaskCard from "../cards/TaskCard.svelte";

  interface Props {
    tasks: Task[];
    onDone: (task: Task) => void;
    onDelay: (task: Task) => void;
    onSkip: (task: Task) => void;
    onEdit?: (task: Task) => void;
    timezoneHandler?: any;
  }

  let { tasks, onDone, onDelay, onSkip, onEdit, timezoneHandler }: Props = $props();

  const sortedTasks = $derived(
    [...tasks].sort(
      (a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()
    )
  );
</script>

<div class="today-tab">
  <div class="today-tab__header">
    <h2 class="today-tab__title">Today & Overdue Tasks</h2>
    <p class="today-tab__subtitle">
      {tasks.length} task{tasks.length !== 1 ? "s" : ""} requiring attention
    </p>
  </div>

  <div class="today-tab__content">
    {#if sortedTasks.length === 0}
      <div class="today-tab__empty">
        <p>🎉 No tasks due today or overdue!</p>
        <p class="today-tab__empty-subtitle">You're all caught up.</p>
      </div>
    {:else}
      {#each sortedTasks as task (task.id)}
        <TaskCard {task} {onDone} {onDelay} {onSkip} {onEdit} {timezoneHandler} />
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
