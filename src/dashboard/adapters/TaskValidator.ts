/**
 * Task Validator
 * 
 * Validates task data before submission to ensure data integrity.
 */

import type { TaskDraft } from "../models/TaskDraft";
import { RecurrenceParser } from "@/core/parsers/RecurrenceParser";

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * Validate a task draft
 */
export function validateTaskDraft(draft: TaskDraft): ValidationResult {
  const errors: ValidationError[] = [];

  // Validate name (required)
  if (!draft.name || !draft.name.trim()) {
    errors.push({
      field: "name",
      message: "Task name is required",
    });
  }

  // Validate due date (required and valid)
  if (!draft.dueAt) {
    errors.push({
      field: "dueAt",
      message: "Due date is required",
    });
  } else if (Number.isNaN(new Date(draft.dueAt).getTime())) {
    errors.push({
      field: "dueAt",
      message: "Invalid due date",
    });
  }

  // Validate scheduled date (if provided, must be valid)
  if (draft.scheduledAt && Number.isNaN(new Date(draft.scheduledAt).getTime())) {
    errors.push({
      field: "scheduledAt",
      message: "Invalid scheduled date",
    });
  }

  // Validate start date (if provided, must be valid)
  if (draft.startAt && Number.isNaN(new Date(draft.startAt).getTime())) {
    errors.push({
      field: "startAt",
      message: "Invalid start date",
    });
  }

  // Validate date ordering (start <= scheduled <= due)
  if (draft.startAt && draft.dueAt) {
    const start = new Date(draft.startAt);
    const due = new Date(draft.dueAt);
    if (start > due) {
      errors.push({
        field: "startAt",
        message: "Start date must be before or equal to due date",
      });
    }
  }

  if (draft.scheduledAt && draft.dueAt) {
    const scheduled = new Date(draft.scheduledAt);
    const due = new Date(draft.dueAt);
    if (scheduled > due) {
      errors.push({
        field: "scheduledAt",
        message: "Scheduled date must be before or equal to due date",
      });
    }
  }

  // Validate recurrence text
  if (!draft.recurrenceText || !draft.recurrenceText.trim()) {
    errors.push({
      field: "recurrenceText",
      message: "Recurrence pattern is required",
    });
  } else {
    const parsed = RecurrenceParser.parse(draft.recurrenceText);
    if (!parsed.isValid || !parsed.frequency) {
      errors.push({
        field: "recurrenceText",
        message: parsed.error || "Invalid recurrence pattern",
      });
    }
  }

  // Validate dependencies (task cannot depend on itself)
  if (draft.id && draft.dependsOn && draft.dependsOn.includes(draft.id)) {
    errors.push({
      field: "dependsOn",
      message: "Task cannot depend on itself",
    });
  }

  if (draft.id && draft.blockedBy && draft.blockedBy.includes(draft.id)) {
    errors.push({
      field: "blockedBy",
      message: "Task cannot be blocked by itself",
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get error message for a specific field
 */
export function getFieldError(
  validationResult: ValidationResult,
  field: string
): string | undefined {
  const error = validationResult.errors.find((e) => e.field === field);
  return error?.message;
}
