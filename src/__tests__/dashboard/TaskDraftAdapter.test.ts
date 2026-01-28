/**
 * Tests for TaskDraftAdapter
 */

import { describe, it, expect } from "vitest";
import { taskToTaskDraft, taskDraftToTask } from "@/dashboard/adapters/TaskDraftAdapter";
import type { Task } from "@/core/models/Task";
import type { TaskDraft } from "@/dashboard/models/TaskDraft";
import type { Frequency } from "@/core/models/Frequency";

describe("TaskDraftAdapter", () => {
  describe("taskToTaskDraft", () => {
    it("should convert basic task to task draft", () => {
      const task: Task = {
        id: "task-1",
        name: "Test Task",
        description: "Test description",
        priority: "high",
        status: "todo",
        dueAt: "2026-02-01T10:00:00.000Z",
        frequency: { type: "daily", interval: 1 },
        enabled: true,
        createdAt: "2026-01-28T00:00:00.000Z",
        updatedAt: "2026-01-28T00:00:00.000Z",
      };

      const draft = taskToTaskDraft(task);

      expect(draft.id).toBe("task-1");
      expect(draft.name).toBe("Test Task");
      expect(draft.description).toBe("Test description");
      expect(draft.priority).toBe("high");
      expect(draft.status).toBe("todo");
      expect(draft.dueAt).toBe("2026-02-01T10:00:00.000Z");
    });

    it("should handle task without optional fields", () => {
      const task: Task = {
        id: "task-2",
        name: "Minimal Task",
        dueAt: "2026-02-01T10:00:00.000Z",
        frequency: { type: "daily", interval: 1 },
        enabled: true,
        createdAt: "2026-01-28T00:00:00.000Z",
        updatedAt: "2026-01-28T00:00:00.000Z",
      };

      const draft = taskToTaskDraft(task);

      expect(draft.id).toBe("task-2");
      expect(draft.name).toBe("Minimal Task");
      expect(draft.description).toBeUndefined();
      expect(draft.priority).toBe("normal"); // Default
      expect(draft.status).toBe("todo"); // Default
    });

    it("should convert scheduled and start dates", () => {
      const task: Task = {
        id: "task-3",
        name: "Task with dates",
        dueAt: "2026-02-03T10:00:00.000Z",
        scheduledAt: "2026-02-02T10:00:00.000Z",
        startAt: "2026-02-01T10:00:00.000Z",
        frequency: { type: "daily", interval: 1 },
        enabled: true,
        createdAt: "2026-01-28T00:00:00.000Z",
        updatedAt: "2026-01-28T00:00:00.000Z",
      };

      const draft = taskToTaskDraft(task);

      expect(draft.scheduledAt).toBe("2026-02-02T10:00:00.000Z");
      expect(draft.startAt).toBe("2026-02-01T10:00:00.000Z");
    });

    it("should convert dependencies", () => {
      const task: Task = {
        id: "task-4",
        name: "Dependent Task",
        dueAt: "2026-02-01T10:00:00.000Z",
        frequency: { type: "daily", interval: 1 },
        dependsOn: ["task-1", "task-2"],
        blockedBy: ["task-3"],
        enabled: true,
        createdAt: "2026-01-28T00:00:00.000Z",
        updatedAt: "2026-01-28T00:00:00.000Z",
      };

      const draft = taskToTaskDraft(task);

      expect(draft.dependsOn).toEqual(["task-1", "task-2"]);
      expect(draft.blockedBy).toEqual(["task-3"]);
    });

    it("should handle recurrenceText", () => {
      const task: Task = {
        id: "task-5",
        name: "Recurring Task",
        dueAt: "2026-02-01T10:00:00.000Z",
        frequency: { type: "weekly", interval: 1, weekdays: [1, 3, 5] },
        recurrenceText: "every week on monday, wednesday, friday",
        enabled: true,
        createdAt: "2026-01-28T00:00:00.000Z",
        updatedAt: "2026-01-28T00:00:00.000Z",
      };

      const draft = taskToTaskDraft(task);

      expect(draft.recurrenceText).toBe("every week on monday, wednesday, friday");
    });
  });

  describe("taskDraftToTask", () => {
    it("should convert basic task draft to partial task", () => {
      const draft: TaskDraft = {
        id: "task-1",
        name: "Test Task",
        description: "Test description",
        priority: "high",
        status: "todo",
        dueAt: "2026-02-01T10:00:00.000Z",
        recurrenceText: "every day",
      };

      const partialTask = taskDraftToTask(draft);

      expect(partialTask.id).toBe("task-1");
      expect(partialTask.name).toBe("Test Task");
      expect(partialTask.description).toBe("Test description");
      expect(partialTask.priority).toBe("high");
      expect(partialTask.status).toBe("todo");
      expect(partialTask.dueAt).toBe("2026-02-01T10:00:00.000Z");
      expect(partialTask.recurrenceText).toBe("every day");
      expect(partialTask.updatedAt).toBeDefined();
    });

    it("should parse recurrence text to frequency", () => {
      const draft: TaskDraft = {
        name: "Recurring Task",
        status: "todo",
        dueAt: "2026-02-01T10:00:00.000Z",
        recurrenceText: "every 2 days",
      };

      const partialTask = taskDraftToTask(draft);

      expect(partialTask.frequency).toBeDefined();
      expect(partialTask.frequency?.type).toBe("daily");
      expect(partialTask.frequency?.interval).toBe(2);
    });

    it("should handle optional dates", () => {
      const draft: TaskDraft = {
        name: "Task with dates",
        status: "todo",
        dueAt: "2026-02-03T10:00:00.000Z",
        scheduledAt: "2026-02-02T10:00:00.000Z",
        startAt: "2026-02-01T10:00:00.000Z",
        recurrenceText: "every day",
      };

      const partialTask = taskDraftToTask(draft);

      expect(partialTask.scheduledAt).toBe("2026-02-02T10:00:00.000Z");
      expect(partialTask.startAt).toBe("2026-02-01T10:00:00.000Z");
    });

    it("should handle dependencies", () => {
      const draft: TaskDraft = {
        name: "Dependent Task",
        status: "todo",
        dueAt: "2026-02-01T10:00:00.000Z",
        recurrenceText: "every day",
        dependsOn: ["task-1", "task-2"],
        blockedBy: ["task-3"],
      };

      const partialTask = taskDraftToTask(draft);

      expect(partialTask.dependsOn).toEqual(["task-1", "task-2"]);
      expect(partialTask.blockedBy).toEqual(["task-3"]);
    });

    it("should handle whenDone flag", () => {
      const draft: TaskDraft = {
        name: "When Done Task",
        status: "todo",
        dueAt: "2026-02-01T10:00:00.000Z",
        recurrenceText: "every day",
        whenDone: true,
      };

      const partialTask = taskDraftToTask(draft);

      expect(partialTask.whenDone).toBe(true);
    });

    it("should handle tags", () => {
      const draft: TaskDraft = {
        name: "Tagged Task",
        status: "todo",
        dueAt: "2026-02-01T10:00:00.000Z",
        recurrenceText: "every day",
        tags: ["work", "urgent"],
      };

      const partialTask = taskDraftToTask(draft);

      expect(partialTask.tags).toEqual(["work", "urgent"]);
    });
  });

  describe("round-trip conversion", () => {
    it("should preserve data through round-trip conversion", () => {
      const originalTask: Task = {
        id: "task-round-trip",
        name: "Round Trip Task",
        description: "Testing round trip",
        priority: "medium",
        status: "todo",
        dueAt: "2026-02-01T10:00:00.000Z",
        scheduledAt: "2026-01-31T10:00:00.000Z",
        startAt: "2026-01-30T10:00:00.000Z",
        frequency: { type: "daily", interval: 1 },
        recurrenceText: "every day",
        whenDone: false,
        dependsOn: ["task-1"],
        blockedBy: ["task-2"],
        tags: ["test"],
        enabled: true,
        createdAt: "2026-01-28T00:00:00.000Z",
        updatedAt: "2026-01-28T00:00:00.000Z",
      };

      const draft = taskToTaskDraft(originalTask);
      const partialTask = taskDraftToTask(draft);

      expect(partialTask.id).toBe(originalTask.id);
      expect(partialTask.name).toBe(originalTask.name);
      expect(partialTask.description).toBe(originalTask.description);
      expect(partialTask.priority).toBe(originalTask.priority);
      expect(partialTask.status).toBe(originalTask.status);
      expect(partialTask.dueAt).toBe(originalTask.dueAt);
      expect(partialTask.scheduledAt).toBe(originalTask.scheduledAt);
      expect(partialTask.startAt).toBe(originalTask.startAt);
      expect(partialTask.recurrenceText).toBe(originalTask.recurrenceText);
      expect(partialTask.whenDone).toBe(originalTask.whenDone);
      expect(partialTask.dependsOn).toEqual(originalTask.dependsOn);
      expect(partialTask.blockedBy).toEqual(originalTask.blockedBy);
      expect(partialTask.tags).toEqual(originalTask.tags);
    });
  });
});
