import { describe, it, expect, beforeEach, vi } from "vitest";
import { TaskStorage } from "@/core/storage/TaskStorage";
import { createTask } from "@/core/models/Task";
import type { Frequency } from "@/core/models/Frequency";

// Mock Plugin
const mockPlugin = {
  loadData: vi.fn(),
  saveData: vi.fn(),
  data: {},
} as any;

describe("TaskStorage - Block Index", () => {
  let storage: TaskStorage;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Reset mock plugin data
    mockPlugin.data = {};
    mockPlugin.loadData.mockImplementation((key: string) => {
      return Promise.resolve(mockPlugin.data[key]);
    });
    mockPlugin.saveData.mockImplementation((key: string, value: any) => {
      mockPlugin.data[key] = value;
      return Promise.resolve();
    });

    storage = new TaskStorage(mockPlugin);
    await storage.init();
  });

  describe("getTaskByBlockId", () => {
    it("should return task by block ID", async () => {
      const frequency: Frequency = {
        type: "daily",
        interval: 1,
        time: "09:00",
      };

      const task = createTask("Test Task", frequency);
      task.linkedBlockId = "block-123";
      await storage.saveTask(task);

      const foundTask = storage.getTaskByBlockId("block-123");
      expect(foundTask).toBeDefined();
      expect(foundTask?.id).toBe(task.id);
      expect(foundTask?.linkedBlockId).toBe("block-123");
    });

    it("should return undefined for non-existent block ID", () => {
      const foundTask = storage.getTaskByBlockId("non-existent-block");
      expect(foundTask).toBeUndefined();
    });

    it("should update block index when task is updated", async () => {
      const frequency: Frequency = {
        type: "daily",
        interval: 1,
        time: "09:00",
      };

      const task = createTask("Test Task", frequency);
      task.linkedBlockId = "block-123";
      await storage.saveTask(task);

      // Update task with new block ID
      task.linkedBlockId = "block-456";
      await storage.saveTask(task);

      // Old block ID should not return task
      expect(storage.getTaskByBlockId("block-123")).toBeUndefined();

      // New block ID should return task
      const foundTask = storage.getTaskByBlockId("block-456");
      expect(foundTask).toBeDefined();
      expect(foundTask?.id).toBe(task.id);
    });

    it("should handle multiple tasks with different block IDs", async () => {
      const frequency: Frequency = {
        type: "daily",
        interval: 1,
        time: "09:00",
      };

      const task1 = createTask("Task 1", frequency);
      task1.linkedBlockId = "block-1";
      await storage.saveTask(task1);

      const task2 = createTask("Task 2", frequency);
      task2.linkedBlockId = "block-2";
      await storage.saveTask(task2);

      const task3 = createTask("Task 3", frequency);
      task3.linkedBlockId = "block-3";
      await storage.saveTask(task3);

      expect(storage.getTaskByBlockId("block-1")?.id).toBe(task1.id);
      expect(storage.getTaskByBlockId("block-2")?.id).toBe(task2.id);
      expect(storage.getTaskByBlockId("block-3")?.id).toBe(task3.id);
    });
  });

  describe("Block index rebuild on init", () => {
    it("should rebuild block index from existing tasks on init", async () => {
      const frequency: Frequency = {
        type: "daily",
        interval: 1,
        time: "09:00",
      };

      // Create some tasks
      const task1 = createTask("Task 1", frequency);
      task1.linkedBlockId = "block-1";
      
      const task2 = createTask("Task 2", frequency);
      task2.linkedBlockId = "block-2";

      const task3 = createTask("Task 3", frequency);
      // No linked block

      // Manually set storage data
      mockPlugin.data["recurring-tasks"] = {
        tasks: [task1, task2, task3],
      };

      // Create new storage instance to trigger init
      const newStorage = new TaskStorage(mockPlugin);
      await newStorage.init();

      // Block index should be rebuilt
      expect(newStorage.getTaskByBlockId("block-1")?.id).toBe(task1.id);
      expect(newStorage.getTaskByBlockId("block-2")?.id).toBe(task2.id);
      expect(newStorage.getTaskByBlockId("block-3")).toBeUndefined();
    });
  });

  describe("Block index cleanup on delete", () => {
    it("should remove block index entry when task is deleted", async () => {
      const frequency: Frequency = {
        type: "daily",
        interval: 1,
        time: "09:00",
      };

      const task = createTask("Test Task", frequency);
      task.linkedBlockId = "block-123";
      await storage.saveTask(task);

      // Verify task exists
      expect(storage.getTaskByBlockId("block-123")).toBeDefined();

      // Delete task
      await storage.deleteTask(task.id);

      // Block index entry should be removed
      expect(storage.getTaskByBlockId("block-123")).toBeUndefined();
    });

    it("should handle deletion of task without linked block", async () => {
      const frequency: Frequency = {
        type: "daily",
        interval: 1,
        time: "09:00",
      };

      const task = createTask("Test Task", frequency);
      // No linked block
      await storage.saveTask(task);

      // Should not throw when deleting
      await expect(storage.deleteTask(task.id)).resolves.not.toThrow();
    });
  });

  describe("syncTaskToBlockAttrs", () => {
    it("should handle missing setBlockAttrs gracefully", async () => {
      const frequency: Frequency = {
        type: "daily",
        interval: 1,
        time: "09:00",
      };

      const task = createTask("Test Task", frequency);
      task.linkedBlockId = "block-123";

      // setBlockAttrs is not available in test environment
      // Should not throw error
      await expect(storage.saveTask(task)).resolves.not.toThrow();
    });

    it("should not attempt sync for tasks without linkedBlockId", async () => {
      const frequency: Frequency = {
        type: "daily",
        interval: 1,
        time: "09:00",
      };

      const task = createTask("Test Task", frequency);
      // No linked block
      
      await expect(storage.saveTask(task)).resolves.not.toThrow();
    });
  });

  describe("Block index edge cases", () => {
    it("should handle task with undefined linkedBlockId", async () => {
      const frequency: Frequency = {
        type: "daily",
        interval: 1,
        time: "09:00",
      };

      const task = createTask("Test Task", frequency);
      task.linkedBlockId = undefined;
      await storage.saveTask(task);

      // Should not add to block index
      expect(storage.getTaskByBlockId("undefined")).toBeUndefined();
    });

    it("should handle changing linkedBlockId from defined to undefined", async () => {
      const frequency: Frequency = {
        type: "daily",
        interval: 1,
        time: "09:00",
      };

      const task = createTask("Test Task", frequency);
      task.linkedBlockId = "block-123";
      await storage.saveTask(task);

      // Remove linked block
      task.linkedBlockId = undefined;
      await storage.saveTask(task);

      // Old block ID should not return task
      expect(storage.getTaskByBlockId("block-123")).toBeUndefined();
    });

    it("should handle multiple tasks attempting to use same block ID", async () => {
      const frequency: Frequency = {
        type: "daily",
        interval: 1,
        time: "09:00",
      };

      const task1 = createTask("Task 1", frequency);
      task1.linkedBlockId = "block-shared";
      await storage.saveTask(task1);

      const task2 = createTask("Task 2", frequency);
      task2.linkedBlockId = "block-shared";
      await storage.saveTask(task2);

      // Last task to save should "win" the block ID mapping
      const foundTask = storage.getTaskByBlockId("block-shared");
      expect(foundTask?.id).toBe(task2.id);
    });
  });
});
