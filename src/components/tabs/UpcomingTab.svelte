<script lang="ts">
  import type { Task } from "@/core/models/Task";
  import TaskCard from "../cards/TaskCard.svelte";

  interface Props {
    tasks: Task[];
    onEdit?: (task: Task) => void;
    onDone?: (task: Task) => void;
    onDelete?: (task: Task) => void;
    daysAhead?: number;
  }

  let { tasks, onEdit, onDone, onDelete, daysAhead = 7 }: Props = $props();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const futureDate = new Date(today);
  futureDate.setDate(futureDate.getDate() + daysAhead);

  // Filter upcoming tasks (due between tomorrow and 7 days from now)
  const upcomingTasks = $derived(
    tasks
      .filter((task) => {
        if (task.status === "done" || task.status === "cancelled" || !task.dueAt) {
          return false;
        }
        const dueDate = new Date(task.dueAt);
        dueDate.setHours(0, 0, 0, 0);
        return dueDate > today && dueDate <= futureDate;
      })
      .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())
  );

  // Group by date
  const groupedTasks = $derived(() => {
    const groups = new Map<string, Task[]>();
    upcomingTasks.forEach((task) => {
      const dueDate = new Date(task.dueAt);
      dueDate.setHours(0, 0, 0, 0);
      const dateKey = dueDate.toISOString().split("T")[0];
      if (!groups.has(dateKey)) {
        groups.set(dateKey, []);
      }
      groups.get(dateKey)!.push(task);
    });
    return groups;
  });

  function formatDateHeader(dateStr: string): string {
    const date = new Date(dateStr);
    const daysDiff = Math.floor(
      (date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );
    
    const weekday = date.toLocaleDateString("en-US", { weekday: "long" });
    const monthDay = date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });

    if (daysDiff === 1) {
      return `Tomorrow - ${weekday}, ${monthDay}`;
    } else {
      return `${weekday}, ${monthDay} (in ${daysDiff} days)`;
    }
  }

  let focusedIndex = $state(0);
  let cardRefs = $state<HTMLDivElement[]>([]);

  $effect(() => {
    if (focusedIndex >= upcomingTasks.length) {
      focusedIndex = Math.max(0, upcomingTasks.length - 1);
    }
  });

  function handleCardKeydown(event: KeyboardEvent, taskIndex: number) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusedIndex = Math.min(focusedIndex + 1, upcomingTasks.length - 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusedIndex = Math.max(focusedIndex - 1, 0);
    } else if (event.key === "Enter" && onEdit) {
      event.preventDefault();
      onEdit(upcomingTasks[taskIndex]);
    } else if (event.key === " " && onDone) {
      event.preventDefault();
      onDone(upcomingTasks[taskIndex]);
    }
  }
</script>

<div class="upcoming-tab">
  <div class="upcoming-tab__header">
    <h2 class="upcoming-tab__title">Upcoming</h2>
    <p class="upcoming-tab__subtitle">
      {upcomingTasks.length} task{upcomingTasks.length !== 1 ? "s" : ""} in the next {daysAhead} days
    </p>
  </div>

  <div class="upcoming-tab__content" role="list" aria-label="Upcoming tasks">
    {#if upcomingTasks.length === 0}
      <div class="upcoming-tab__empty">
        <p>📅 No tasks scheduled for the next {daysAhead} days</p>
        <p class="upcoming-tab__empty-subtitle">
          You have a clear schedule ahead!
        </p>
      </div>
    {:else}
      {#each [...groupedTasks.entries()] as [dateKey, dateTasks]}
        <div class="upcoming-tab__date-group">
          <h3 class="upcoming-tab__date-header">
            {formatDateHeader(dateKey)}
          </h3>
          {#each dateTasks as task, index (task.id)}
            {@const globalIndex = upcomingTasks.indexOf(task)}
            <div
              class="upcoming-tab__card-wrapper"
              role="listitem"
              tabindex={globalIndex === focusedIndex ? 0 : -1}
              bind:this={cardRefs[globalIndex]}
              onkeydown={(event) => handleCardKeydown(event, globalIndex)}
              onfocus={() => (focusedIndex = globalIndex)}
            >
              <TaskCard {task} onEdit={onEdit} onDone={onDone} onDelete={onDelete} />
            </div>
          {/each}
        </div>
      {/each}
    {/if}
  </div>
</div>

<style>
  .upcoming-tab {
    padding: 16px;
  }

  .upcoming-tab__header {
    margin-bottom: 20px;
  }

  .upcoming-tab__title {
    margin: 0 0 8px 0;
    font-size: 20px;
    font-weight: 600;
    color: var(--b3-theme-on-surface);
  }

  .upcoming-tab__subtitle {
    margin: 0;
    font-size: 14px;
    color: var(--b3-theme-on-surface-light);
  }

  .upcoming-tab__content {
    max-width: 800px;
  }

  .upcoming-tab__date-group {
    margin-bottom: 24px;
  }

  .upcoming-tab__date-header {
    margin: 0 0 12px 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--b3-theme-primary);
    padding-bottom: 8px;
    border-bottom: 1px solid var(--b3-theme-surface-lighter);
  }

  .upcoming-tab__card-wrapper:focus {
    outline: 2px solid var(--b3-theme-primary);
    outline-offset: 4px;
    border-radius: 10px;
  }

  .upcoming-tab__empty {
    text-align: center;
    padding: 60px 20px;
    color: var(--b3-theme-on-surface-light);
  }

  .upcoming-tab__empty p {
    margin: 0 0 8px 0;
    font-size: 18px;
  }

  .upcoming-tab__empty-subtitle {
    font-size: 14px;
  }
</style>
