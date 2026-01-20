<script lang="ts">
  import type { Task } from "@/core/models/Task";
  import TaskCard from "../cards/TaskCard.svelte";

  interface Props {
    tasks: Task[];
    onEdit?: (task: Task) => void;
    onDone?: (task: Task) => void;
    onDelete?: (task: Task) => void;
  }

  let { tasks, onEdit, onDone, onDelete }: Props = $props();

  // Filter to inbox: no due date, no scheduled date, no start date, not done
  const inboxTasks = $derived(
    tasks.filter(
      (task) =>
        task.status !== "done" &&
        task.status !== "cancelled" &&
        !task.dueAt &&
        !task.scheduledAt &&
        !task.startAt
    ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  );

  let focusedIndex = $state(0);
  let cardRefs = $state<HTMLDivElement[]>([]);

  $effect(() => {
    if (focusedIndex >= inboxTasks.length) {
      focusedIndex = Math.max(0, inboxTasks.length - 1);
    }
  });

  function focusCardAt(index: number) {
    if (inboxTasks.length === 0) {
      return;
    }
    const clampedIndex = Math.max(0, Math.min(index, inboxTasks.length - 1));
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
    } else if (event.key === "Enter" && onEdit) {
      event.preventDefault();
      onEdit(inboxTasks[index]);
    } else if (event.key === " " && onDone) {
      event.preventDefault();
      onDone(inboxTasks[index]);
    }
  }
</script>

<div class="inbox-tab">
  <div class="inbox-tab__header">
    <h2 class="inbox-tab__title">Inbox</h2>
    <p class="inbox-tab__subtitle">
      {inboxTasks.length} task{inboxTasks.length !== 1 ? "s" : ""} without dates
    </p>
  </div>

  <div class="inbox-tab__content" role="list" aria-label="Inbox tasks">
    {#if inboxTasks.length === 0}
      <div class="inbox-tab__empty">
        <p>📥 No tasks in inbox</p>
        <p class="inbox-tab__empty-subtitle">
          Create your first task or schedule your existing tasks!
        </p>
      </div>
    {:else}
      {#each inboxTasks as task, index (task.id)}
        <div
          class="inbox-tab__card-wrapper"
          role="listitem"
          tabindex={index === focusedIndex ? 0 : -1}
          bind:this={cardRefs[index]}
          onkeydown={(event) => handleCardKeydown(event, index)}
          onfocus={() => (focusedIndex = index)}
        >
          <TaskCard {task} onEdit={onEdit} onDone={onDone} onDelete={onDelete} />
        </div>
      {/each}
    {/if}
  </div>
</div>

<style>
  .inbox-tab {
    padding: 16px;
  }

  .inbox-tab__header {
    margin-bottom: 20px;
  }

  .inbox-tab__title {
    margin: 0 0 8px 0;
    font-size: 20px;
    font-weight: 600;
    color: var(--b3-theme-on-surface);
  }

  .inbox-tab__subtitle {
    margin: 0;
    font-size: 14px;
    color: var(--b3-theme-on-surface-light);
  }

  .inbox-tab__content {
    max-width: 800px;
  }

  .inbox-tab__card-wrapper:focus {
    outline: 2px solid var(--b3-theme-primary);
    outline-offset: 4px;
    border-radius: 10px;
  }

  .inbox-tab__empty {
    text-align: center;
    padding: 60px 20px;
    color: var(--b3-theme-on-surface-light);
  }

  .inbox-tab__empty p {
    margin: 0 0 8px 0;
    font-size: 18px;
  }

  .inbox-tab__empty-subtitle {
    font-size: 14px;
  }
</style>
