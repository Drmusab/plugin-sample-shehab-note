/** @vitest-environment jsdom */
import { describe, expect, it, beforeEach, vi } from "vitest";
import { InlineToggleHandler } from "@/commands/InlineToggleHandler";
import type { Task } from "@/core/models/Task";
import type { TaskCommands } from "@/commands/TaskCommands";
import type { TaskIndex } from "@/core/storage/TaskIndex";
import type { ParsedTask } from "@/parser/InlineTaskParser";

// Mock the dependencies
vi.mock("@/utils/logger", () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

vi.mock("@/utils/notifications", () => ({
  toast: {
    error: vi.fn(),
    warning: vi.fn(),
    success: vi.fn(),
  },
}));

// Create a mock task
function createMockTask(overrides?: Partial<Task>): Task {
  return {
    id: "task-1",
    name: "Test Task",
    dueAt: "2026-01-25T12:00:00Z",
    frequency: {
      type: "day",
      interval: 1,
    },
    enabled: true,
    status: "todo",
    linkedBlockId: "block-123",
    linkedBlockContent: "- [ ] Test Task 📅 2026-01-25",
    createdAt: "2026-01-20T12:00:00Z",
    updatedAt: "2026-01-20T12:00:00Z",
    version: 1,
    ...overrides,
  };
}

// Create mock TaskIndex
function createMockTaskIndex(): TaskIndex {
  const tasks = new Map<string, Task>();
  const blockIdMap = new Map<string, string>();

  return {
    getByBlockId: vi.fn((blockId: string) => {
      const taskId = blockIdMap.get(blockId);
      return taskId ? tasks.get(taskId) : undefined;
    }),
    getById: vi.fn((id: string) => tasks.get(id)),
    getAllTasks: vi.fn(() => Array.from(tasks.values())),
    // Helper methods for testing
    _addTask: (task: Task) => {
      tasks.set(task.id, task);
      if (task.linkedBlockId) {
        blockIdMap.set(task.linkedBlockId, task.id);
      }
    },
    _updateTask: (task: Task) => {
      tasks.set(task.id, task);
    },
  } as any;
}

// Create mock TaskCommands
function createMockTaskCommands(): TaskCommands {
  return {
    completeTask: vi.fn().mockResolvedValue(undefined),
    toggleStatus: vi.fn().mockResolvedValue(undefined),
  } as any;
}

describe("InlineToggleHandler", () => {
  let handler: InlineToggleHandler;
  let mockTaskIndex: TaskIndex;
  let mockTaskCommands: TaskCommands;

  beforeEach(() => {
    vi.clearAllMocks();
    mockTaskIndex = createMockTaskIndex();
    mockTaskCommands = createMockTaskCommands();
    
    // Setup DOM
    document.body.innerHTML = "";
  });

  describe("handleToggle", () => {
    it("should ignore toggle for non-managed task", async () => {
      handler = new InlineToggleHandler({
        taskIndex: mockTaskIndex,
        taskCommands: mockTaskCommands,
      });

      // Setup: no task in index
      await handler.handleToggle("non-existent-block", true);

      // Wait for debounce
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Verify: no commands called
      expect(mockTaskCommands.completeTask).not.toHaveBeenCalled();
      expect(mockTaskCommands.toggleStatus).not.toHaveBeenCalled();
    });

    it("should complete task when checkbox is checked", async () => {
      const task = createMockTask({
        status: "todo",
        linkedBlockId: "block-123",
      });
      
      (mockTaskIndex as any)._addTask(task);

      // Setup DOM with block content
      const blockEl = document.createElement("div");
      blockEl.setAttribute("data-node-id", "block-123");
      blockEl.textContent = "- [ ] Test Task 📅 2026-01-25";
      document.body.appendChild(blockEl);

      handler = new InlineToggleHandler({
        taskIndex: mockTaskIndex,
        taskCommands: mockTaskCommands,
      });

      await handler.handleToggle("block-123", true);

      // Wait for debounce
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Verify: completeTask was called
      expect(mockTaskCommands.completeTask).toHaveBeenCalledWith("task-1");
    });

    it("should toggle to todo when checkbox is unchecked", async () => {
      const task = createMockTask({
        status: "done",
        linkedBlockId: "block-123",
      });
      
      (mockTaskIndex as any)._addTask(task);

      // Setup DOM with block content
      const blockEl = document.createElement("div");
      blockEl.setAttribute("data-node-id", "block-123");
      blockEl.textContent = "- [x] Test Task 📅 2026-01-25";
      document.body.appendChild(blockEl);

      handler = new InlineToggleHandler({
        taskIndex: mockTaskIndex,
        taskCommands: mockTaskCommands,
      });

      await handler.handleToggle("block-123", false);

      // Wait for debounce
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Verify: toggleStatus was called
      expect(mockTaskCommands.toggleStatus).toHaveBeenCalledWith("task-1");
    });

    it("should ignore toggle if status hasn't changed", async () => {
      const task = createMockTask({
        status: "done",
        linkedBlockId: "block-123",
      });
      
      (mockTaskIndex as any)._addTask(task);

      // Setup DOM with block content
      const blockEl = document.createElement("div");
      blockEl.setAttribute("data-node-id", "block-123");
      blockEl.textContent = "- [x] Test Task 📅 2026-01-25";
      document.body.appendChild(blockEl);

      handler = new InlineToggleHandler({
        taskIndex: mockTaskIndex,
        taskCommands: mockTaskCommands,
      });

      // Checkbox is checked, task is already done -> no change
      await handler.handleToggle("block-123", true);

      // Wait for debounce
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Verify: no commands called
      expect(mockTaskCommands.completeTask).not.toHaveBeenCalled();
      expect(mockTaskCommands.toggleStatus).not.toHaveBeenCalled();
    });

    it("should debounce rapid toggles", async () => {
      const task = createMockTask({
        status: "todo",
        linkedBlockId: "block-123",
      });
      
      (mockTaskIndex as any)._addTask(task);

      // Setup DOM with block content
      const blockEl = document.createElement("div");
      blockEl.setAttribute("data-node-id", "block-123");
      blockEl.textContent = "- [ ] Test Task 📅 2026-01-25";
      document.body.appendChild(blockEl);

      handler = new InlineToggleHandler({
        taskIndex: mockTaskIndex,
        taskCommands: mockTaskCommands,
      });

      // Rapid toggles
      await handler.handleToggle("block-123", true);
      await handler.handleToggle("block-123", false);
      await handler.handleToggle("block-123", true);

      // Wait for debounce
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Verify: only called once (last toggle)
      expect(mockTaskCommands.completeTask).toHaveBeenCalledTimes(1);
    });
  });

  describe("isManagedTask", () => {
    it("should return true for managed task", async () => {
      const task = createMockTask({
        linkedBlockId: "block-123",
      });
      
      (mockTaskIndex as any)._addTask(task);

      handler = new InlineToggleHandler({
        taskIndex: mockTaskIndex,
        taskCommands: mockTaskCommands,
      });

      const result = await handler.isManagedTask("block-123");

      expect(result).toBe(true);
    });

    it("should return false for non-managed task", async () => {
      handler = new InlineToggleHandler({
        taskIndex: mockTaskIndex,
        taskCommands: mockTaskCommands,
      });

      const result = await handler.isManagedTask("non-existent-block");

      expect(result).toBe(false);
    });
  });

  describe("calculateNewStatus", () => {
    it("should calculate done when checkbox is checked from todo", async () => {
      handler = new InlineToggleHandler({
        taskIndex: mockTaskIndex,
        taskCommands: mockTaskCommands,
      });

      // Access private method via any cast for testing
      const newStatus = (handler as any).calculateNewStatus(true, "todo");
      expect(newStatus).toBe("done");
    });

    it("should calculate done when checkbox is checked from cancelled", async () => {
      handler = new InlineToggleHandler({
        taskIndex: mockTaskIndex,
        taskCommands: mockTaskCommands,
      });

      const newStatus = (handler as any).calculateNewStatus(true, "cancelled");
      expect(newStatus).toBe("done");
    });

    it("should keep done when checkbox is checked from done", async () => {
      handler = new InlineToggleHandler({
        taskIndex: mockTaskIndex,
        taskCommands: mockTaskCommands,
      });

      const newStatus = (handler as any).calculateNewStatus(true, "done");
      expect(newStatus).toBe("done");
    });

    it("should calculate todo when checkbox is unchecked from done", async () => {
      handler = new InlineToggleHandler({
        taskIndex: mockTaskIndex,
        taskCommands: mockTaskCommands,
      });

      const newStatus = (handler as any).calculateNewStatus(false, "done");
      expect(newStatus).toBe("todo");
    });

    it("should keep todo when checkbox is unchecked from todo", async () => {
      handler = new InlineToggleHandler({
        taskIndex: mockTaskIndex,
        taskCommands: mockTaskCommands,
      });

      const newStatus = (handler as any).calculateNewStatus(false, "todo");
      expect(newStatus).toBe("todo");
    });
  });

  describe("destroy", () => {
    it("should clear pending toggles", async () => {
      handler = new InlineToggleHandler({
        taskIndex: mockTaskIndex,
        taskCommands: mockTaskCommands,
      });

      const task = createMockTask({
        status: "todo",
        linkedBlockId: "block-123",
      });
      
      (mockTaskIndex as any)._addTask(task);

      // Setup DOM
      const blockEl = document.createElement("div");
      blockEl.setAttribute("data-node-id", "block-123");
      blockEl.textContent = "- [ ] Test Task 📅 2026-01-25";
      document.body.appendChild(blockEl);

      // Start a toggle but don't wait
      await handler.handleToggle("block-123", true);

      // Destroy immediately
      handler.destroy();

      // Wait longer than debounce
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Verify: should not have been called since destroy cleared pending
      expect(mockTaskCommands.completeTask).not.toHaveBeenCalled();
    });
  });
});
