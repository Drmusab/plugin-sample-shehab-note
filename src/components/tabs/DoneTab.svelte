<script lang="ts">
  import type { Task } from "@/core/models/Task";
  import TaskCard from "../cards/TaskCard.svelte";

  interface Props {
    tasks: Task[];
    onEdit?: (task: Task) => void;
    onDelete?: (task: Task) => void;
    onUncomplete?: (task: Task) => void;
    daysBack?: number;
  }

  let { tasks, onEdit, onDelete, onUncomplete, daysBack = 30 }: Props = $props();

  let currentPage = $state(0);
  const itemsPerPage = 50;

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysBack);
  cutoffDate.setHours(0, 0, 0, 0);

  // Filter to done tasks in last N days
  const doneTasks = $derived(
    tasks
      .filter((task) => {
        if (task.status !== "done") return false;
        if (!task.doneAt) return false;
        const doneDate = new Date(task.doneAt);
        return doneDate >= cutoffDate;
      })
      .sort((a, b) => new Date(b.doneAt!).getTime() - new Date(a.doneAt!).getTime())
  );

  const totalPages = $derived(Math.ceil(doneTasks.length / itemsPerPage));
  const paginatedTasks = $derived(
    doneTasks.slice(
      currentPage * itemsPerPage,
      (currentPage + 1) * itemsPerPage
    )
  );

  $effect(() => {
    if (currentPage >= totalPages && totalPages > 0) {
      currentPage = totalPages - 1;
    }
  });

  function nextPage() {
    if (currentPage < totalPages - 1) {
      currentPage++;
    }
  }

  function prevPage() {
    if (currentPage > 0) {
      currentPage--;
    }
  }

  function formatDoneDate(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return "Today";
    } else if (diffDays === 1) {
      return "Yesterday";
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
      });
    }
  }

  let focusedIndex = $state(0);
  let cardRefs = $state<HTMLDivElement[]>([]);

  $effect(() => {
    if (focusedIndex >= paginatedTasks.length) {
      focusedIndex = Math.max(0, paginatedTasks.length - 1);
    }
  });

  function handleCardKeydown(event: KeyboardEvent, index: number) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusedIndex = Math.min(focusedIndex + 1, paginatedTasks.length - 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusedIndex = Math.max(focusedIndex - 1, 0);
    } else if (event.key === "Enter" && onEdit) {
      event.preventDefault();
      onEdit(paginatedTasks[index]);
    }
  }
</script>

<div class="done-tab">
  <div class="done-tab__header">
    <h2 class="done-tab__title">Done</h2>
    <p class="done-tab__subtitle">
      {doneTasks.length} completed task{doneTasks.length !== 1 ? "s" : ""} in the last {daysBack} days
    </p>
  </div>

  <div class="done-tab__content" role="list" aria-label="Completed tasks">
    {#if doneTasks.length === 0}
      <div class="done-tab__empty">
        <p>✅ No completed tasks yet</p>
        <p class="done-tab__empty-subtitle">
          Complete some tasks to see them here!
        </p>
      </div>
    {:else}
      {#each paginatedTasks as task, index (task.id)}
        <div
          class="done-tab__card-wrapper"
          role="listitem"
          tabindex={index === focusedIndex ? 0 : -1}
          bind:this={cardRefs[index]}
          onkeydown={(event) => handleCardKeydown(event, index)}
          onfocus={() => (focusedIndex = index)}
        >
          <div class="done-tab__task-header">
            <span class="done-tab__done-date">
              Completed {formatDoneDate(task.doneAt!)}
            </span>
            {#if onUncomplete}
              <button
                class="done-tab__uncomplete-btn"
                onclick={() => onUncomplete(task)}
                title="Mark as not done"
              >
                Undo
              </button>
            {/if}
          </div>
          <TaskCard {task} onEdit={onEdit} onDelete={onDelete} />
        </div>
      {/each}

      {#if totalPages > 1}
        <div class="done-tab__pagination">
          <button
            class="done-tab__page-btn"
            onclick={prevPage}
            disabled={currentPage === 0}
          >
            ← Previous
          </button>
          <span class="done-tab__page-info">
            Page {currentPage + 1} of {totalPages}
          </span>
          <button
            class="done-tab__page-btn"
            onclick={nextPage}
            disabled={currentPage >= totalPages - 1}
          >
            Next →
          </button>
        </div>
      {/if}
    {/if}
  </div>
</div>

<style>
  .done-tab {
    padding: 16px;
  }

  .done-tab__header {
    margin-bottom: 20px;
  }

  .done-tab__title {
    margin: 0 0 8px 0;
    font-size: 20px;
    font-weight: 600;
    color: var(--b3-theme-on-surface);
  }

  .done-tab__subtitle {
    margin: 0;
    font-size: 14px;
    color: var(--b3-theme-on-surface-light);
  }

  .done-tab__content {
    max-width: 800px;
  }

  .done-tab__card-wrapper {
    margin-bottom: 16px;
  }

  .done-tab__card-wrapper:focus {
    outline: 2px solid var(--b3-theme-primary);
    outline-offset: 4px;
    border-radius: 10px;
  }

  .done-tab__task-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
    font-size: 12px;
  }

  .done-tab__done-date {
    color: var(--b3-theme-on-surface-light);
  }

  .done-tab__uncomplete-btn {
    padding: 4px 12px;
    border: 1px solid var(--b3-theme-surface-lighter);
    background: var(--b3-theme-surface);
    color: var(--b3-theme-on-surface);
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
  }

  .done-tab__uncomplete-btn:hover {
    background: var(--b3-theme-surface-light);
  }

  .done-tab__pagination {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 16px;
    margin-top: 24px;
    padding: 16px 0;
  }

  .done-tab__page-btn {
    padding: 8px 16px;
    border: 1px solid var(--b3-theme-surface-lighter);
    background: var(--b3-theme-surface);
    color: var(--b3-theme-on-surface);
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
  }

  .done-tab__page-btn:hover:not(:disabled) {
    background: var(--b3-theme-surface-light);
  }

  .done-tab__page-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .done-tab__page-info {
    font-size: 14px;
    color: var(--b3-theme-on-surface-light);
  }

  .done-tab__empty {
    text-align: center;
    padding: 60px 20px;
    color: var(--b3-theme-on-surface-light);
  }

  .done-tab__empty p {
    margin: 0 0 8px 0;
    font-size: 18px;
  }

  .done-tab__empty-subtitle {
    font-size: 14px;
  }
</style>
