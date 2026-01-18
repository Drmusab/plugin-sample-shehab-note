/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import { TaskCommands } from "@/commands/TaskCommands";
import type { Task } from "@/core/models/Task";
import type { TaskRepositoryProvider } from "@/core/storage/TaskRepository";

function createMockRepository(): TaskRepositoryProvider {
  const tasks = new Map<string, Task>();

  return {
    getAllTasks: () => Array.from(tasks.values()),
    getTask: (id: string) => tasks.get(id),
    getTaskByBlockId: (blockId: string) => undefined,
    getEnabledTasks: () => Array.from(tasks.values()).filter((t) => t.enabled),
    getTasksDueOnOrBefore: (date: Date) => [],
    getTodayAndOverdueTasks: () => [],
    getTasksInRange: (startDate: Date, endDate: Date) => [],
    saveTask: async (task: Task) => {
      tasks.set(task.id, task);
    },
    deleteTask: async (taskId: string) => {
      tasks.delete(taskId);
    },
    archiveTask: async (task: Task) => {},
    loadArchive: async () => [],
    flush: async () => {},
  };
}

function createTask(id: string, name: string, options: Partial<Task> = {}): Task {
  const now = new Date().toISOString();
  return {
    id,
    name,
    dueAt: now,
    enabled: true,
    createdAt: now,
    updatedAt: now,
    status: "todo",
    ...options,
  };
}

describe("TaskCommands", () => {
  it("completes a task", async () => {
    const repo = createMockRepository();
    const task = createTask("task-1", "Test task");
    await repo.saveTask(task);

    const commands = new TaskCommands(repo);
    await commands.completeTask("task-1");

    const updated = repo.getTask("task-1");
    expect(updated?.status).toBe("done");
    expect(updated?.doneAt).toBeDefined();
  });

  it("defers task by specified days", async () => {
    const repo = createMockRepository();
    const dueDate = new Date("2025-01-20T12:00:00Z");
    const task = createTask("task-1", "Test task", {
      dueAt: dueDate.toISOString(),
    });
    await repo.saveTask(task);

    const commands = new TaskCommands(repo);
    await commands.deferTask("task-1", 3);

    const updated = repo.getTask("task-1");
    const updatedDue = new Date(updated!.dueAt);
    const expectedDue = new Date(dueDate);
    expectedDue.setDate(expectedDue.getDate() + 3);

    expect(updatedDue.toDateString()).toBe(expectedDue.toDateString());
  });

  it("reschedules task to today", async () => {
    const repo = createMockRepository();
    const task = createTask("task-1", "Test task");
    await repo.saveTask(task);

    const commands = new TaskCommands(repo);
    await commands.rescheduleToToday("task-1");

    const updated = repo.getTask("task-1");
    expect(updated?.scheduledAt).toBeDefined();

    const scheduledDate = new Date(updated!.scheduledAt!);
    const today = new Date();
    expect(scheduledDate.toDateString()).toBe(today.toDateString());
  });

  it("deletes a task", async () => {
    const repo = createMockRepository();
    const task = createTask("task-1", "Test task");
    await repo.saveTask(task);

    const commands = new TaskCommands(repo);
    await commands.deleteTask("task-1");

    expect(repo.getTask("task-1")).toBeUndefined();
  });
});
