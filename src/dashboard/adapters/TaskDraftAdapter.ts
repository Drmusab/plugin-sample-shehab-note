/**
 * Task Draft Adapter
 * 
 * Converts between UI state (TaskDraft) and business model (Task).
 * This adapter layer ensures separation of concerns between the presentation
 * and business logic layers.
 */

import type { Task, TaskPriority } from "@/core/models/Task";
import type { TaskDraft } from "../models/TaskDraft";
import { RecurrenceParser } from "@/core/parsers/RecurrenceParser";

/**
 * Convert a Task (business model) to TaskDraft (UI model)
 */
export function taskToTaskDraft(task: Task): TaskDraft {
  return {
    id: task.id,
    name: task.name,
    description: task.description,
    priority: normalizePriorityToUI(task.priority),
    status: task.status || "todo",
    dueAt: task.dueAt,
    scheduledAt: task.scheduledAt,
    startAt: task.startAt,
    recurrenceText: task.recurrenceText || RecurrenceParser.stringify(task.frequency),
    whenDone: task.whenDone,
    blockedBy: task.blockedBy,
    dependsOn: task.dependsOn,
    tags: task.tags,
  };
}

/**
 * Convert a TaskDraft (UI model) to Task data (business model)
 * Note: This returns partial Task data that should be merged with existing task or defaults
 */
export function taskDraftToTask(draft: TaskDraft): Partial<Task> {
  const parsed = RecurrenceParser.parse(draft.recurrenceText);
  const frequency = parsed.frequency;
  
  return {
    id: draft.id,
    name: draft.name,
    description: draft.description,
    priority: normalizePriorityFromUI(draft.priority),
    status: draft.status,
    dueAt: draft.dueAt,
    scheduledAt: draft.scheduledAt,
    startAt: draft.startAt,
    recurrenceText: draft.recurrenceText,
    frequency: frequency || undefined,
    whenDone: draft.whenDone,
    blockedBy: draft.blockedBy,
    dependsOn: draft.dependsOn,
    tags: draft.tags,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Normalize priority from business model to UI model
 */
function normalizePriorityToUI(
  priority?: TaskPriority
): "lowest" | "low" | "normal" | "medium" | "high" | "highest" {
  if (!priority) {
    return "normal";
  }
  
  // Map number priorities to string priorities
  const priorityMap: Record<number, "lowest" | "low" | "normal" | "medium" | "high" | "highest"> = {
    0: "lowest",
    1: "low",
    2: "normal",
    3: "medium",
    4: "high",
    5: "highest",
  };

  if (typeof priority === "number") {
    return priorityMap[priority] || "normal";
  }

  return priority as "lowest" | "low" | "normal" | "medium" | "high" | "highest";
}

/**
 * Normalize priority from UI model to business model
 */
function normalizePriorityFromUI(
  priority?: "lowest" | "low" | "normal" | "medium" | "high" | "highest"
): TaskPriority {
  return priority || "normal";
}
