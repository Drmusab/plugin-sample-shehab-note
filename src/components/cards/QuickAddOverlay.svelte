<script lang="ts">
  import { onMount } from "svelte";
  import type { TaskRepositoryProvider } from "@/core/storage/TaskRepository";
  import { createTask } from "@/core/models/Task";
  import { createDefaultFrequency, isValidFrequency } from "@/core/models/Frequency";
  import { toast } from "@/utils/notifications";
  import { pluginEventBus } from "@/core/events/PluginEventBus";

  interface Prefill {
    suggestedName?:  string;
    linkedBlockId?: string;
    linkedBlockContent?: string;
    suggestedTime?: string | null;
  }

  interface Props {
    repository: TaskRepositoryProvider;
    onClose: () => void;
    prefill?: Prefill;
    onAdvanced?: () => void;
  }

  let { repository, onClose, prefill, onAdvanced }: Props = $props();

  // Initialize with prefill value - it's used once at component creation
  let name = $state(prefill?.suggestedName ??  "");
  let dueAt = $state(new Date().toISOString().slice(0, 16));
  let touched = $state({ name: false, dueAt:  false });
  let isSaving = $state(false);
  let nameInput:  HTMLInputElement | null = $state(null);

  const nameError = $derived(
    touched.name && ! name.trim() ? "Task name is required." : ""
  );
  const dueAtError = $derived(
    ! touched.dueAt ?  "" : 
    ! dueAt ?  "Due date and time are required." : 
    Number. isNaN(new Date(dueAt).getTime()) ? "Enter a valid date and time." :  ""
  );
  const hasErrors = $derived(! !(nameError || dueAtError));

  onMount(() => {
    if (prefill?. suggestedTime) {
      const now = new Date();
      const [hours, minutes] = prefill. suggestedTime.split(":").map(Number);
      now.setHours(hours, minutes, 0, 0);
      dueAt = now.toISOString().slice(0, 16);
    }
    requestAnimationFrame(() => {
      nameInput?.focus();
    });
  });

  async function handleSave() {
    touched = { name: true, dueAt: true };
    if (hasErrors) {
      toast.warning("Please fill out the required fields.");
      return;
    }

    const frequency = createDefaultFrequency();
    const timeValue = dueAt. slice(11, 16);
    frequency.time = timeValue;
    if (! isValidFrequency(frequency)) {
      toast.error("Invalid frequency configuration.");
      return;
    }

    const task = createTask(name. trim(), frequency, new Date(dueAt));
    task.linkedBlockId = prefill?. linkedBlockId || undefined;
    task.linkedBlockContent = prefill?.linkedBlockContent || undefined;

    isSaving = true;
    try {
      await repository.saveTask(task);
      toast.success(`Task "${task.name}" created`);
      pluginEventBus.emit("task:refresh", undefined);
      window.dispatchEvent(new CustomEvent("recurring-task-refresh"));
      onClose();
    } catch (err) {
      toast.error("Failed to create task: " + err);
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
</script>

<div class="quick-add-overlay" onkeydown={handleKeydown} role="dialog" aria-modal="true" aria-labelledby="quick-add-title">
  <div class="quick-add-card" role="document">
    <div class="quick-add-card__header">
      <h2 id="quick-add-title">Quick Add</h2>
      <button class="quick-add-card__close" type="button" onclick={onClose} aria-label="Close">
        ✕
      </button>
    </div>

    <div class="quick-add-card__field">
      <label for="quick-task-name">Task Name *</label>
      <input
        id="quick-task-name"
        bind:this={nameInput}
        type="text"
        bind:value={name}
        placeholder="e.g. Review daily notes"
        aria-invalid={!! nameError}
        oninput={() => (touched.name = true)}
        onblur={() => (touched.name = true)}
      />
      {#if nameError}
        <div class="quick-add-card__error">{nameError}</div>
      {/if}
    </div>

    <div class="quick-add-card__field">
      <label for="quick-task-due">Due *</label>
      <input
        id="quick-task-due"
        type="datetime-local"
        bind:value={dueAt}
        aria-invalid={!!dueAtError}
        oninput={() => (touched.dueAt = true)}
        onblur={() => (touched.dueAt = true)}
      />
      {#if dueAtError}
        <div class="quick-add-card__error">{dueAtError}</div>
      {/if}
    </div>

    {#if prefill?.linkedBlockId}
      <div class="quick-add-card__linked">
        Linked block: <span>{prefill.linkedBlockId}</span>
      </div>
    {/if}

    <div class="quick-add-card__actions">
      <button class="quick-add-card__cancel" type="button" onclick={onClose}>
        Cancel
      </button>
      {#if onAdvanced}
        <button class="quick-add-card__advanced" type="button" onclick={onAdvanced}>
          Advanced... 
        </button>
      {/if}
      <button class="quick-add-card__save" type="button" onclick={handleSave} disabled={isSaving}>
        {isSaving ?  "Saving…" : "Create Task"}
      </button>
    </div>

    <p class="quick-add-card__hint">Tip: Press ⌘/Ctrl + Enter to save. </p>
  </div>
</div>

<style>
  .quick-add-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.45);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10001;
    padding: 20px;
  }

  .quick-add-card {
    width: min(420px, 100%);
    background: var(--b3-theme-surface);
    border-radius: 12px;
    padding: 20px;
    box-shadow:  0 8px 30px rgba(0, 0, 0, 0.25);
  }

  .quick-add-card__header {
    display:  flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
  }

  .quick-add-card__header h2 {
    margin: 0;
    font-size: 18px;
    color: var(--b3-theme-on-surface);
  }

  .quick-add-card__close {
    border: none;
    background: transparent;
    color: var(--b3-theme-on-surface);
    cursor: pointer;
    font-size: 16px;
  }

  .quick-add-card__field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 14px;
    font-size: 14px;
    color: var(--b3-theme-on-surface);
  }

  .quick-add-card__field input {
    padding: 8px 12px;
    border-radius: 6px;
    border: 1px solid var(--b3-border-color);
    background: var(--b3-theme-background);
    color: var(--b3-theme-on-background);
  }

  .quick-add-card__field input:focus {
    outline: none;
    border-color: var(--b3-theme-primary);
  }

  .quick-add-card__error {
    font-size: 12px;
    color: var(--b3-theme-error);
  }

  .quick-add-card__linked {
    font-size: 12px;
    color: var(--b3-theme-on-surface-light);
    margin-bottom: 14px;
  }

  .quick-add-card__linked span {
    color: var(--b3-theme-on-surface);
  }

  .quick-add-card__actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
  }

  .quick-add-card__cancel {
    padding: 8px 14px;
    border-radius:  6px;
    border:  1px solid var(--b3-border-color);
    background: var(--b3-theme-surface-lighter);
    color: var(--b3-theme-on-surface);
    cursor: pointer;
  }

  .quick-add-card__advanced {
    padding: 8px 14px;
    border-radius: 6px;
    border: 1px solid var(--b3-border-color);
    background: var(--b3-theme-surface);
    color: var(--b3-theme-primary);
    cursor: pointer;
  }

  .quick-add-card__advanced:hover {
    background: var(--b3-theme-surface-lighter);
  }

  .quick-add-card__save {
    padding: 8px 14px;
    border-radius:  6px;
    border:  none;
    background: var(--b3-theme-primary);
    color: white;
    cursor: pointer;
  }

  .quick-add-card__save:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .quick-add-card__hint {
    margin-top: 14px;
    font-size:  12px;
    color: var(--b3-theme-on-surface-light);
  }
</style>
