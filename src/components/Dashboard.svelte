<script lang="ts">
  import type { Task } from "@/core/models/Task";
  import { duplicateTask, recordMiss, isBlocked, isBlocking, normalizePriority } from "@/core/models/Task";
  import type { TaskRepositoryProvider } from "@/core/storage/TaskRepository";
  import type { Scheduler } from "@/core/engine/Scheduler";
  import type { SettingsService } from "@/core/settings/SettingsService";
  import type { EventService } from "@/services/EventService";
  import type { ShortcutManager } from "@/commands/ShortcutManager";
  import { showToast, toast } from "@/utils/notifications";
  import { isValidFrequency } from "@/core/models/Frequency";
  import { pluginEventBus } from "@/core/events/PluginEventBus";
  import { evaluateEscalation } from "@/core/escalation/EscalationEvaluator";
  import {
    getTodayAndOverdueTasks,
    removeTask,
    updateTaskById,
    upsertTask,
  } from "./dashboard/taskState";
  import { onDestroy, onMount } from "svelte";
  import type { App } from "siyuan";
  import { setContext } from "svelte";
  import { URGENCY_SETTINGS_CONTEXT_KEY } from "@/core/urgency/UrgencyContext";
  import { ESCALATION_SETTINGS_CONTEXT_KEY } from "@/core/escalation/EscalationContext";
  import TodayTab from "./tabs/TodayTab.svelte";
  import AllTasksTab from "./tabs/AllTasksTab.svelte";
  import TimelineTab from "./tabs/TimelineTab.svelte";
  import AnalyticsTab from "./tabs/AnalyticsTab.svelte";
  import InboxTab from "./tabs/InboxTab.svelte";
  import UpcomingTab from "./tabs/UpcomingTab.svelte";
  import DoneTab from "./tabs/DoneTab.svelte";
  import ProjectsTab from "./tabs/ProjectsTab.svelte";
  import SearchTab from "./tabs/SearchTab.svelte";
  import DependenciesTab from "./tabs/DependenciesTab.svelte";
  import InsightsTab from "./tabs/InsightsTab.svelte";
  import EscalationTab from "./tabs/EscalationTab.svelte";
  import AttentionTab from "./tabs/AttentionTab.svelte";
  import TaskEditorModal from "./TaskEditorModal.svelte";
  import Settings from "./settings/Settings.svelte";
  import Icon from "./ui/Icon.svelte";
  import type { PatternLearner } from "@/core/ml/PatternLearner";

  interface Props {
    repository: TaskRepositoryProvider;
    scheduler: Scheduler;
    eventService: EventService;
    shortcutManager: ShortcutManager | null;
    settingsService: SettingsService;
    app: App;
    patternLearner?: PatternLearner;
  }

  let { repository, scheduler, eventService, shortcutManager, settingsService, app, patternLearner }: Props = $props();

  const escalationSettings = $state(settingsService.get().escalation);
  const attentionSettings = $state(settingsService.get().attention);

  setContext(URGENCY_SETTINGS_CONTEXT_KEY, settingsService.get().urgency);
  setContext(ESCALATION_SETTINGS_CONTEXT_KEY, escalationSettings);

  // Get timezone handler and recurrence engine from scheduler
  // These are simple getters, not reactive state - no need for $derived
  const timezoneHandler = scheduler.getTimezoneHandler();
  const recurrenceEngine = scheduler.getRecurrenceEngine();

  type TabType = "inbox" | "today" | "attention" | "upcoming" | "done" | "projects" | "search" | "all" | "timeline" | "analytics" | "insights" | "dependencies" | "escalation";
  let activeTab = $state<TabType>("today");
  let showTaskForm = $state(false);
  let showSettings = $state(false);
  let editingTask = $state<Task | undefined>(undefined);
  let quickFilters = $state<Set<string>>(new Set());
  /**
   * Dashboard task state (single UI source of truth).
   * Storage is only used for initial hydration or explicit reloads.
   */
  let allTasks = $state<Task[]>([]);
  let todayTasks = $derived(getTodayAndOverdueTasks(allTasks));
  let isRefreshing = $state(false);
  const panelLabelId = $derived(
    ["inbox", "today", "attention", "upcoming", "done", "projects", "search", "all", "insights", "dependencies", "escalation"].includes(activeTab)
      ? `dashboard-tab-${activeTab}`
      : undefined
  );

  // Apply quick filters
  const filteredTasks = $derived(() => {
    let tasks = allTasks;
    
    if (quickFilters.has("notDone")) {
      tasks = tasks.filter((t) => t.status !== "done" && t.status !== "cancelled");
    }
    if (quickFilters.has("dueToday")) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tasks = tasks.filter((t) => {
        if (! t.dueAt) return false;
        const due = new Date(t.dueAt);
        return due >= today && due < tomorrow;
      });
    }
    if (quickFilters. has("overdue")) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      tasks = tasks.filter((t) => {
        if (!t.dueAt || t.status === "done" || t.status === "cancelled") return false;
        const due = new Date(t.dueAt);
        return due < today;
      });
    }
    if (quickFilters.has("inProgress")) {
      tasks = tasks. filter((t) => t.status === "todo" && t.statusSymbol && t.statusSymbol !== " ");
    }
    if (quickFilters.has("blocked")) {
      tasks = tasks.filter((t) => isBlocked(t, allTasks));
    }
    if (quickFilters.has("blocking")) {
      tasks = tasks.filter((t) => isBlocking(t, allTasks));
    }
    if (quickFilters.has("highPriority")) {
      tasks = tasks.filter((t) => {
        const priority = normalizePriority(t.priority) || "normal";
        return priority === "high" || priority === "highest";
      });
    }
    
    return tasks;
  });

  // Task counts for tab badges
  const inboxCount = $derived(
    allTasks.filter(
      (t) =>
        t.status !== "done" &&
        t. status !== "cancelled" &&
        ! t. dueAt &&
        !t. scheduledAt &&
        !t.startAt
    ).length
  );

  const upcomingCount = $derived(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const futureDate = new Date(today);
    futureDate.setDate(futureDate.getDate() + 7);
    return allTasks.filter((t) => {
      if (t.status === "done" || t.status === "cancelled" || ! t.dueAt) return false;
      const due = new Date(t.dueAt);
      due.setHours(0, 0, 0, 0);
      return due > today && due <= futureDate;
    }).length;
  });

  const doneCount = $derived(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    cutoff.setHours(0, 0, 0, 0);
    return allTasks. filter((t) => {
      if (t.status !== "done" || ! t.doneAt) return false;
      const done = new Date(t.doneAt);
      return done >= cutoff;
    }).length;
  });

  const projectsCount = $derived(
    allTasks.filter((t) => t.status !== "done" && t.status !== "cancelled").length
  );

  const blockedCount = $derived(
    allTasks.filter((t) => isBlocked(t, allTasks)).length
  );

  const escalationCount = $derived(() => {
    if (!escalationSettings.enabled) {
      return 0;
    }
    return allTasks.filter((task) => evaluateEscalation(task, { settings: escalationSettings }).level > 0).length;
  });

  // Refresh tasks from storage (initial load / explicit reloads only)
  function loadTasksFromStorage(reason: "initial" | "reload" | "external" = "initial") {
    isRefreshing = true;
    // Shallow copy keeps UI state decoupled from storage while avoiding deep clones. 
    allTasks = repository.getAllTasks().map((task) => ({ ...task }));
    isRefreshing = false;
    if (reason !== "initial") {
      toast.info("Task list reloaded");
    }
  }

  // Initialize
  loadTasksFromStorage();

  const refreshHandler = () => loadTasksFromStorage("reload");
  onMount(() => {
    window.addEventListener("recurring-task-refresh", refreshHandler);
  });
  onDestroy(() => {
    window.removeEventListener("recurring-task-refresh", refreshHandler);
  });

  async function handleTaskDone(task: Task) {
    pluginEventBus.emit("task: complete", { taskId: task.id });
  }

  async function handleTaskDelay(task: Task) {
    const previousTasks = allTasks;
    const nextTasks = updateTaskById(allTasks, task.id, (current) => {
      const nextTask = { ...current };
      const currentDue = new Date(nextTask.dueAt);
      const tomorrow = timezoneHandler.tomorrow();
      tomorrow.setHours(currentDue.getHours(), currentDue.getMinutes(), 0, 0);
      nextTask.dueAt = tomorrow. toISOString();
      nextTask.snoozeCount = (nextTask.snoozeCount || 0) + 1;
      nextTask.updatedAt = new Date().toISOString();
      return nextTask;
    });

    allTasks = nextTasks;
    toast.info(`Task "${task.name}" delayed to tomorrow`);

    try {
      await eventService.emitTaskEvent("task. snoozed", task);
      await scheduler.delayToTomorrow(task.id);
    } catch (err) {
      allTasks = previousTasks;
      toast.error("Failed to delay task:  " + err);
      loadTasksFromStorage("external");
    }
  }

  async function handleSaveTask(task: Task) {
    // Add validation
    if (!task.name?. trim()) {
      toast.error("Task name is required");
      return;
    }
    if (!isValidFrequency(task.frequency)) {
      toast.error("Invalid frequency configuration");
      return;
    }
    
    const nextTask = { ...task };
    allTasks = upsertTask(allTasks, nextTask);
    showTaskForm = false;
    editingTask = undefined;
    toast.success(`Task "${task.name}" saved successfully`);

    void repository.saveTask(nextTask).catch((err) => {
      toast.error("Failed to save task: " + err);
      loadTasksFromStorage("external");
    });
  }

  async function handleDeleteTask(task: Task) {
    const previousTasks = allTasks;
    allTasks = removeTask(allTasks, task. id);
    
    const undoTimeout = window.setTimeout(async () => {
      try {
        await repository.deleteTask(task.id);
      } catch (err) {
        allTasks = previousTasks;
        toast.error("Failed to delete task: " + err);
        loadTasksFromStorage("external");
      }
    }, 5000);

    showToast({
      message: `Task "${task.name}" deleted`,
      type: "success",
      duration: 5000,
      actionLabel: "Undo",
      onAction:  () => {
        window.clearTimeout(undoTimeout);
        allTasks = previousTasks;
        toast.info(`Restored "${task.name}"`);
      },
      showCountdown: true,
    });
  }

  async function handleDuplicateTask(task: Task) {
    const duplicateName = task.name. endsWith(" (copy)")
      ? `${task.name} ${new Date().toLocaleDateString()}`
      : `${task.name} (copy)`;
    const duplicated = duplicateTask(task, {
      name: duplicateName,
    });

    allTasks = upsertTask(allTasks, duplicated);
    toast.success(`Duplicated "${task.name}"`);

    void repository.saveTask(duplicated).catch((err) => {
      allTasks = removeTask(allTasks, duplicated.id);
      toast.error("Failed to duplicate task: " + err);
      loadTasksFromStorage("external");
    });
  }

  async function handleToggleEnabled(task: Task) {
    const nextEnabled = !task.enabled;
    const nextTask = { ...task, enabled: nextEnabled };
    const nextTasks = updateTaskById(allTasks, task.id, () => nextTask);

    allTasks = nextTasks;
    toast.info(`Task ${nextEnabled ? "enabled" : "disabled"}`);

    void repository.saveTask(nextTask).catch((err) => {
      toast.error("Failed to update task: " + err);
      loadTasksFromStorage("external");
    });
  }

  async function handleBulkEnabledUpdate(taskIds: string[], enabled: boolean) {
    if (taskIds.length === 0) {
      return;
    }

    const previousTasks = allTasks;
    const taskIdSet = new Set(taskIds);
    const nextTasks = allTasks.map((task) =>
      taskIdSet.has(task.id) ? { ...task, enabled } : task
    );

    allTasks = nextTasks;
    toast.info(`${enabled ? "Enabled" : "Disabled"} ${taskIds.length} task${taskIds.length === 1 ? "" : "s"}`);

    try {
      const tasksToSave = nextTasks.filter((task) => taskIdSet.has(task.id));
      await Promise.all(tasksToSave.map((task) => repository.saveTask(task)));
    } catch (err) {
      allTasks = previousTasks;
      toast.error(`Failed to ${enabled ? "enable" : "disable"} tasks: ${err}`);
      loadTasksFromStorage("external");
    }
  }

  async function handleBulkDelete(taskIds: string[]) {
    if (taskIds.length === 0) {
      return;
    }

    const previousTasks = allTasks;
    const taskIdSet = new Set(taskIds);
    const tasksToDelete = allTasks. filter((task) => taskIdSet.has(task.id));
    allTasks = allTasks.filter((task) => !taskIdSet.has(task.id));

    const undoTimeout = window.setTimeout(async () => {
      try {
        await Promise.all(tasksToDelete.map((task) => repository.deleteTask(task. id)));
      } catch (err) {
        allTasks = previousTasks;
        toast. error("Failed to delete tasks: " + err);
        loadTasksFromStorage("external");
      }
    }, 5000);

    showToast({
      message: `${tasksToDelete.length} task${tasksToDelete.length === 1 ? "" : "s"} deleted`,
      type: "success",
      duration: 5000,
      actionLabel: "Undo",
      onAction: () => {
        window. clearTimeout(undoTimeout);
        allTasks = previousTasks;
        toast.info("Bulk delete undone");
      },
      showCountdown: true,
    });
  }

  function handleEditTask(task: Task) {
    editingTask = task;
    showTaskForm = true;
  }

  function handleCreateTask() {
    editingTask = undefined;
    showTaskForm = true;
  }

  function handleCancelForm() {
    showTaskForm = false;
    editingTask = undefined;
  }

  function handleOpenSettings() {
    showSettings = true;
  }

  function handleCloseSettings() {
    showSettings = false;
  }

  async function handleTaskSkip(task: Task) {
    const previousTasks = allTasks;
    const nextTasks = updateTaskById(allTasks, task.id, (current) => {
      const nextTask = { ...current };
      recordMiss(nextTask);
      const nextDue = recurrenceEngine.calculateNext(new Date(nextTask.dueAt), nextTask.frequency);
      nextTask.dueAt = nextDue.toISOString();
      return nextTask;
    });

    allTasks = nextTasks;
    toast.info(`Task "${task.name}" skipped to next occurrence`);

    try {
      await eventService.emitTaskEvent("task.skipped", task);
      await scheduler.skipTaskOccurrence(task.id);
    } catch (err) {
      allTasks = previousTasks;
      toast.error("Failed to skip task: " + err);
      loadTasksFromStorage("external");
    }
  }

  function toggleQuickFilter(filterId: string) {
    const newFilters = new Set(quickFilters);
    if (newFilters.has(filterId)) {
      newFilters.delete(filterId);
    } else {
      newFilters.add(filterId);
    }
    quickFilters = newFilters;
  }

  async function handleUncompleteTask(task: Task) {
    const updatedTask = {
      ...task,
      status: "todo" as const,
      doneAt: undefined,
    };
    allTasks = upsertTask(allTasks, updatedTask);
    toast.success(`Task "${task.name}" marked as not done`);
    
    void repository.saveTask(updatedTask).catch((err) => {
      toast.error("Failed to update task: " + err);
      loadTasksFromStorage("external");
    });
  }

</script>

<div class="dashboard {escalationSettings.colorTheme === 'high-contrast' ? 'dashboard--escalation-high-contrast' : ''}">
  <div class="dashboard__header">
    <h1 class="dashboard__title">Recurring Tasks</h1>
    <div class="dashboard__header-actions">
      <button
        class="dashboard__refresh-btn"
        onclick={() => loadTasksFromStorage("reload")}
        disabled={isRefreshing}
        title="Refresh tasks"
      >
        {isRefreshing ? "⟳" : "↻"}
      </button>
      <button class="dashboard__settings-btn" onclick={handleOpenSettings}>
        ⚙️ Settings
      </button>
    </div>
  </div>

  {#if showSettings}
    <div class="dashboard__overlay">
      <Settings
        {eventService}
        {shortcutManager}
        {settingsService}
        {repository}
        {patternLearner}
        onClose={handleCloseSettings}
      />
    </div>
  {:else if showTaskForm}
    <div class="dashboard__overlay">
      <TaskEditorModal
        task={editingTask}
        {repository}
        {settingsService}
        {patternLearner}
        onSave={handleSaveTask}
        onClose={handleCancelForm}
      />
    </div>
  {:else}
    <div class="dashboard__tabs" role="tablist" aria-label="Dashboard tabs">
      <button
        id="dashboard-tab-inbox"
        class="dashboard__tab {activeTab === 'inbox' ? 'active' : ''}"
        role="tab"
        aria-selected={activeTab === "inbox"}
        aria-controls="dashboard-panel"
        onclick={() => (activeTab = "inbox")}
      >
        <Icon category="navigation" name="inbox" size={16} alt="Inbox" /> Inbox
        {#if inboxCount > 0}
          <span class="dashboard__tab-badge">{inboxCount}</span>
        {/if}
      </button>
      <button
        id="dashboard-tab-today"
        class="dashboard__tab {activeTab === 'today' ? 'active' : ''}"
        role="tab"
        aria-selected={activeTab === "today"}
        aria-controls="dashboard-panel"
        onclick={() => (activeTab = "today")}
      >
        <Icon category="navigation" name="today" size={16} alt="Today" /> Today
        {#if todayTasks.length > 0}
          <span class="dashboard__tab-badge">{todayTasks.length}</span>
        {/if}
      </button>
      {#if escalationSettings.enabled}
        <button
          id="dashboard-tab-escalation"
          class="dashboard__tab {activeTab === 'escalation' ? 'active' : ''}"
          role="tab"
          aria-selected={activeTab === "escalation"}
          aria-controls="dashboard-panel"
          onclick={() => (activeTab = "escalation")}
        >
          <Icon category="status" name="warning" size={16} alt="Escalation" /> Escalation
          {#if escalationCount > 0}
            <span class="dashboard__tab-badge">{escalationCount}</span>
          {/if}
        </button>
      {/if}
      {#if attentionSettings.enabled}
        <button
          id="dashboard-tab-attention"
          class="dashboard__tab {activeTab === 'attention' ? 'active' : ''}"
          role="tab"
          aria-selected={activeTab === "attention"}
          aria-controls="dashboard-panel"
          onclick={() => (activeTab = "attention")}
        >
          <Icon category="navigation" name="list" size={16} alt="Attention" /> Attention
        </button>
      {/if}
      <button
        id="dashboard-tab-upcoming"
        class="dashboard__tab {activeTab === 'upcoming' ?  'active' : ''}"
        role="tab"
        aria-selected={activeTab === "upcoming"}
        aria-controls="dashboard-panel"
        onclick={() => (activeTab = "upcoming")}
      >
        <Icon category="navigation" name="calendar" size={16} alt="Upcoming" /> Upcoming
        {#if upcomingCount > 0}
          <span class="dashboard__tab-badge">{upcomingCount}</span>
        {/if}
      </button>
      <button
        id="dashboard-tab-done"
        class="dashboard__tab {activeTab === 'done' ? 'active' : ''}"
        role="tab"
        aria-selected={activeTab === "done"}
        aria-controls="dashboard-panel"
        onclick={() => (activeTab = "done")}
      >
        <Icon category="navigation" name="done" size={16} alt="Done" /> Done
        {#if doneCount > 0}
          <span class="dashboard__tab-badge">{doneCount}</span>
        {/if}
      </button>
      <button
        id="dashboard-tab-projects"
        class="dashboard__tab {activeTab === 'projects' ? 'active' : ''}"
        role="tab"
        aria-selected={activeTab === "projects"}
        aria-controls="dashboard-panel"
        onclick={() => (activeTab = "projects")}
      >
        <Icon category="navigation" name="folder" size={16} alt="Projects" /> Projects
        {#if projectsCount > 0}
          <span class="dashboard__tab-badge">{projectsCount}</span>
        {/if}
      </button>
      <button
        id="dashboard-tab-search"
        class="dashboard__tab {activeTab === 'search' ? 'active' : ''}"
        role="tab"
        aria-selected={activeTab === "search"}
        aria-controls="dashboard-panel"
        onclick={() => (activeTab = "search")}
      >
        <Icon category="navigation" name="search" size={16} alt="Search" /> Search
      </button>
      <button
        id="dashboard-tab-dependencies"
        class="dashboard__tab {activeTab === 'dependencies' ? 'active' : ''}"
        role="tab"
        aria-selected={activeTab === "dependencies"}
        aria-controls="dashboard-panel"
        onclick={() => (activeTab = "dependencies")}
      >
        <Icon category="navigation" name="link" size={16} alt="Dependencies" /> Dependencies
        {#if blockedCount > 0}
          <span class="dashboard__tab-badge">{blockedCount}</span>
        {/if}
      </button>
      <button
        id="dashboard-tab-all"
        class="dashboard__tab {activeTab === 'all' ? 'active' : ''}"
        role="tab"
        aria-selected={activeTab === "all"}
        aria-controls="dashboard-panel"
        onclick={() => (activeTab = "all")}
      >
        <Icon category="navigation" name="list" size={16} alt="All" /> All
        <span class="dashboard__tab-badge">{allTasks.length}</span>
      </button>
      <button
        id="dashboard-tab-insights"
        class="dashboard__tab {activeTab === 'insights' ? 'active' : ''}"
        role="tab"
        aria-selected={activeTab === "insights"}
        aria-controls="dashboard-panel"
        onclick={() => (activeTab = "insights")}
      >
        <Icon category="navigation" name="insights" size={16} alt="Insights" /> Insights
      </button>
    </div>

    {#if activeTab !== "search" && activeTab !== "timeline" && activeTab !== "analytics" && activeTab !== "insights" && activeTab !== "dependencies" && activeTab !== "escalation"}
      <div class="dashboard__filters">
        <span class="dashboard__filters-label">Quick Filters: </span>
        <button
          class="dashboard__filter-btn {quickFilters.has('notDone') ? 'active' : ''}"
          onclick={() => toggleQuickFilter('notDone')}
        >
          Not Done
        </button>
        <button
          class="dashboard__filter-btn {quickFilters. has('dueToday') ? 'active' : ''}"
          onclick={() => toggleQuickFilter('dueToday')}
        >
          Due Today
        </button>
        <button
          class="dashboard__filter-btn {quickFilters.has('overdue') ? 'active' : ''}"
          onclick={() => toggleQuickFilter('overdue')}
        >
          Overdue
        </button>
        <button
          class="dashboard__filter-btn {quickFilters.has('inProgress') ? 'active' : ''}"
          onclick={() => toggleQuickFilter('inProgress')}
        >
          In Progress
        </button>
        <button
          class="dashboard__filter-btn {quickFilters. has('blocked') ? 'active' : ''}"
          onclick={() => toggleQuickFilter('blocked')}
        >
          Blocked
        </button>
        <button
          class="dashboard__filter-btn {quickFilters.has('blocking') ? 'active' : ''}"
          onclick={() => toggleQuickFilter('blocking')}
        >
          Blocking
        </button>
        <button
          class="dashboard__filter-btn {quickFilters.has('highPriority') ? 'active' : ''}"
          onclick={() => toggleQuickFilter('highPriority')}
        >
          High Priority
        </button>
      </div>
    {/if}

    <div
      id="dashboard-panel"
      class="dashboard__content"
      role="tabpanel"
      aria-labelledby={panelLabelId}
    >
      {#if activeTab === "inbox"}
        <InboxTab
          tasks={quickFilters.size > 0 ? filteredTasks : allTasks}
          onEdit={handleEditTask}
          onDone={handleTaskDone}
          onDelete={handleDeleteTask}
        />
      {:else if activeTab === "today"}
        <TodayTab
          tasks={quickFilters.size > 0 ? filteredTasks. filter(t => todayTasks.some(tt => tt.id === t.id)) : todayTasks}
          onDone={handleTaskDone}
          onDelay={handleTaskDelay}
          onSkip={handleTaskSkip}
          onEdit={handleEditTask}
          {timezoneHandler}
        />
      {:else if activeTab === "escalation"}
        <EscalationTab
          tasks={allTasks}
          {app}
          settings={escalationSettings}
          onEdit={handleEditTask}
        />
      {:else if activeTab === "attention"}
        <AttentionTab
          tasks={allTasks}
          {app}
          settings={attentionSettings}
          escalationSettings={escalationSettings}
          onEdit={handleEditTask}
        />
      {:else if activeTab === "upcoming"}
        <UpcomingTab
          tasks={quickFilters.size > 0 ?  filteredTasks :  allTasks}
          onEdit={handleEditTask}
          onDone={handleTaskDone}
          onDelete={handleDeleteTask}
        />
      {:else if activeTab === "done"}
        <DoneTab
          tasks={quickFilters.size > 0 ? filteredTasks : allTasks}
          onEdit={handleEditTask}
          onDelete={handleDeleteTask}
          onUncomplete={handleUncompleteTask}
        />
      {:else if activeTab === "projects"}
        <ProjectsTab
          tasks={quickFilters.size > 0 ? filteredTasks : allTasks}
          onEdit={handleEditTask}
          onDone={handleTaskDone}
          onDelete={handleDeleteTask}
        />
      {:else if activeTab === "search"}
        <SearchTab
          tasks={allTasks}
          onEdit={handleEditTask}
          onDone={handleTaskDone}
          onDelete={handleDeleteTask}
        />
      {:else if activeTab === "dependencies"}
        <DependenciesTab
          tasks={allTasks}
          {app}
          {settingsService}
          onEdit={handleEditTask}
        />
      {:else if activeTab === "all"}
        <AllTasksTab
          tasks={quickFilters.size > 0 ? filteredTasks : allTasks}
          onEdit={handleEditTask}
          onDelete={handleDeleteTask}
          onDuplicate={handleDuplicateTask}
          onToggleEnabled={handleToggleEnabled}
          onBulkEnable={(taskIds) => handleBulkEnabledUpdate(taskIds, true)}
          onBulkDisable={(taskIds) => handleBulkEnabledUpdate(taskIds, false)}
          onBulkDelete={handleBulkDelete}
          onCreate={handleCreateTask}
        />
      {:else if activeTab === "timeline"}
        <TimelineTab
          tasks={allTasks}
          {recurrenceEngine}
        />
      {:else if activeTab === "analytics"}
        <AnalyticsTab tasks={allTasks} />
      {:else if activeTab === "insights"}
        <InsightsTab
          tasks={allTasks}
          onApplySuggestion={async (task, suggestion) => {
            // Apply the suggested schedule
            const updatedTask = {
              ...task,
              frequency: suggestion.suggestedSchedule.frequency,
              dueAt: suggestion.suggestedSchedule.time 
                ? (() => {
                    const date = new Date(task.dueAt);
                    const [hours, minutes] = suggestion.suggestedSchedule.time.split(':').map(Number);
                    date.setHours(hours, minutes || 0, 0, 0);
                    return date.toISOString();
                  })()
                : task.dueAt,
              updatedAt: new Date().toISOString()
            };
            
            allTasks = upsertTask(allTasks, updatedTask);
            toast.success(`Schedule updated for "${task.name}"`);
            
            try {
              await repository.saveTask(updatedTask);
            } catch (err) {
              toast.error("Failed to save schedule update: " + err);
              loadTasksFromStorage("external");
            }
          }}
        />
      {/if}
    </div>
  {/if}
</div>

<style>
  .dashboard {
    display: flex;
    flex-direction: column;
    height: 100%;
    background:  var(--b3-theme-background);
    --rt-escalation-warning-bg: rgba(251, 191, 36, 0.16);
    --rt-escalation-warning-border: rgba(251, 191, 36, 0.45);
    --rt-escalation-warning-text: var(--b3-theme-on-surface);
    --rt-escalation-critical-bg: rgba(249, 115, 22, 0.18);
    --rt-escalation-critical-border: rgba(249, 115, 22, 0.5);
    --rt-escalation-critical-text: var(--b3-theme-on-surface);
    --rt-escalation-severe-bg: rgba(239, 68, 68, 0.18);
    --rt-escalation-severe-border: rgba(239, 68, 68, 0.55);
    --rt-escalation-severe-text: var(--b3-theme-on-surface);
    --rt-escalation-on-time-bg: var(--b3-theme-surface-lighter);
    --rt-escalation-on-time-border: var(--b3-border-color);
    --rt-escalation-on-time-text: var(--b3-theme-on-surface-light);
  }

  .dashboard--escalation-high-contrast {
    --rt-escalation-warning-bg: #fbbf24;
    --rt-escalation-warning-border: #f59e0b;
    --rt-escalation-warning-text: #1f2937;
    --rt-escalation-critical-bg: #f97316;
    --rt-escalation-critical-border: #ea580c;
    --rt-escalation-critical-text: #111827;
    --rt-escalation-severe-bg: #ef4444;
    --rt-escalation-severe-border: #dc2626;
    --rt-escalation-severe-text: #ffffff;
  }

  .dashboard__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    border-bottom:  1px solid var(--b3-border-color);
    background: var(--b3-theme-surface);
  }

  .dashboard__title {
    margin: 0;
    font-size: 18px;
    font-weight:  600;
    color: var(--b3-theme-on-surface);
  }

  .dashboard__header-actions {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .dashboard__refresh-btn {
    padding: 8px 12px;
    background: var(--b3-theme-surface-lighter);
    color: var(--b3-theme-on-surface);
    border: 1px solid var(--b3-border-color);
    border-radius: 6px;
    font-size: 16px;
    cursor: pointer;
    transition: background 0.2s;
  }

  .dashboard__refresh-btn:hover:not(:disabled) {
    background: var(--b3-theme-surface-light);
  }

  .dashboard__refresh-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .dashboard__settings-btn {
    padding: 8px 16px;
    background: var(--b3-theme-surface-lighter);
    color: var(--b3-theme-on-surface);
    border: 1px solid var(--b3-border-color);
    border-radius: 6px;
    font-size: 14px;
    cursor: pointer;
    transition: background 0.2s;
  }

  .dashboard__settings-btn:hover {
    background: var(--b3-theme-surface-light);
  }

  .dashboard__tabs {
    display: flex;
    border-bottom: 1px solid var(--b3-border-color);
    background: var(--b3-theme-surface);
    padding: 0 20px;
  }

  .dashboard__tab {
    position: relative;
    padding: 12px 20px;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    font-size: 14px;
    font-weight: 500;
    color: var(--b3-theme-on-surface-light);
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .dashboard__tab:hover {
    color: var(--b3-theme-on-surface);
    background: var(--b3-theme-surface-lighter);
  }

  .dashboard__tab.active {
    color: var(--b3-theme-primary);
    border-bottom-color: var(--b3-theme-primary);
  }

  .dashboard__tab-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 20px;
    height: 20px;
    padding: 0 6px;
    background: var(--b3-theme-primary);
    color: white;
    border-radius: 10px;
    font-size:  11px;
    font-weight:  600;
  }

  .dashboard__filters {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 20px;
    background: var(--b3-theme-surface);
    border-bottom: 1px solid var(--b3-border-color);
    flex-wrap: wrap;
  }

  .dashboard__filters-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--b3-theme-on-surface-light);
    margin-right: 8px;
  }

  .dashboard__filter-btn {
    padding: 6px 12px;
    background: var(--b3-theme-surface-lighter);
    color: var(--b3-theme-on-surface);
    border: 1px solid var(--b3-border-color);
    border-radius: 16px;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .dashboard__filter-btn:hover {
    background:  var(--b3-theme-surface-light);
  }

  .dashboard__filter-btn.active {
    background: var(--b3-theme-primary);
    color: white;
    border-color: var(--b3-theme-primary);
  }

  .dashboard__content {
    flex: 1;
    overflow-y: auto;
  }

  .dashboard__overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    overflow-y: auto;
    z-index: 1000;
  }
</style>
