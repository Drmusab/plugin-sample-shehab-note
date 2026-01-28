/**
 * @deprecated This model is DEPRECATED in favor of EditableTask from Obsidian-Tasks
 * 
 * The dashboard now uses the vendored Obsidian-Tasks UI components, which work with
 * the EditableTask model instead of TaskDraft. This interface is kept for backward
 * compatibility with any legacy code that may still reference it.
 * 
 * Migration path:
 * - Use EditableTask from @/vendor/obsidian-tasks/ui/EditableTask.ts
 * - Use TaskDraftAdapter from @/adapters/TaskDraftAdapter.ts for conversions
 * - EditableTask provides richer functionality and Obsidian-Tasks compatibility
 * 
 * @see {@link /src/vendor/obsidian-tasks/ui/EditableTask.ts} - Current UI model
 * @see {@link /src/adapters/TaskDraftAdapter.ts} - Adapter for EditableTask ↔ RecurringTask
 * 
 * ---
 * 
 * Task Draft Interface (LEGACY)
 * 
 * Minimal interface representing task data as used by the UI layer.
 * This is a simplified view of the Task model for form editing.
 */

export interface TaskDraft {
  /** Task identifier (undefined for new tasks) */
  id?: string;

  /** Task title/description */
  name: string;

  /** Task description/notes */
  description?: string;

  /** Priority level */
  priority?: "lowest" | "low" | "normal" | "medium" | "high" | "highest";

  /** Task status */
  status: "todo" | "done" | "cancelled";

  /** Due date (ISO string) */
  dueAt: string;

  /** Scheduled date - when to start working (ISO string) */
  scheduledAt?: string;

  /** Start date - earliest start date (ISO string) */
  startAt?: string;

  /** Human-readable recurrence text */
  recurrenceText: string;

  /** Calculate next recurrence from completion date */
  whenDone?: boolean;

  /** Task IDs this task is blocked by */
  blockedBy?: string[];

  /** Task IDs this task depends on */
  dependsOn?: string[];

  /** Tags for categorization */
  tags?: string[];
}
