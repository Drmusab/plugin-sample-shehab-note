/** @vitest-environment jsdom */
import { render } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import InboxTab from "@/components/tabs/InboxTab.svelte";
import type { Task } from "@/core/models/Task";

function createTask(id: string, name: string, options: Partial<Task> = {}): Task {
  const now = new Date().toISOString();
  return {
    id,
    name,
    dueAt: now,
    enabled: true,
    createdAt: now,
    updatedAt: now,
    ...options,
  };
}

describe("InboxTab", () => {
  it("renders empty state when no inbox tasks exist", () => {
    const tasks = [createTask("task-1", "Task with due date")];
    const { getByText } = render(InboxTab, {
      props: {
        tasks,
        onEdit: vi.fn(),
        onDone: vi.fn(),
        onDelete: vi.fn(),
      },
    });

    expect(getByText(/No tasks in inbox/i)).toBeTruthy();
  });

  it("displays tasks with no dates", () => {
    const inboxTask = createTask("task-1", "Inbox task", {
      dueAt: undefined,
      scheduledAt: undefined,
      startAt: undefined,
      status: "todo",
    });
    const regularTask = createTask("task-2", "Regular task");

    const { getByText, queryByText } = render(InboxTab, {
      props: {
        tasks: [inboxTask, regularTask],
        onEdit: vi.fn(),
        onDone: vi.fn(),
        onDelete: vi.fn(),
      },
    });

    expect(getByText("1 task without dates")).toBeTruthy();
  });

  it("filters out done and cancelled tasks", () => {
    const inboxTask = createTask("task-1", "Inbox task", {
      dueAt: undefined,
      scheduledAt: undefined,
      startAt: undefined,
      status: "todo",
    });
    const doneTask = createTask("task-2", "Done task", {
      dueAt: undefined,
      scheduledAt: undefined,
      startAt: undefined,
      status: "done",
    });

    const { getByText } = render(InboxTab, {
      props: {
        tasks: [inboxTask, doneTask],
        onEdit: vi.fn(),
        onDone: vi.fn(),
        onDelete: vi.fn(),
      },
    });

    expect(getByText("1 task without dates")).toBeTruthy();
  });
});
