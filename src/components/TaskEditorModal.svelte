<script lang="ts">
  import { onMount } from "svelte";
  import type { Task, TaskPriority } from "@/core/models/Task";
  import { createTask } from "@/core/models/Task";
  import type { TaskRepositoryProvider } from "@/core/storage/TaskRepository";
  import type { Frequency } from "@/core/models/Frequency";
  import { createDefaultFrequency } from "@/core/models/Frequency";
  import { RecurrenceParser } from "@/core/parsers/RecurrenceParser";
  import { toast } from "@/utils/notifications";
  import PrioritySelector from "./ui/PrioritySelector.svelte";
  import StatusSelector from "./ui/StatusSelector.svelte";
  import RecurrenceInput from "./ui/RecurrenceInput.svelte";
  import DependencyPicker from "./ui/DependencyPicker.svelte";

  const DEFAULT_RECURRENCE_TEXT = "every day";
  const LABEL_BLOCKED_BY = "Blocked by (tasks that must complete first)";
  const LABEL_BLOCKS = "Blocks (tasks that depend on this)";

  interface Props {
    repository: TaskRepositoryProvider;
    task?: Task;
    onClose: () => void;
    onSave?: (task: Task) => void;
  }

  let { repository, task, onClose, onSave }: Props = $props();

  const isNew = !task;
  
  // Form state
  let name = $state(task?.name || "");
  let description = $state(task?.description || "");
  let priority = $state<TaskPriority>(task?.priority || "normal");
  let status = $state<"todo" | "done" | "cancelled">(task?.status || "todo");
  let dueAt = $state(task?.dueAt ? new Date(task.dueAt).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16));
  let scheduledAt = $state(task?.scheduledAt ? new Date(task.scheduledAt).toISOString().slice(0, 16) : "");
  let startAt = $state(task?.startAt ? new Date(task.startAt).toISOString().slice(0, 16) : "");
  let recurrenceText = $state(task?.recurrenceText || (task?.frequency ? RecurrenceParser.stringify(task.frequency) : DEFAULT_RECURRENCE_TEXT));
  let recurrenceFrequency = $state<Frequency | null>(task?.frequency || null);
  let recurrenceValid = $state(true);
  let blockedBy = $state<string[]>(task?.blockedBy || []);
  let dependsOn = $state<string[]>(task?.dependsOn || []);
  
  let touched = $state({
    name: false,
    dueAt: false,
    recurrence: false,
  });

  let isSaving = $state(false);
  let nameInput: HTMLInputElement | null = $state(null);

  // Validation
  const nameError = $derived(
    touched.name && !name.trim() ? "Task name is required" : ""
  );

  const dueAtError = $derived(
    !touched.dueAt ? "" :
    !dueAt ? "Due date is required" :
    Number.isNaN(new Date(dueAt).getTime()) ? "Invalid due date" : ""
  );

  const recurrenceError = $derived(
    touched.recurrence && !recurrenceValid ? "Invalid recurrence pattern" : ""
  );

  const hasErrors = $derived(!!(nameError || dueAtError || recurrenceError));

  onMount(() => {
    requestAnimationFrame(() => {
      nameInput?.focus();
    });
  });

  function handleRecurrenceChange(text: string, frequency: Frequency | null, isValid: boolean) {
    recurrenceText = text;
    recurrenceFrequency = frequency;
    recurrenceValid = isValid;
    touched.recurrence = true;
  }

  function handlePriorityChange(newPriority: TaskPriority) {
    priority = newPriority;
  }

  function handleStatusChange(newStatus: "todo" | "done" | "cancelled") {
    status = newStatus;
  }

  function handleBlockedByChange(selected: string[]) {
    blockedBy = selected;
  }

  function handleDependsOnChange(selected: string[]) {
    dependsOn = selected;
  }

  async function handleSave() {
    touched = { name: true, dueAt: true, recurrence: true };

    if (hasErrors) {
      toast.warning("Please fix validation errors");
      return;
    }

    if (!recurrenceFrequency) {
      toast.error("Invalid recurrence pattern");
      return;
    }

    isSaving = true;

    try {
      let savedTask: Task;
      
      if (isNew) {
        // Create new task
        savedTask = createTask(name.trim(), recurrenceFrequency, new Date(dueAt));
      } else {
        // Update existing task
        savedTask = { ...task! };
        savedTask.name = name.trim();
        savedTask.frequency = recurrenceFrequency;
        savedTask.dueAt = new Date(dueAt).toISOString();
      }

      // Update all fields
      savedTask.description = description.trim() || undefined;
      savedTask.priority = priority;
      savedTask.status = status;
      savedTask.recurrenceText = recurrenceText;
      savedTask.scheduledAt = scheduledAt ? new Date(scheduledAt).toISOString() : undefined;
      savedTask.startAt = startAt ? new Date(startAt).toISOString() : undefined;
      savedTask.blockedBy = blockedBy.length > 0 ? blockedBy : undefined;
      savedTask.dependsOn = dependsOn.length > 0 ? dependsOn : undefined;
      savedTask.updatedAt = new Date().toISOString();

      // Handle status transitions
      if (status === "done" && !savedTask.lastCompletedAt) {
        savedTask.lastCompletedAt = new Date().toISOString();
      }
      if (status === "cancelled" && !savedTask.cancelledAt) {
        savedTask.cancelledAt = new Date().toISOString();
      }

      await repository.saveTask(savedTask);
      
      if (onSave) {
        onSave(savedTask);
      }

      toast.success(`Task "${savedTask.name}" ${isNew ? "created" : "updated"}`);
      window.dispatchEvent(new CustomEvent("recurring-task-refresh"));
      onClose();
    } catch (err) {
      toast.error(`Failed to save task: ${err}`);
    } finally {
      isSaving = false;
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      onClose();
    }
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      void handleSave();
    }
  }

  // Format timestamps for display
  function formatTimestamp(isoString?: string): string {
    if (!isoString) return "—";
    return new Date(isoString).toLocaleString();
  }
</script>

<div
  class="task-editor-overlay"
  onkeydown={handleKeydown}
  role="dialog"
  aria-modal="true"
  aria-labelledby="task-editor-title"
  tabindex="-1"
>
  <div class="task-editor-modal" role="document">
    <div class="task-editor__header">
      <h2 id="task-editor-title">{isNew ? "Create Task" : "Edit Task"}</h2>
      <button
        class="task-editor__close"
        type="button"
        onclick={onClose}
        aria-label="Close"
      >
        ✕
      </button>
    </div>

    <div class="task-editor__body">
      <!-- Task Name -->
      <div class="task-editor__field">
        <label for="task-name">Description *</label>
        <input
          id="task-name"
          bind:this={nameInput}
          type="text"
          bind:value={name}
          placeholder="Task name"
          aria-invalid={!!nameError}
          oninput={() => (touched.name = true)}
          onblur={() => (touched.name = true)}
        />
        {#if nameError}
          <div class="task-editor__error">{nameError}</div>
        {/if}
      </div>

      <!-- Notes/Description -->
      <div class="task-editor__field">
        <label for="task-description">Notes</label>
        <textarea
          id="task-description"
          bind:value={description}
          placeholder="Additional details about this task..."
          rows="3"
        ></textarea>
      </div>

      <!-- Priority -->
      <div class="task-editor__field">
        <label>Priority</label>
        <PrioritySelector value={priority} onchange={handlePriorityChange} />
      </div>

      <!-- Status -->
      <div class="task-editor__field">
        <label>Status</label>
        <StatusSelector value={status} onchange={handleStatusChange} />
      </div>

      <!-- Due Date -->
      <div class="task-editor__field">
        <label for="task-due">Due Date *</label>
        <input
          id="task-due"
          type="datetime-local"
          bind:value={dueAt}
          aria-invalid={!!dueAtError}
          oninput={() => (touched.dueAt = true)}
          onblur={() => (touched.dueAt = true)}
        />
        {#if dueAtError}
          <div class="task-editor__error">{dueAtError}</div>
        {/if}
      </div>

      <!-- Scheduled Date -->
      <div class="task-editor__field">
        <label for="task-scheduled">Scheduled Date</label>
        <input
          id="task-scheduled"
          type="datetime-local"
          bind:value={scheduledAt}
        />
        <div class="task-editor__hint">When you plan to start working on this task</div>
      </div>

      <!-- Start Date -->
      <div class="task-editor__field">
        <label for="task-start">Start Date</label>
        <input
          id="task-start"
          type="datetime-local"
          bind:value={startAt}
        />
        <div class="task-editor__hint">Earliest date this task can begin</div>
      </div>

      <!-- Recurrence -->
      <div class="task-editor__field">
        <label for="task-recurrence">Recurrence</label>
        <RecurrenceInput
          value={recurrenceText}
          onchange={handleRecurrenceChange}
          showPreview={true}
        />
        {#if recurrenceError}
          <div class="task-editor__error">{recurrenceError}</div>
        {/if}
      </div>

      <!-- Blocked By -->
      <div class="task-editor__field">
        <DependencyPicker
          {repository}
          selected={blockedBy}
          excludeId={task?.id}
          onchange={handleBlockedByChange}
          label={LABEL_BLOCKED_BY}
        />
      </div>

      <!-- Depends On -->
      <div class="task-editor__field">
        <DependencyPicker
          {repository}
          selected={dependsOn}
          excludeId={task?.id}
          onchange={handleDependsOnChange}
          label={LABEL_BLOCKS}
        />
      </div>

      <!-- Timestamps -->
      <div class="task-editor__timestamps">
        <div class="task-editor__timestamp">
          <span class="task-editor__timestamp-label">Created:</span>
          <span class="task-editor__timestamp-value">{formatTimestamp(task?.createdAt)}</span>
        </div>
        {#if task?.lastCompletedAt}
          <div class="task-editor__timestamp">
            <span class="task-editor__timestamp-label">Completed:</span>
            <span class="task-editor__timestamp-value">{formatTimestamp(task.lastCompletedAt)}</span>
          </div>
        {/if}
        {#if task?.cancelledAt}
          <div class="task-editor__timestamp">
            <span class="task-editor__timestamp-label">Cancelled:</span>
            <span class="task-editor__timestamp-value">{formatTimestamp(task.cancelledAt)}</span>
          </div>
        {/if}
        {#if task?.linkedBlockId}
          <div class="task-editor__timestamp">
            <span class="task-editor__timestamp-label">Linked block:</span>
            <span class="task-editor__timestamp-value">{task.linkedBlockId}</span>
          </div>
        {/if}
      </div>
    </div>

    <div class="task-editor__footer">
      <button
        class="task-editor__cancel"
        type="button"
        onclick={onClose}
      >
        Cancel
      </button>
      <button
        class="task-editor__save"
        type="button"
        onclick={handleSave}
        disabled={isSaving}
      >
        {isSaving ? "Saving..." : isNew ? "Create Task" : "Save Changes"}
      </button>
    </div>

    <div class="task-editor__hint-footer">
      💡 Press <kbd>Esc</kbd> to close, <kbd>⌘/Ctrl+Enter</kbd> to save
    </div>
  </div>
</div>

<style>
  .task-editor-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    padding: 20px;
    overflow-y: auto;
  }

  .task-editor-modal {
    width: min(560px, 100%);
    max-height: 90vh;
    background: var(--b3-theme-surface);
    border-radius: 12px;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.3);
    display: flex;
    flex-direction: column;
  }

  .task-editor__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px;
    border-bottom: 1px solid var(--b3-border-color);
  }

  .task-editor__header h2 {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
    color: var(--b3-theme-on-surface);
  }

  .task-editor__close {
    border: none;
    background: transparent;
    color: var(--b3-theme-on-surface);
    cursor: pointer;
    font-size: 20px;
    padding: 4px;
    line-height: 1;
    opacity: 0.7;
    transition: opacity 0.2s;
  }

  .task-editor__close:hover {
    opacity: 1;
  }

  .task-editor__body {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .task-editor__field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .task-editor__field label {
    font-size: 14px;
    font-weight: 500;
    color: var(--b3-theme-on-surface);
  }

  .task-editor__field input[type="text"],
  .task-editor__field input[type="datetime-local"],
  .task-editor__field textarea {
    width: 100%;
    padding: 8px 12px;
    border-radius: 6px;
    border: 1px solid var(--b3-border-color);
    background: var(--b3-theme-background);
    color: var(--b3-theme-on-background);
    font-size: 14px;
    font-family: inherit;
  }

  .task-editor__field textarea {
    resize: vertical;
  }

  .task-editor__field input:focus,
  .task-editor__field textarea:focus {
    outline: none;
    border-color: var(--b3-theme-primary);
  }

  .task-editor__error {
    font-size: 12px;
    color: var(--b3-theme-error, #ff4444);
  }

  .task-editor__hint {
    font-size: 12px;
    color: var(--b3-theme-on-surface-light);
  }

  .task-editor__timestamps {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 12px;
    background: var(--b3-theme-surface-lighter);
    border-radius: 6px;
    font-size: 12px;
  }

  .task-editor__timestamp {
    display: flex;
    justify-content: space-between;
  }

  .task-editor__timestamp-label {
    font-weight: 500;
    color: var(--b3-theme-on-surface);
  }

  .task-editor__timestamp-value {
    color: var(--b3-theme-on-surface-light);
  }

  .task-editor__footer {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    padding: 16px 20px;
    border-top: 1px solid var(--b3-border-color);
  }

  .task-editor__cancel {
    padding: 10px 20px;
    border-radius: 6px;
    border: 1px solid var(--b3-border-color);
    background: var(--b3-theme-surface-lighter);
    color: var(--b3-theme-on-surface);
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    transition: background 0.2s;
  }

  .task-editor__cancel:hover {
    background: var(--b3-theme-surface-light);
  }

  .task-editor__save {
    padding: 10px 20px;
    border-radius: 6px;
    border: none;
    background: var(--b3-theme-primary);
    color: white;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    transition: opacity 0.2s;
  }

  .task-editor__save:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .task-editor__save:hover:not(:disabled) {
    opacity: 0.9;
  }

  .task-editor__hint-footer {
    padding: 12px 20px;
    text-align: center;
    font-size: 12px;
    color: var(--b3-theme-on-surface-light);
    border-top: 1px solid var(--b3-border-color);
  }

  .task-editor__hint-footer kbd {
    padding: 2px 6px;
    border-radius: 3px;
    background: var(--b3-theme-surface-lighter);
    border: 1px solid var(--b3-border-color);
    font-family: monospace;
    font-size: 11px;
  }
</style>
