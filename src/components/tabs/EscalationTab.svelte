<script lang="ts">
  import type { App } from "siyuan";
  import { openTab } from "siyuan";
  import type { Task } from "@/core/models/Task";
  import { normalizePriority } from "@/core/models/Task";
  import type { EscalationSettings } from "@/core/settings/PluginSettings";
  import {
    buildEscalationExplanation,
    evaluateEscalation,
    getEscalationAnchorDate,
  } from "@/core/escalation/EscalationEvaluator";
  import { formatDateTime, startOfDay } from "@/utils/date";
  import { onDestroy, onMount } from "svelte";
  import { toast } from "@/utils/notifications";
  import EscalationBadge from "@/components/ui/EscalationBadge.svelte";

  interface Props {
    tasks: Task[];
    app: App;
    settings: EscalationSettings;
    onEdit?: (task: Task) => void;
  }

  let { tasks, app, settings, onEdit }: Props = $props();

  type SortMode = "due" | "priority" | "overdue";

  let selectedLevels = $state<Set<number>>(new Set([1, 2, 3]));
  let sortMode = $state<SortMode>("due");
  let referenceDay = $state(startOfDay(new Date()));
  let dayTimer: number | null = $state(null);

  const levelMeta: Record<number, { icon: string; label: string }> = {
    1: { icon: "🟡", label: "Warning" },
    2: { icon: "🟠", label: "Critical" },
    3: { icon: "🔴", label: "Severe" },
  };

  const priorityWeights: Record<string, number> = {
    lowest: 0,
    low: 1,
    normal: 2,
    medium: 3,
    high: 4,
    highest: 5,
  };

  function scheduleNextDayRefresh() {
    if (dayTimer) {
      window.clearTimeout(dayTimer);
      dayTimer = null;
    }
    const now = new Date();
    const nextDay = startOfDay(new Date(now));
    nextDay.setDate(nextDay.getDate() + 1);
    const delay = nextDay.getTime() - now.getTime();
    dayTimer = window.setTimeout(() => {
      referenceDay = startOfDay(new Date());
      scheduleNextDayRefresh();
    }, Math.max(0, delay));
  }

  onMount(() => {
    scheduleNextDayRefresh();
  });

  onDestroy(() => {
    if (dayTimer) {
      window.clearTimeout(dayTimer);
    }
  });

  function toggleLevel(level: number) {
    const next = new Set(selectedLevels);
    if (next.has(level)) {
      next.delete(level);
    } else {
      next.add(level);
    }
    selectedLevels = next;
  }

  function compareTasks(a: EscalationTask, b: EscalationTask): number {
    if (sortMode === "priority") {
      const weightA = priorityWeights[normalizePriority(a.task.priority) || "normal"] ?? 2;
      const weightB = priorityWeights[normalizePriority(b.task.priority) || "normal"] ?? 2;
      return weightB - weightA;
    }

    if (sortMode === "overdue") {
      return b.result.daysOverdue - a.result.daysOverdue;
    }

    const dateA = a.anchorDate?.getTime() ?? Number.POSITIVE_INFINITY;
    const dateB = b.anchorDate?.getTime() ?? Number.POSITIVE_INFINITY;
    return dateA - dateB;
  }

  function getSourceLabel(task: Task): string | null {
    if (task.path) {
      return task.path.split("/").pop() || task.path;
    }
    if (task.linkedBlockId) {
      return `Block ${task.linkedBlockId.slice(0, 8)}…`;
    }
    return null;
  }

  function openTask(task: Task) {
    if (task.linkedBlockId) {
      openTab({
        app,
        doc: {
          id: task.linkedBlockId,
        },
      });
      return;
    }

    if (onEdit) {
      onEdit(task);
      return;
    }

    toast.info("No linked block found for this task.");
  }

  type EscalationTask = {
    task: Task;
    result: ReturnType<typeof evaluateEscalation>;
    anchorDate: Date | null;
    explanation: string;
  };

  const escalationTasks = $derived(() => {
    const list: EscalationTask[] = [];
    for (const task of tasks) {
      if (task.status === "done" || task.status === "cancelled") {
        continue;
      }
      const result = evaluateEscalation(task, { settings, referenceDate: referenceDay });
      if (result.level === 0) {
        continue;
      }
      const anchorDate = getEscalationAnchorDate(task, settings);
      list.push({
        task,
        result,
        anchorDate,
        explanation: buildEscalationExplanation(task, result, { settings, referenceDate: referenceDay }),
      });
    }
    return list;
  });

  const groupedSections = $derived(() => {
    const groups = new Map<number, EscalationTask[]>();
    for (const item of escalationTasks) {
      if (!selectedLevels.has(item.result.level)) {
        continue;
      }
      const list = groups.get(item.result.level) ?? [];
      list.push(item);
      groups.set(item.result.level, list);
    }

    for (const items of groups.values()) {
      items.sort(compareTasks);
    }

    return [
      { level: 3, title: "Severe", items: groups.get(3) ?? [] },
      { level: 2, title: "Critical", items: groups.get(2) ?? [] },
      { level: 1, title: "Warning", items: groups.get(1) ?? [] },
    ];
  });

  const totalVisible = $derived(
    groupedSections.reduce((sum, section) => sum + section.items.length, 0)
  );
</script>

<div class="escalation-tab">
  <div class="escalation-tab__header">
    <div>
      <h2 class="escalation-tab__title">Escalation Dashboard</h2>
      <p class="escalation-tab__subtitle">
        Overdue tasks are grouped by how late they are so you can focus fast.
      </p>
    </div>
    <div class="escalation-tab__summary">
      <span>{escalationTasks.length} overdue</span>
      <span>{selectedLevels.size} levels shown</span>
    </div>
  </div>

  <div class="escalation-tab__controls">
    <div class="escalation-tab__filters" role="group" aria-label="Escalation level filters">
      {#each [3, 2, 1] as level}
        <button
          class="escalation-tab__filter {selectedLevels.has(level) ? 'active' : ''}"
          onclick={() => toggleLevel(level)}
        >
          <span class="escalation-tab__filter-icon">{levelMeta[level].icon}</span>
          <span>{levelMeta[level].label}</span>
        </button>
      {/each}
    </div>
    <label class="escalation-tab__sort">
      <span>Sort within level</span>
      <select bind:value={sortMode}>
        <option value="due">Due date</option>
        <option value="priority">Priority</option>
        <option value="overdue">Days overdue</option>
      </select>
    </label>
  </div>

  {#if totalVisible === 0}
    <div class="escalation-tab__empty">
      <p>No overdue tasks match the current filters.</p>
    </div>
  {:else}
    <div class="escalation-tab__sections">
      {#each groupedSections as section}
        <section class="escalation-section">
          <header class="escalation-section__header">
            <div class="escalation-section__title">
              <span class="escalation-section__icon">{levelMeta[section.level].icon}</span>
              <span>{section.title}</span>
            </div>
            <span class="escalation-section__count">{section.items.length}</span>
          </header>

          {#if section.items.length === 0}
            <div class="escalation-section__empty">No tasks at this level.</div>
          {:else}
            <div class="escalation-section__list">
              {#each section.items as item}
                <article class="escalation-card">
                  <div class="escalation-card__header">
                    <button class="escalation-card__title" onclick={() => openTask(item.task)}>
                      {item.task.name}
                    </button>
                    {#if settings.badgeVisibility.dashboard}
                      <EscalationBadge result={item.result} explanation={item.explanation} compact={true} />
                    {:else}
                      <span class="escalation-card__level" title={item.explanation}>
                        {levelMeta[item.result.level].icon} {item.result.label}
                      </span>
                    {/if}
                  </div>
                  <div class="escalation-card__meta">
                    {#if item.anchorDate}
                      <div>
                        <span class="escalation-card__label">
                          {item.task.dueAt ? "Due:" : "Scheduled:"}
                        </span>
                        <span>{formatDateTime(item.anchorDate)}</span>
                      </div>
                    {/if}
                    <div>
                      <span class="escalation-card__label">Overdue:</span>
                      <span>{item.result.daysOverdue} days</span>
                    </div>
                    {#if item.task.priority}
                      <div>
                        <span class="escalation-card__label">Priority:</span>
                        <span>{normalizePriority(item.task.priority)}</span>
                      </div>
                    {/if}
                    {#if getSourceLabel(item.task)}
                      <div>
                        <span class="escalation-card__label">Source:</span>
                        <span>{getSourceLabel(item.task)}</span>
                      </div>
                    {/if}
                  </div>
                  <div class="escalation-card__actions">
                    <button class="escalation-card__action" onclick={() => openTask(item.task)}>
                      Open source
                    </button>
                  </div>
                </article>
              {/each}
            </div>
          {/if}
        </section>
      {/each}
    </div>
  {/if}
</div>

<style>
  .escalation-tab {
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding: 20px;
  }

  .escalation-tab__header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
  }

  .escalation-tab__title {
    margin: 0;
    font-size: 20px;
    color: var(--b3-theme-on-surface);
  }

  .escalation-tab__subtitle {
    margin: 6px 0 0;
    color: var(--b3-theme-on-surface-light);
    font-size: 13px;
  }

  .escalation-tab__summary {
    display: flex;
    gap: 12px;
    font-size: 12px;
    color: var(--b3-theme-on-surface-light);
  }

  .escalation-tab__controls {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    justify-content: space-between;
    align-items: center;
  }

  .escalation-tab__filters {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .escalation-tab__filter {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 999px;
    border: 1px solid var(--b3-border-color);
    background: var(--b3-theme-surface);
    color: var(--b3-theme-on-surface);
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .escalation-tab__filter.active {
    border-color: var(--b3-theme-primary);
    box-shadow: 0 0 0 1px var(--b3-theme-primary);
  }

  .escalation-tab__filter-icon {
    font-size: 14px;
  }

  .escalation-tab__sort {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: var(--b3-theme-on-surface);
  }

  .escalation-tab__sort select {
    padding: 6px 10px;
    border-radius: 6px;
    border: 1px solid var(--b3-border-color);
    background: var(--b3-theme-surface);
    color: var(--b3-theme-on-surface);
  }

  .escalation-tab__empty {
    padding: 24px;
    border-radius: 12px;
    border: 1px dashed var(--b3-border-color);
    color: var(--b3-theme-on-surface-light);
    text-align: center;
  }

  .escalation-tab__sections {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .escalation-section {
    border: 1px solid var(--b3-border-color);
    border-radius: 12px;
    background: var(--b3-theme-surface);
    padding: 16px;
  }

  .escalation-section__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }

  .escalation-section__title {
    display: flex;
    gap: 8px;
    align-items: center;
    font-weight: 600;
    color: var(--b3-theme-on-surface);
  }

  .escalation-section__count {
    font-size: 12px;
    color: var(--b3-theme-on-surface-light);
  }

  .escalation-section__empty {
    padding: 12px 8px;
    font-size: 12px;
    color: var(--b3-theme-on-surface-light);
  }

  .escalation-section__list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .escalation-card {
    border-radius: 10px;
    padding: 12px 14px;
    border: 1px solid var(--b3-border-color);
    background: var(--b3-theme-surface-lighter);
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .escalation-card__header {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: center;
  }

  .escalation-card__level {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 600;
    color: var(--b3-theme-on-surface);
  }

  .escalation-card__title {
    background: none;
    border: none;
    padding: 0;
    font-weight: 600;
    color: var(--b3-theme-on-surface);
    cursor: pointer;
    text-align: left;
  }

  .escalation-card__title:hover {
    color: var(--b3-theme-primary);
  }

  .escalation-card__meta {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 8px;
    font-size: 12px;
    color: var(--b3-theme-on-surface);
  }

  .escalation-card__label {
    color: var(--b3-theme-on-surface-light);
    margin-right: 4px;
  }

  .escalation-card__actions {
    display: flex;
    justify-content: flex-end;
  }

  .escalation-card__action {
    padding: 6px 12px;
    border-radius: 8px;
    border: 1px solid var(--b3-border-color);
    background: var(--b3-theme-surface);
    font-size: 12px;
    cursor: pointer;
    color: var(--b3-theme-on-surface);
  }

  .escalation-card__action:hover {
    border-color: var(--b3-theme-primary);
    color: var(--b3-theme-primary);
  }
</style>
