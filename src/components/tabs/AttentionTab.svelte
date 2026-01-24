<script lang="ts">
  import type { App } from "siyuan";
  import { openTab } from "siyuan";
  import type { Task } from "@/core/models/Task";
  import type { AttentionSettings, EscalationSettings } from "@/core/settings/PluginSettings";
  import { AttentionEngine, type AttentionLane, type AttentionProfile } from "@/core/attention/AttentionEngine";
  import { buildEscalationExplanation } from "@/core/escalation/EscalationEvaluator";
  import { formatDateTime, startOfDay } from "@/utils/date";
  import { onDestroy, onMount } from "svelte";
  import { toast } from "@/utils/notifications";
  import EscalationBadge from "@/components/ui/EscalationBadge.svelte";
  import PriorityBadge from "@/components/ui/PriorityBadge.svelte";

  interface Props {
    tasks: Task[];
    app: App;
    settings: AttentionSettings;
    escalationSettings: EscalationSettings;
    onEdit?: (task: Task) => void;
  }

  let { tasks, app, settings, escalationSettings, onEdit }: Props = $props();

  const attentionEngine = new AttentionEngine();

  let referenceDay = $state(startOfDay(new Date()));
  let dayTimer: number | null = $state(null);
  let activeFilters = $state<Set<string>>(new Set());
  let expandedReasons = $state<Set<string>>(new Set());
  let expandedBlockers = $state<Set<string>>(new Set());

  const lanes: AttentionLane[] = ["DO_NOW", "UNBLOCK_FIRST", "BLOCKED", "WATCHLIST"];
  const laneLabels: Record<AttentionLane, string> = {
    DO_NOW: "Do Now",
    UNBLOCK_FIRST: "Unblock First",
    BLOCKED: "Blocked",
    WATCHLIST: "Watchlist",
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

  function toggleFilter(filter: string) {
    const next = new Set(activeFilters);
    if (next.has(filter)) {
      next.delete(filter);
    } else {
      next.add(filter);
    }
    activeFilters = next;
  }

  function toggleReasons(taskId: string) {
    const next = new Set(expandedReasons);
    if (next.has(taskId)) {
      next.delete(taskId);
    } else {
      next.add(taskId);
    }
    expandedReasons = next;
  }

  function toggleBlockers(taskId: string) {
    const next = new Set(expandedBlockers);
    if (next.has(taskId)) {
      next.delete(taskId);
    } else {
      next.add(taskId);
    }
    expandedBlockers = next;
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

  const tasksById = $derived(() => new Map(tasks.map((task) => [task.id, task])));

  const attentionProfiles = $derived(() =>
    attentionEngine.getAttentionProfiles(tasks, {
      attentionSettings: settings,
      escalationSettings,
      referenceDate: referenceDay,
    })
  );

  type AttentionItem = {
    task: Task;
    profile: AttentionProfile;
  };

  const attentionItems = $derived(() => {
    const items: AttentionItem[] = [];
    for (const task of tasks) {
      const profile = attentionProfiles.get(task.id);
      if (!profile) {
        continue;
      }
      items.push({ task, profile });
    }
    return items;
  });

  const hasWorkTag = $derived(() =>
    attentionItems.some(({ task }) => task.tags?.includes("#work") || task.tags?.includes("work"))
  );

  const filteredItems = $derived(() => {
    let items = attentionItems;

    if (activeFilters.has("doNow")) {
      items = items.filter(({ profile }) => profile.lane === "DO_NOW");
    }

    if (activeFilters.has("severe")) {
      items = items.filter(({ profile }) => profile.escalation.level === 3);
    }

    if (activeFilters.has("blocking")) {
      items = items.filter(({ profile }) => profile.dependency.isBlocking);
    }

    if (activeFilters.has("workTag")) {
      items = items.filter(({ task }) => task.tags?.includes("#work") || task.tags?.includes("work"));
    }

    return items;
  });

  const laneItems = $derived(() => {
    const grouped: Record<AttentionLane, AttentionItem[]> = {
      DO_NOW: [],
      UNBLOCK_FIRST: [],
      BLOCKED: [],
      WATCHLIST: [],
    };

    for (const item of filteredItems) {
      grouped[item.profile.lane].push(item);
    }

    for (const lane of lanes) {
      grouped[lane].sort((a, b) => b.profile.score - a.profile.score);
    }

    return grouped;
  });

  function getLaneDescription(lane: AttentionLane): string {
    switch (lane) {
      case "DO_NOW":
        return "High attention score and actionable now.";
      case "UNBLOCK_FIRST":
        return "These tasks unlock other work.";
      case "BLOCKED":
        return "High attention but waiting on blockers.";
      case "WATCHLIST":
        return "Upcoming or medium urgency tasks.";
      default:
        return "";
    }
  }

  function formatOverdue(profile: AttentionProfile): string {
    if (profile.escalation.daysOverdue <= 0) {
      return "On time";
    }
    return `${profile.escalation.daysOverdue} day${profile.escalation.daysOverdue === 1 ? "" : "s"} overdue`;
  }

  function formatDueDate(task: Task): string {
    if (!task.dueAt) {
      return "No due date";
    }
    return formatDateTime(new Date(task.dueAt));
  }

  function getBlockerLabel(taskId: string): string {
    const blocker = tasksById.get(taskId);
    return blocker?.name ?? taskId;
  }

  function getBlockerTask(taskId: string): Task | undefined {
    return tasksById.get(taskId);
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
</script>

<div class="attention-tab">
  <div class="attention-tab__header">
    <div>
      <h2 class="attention-tab__title">Attention Dashboard</h2>
      <p class="attention-tab__subtitle">
        {filteredItems.length} task{filteredItems.length !== 1 ? "s" : ""} ranked by urgency, priority, and dependencies.
      </p>
    </div>
    <div class="attention-tab__filters" role="group" aria-label="Attention filters">
      <button
        class={`attention-tab__filter ${activeFilters.has("doNow") ? "active" : ""}`}
        onclick={() => toggleFilter("doNow")}
      >
        Only Do Now
      </button>
      <button
        class={`attention-tab__filter ${activeFilters.has("severe") ? "active" : ""}`}
        onclick={() => toggleFilter("severe")}
      >
        Only Severe
      </button>
      <button
        class={`attention-tab__filter ${activeFilters.has("blocking") ? "active" : ""}`}
        onclick={() => toggleFilter("blocking")}
      >
        Only Blocking
      </button>
      {#if hasWorkTag}
        <button
          class={`attention-tab__filter ${activeFilters.has("workTag") ? "active" : ""}`}
          onclick={() => toggleFilter("workTag")}
        >
          Only #work
        </button>
      {/if}
    </div>
  </div>

  <div class="attention-tab__lanes">
    {#each lanes as lane}
      <section class="attention-tab__lane" aria-label={laneLabels[lane]}>
        <div class="attention-tab__lane-header">
          <div>
            <h3 class="attention-tab__lane-title">{laneLabels[lane]}</h3>
            <p class="attention-tab__lane-subtitle">{getLaneDescription(lane)}</p>
          </div>
          <span class="attention-tab__lane-count">{laneItems[lane].length}</span>
        </div>

        {#if laneItems[lane].length === 0}
          <div class="attention-tab__empty">No tasks in this lane.</div>
        {:else}
          <div class="attention-tab__lane-list">
            {#each laneItems[lane] as item (item.task.id)}
              <article class="attention-card">
                <button class="attention-card__title" onclick={() => openTask(item.task)}>
                  <span>{item.task.name}</span>
                </button>
                <div class="attention-card__meta">
                  <span class="attention-card__score">Score {item.profile.score}</span>
                  <span class="attention-card__due">
                    Due {formatDueDate(item.task)}
                  </span>
                  <span class="attention-card__overdue">{formatOverdue(item.profile)}</span>
                  {#if getSourceLabel(item.task)}
                    <span class="attention-card__source">{getSourceLabel(item.task)}</span>
                  {/if}
                </div>

                <div class="attention-card__badges">
                  <EscalationBadge
                    result={{
                      level: item.profile.escalation.level,
                      daysOverdue: item.profile.escalation.daysOverdue,
                      label: item.profile.escalation.label,
                    }}
                    explanation={buildEscalationExplanation(item.task, {
                      level: item.profile.escalation.level,
                      daysOverdue: item.profile.escalation.daysOverdue,
                      label: item.profile.escalation.label,
                    }, { settings: escalationSettings, referenceDate: referenceDay })}
                    compact={true}
                  />
                  <PriorityBadge level={item.profile.priority.level} weight={item.profile.priority.weight} compact={true} />
                  {#if item.profile.dependency.isBlocked}
                    <span
                      class="attention-card__dependency attention-card__dependency--blocked"
                      title={`Blocked by ${item.profile.dependency.blockers.length} task(s)`}
                    >
                      ⛔ Blocked ({item.profile.dependency.blockers.length})
                    </span>
                  {/if}
                  {#if item.profile.dependency.isBlocking}
                    <span
                      class="attention-card__dependency attention-card__dependency--blocking"
                      title={`Blocking ${item.profile.dependency.blockedCount} task(s)`}
                    >
                      🔗 Blocking ({item.profile.dependency.blockedCount})
                    </span>
                  {/if}
                  {#if item.profile.dependency.cycle?.detected}
                    <span
                      class="attention-card__dependency attention-card__dependency--cycle"
                      title="Dependency cycle detected"
                    >
                      🔁 Cycle
                    </span>
                  {/if}
                  <button
                    class="attention-card__info"
                    onclick={() => toggleReasons(item.task.id)}
                    aria-label="Why is this here?"
                    title="Why is this here?"
                  >
                    i
                  </button>
                </div>

                {#if expandedReasons.has(item.task.id)}
                  <div class="attention-card__reasons">
                    <strong>Why is this here?</strong>
                    <ul>
                      {#each item.profile.reasons as reason}
                        <li>{reason}</li>
                      {/each}
                    </ul>
                  </div>
                {/if}

                {#if item.profile.dependency.isBlocked}
                  <button
                    class="attention-card__blockers-toggle"
                    onclick={() => toggleBlockers(item.task.id)}
                  >
                    {expandedBlockers.has(item.task.id) ? "Hide blockers" : "Show blockers"}
                  </button>
                  {#if expandedBlockers.has(item.task.id)}
                    <div class="attention-card__blockers">
                      <strong>Blockers</strong>
                      <ul>
                        {#each item.profile.dependency.blockers.slice(0, settings.blockersPreviewCount) as blockerId}
                          <li>
                            <button
                              class="attention-card__blocker"
                              onclick={() => {
                                const blockerTask = getBlockerTask(blockerId);
                                if (blockerTask) {
                                  openTask(blockerTask);
                                } else {
                                  toast.info(`Blocker ${blockerId} not found.`);
                                }
                              }}
                            >
                              {getBlockerLabel(blockerId)}
                            </button>
                          </li>
                        {/each}
                      </ul>
                    </div>
                  {/if}
                {/if}
              </article>
            {/each}
          </div>
        {/if}
      </section>
    {/each}
  </div>
</div>

<style>
  .attention-tab {
    padding: 16px;
  }

  .attention-tab__header {
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin-bottom: 20px;
  }

  .attention-tab__title {
    margin: 0 0 6px 0;
    font-size: 20px;
    font-weight: 600;
    color: var(--b3-theme-on-surface);
  }

  .attention-tab__subtitle {
    margin: 0;
    font-size: 14px;
    color: var(--b3-theme-on-surface-light);
  }

  .attention-tab__filters {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .attention-tab__filter {
    border: 1px solid var(--b3-border-color);
    background: var(--b3-theme-surface-lighter);
    color: var(--b3-theme-on-surface);
    border-radius: 999px;
    padding: 6px 12px;
    font-size: 12px;
    cursor: pointer;
  }

  .attention-tab__filter.active {
    background: var(--b3-theme-primary-light);
    border-color: var(--b3-theme-primary);
    color: var(--b3-theme-primary);
  }

  .attention-tab__lanes {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 16px;
  }

  .attention-tab__lane {
    border: 1px solid var(--b3-border-color);
    border-radius: 12px;
    padding: 12px;
    background: var(--b3-theme-surface);
  }

  .attention-tab__lane-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 12px;
  }

  .attention-tab__lane-title {
    margin: 0 0 4px 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--b3-theme-on-surface);
  }

  .attention-tab__lane-subtitle {
    margin: 0;
    font-size: 12px;
    color: var(--b3-theme-on-surface-light);
  }

  .attention-tab__lane-count {
    background: var(--b3-theme-surface-lighter);
    border-radius: 999px;
    padding: 4px 8px;
    font-size: 12px;
  }

  .attention-tab__empty {
    padding: 12px;
    text-align: center;
    font-size: 12px;
    color: var(--b3-theme-on-surface-light);
  }

  .attention-tab__lane-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .attention-card {
    border: 1px solid var(--b3-border-color);
    border-radius: 10px;
    padding: 12px;
    background: var(--b3-theme-surface-lighter);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .attention-card__title {
    background: none;
    border: none;
    text-align: left;
    font-size: 14px;
    font-weight: 600;
    color: var(--b3-theme-on-surface);
    cursor: pointer;
    padding: 0;
  }

  .attention-card__meta {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 12px;
    font-size: 12px;
    color: var(--b3-theme-on-surface-light);
  }

  .attention-card__score {
    font-weight: 600;
    color: var(--b3-theme-primary);
  }

  .attention-card__badges {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
  }

  .attention-card__dependency {
    font-size: 11px;
    padding: 3px 8px;
    border-radius: 999px;
    border: 1px solid var(--b3-border-color);
    background: var(--b3-theme-surface);
    white-space: nowrap;
  }

  .attention-card__dependency--blocked {
    color: #ef4444;
    border-color: rgba(239, 68, 68, 0.5);
  }

  .attention-card__dependency--blocking {
    color: #3b82f6;
    border-color: rgba(59, 130, 246, 0.5);
  }

  .attention-card__dependency--cycle {
    color: #f59e0b;
    border-color: rgba(245, 158, 11, 0.6);
  }

  .attention-card__info {
    border: none;
    background: var(--b3-theme-surface);
    border-radius: 50%;
    width: 24px;
    height: 24px;
    font-size: 12px;
    cursor: pointer;
    color: var(--b3-theme-on-surface-light);
  }

  .attention-card__reasons {
    background: var(--b3-theme-surface);
    border-radius: 8px;
    padding: 8px 10px;
    font-size: 12px;
    color: var(--b3-theme-on-surface);
  }

  .attention-card__reasons ul {
    margin: 6px 0 0 18px;
    padding: 0;
  }

  .attention-card__blockers-toggle {
    align-self: flex-start;
    background: none;
    border: none;
    color: var(--b3-theme-primary);
    font-size: 12px;
    cursor: pointer;
    padding: 0;
  }

  .attention-card__blockers {
    background: var(--b3-theme-surface);
    border-radius: 8px;
    padding: 8px 10px;
    font-size: 12px;
  }

  .attention-card__blockers ul {
    margin: 6px 0 0 16px;
    padding: 0;
  }

  .attention-card__blocker {
    background: none;
    border: none;
    color: var(--b3-theme-primary);
    text-align: left;
    cursor: pointer;
    padding: 0;
  }

  @media (min-width: 900px) {
    .attention-tab__header {
      flex-direction: row;
      justify-content: space-between;
      align-items: center;
    }
  }
</style>
