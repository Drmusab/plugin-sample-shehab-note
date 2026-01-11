<script lang="ts">
  import type { Task } from "@/core/models/Task";
  import type { RecurrenceEngine } from "@/core/engine/RecurrenceEngine";
  import {
    addDays,
    endOfDay,
    formatDate,
    formatTime,
    getDateRange,
    startOfDay,
  } from "@/utils/date";

  interface Props {
    tasks: Task[];
    recurrenceEngine: RecurrenceEngine;
    days?: number;
  }

  let { tasks, recurrenceEngine, days = 30 }: Props = $props();

  interface TimelineDay {
    date: Date;
    tasks: { task: Task; occurrence: Date }[];
  }

  const timelineData = $derived.by(() => {
    const startDate = startOfDay(new Date());
    const endDate = endOfDay(addDays(startDate, days - 1));
    const msPerDay = 24 * 60 * 60 * 1000;

    const dateRange = getDateRange(startDate, days);
    const timeline: TimelineDay[] = dateRange.map((date) => ({
      date,
      tasks: [],
    }));

    // For each task, get all occurrences in range
    for (const task of tasks.filter((t) => t.enabled)) {
      const firstOccurrence = new Date(task.dueAt);
      const occurrences = recurrenceEngine.getOccurrencesInRange(
        startDate,
        endDate,
        task.frequency,
        firstOccurrence
      );

      for (const occurrence of occurrences) {
        const occurrenceDay = startOfDay(occurrence);
        const dayIndex = Math.floor(
          (occurrenceDay.getTime() - startDate.getTime()) / msPerDay
        );
        if (dayIndex >= 0 && dayIndex < days) {
          timeline[dayIndex].tasks.push({ task, occurrence });
        }
      }
    }

    for (const day of timeline) {
      day.tasks.sort(
        (a, b) => a.occurrence.getTime() - b.occurrence.getTime()
      );
    }

    return timeline;
  });

  const hasAnyTasks = $derived(
    timelineData.some((day) => day.tasks.length > 0)
  );
</script>

<div class="timeline-tab">
  <div class="timeline-tab__header">
    <h2 class="timeline-tab__title">Scheduled Timeline</h2>
    <p class="timeline-tab__subtitle">Next {days} days</p>
  </div>

  <div class="timeline-tab__content">
    {#if !hasAnyTasks}
      <div class="timeline-tab__empty">
        <p>No tasks scheduled in the next {days} days.</p>
      </div>
    {:else}
      <div class="timeline-tab__timeline">
        {#each timelineData as day (day.date.toISOString())}
          {#if day.tasks.length > 0}
            <div class="timeline-day">
              <div class="timeline-day__date">
                <div class="timeline-day__date-label">
                  {formatDate(day.date)}
                </div>
                <div class="timeline-day__weekday">
                  {day.date.toLocaleDateString(undefined, { weekday: "short" })}
                </div>
              </div>
              <div class="timeline-day__tasks">
                {#each day.tasks as { task, occurrence } (task.id + occurrence.toISOString())}
                  <div class="timeline-task">
                    <div class="timeline-task__time">
                      {formatTime(occurrence)}
                    </div>
                    <div class="timeline-task__content">
                      <div class="timeline-task__name">{task.name}</div>
                      {#if task.alertPayload.note}
                        <div class="timeline-task__note">
                          {task.alertPayload.note}
                        </div>
                      {/if}
                    </div>
                  </div>
                {/each}
              </div>
            </div>
          {/if}
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .timeline-tab {
    padding: 16px;
  }

  .timeline-tab__header {
    margin-bottom: 20px;
  }

  .timeline-tab__title {
    margin: 0 0 8px 0;
    font-size: 20px;
    font-weight: 600;
    color: var(--b3-theme-on-surface);
  }

  .timeline-tab__subtitle {
    margin: 0;
    font-size: 14px;
    color: var(--b3-theme-on-surface-light);
  }

  .timeline-tab__content {
    max-width: 900px;
  }

  .timeline-tab__empty {
    text-align: center;
    padding: 60px 20px;
    color: var(--b3-theme-on-surface-light);
  }

  .timeline-tab__timeline {
    position: relative;
  }

  .timeline-day {
    display: flex;
    gap: 24px;
    margin-bottom: 32px;
    position: relative;
  }

  .timeline-day:not(:last-child)::after {
    content: "";
    position: absolute;
    left: 60px;
    top: 60px;
    bottom: -32px;
    width: 2px;
    background: var(--b3-border-color);
  }

  .timeline-day__date {
    flex-shrink: 0;
    width: 120px;
    text-align: right;
    padding-top: 8px;
  }

  .timeline-day__date-label {
    font-size: 14px;
    font-weight: 600;
    color: var(--b3-theme-on-surface);
    margin-bottom: 4px;
  }

  .timeline-day__weekday {
    font-size: 12px;
    color: var(--b3-theme-on-surface-light);
  }

  .timeline-day__tasks {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .timeline-task {
    display: flex;
    gap: 16px;
    background: var(--b3-theme-surface);
    border: 1px solid var(--b3-border-color);
    border-radius: 8px;
    padding: 12px 16px;
    position: relative;
  }

  .timeline-task::before {
    content: "";
    position: absolute;
    left: -37px;
    top: 50%;
    transform: translateY(-50%);
    width: 12px;
    height: 12px;
    background: var(--b3-theme-primary);
    border: 2px solid var(--b3-theme-background);
    border-radius: 50%;
    z-index: 1;
  }

  .timeline-task__time {
    flex-shrink: 0;
    font-size: 13px;
    font-weight: 600;
    color: var(--b3-theme-primary);
    min-width: 50px;
  }

  .timeline-task__content {
    flex: 1;
  }

  .timeline-task__name {
    font-size: 14px;
    font-weight: 500;
    color: var(--b3-theme-on-surface);
    margin-bottom: 4px;
  }

  .timeline-task__note {
    font-size: 13px;
    color: var(--b3-theme-on-surface-light);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
