<script lang="ts">
  import type { Task } from "@/core/models/Task";
  import type { Frequency, FrequencyType } from "@/core/models/Frequency";
  import { createTask } from "@/core/models/Task";
  import { WEEKDAY_NAMES } from "@/utils/constants";
  import { toast } from "@/utils/notifications";

  interface Props {
    task?: Task;
    onSave: (task: Task) => void;
    onCancel: () => void;
  }

  let { task, onSave, onCancel }: Props = $props();

  // Form state - initialize from task prop
  const isEditing = $derived(!!task);
  
  let name = $state("");
  let dueAt = $state("");
  let frequencyType = $state<FrequencyType>("daily");
  let interval = $state(1);
  let time = $state("09:00");
  let weekdays = $state<number[]>([]);
  let dayOfMonth = $state(1);
  let enabled = $state(true);
  let linkedBlockId = $state("");
  let priority = $state<"low" | "normal" | "high">("normal");
  let tags = $state("");
  let touched = $state({
    name: false,
    dueAt: false,
    weekdays: false,
    dayOfMonth: false,
  });

  const nameError = $derived(() =>
    touched.name && !name.trim() ? "Task name is required." : ""
  );
  const dueAtError = $derived(() => {
    if (!touched.dueAt) {
      return "";
    }
    if (!dueAt) {
      return "Due date and time are required.";
    }
    const parsed = new Date(dueAt);
    return Number.isNaN(parsed.getTime()) ? "Enter a valid date and time." : "";
  });
  const weekdaysError = $derived(() =>
    touched.weekdays && frequencyType === "weekly" && weekdays.length === 0
      ? "Select at least one weekday."
      : ""
  );
  const dayOfMonthError = $derived(() =>
    touched.dayOfMonth && frequencyType === "monthly" && (dayOfMonth < 1 || dayOfMonth > 31)
      ? "Day of month must be between 1 and 31."
      : ""
  );
  const hasErrors = $derived(
    () => !!(nameError || dueAtError || weekdaysError || dayOfMonthError)
  );

  // Initialize form from task
  $effect(() => {
    if (task) {
      name = task.name || "";
      dueAt = task.dueAt
        ? new Date(task.dueAt).toISOString().slice(0, 16)
        : new Date().toISOString().slice(0, 16);
      frequencyType = task.frequency.type || "daily";
      interval = task.frequency.interval || 1;
      time = task.frequency.time || "09:00";
      weekdays = task.frequency.type === "weekly" ? task.frequency.weekdays : [];
      dayOfMonth =
        task.frequency.type === "monthly"
          ? task.frequency.dayOfMonth
          : new Date(task.dueAt).getDate();
      enabled = task.enabled ?? true;
      linkedBlockId = task.linkedBlockId || "";
      priority = task.priority || "normal";
      tags = task.tags ? task.tags.join(", ") : "";
      touched = {
        name: false,
        dueAt: false,
        weekdays: false,
        dayOfMonth: false,
      };
    } else {
      // Reset for new task
      name = "";
      dueAt = new Date().toISOString().slice(0, 16);
      frequencyType = "daily";
      interval = 1;
      time = "09:00";
      weekdays = [];
      dayOfMonth = new Date().getDate();
      enabled = true;
      linkedBlockId = "";
      priority = "normal";
      tags = "";
      touched = {
        name: false,
        dueAt: false,
        weekdays: false,
        dayOfMonth: false,
      };
    }
  });

  function handleSave() {
    touched = {
      name: true,
      dueAt: true,
      weekdays: true,
      dayOfMonth: true,
    };

    if (hasErrors) {
      toast.warning("Please fix the highlighted fields.");
      return;
    }

    let frequency: Frequency;
    if (frequencyType === "weekly") {
      frequency = {
        type: "weekly",
        interval,
        time,
        weekdays,
      };
    } else if (frequencyType === "monthly") {
      frequency = {
        type: "monthly",
        interval,
        time,
        dayOfMonth,
      };
    } else {
      frequency = {
        type: "daily",
        interval,
        time,
      };
    }

    const taskData: Task = task
      ? {
          ...task,
          name: name.trim(),
          dueAt: new Date(dueAt).toISOString(),
          frequency,
          enabled,
          linkedBlockId: linkedBlockId.trim() || undefined,
          priority,
          tags: tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
          updatedAt: new Date().toISOString(),
        }
      : createTask(name.trim(), frequency, new Date(dueAt));

    if (!task) {
      taskData.enabled = enabled;
      taskData.linkedBlockId = linkedBlockId.trim() || undefined;
      taskData.priority = priority;
      taskData.tags = tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
    }

    onSave(taskData);
  }

  function toggleWeekday(day: number) {
    touched.weekdays = true;
    if (weekdays.includes(day)) {
      weekdays = weekdays.filter((d) => d !== day);
    } else {
      weekdays = [...weekdays, day].sort();
    }
  }

  const weekdayNames = WEEKDAY_NAMES;
  const weekdayLabels = ["M", "T", "W", "T", "F", "S", "S"];
</script>

<div class="task-form">
  <h2 class="task-form__title">
    {isEditing ? "Edit Task" : "Create New Task"}
  </h2>

  <div class="task-form__field">
    <label class="task-form__label" for="task-name">Task Name *</label>
    <input
      id="task-name"
      class="task-form__input"
      type="text"
      bind:value={name}
      placeholder="Enter task name"
      aria-invalid={!!nameError}
      aria-describedby="task-name-error"
      oninput={() => (touched.name = true)}
      onblur={() => (touched.name = true)}
    />
    {#if nameError}
      <div class="task-form__error" id="task-name-error">{nameError}</div>
    {/if}
  </div>

  <div class="task-form__field">
    <label class="task-form__label" for="task-due">Due Date & Time *</label>
    <input
      id="task-due"
      class="task-form__input"
      type="datetime-local"
      bind:value={dueAt}
      aria-invalid={!!dueAtError}
      aria-describedby="task-due-error"
      oninput={() => (touched.dueAt = true)}
      onblur={() => (touched.dueAt = true)}
    />
    {#if dueAtError}
      <div class="task-form__error" id="task-due-error">{dueAtError}</div>
    {/if}
  </div>

  <div class="task-form__field">
    <label class="task-form__label" for="frequency-type">Frequency Type</label>
    <select id="frequency-type" class="task-form__select" bind:value={frequencyType}>
      <option value="daily">Daily</option>
      <option value="weekly">Weekly</option>
      <option value="monthly">Monthly</option>
    </select>
  </div>

  <div class="task-form__field">
    <label class="task-form__label" for="task-interval">
      Repeat Every (interval)
    </label>
    <input
      id="task-interval"
      class="task-form__input"
      type="number"
      min="1"
      bind:value={interval}
    />
  </div>

  <div class="task-form__field">
    <label class="task-form__label" for="task-time">Time (HH:mm)</label>
    <input
      id="task-time"
      class="task-form__input"
      type="time"
      bind:value={time}
    />
  </div>

  {#if frequencyType === "weekly"}
    <div class="task-form__field">
      <label class="task-form__label" for="weekdays-group">Weekdays</label>
      <div id="weekdays-group" class="task-form__weekdays" role="group" aria-label="Select weekdays">
        {#each weekdayNames as day, index}
          <button
            class="task-form__weekday {weekdays.includes(index)
              ? 'task-form__weekday--active'
              : 'task-form__weekday--inactive'}"
            onclick={() => toggleWeekday(index)}
            onblur={() => (touched.weekdays = true)}
            type="button"
            aria-pressed={weekdays.includes(index)}
            aria-label={day}
          >
            {weekdayLabels[index]}
          </button>
        {/each}
      </div>
      {#if weekdaysError}
        <div class="task-form__error">{weekdaysError}</div>
      {/if}
    </div>
  {/if}

  {#if frequencyType === "monthly"}
    <div class="task-form__field">
      <label class="task-form__label" for="day-of-month">Day of Month</label>
      <input
        id="day-of-month"
        class="task-form__input"
        type="number"
        min="1"
        max="31"
        bind:value={dayOfMonth}
        aria-invalid={!!dayOfMonthError}
        aria-describedby="task-day-error"
        oninput={() => (touched.dayOfMonth = true)}
        onblur={() => (touched.dayOfMonth = true)}
      />
      {#if dayOfMonthError}
        <div class="task-form__error" id="task-day-error">{dayOfMonthError}</div>
      {/if}
    </div>
  {/if}

  <div class="task-form__field">
    <label class="task-form__checkbox">
      <input type="checkbox" bind:checked={enabled} />
      <span>Enabled</span>
    </label>
  </div>

  <div class="task-form__section">
    <h3 class="task-form__section-title">Routing Metadata</h3>

    <div class="task-form__field">
      <label class="task-form__label" for="task-block">Linked Block ID</label>
      <input
        id="task-block"
        class="task-form__input"
        type="text"
        bind:value={linkedBlockId}
        placeholder="20260112101010-abcdef"
      />
    </div>

    <div class="task-form__field">
      <label class="task-form__label" for="task-priority">Priority</label>
      <select id="task-priority" class="task-form__select" bind:value={priority}>
        <option value="low">Low</option>
        <option value="normal">Normal</option>
        <option value="high">High</option>
      </select>
    </div>

    <div class="task-form__field">
      <label class="task-form__label" for="task-tags">Tags</label>
      <input
        id="task-tags"
        class="task-form__input"
        type="text"
        bind:value={tags}
        placeholder="health, habit"
      />
    </div>
  </div>

  <div class="task-form__actions">
    <button class="task-form__button task-form__button--cancel" onclick={onCancel}>
      Cancel
    </button>
    <button class="task-form__button task-form__button--save" onclick={handleSave}>
      Save Task
    </button>
  </div>
</div>

<style>
  .task-form {
    background: var(--b3-theme-surface);
    border-radius: 8px;
    padding: 24px;
    max-width: 600px;
  }

  .task-form__title {
    margin: 0 0 24px 0;
    font-size: 20px;
    font-weight: 600;
    color: var(--b3-theme-on-surface);
  }

  .task-form__field {
    margin-bottom: 16px;
  }

  .task-form__label {
    display: block;
    margin-bottom: 6px;
    font-size: 14px;
    font-weight: 500;
    color: var(--b3-theme-on-surface);
  }

  .task-form__input,
  .task-form__select,
  .task-form__textarea {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid var(--b3-border-color);
    border-radius: 6px;
    font-size: 14px;
    background: var(--b3-theme-background);
    color: var(--b3-theme-on-background);
    box-sizing: border-box;
  }

  .task-form__input:focus,
  .task-form__select:focus,
  .task-form__textarea:focus {
    outline: none;
    border-color: var(--b3-theme-primary);
  }

  .task-form__error {
    margin-top: 6px;
    font-size: 12px;
    color: var(--b3-theme-error);
  }

  .task-form__textarea {
    resize: vertical;
    font-family: inherit;
  }

  .task-form__checkbox {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
  }

  .task-form__checkbox input {
    cursor: pointer;
  }

  .task-form__weekdays {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .task-form__weekday {
    padding: 8px 12px;
    border: 1px solid var(--b3-border-color);
    border-radius: 6px;
    background: var(--b3-theme-background);
    color: var(--b3-theme-on-background);
    cursor: pointer;
    transition: all 0.2s;
    min-width: 36px;
    text-align: center;
  }

  .task-form__weekday--active {
    background: var(--b3-theme-primary);
    color: white;
    border-color: var(--b3-theme-primary);
  }

  .task-form__weekday--inactive {
    background: var(--b3-theme-surface-lighter);
    color: var(--b3-theme-on-surface);
  }

  .task-form__section {
    margin-top: 24px;
    padding-top: 24px;
    border-top: 1px solid var(--b3-border-color);
  }

  .task-form__section-title {
    margin: 0 0 16px 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--b3-theme-on-surface);
  }

  .task-form__actions {
    display: flex;
    gap: 12px;
    margin-top: 24px;
    justify-content: flex-end;
  }

  .task-form__button {
    padding: 10px 20px;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .task-form__button--cancel {
    background: var(--b3-theme-surface-lighter);
    color: var(--b3-theme-on-surface);
  }

  .task-form__button--cancel:hover {
    background: var(--b3-theme-surface-light);
  }

  .task-form__button--save {
    background: var(--b3-theme-primary);
    color: white;
  }

  .task-form__button--save:hover {
    background: var(--b3-theme-primary-light);
  }
</style>
