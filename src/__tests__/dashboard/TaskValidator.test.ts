/**
 * Tests for TaskValidator
 */

import { describe, it, expect } from "vitest";
import { validateTaskDraft, getFieldError } from "@/dashboard/adapters/TaskValidator";
import type { TaskDraft } from "@/dashboard/models/TaskDraft";

describe("TaskValidator", () => {
  describe("validateTaskDraft", () => {
    it("should validate a complete valid task draft", () => {
      const draft: TaskDraft = {
        name: "Valid Task",
        description: "This is a valid task",
        priority: "high",
        status: "todo",
        dueAt: "2026-02-01T10:00:00.000Z",
        recurrenceText: "every day",
      };

      const result = validateTaskDraft(draft);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject task with empty name", () => {
      const draft: TaskDraft = {
        name: "",
        status: "todo",
        dueAt: "2026-02-01T10:00:00.000Z",
        recurrenceText: "every day",
      };

      const result = validateTaskDraft(draft);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe("name");
      expect(result.errors[0].message).toBe("Task name is required");
    });

    it("should reject task with whitespace-only name", () => {
      const draft: TaskDraft = {
        name: "   ",
        status: "todo",
        dueAt: "2026-02-01T10:00:00.000Z",
        recurrenceText: "every day",
      };

      const result = validateTaskDraft(draft);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === "name")).toBe(true);
    });

    it("should reject task without due date", () => {
      const draft: TaskDraft = {
        name: "Task without due date",
        status: "todo",
        dueAt: "",
        recurrenceText: "every day",
      };

      const result = validateTaskDraft(draft);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === "dueAt")).toBe(true);
    });

    it("should reject task with invalid due date", () => {
      const draft: TaskDraft = {
        name: "Task with invalid date",
        status: "todo",
        dueAt: "not-a-date",
        recurrenceText: "every day",
      };

      const result = validateTaskDraft(draft);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === "dueAt")).toBe(true);
      expect(result.errors.find((e) => e.field === "dueAt")?.message).toBe("Invalid due date");
    });

    it("should reject task with invalid scheduled date", () => {
      const draft: TaskDraft = {
        name: "Task with invalid scheduled",
        status: "todo",
        dueAt: "2026-02-01T10:00:00.000Z",
        scheduledAt: "invalid-date",
        recurrenceText: "every day",
      };

      const result = validateTaskDraft(draft);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === "scheduledAt")).toBe(true);
    });

    it("should reject task with invalid start date", () => {
      const draft: TaskDraft = {
        name: "Task with invalid start",
        status: "todo",
        dueAt: "2026-02-01T10:00:00.000Z",
        startAt: "bad-date",
        recurrenceText: "every day",
      };

      const result = validateTaskDraft(draft);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === "startAt")).toBe(true);
    });

    it("should reject task with start date after due date", () => {
      const draft: TaskDraft = {
        name: "Task with wrong date order",
        status: "todo",
        dueAt: "2026-02-01T10:00:00.000Z",
        startAt: "2026-02-05T10:00:00.000Z",
        recurrenceText: "every day",
      };

      const result = validateTaskDraft(draft);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === "startAt")).toBe(true);
      expect(result.errors.find((e) => e.field === "startAt")?.message).toBe(
        "Start date must be before or equal to due date"
      );
    });

    it("should reject task with scheduled date after due date", () => {
      const draft: TaskDraft = {
        name: "Task with wrong scheduled date",
        status: "todo",
        dueAt: "2026-02-01T10:00:00.000Z",
        scheduledAt: "2026-02-05T10:00:00.000Z",
        recurrenceText: "every day",
      };

      const result = validateTaskDraft(draft);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === "scheduledAt")).toBe(true);
      expect(result.errors.find((e) => e.field === "scheduledAt")?.message).toBe(
        "Scheduled date must be before or equal to due date"
      );
    });

    it("should accept task with valid date ordering", () => {
      const draft: TaskDraft = {
        name: "Task with correct dates",
        status: "todo",
        dueAt: "2026-02-05T10:00:00.000Z",
        scheduledAt: "2026-02-03T10:00:00.000Z",
        startAt: "2026-02-01T10:00:00.000Z",
        recurrenceText: "every day",
      };

      const result = validateTaskDraft(draft);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject task with empty recurrence text", () => {
      const draft: TaskDraft = {
        name: "Task without recurrence",
        status: "todo",
        dueAt: "2026-02-01T10:00:00.000Z",
        recurrenceText: "",
      };

      const result = validateTaskDraft(draft);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === "recurrenceText")).toBe(true);
    });

    it("should reject task with invalid recurrence pattern", () => {
      const draft: TaskDraft = {
        name: "Task with invalid recurrence",
        status: "todo",
        dueAt: "2026-02-01T10:00:00.000Z",
        recurrenceText: "invalid recurrence pattern",
      };

      const result = validateTaskDraft(draft);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === "recurrenceText")).toBe(true);
    });

    it("should accept task with valid recurrence pattern", () => {
      const validPatterns = [
        "every day",
        "every 2 days",
        "every week",
        "every month",
        "every year",
      ];

      validPatterns.forEach((pattern) => {
        const draft: TaskDraft = {
          name: "Task with valid recurrence",
          status: "todo",
          dueAt: "2026-02-01T10:00:00.000Z",
          recurrenceText: pattern,
        };

        const result = validateTaskDraft(draft);

        expect(result.valid).toBe(true);
      });
    });

    it("should reject task that depends on itself", () => {
      const draft: TaskDraft = {
        id: "task-1",
        name: "Self-dependent task",
        status: "todo",
        dueAt: "2026-02-01T10:00:00.000Z",
        recurrenceText: "every day",
        dependsOn: ["task-1"],
      };

      const result = validateTaskDraft(draft);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === "dependsOn")).toBe(true);
      expect(result.errors.find((e) => e.field === "dependsOn")?.message).toBe(
        "Task cannot depend on itself"
      );
    });

    it("should reject task blocked by itself", () => {
      const draft: TaskDraft = {
        id: "task-2",
        name: "Self-blocked task",
        status: "todo",
        dueAt: "2026-02-01T10:00:00.000Z",
        recurrenceText: "every day",
        blockedBy: ["task-2"],
      };

      const result = validateTaskDraft(draft);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === "blockedBy")).toBe(true);
      expect(result.errors.find((e) => e.field === "blockedBy")?.message).toBe(
        "Task cannot be blocked by itself"
      );
    });

    it("should accept task with valid dependencies", () => {
      const draft: TaskDraft = {
        id: "task-1",
        name: "Task with dependencies",
        status: "todo",
        dueAt: "2026-02-01T10:00:00.000Z",
        recurrenceText: "every day",
        dependsOn: ["task-2", "task-3"],
        blockedBy: ["task-4"],
      };

      const result = validateTaskDraft(draft);

      expect(result.valid).toBe(true);
    });

    it("should accumulate multiple validation errors", () => {
      const draft: TaskDraft = {
        name: "",
        status: "todo",
        dueAt: "invalid-date",
        recurrenceText: "",
      };

      const result = validateTaskDraft(draft);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(3);
      expect(result.errors.some((e) => e.field === "name")).toBe(true);
      expect(result.errors.some((e) => e.field === "dueAt")).toBe(true);
      expect(result.errors.some((e) => e.field === "recurrenceText")).toBe(true);
    });
  });

  describe("getFieldError", () => {
    it("should return error message for specific field", () => {
      const draft: TaskDraft = {
        name: "",
        status: "todo",
        dueAt: "2026-02-01T10:00:00.000Z",
        recurrenceText: "every day",
      };

      const result = validateTaskDraft(draft);
      const nameError = getFieldError(result, "name");

      expect(nameError).toBe("Task name is required");
    });

    it("should return undefined for field without error", () => {
      const draft: TaskDraft = {
        name: "Valid Task",
        status: "todo",
        dueAt: "2026-02-01T10:00:00.000Z",
        recurrenceText: "every day",
      };

      const result = validateTaskDraft(draft);
      const nameError = getFieldError(result, "name");

      expect(nameError).toBeUndefined();
    });

    it("should return first error for field with multiple errors", () => {
      const draft: TaskDraft = {
        name: "",
        status: "todo",
        dueAt: "",
        recurrenceText: "every day",
      };

      const result = validateTaskDraft(draft);
      const dueAtError = getFieldError(result, "dueAt");

      expect(dueAtError).toBeDefined();
      expect(typeof dueAtError).toBe("string");
    });
  });
});
