<script lang="ts">
  import type { Task } from "@/core/models/Task";
  import type { TaskService } from "@/core/TaskService";
  import type { RecurringTaskService } from "@/core/RecurringTaskService";
  import type { EventService } from "@/services/EventService";
  import { toast } from "@/utils/notifications";
  import { isValidFrequency } from "@/core/models/Frequency";
  import {
    getTodayAndOverdueTasks,
    removeTask,
    updateTaskById,
    upsertTask,
  } from "./dashboard/taskState";
  import TodayTab from "./tabs/TodayTab.svelte";
  import AllTasksTab from "./tabs/AllTasksTab.svelte";
  import TimelineTab from "./tabs/TimelineTab.svelte";
  import AnalyticsTab from "./tabs/AnalyticsTab.svelte";
  import TaskForm from "./cards/TaskForm.svelte";
  import Settings from "./settings/Settings.svelte";

  interface Props {
    taskService: TaskService;
    recurringTaskService: RecurringTaskService;
    eventService: EventService;
  }

  let { taskService, recurringTaskService, eventService }: Props = $props();

  // Get timezone handler from recurring task service
  const timezoneHandler = recurringTaskService.getTimezoneHandler();

  let activeTab = $state<"today" | "all" | "timeline" | "analytics">("today");
  let showTaskForm = $state(false);
  let showSettings = $state(false);
  let editingTask = $state<Task | undefined>(undefined);
  /**
   * Dashboard task state (single UI source of truth).
   * Storage is only used for initial hydration or explicit reloads.
   */
  let allTasks = $state<Task[]>([]);
  let todayTasks = $derived(getTodayAndOverdueTasks(allTasks));

  const recurrenceEngine = recurringTaskService.getRecurrenceEngine();

  // Refresh tasks from storage (initial load / explicit reloads only)
  function loadTasksFromStorage(reason: "initial" | "reload" | "external" = "initial") {
    // Shallow copy keeps UI state decoupled from storage while avoiding deep clones.
    allTasks = taskService.loadTasks();
    if (reason !== "initial") {
      toast.info("Task list reloaded");
    }
  }

  // Initialize
  loadTasksFromStorage();

  async function handleTaskDone(task: Task) {
    const nextTasks = updateTaskById(allTasks, task.id, (current) =>
      recurringTaskService.buildCompletionUpdate(current)
    );

    allTasks = nextTasks;
    toast.success(`Task "${task.name}" completed and rescheduled`);

    void recurringTaskService
      .completeTask(task)
      .catch((err) => {
        toast.error("Failed to mark task as done: " + err);
        loadTasksFromStorage("external");
      });
  }

  async function handleTaskDelay(task: Task) {
    const nextTasks = updateTaskById(allTasks, task.id, (current) =>
      recurringTaskService.buildDelayToTomorrowUpdate(current)
    );

    allTasks = nextTasks;
    toast.info(`Task "${task.name}" delayed to tomorrow`);

    void recurringTaskService
      .snoozeToTomorrow(task)
      .catch((err) => {
        toast.error("Failed to delay task: " + err);
        loadTasksFromStorage("external");
      });
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

    void taskService.saveTask(nextTask).catch((err) => {
      toast.error("Failed to save task: " + err);
      loadTasksFromStorage("external");
    });
  }

  async function handleDeleteTask(task: Task) {
    allTasks = removeTask(allTasks, task.id);
    toast.success(`Task "${task.name}" deleted`);

    void taskService.deleteTask(task.id).catch((err) => {
      toast.error("Failed to delete task: " + err);
      loadTasksFromStorage("external");
    });
  }

  async function handleToggleEnabled(task: Task) {
    const nextEnabled = !task.enabled;
    const nextTask = { ...task, enabled: nextEnabled };
    const nextTasks = updateTaskById(allTasks, task.id, () => nextTask);

    allTasks = nextTasks;
    toast.info(`Task ${nextEnabled ? "enabled" : "disabled"}`);

    void taskService.saveTask(nextTask).catch((err) => {
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
    const nextTasks = updateTaskById(allTasks, task.id, (current) =>
      recurringTaskService.buildSkipUpdate(current)
    );

    allTasks = nextTasks;
    toast.info(`Task "${task.name}" skipped to next occurrence`);

    void recurringTaskService
      .skipTask(task)
      .catch((err) => {
        toast.error("Failed to skip task: " + err);
        loadTasksFromStorage("external");
      });
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
          recurrenceEngine={recurrenceEngine}
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
