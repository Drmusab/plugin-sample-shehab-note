<script lang="ts">
  import type { Task } from "@/core/models/Task";
  import { recordCompletion, recordMiss } from "@/core/models/Task";
  import type { TaskStorage } from "@/core/storage/TaskStorage";
  import type { Scheduler } from "@/core/engine/Scheduler";
  import type { EventService } from "@/services/EventService";
  import { showToast, toast } from "@/utils/notifications";
  import { isValidFrequency } from "@/core/models/Frequency";
  import {
    getTodayAndOverdueTasks,
    removeTask,
    updateTaskById,
    upsertTask,
  } from "./dashboard/taskState";
  import { onDestroy, onMount } from "svelte";
  import TodayTab from "./tabs/TodayTab.svelte";
  import AllTasksTab from "./tabs/AllTasksTab.svelte";
  import TimelineTab from "./tabs/TimelineTab.svelte";
  import AnalyticsTab from "./tabs/AnalyticsTab.svelte";
  import TaskForm from "./cards/TaskForm.svelte";
  import Settings from "./settings/Settings.svelte";

  interface Props {
    storage: TaskStorage;
    scheduler: Scheduler;
    eventService: EventService;
  }

  let { storage, scheduler, eventService }: Props = $props();

  // Get timezone handler and recurrence engine from scheduler
  // Access these in component setup - they're stable references
  const timezoneHandler = scheduler.getTimezoneHandler();
  const recurrenceEngine = scheduler.getRecurrenceEngine();

  let activeTab = $state<"today" | "all" | "timeline" | "analytics">("today");
  let showTaskForm = $state(false);
  let showSettings = $state(false);
  let editingTask = $state<Task | undefined>(undefined);
  const pendingCompletions = new Map<string, { timeoutId: number; snapshot: Task }>();
  const completionLocks = new Set<string>();
  /**
   * Dashboard task state (single UI source of truth).
   * Storage is only used for initial hydration or explicit reloads.
   */
  let allTasks = $state<Task[]>([]);
  let todayTasks = $derived(getTodayAndOverdueTasks(allTasks));

  function formatNextDueLabel(date: Date): string {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);

    const timeLabel = date.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });

    if (date.toDateString() === now.toDateString()) {
      return `Today at ${timeLabel}`;
    }
    if (date.toDateString() === tomorrow.toDateString()) {
      return `Tomorrow at ${timeLabel}`;
    }

    return `${date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    })} at ${timeLabel}`;
  }

  // Refresh tasks from storage (initial load / explicit reloads only)
  function loadTasksFromStorage(reason: "initial" | "reload" | "external" = "initial") {
    // Shallow copy keeps UI state decoupled from storage while avoiding deep clones.
    allTasks = storage.getAllTasks().map((task) => ({ ...task }));
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
    pendingCompletions.forEach(({ timeoutId }) => {
      window.clearTimeout(timeoutId);
    });
    pendingCompletions.clear();
    completionLocks.clear();
  });

  async function handleTaskDone(task: Task) {
    if (completionLocks.has(task.id)) {
      toast.info(`Completion already in progress for "${task.name}".`);
      return;
    }
    if (pendingCompletions.has(task.id)) {
      toast.info(`Completion already pending for "${task.name}".`);
      return;
    }

    completionLocks.add(task.id);
    const snapshot = JSON.parse(JSON.stringify(task)) as Task;
    const nextTasks = updateTaskById(allTasks, task.id, (current) => {
      const nextTask = { ...current };
      recordCompletion(nextTask);
      const nextDue = recurrenceEngine.calculateNext(new Date(nextTask.dueAt), nextTask.frequency);
      nextTask.dueAt = nextDue.toISOString();
      return nextTask;
    });

    allTasks = nextTasks;
    const updatedTask = nextTasks.find((item) => item.id === task.id);
    const nextDueLabel = updatedTask ? formatNextDueLabel(new Date(updatedTask.dueAt)) : "soon";
    const undoTimeout = window.setTimeout(async () => {
      pendingCompletions.delete(task.id);
      try {
        await eventService.emitTaskEvent("task.completed", task);
        await scheduler.markTaskDone(task.id);
      } catch (err) {
        allTasks = updateTaskById(allTasks, task.id, () => snapshot);
        toast.error("Failed to mark task as done: " + err);
        loadTasksFromStorage("external");
      } finally {
        completionLocks.delete(task.id);
      }
    }, 5000);

    const undoCompletion = () => {
      window.clearTimeout(undoTimeout);
      pendingCompletions.delete(task.id);
      completionLocks.delete(task.id);
      allTasks = updateTaskById(allTasks, task.id, () => snapshot);
      toast.info(`Undo: "${task.name}" restored`);
    };

    pendingCompletions.set(task.id, { timeoutId: undoTimeout, snapshot });

    showToast({
      message: `Task "${task.name}" completed. Next: ${nextDueLabel}`,
      type: "success",
      duration: 5000,
      actionLabel: "Undo",
      onAction: undoCompletion,
      showCountdown: true,
    });

    return;
  }

  async function handleTaskDelay(task: Task) {
    const previousTasks = allTasks;
    const nextTasks = updateTaskById(allTasks, task.id, (current) => {
      const nextTask = { ...current };
      const currentDue = new Date(nextTask.dueAt);
      const tomorrow = timezoneHandler.tomorrow();
      tomorrow.setHours(currentDue.getHours(), currentDue.getMinutes(), 0, 0);
      nextTask.dueAt = tomorrow.toISOString();
      nextTask.snoozeCount = (nextTask.snoozeCount || 0) + 1;
      nextTask.updatedAt = new Date().toISOString();
      return nextTask;
    });

    allTasks = nextTasks;
    toast.info(`Task "${task.name}" delayed to tomorrow`);

    try {
      await eventService.emitTaskEvent("task.snoozed", task);
      await scheduler.delayToTomorrow(task.id);
    } catch (err) {
      allTasks = previousTasks;
      toast.error("Failed to delay task: " + err);
      loadTasksFromStorage("external");
    }
  }

  async function handleSaveTask(task: Task) {
    // Add validation
    if (!task.name?.trim()) {
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

    void storage.saveTask(nextTask).catch((err) => {
      toast.error("Failed to save task: " + err);
      loadTasksFromStorage("external");
    });
  }

  async function handleDeleteTask(task: Task) {
    const previousTasks = allTasks;
    allTasks = removeTask(allTasks, task.id);
    
    const undoTimeout = window.setTimeout(async () => {
      try {
        await storage.deleteTask(task.id);
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
      onAction: () => {
        window.clearTimeout(undoTimeout);
        allTasks = previousTasks;
        toast.info(`Restored "${task.name}"`);
      },
      showCountdown: true,
    });
  }

  async function handleToggleEnabled(task: Task) {
    const nextEnabled = !task.enabled;
    const nextTask = { ...task, enabled: nextEnabled };
    const nextTasks = updateTaskById(allTasks, task.id, () => nextTask);

    allTasks = nextTasks;
    toast.info(`Task ${nextEnabled ? "enabled" : "disabled"}`);

    void storage.saveTask(nextTask).catch((err) => {
      toast.error("Failed to update task: " + err);
      loadTasksFromStorage("external");
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
</script>

<div class="dashboard">
  <div class="dashboard__header">
    <h1 class="dashboard__title">Recurring Tasks</h1>
    <button class="dashboard__settings-btn" onclick={handleOpenSettings}>
      ⚙️ Settings
    </button>
  </div>

  {#if showSettings}
    <div class="dashboard__overlay">
      <Settings {eventService} onClose={handleCloseSettings} />
    </div>
  {:else if showTaskForm}
    <div class="dashboard__overlay">
      <TaskForm task={editingTask} onSave={handleSaveTask} onCancel={handleCancelForm} />
    </div>
  {:else}
    <div class="dashboard__tabs">
      <button
        class="dashboard__tab {activeTab === 'today' ? 'active' : ''}"
        onclick={() => (activeTab = "today")}
      >
        📋 Today & Overdue
        {#if todayTasks.length > 0}
          <span class="dashboard__tab-badge">{todayTasks.length}</span>
        {/if}
      </button>
      <button
        class="dashboard__tab {activeTab === 'all' ? 'active' : ''}"
        onclick={() => (activeTab = "all")}
      >
        📝 All Tasks
        <span class="dashboard__tab-badge">{allTasks.length}</span>
      </button>
      <button
        class="dashboard__tab {activeTab === 'timeline' ? 'active' : ''}"
        onclick={() => (activeTab = "timeline")}
      >
        📅 Timeline
      </button>
      <button
        class="dashboard__tab {activeTab === 'analytics' ? 'active' : ''}"
        onclick={() => (activeTab = "analytics")}
      >
        📊 Analytics
      </button>
    </div>

    <div class="dashboard__content">
      {#if activeTab === "today"}
        <TodayTab
          tasks={todayTasks}
          onDone={handleTaskDone}
          onDelay={handleTaskDelay}
          onSkip={handleTaskSkip}
          onEdit={handleEditTask}
          {timezoneHandler}
        />
      {:else if activeTab === "all"}
        <AllTasksTab
          tasks={allTasks}
          onEdit={handleEditTask}
          onDelete={handleDeleteTask}
          onToggleEnabled={handleToggleEnabled}
          onCreate={handleCreateTask}
        />
      {:else if activeTab === "timeline"}
        <TimelineTab
          tasks={allTasks}
          recurrenceEngine={scheduler.getRecurrenceEngine()}
        />
      {:else if activeTab === "analytics"}
        <AnalyticsTab tasks={allTasks} />
      {/if}
    </div>
  {/if}
</div>

<style>
  .dashboard {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--b3-theme-background);
  }

  .dashboard__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid var(--b3-border-color);
    background: var(--b3-theme-surface);
  }

  .dashboard__title {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--b3-theme-on-surface);
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
    font-size: 11px;
    font-weight: 600;
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
