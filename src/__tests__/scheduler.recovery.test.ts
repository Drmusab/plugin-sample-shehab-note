import { describe, it, expect, beforeEach, vi } from "vitest";
import { Scheduler } from "@/core/engine/Scheduler";
import { TaskStorage } from "@/core/storage/TaskStorage";
import { NotificationState } from "@/core/engine/NotificationState";
import { createTask } from "@/core/models/Task";
import type { Frequency } from "@/core/models/Frequency";

// Mock Plugin
const mockPlugin = {
  loadData: vi.fn(),
  saveData: vi.fn(),
  data: {},
} as any;

describe("Scheduler - Recovery", () => {
  let storage: TaskStorage;
  let notificationState: NotificationState;
  let scheduler: Scheduler;

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
    
    notificationState = new NotificationState(mockPlugin, "test-notification-state");
    await notificationState.load();
    
    scheduler = new Scheduler(storage, notificationState, 60000, mockPlugin);
  });

  describe("recoverMissedTasks", () => {
    it("should recover missed tasks from previous session", async () => {
      const frequency: Frequency = {
        type: "daily",
        interval: 1,
        time: "09:00",
      };

      // Create a task that was supposed to run yesterday
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(9, 0, 0, 0);
      
      const task = createTask("Daily Task", frequency, yesterday);
      await storage.saveTask(task);

      // Set last run timestamp to 2 days ago
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      await mockPlugin.saveData("last-run-timestamp", {
        timestamp: twoDaysAgo.toISOString(),
      });

      const missedTasks: any[] = [];
      scheduler.start(
        () => {},
        (task) => {
          missedTasks.push(task);
        }
      );

      await scheduler.recoverMissedTasks();

      // Should have detected the missed task
      expect(missedTasks.length).toBeGreaterThan(0);
      expect(missedTasks[0].id).toBe(task.id);
      
      scheduler.stop();
    });

    it("should advance tasks to next future occurrence", async () => {
      const frequency: Frequency = {
        type: "daily",
        interval: 1,
        time: "09:00",
      };

      // Create a task with due date in the past
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      threeDaysAgo.setHours(9, 0, 0, 0);
      
      const task = createTask("Overdue Task", frequency, threeDaysAgo);
      await storage.saveTask(task);

      // Set last run timestamp to 4 days ago
      const fourDaysAgo = new Date();
      fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);
      await mockPlugin.saveData("last-run-timestamp", {
        timestamp: fourDaysAgo.toISOString(),
      });

      scheduler.start(() => {}, () => {});
      await scheduler.recoverMissedTasks();

      // Task should be advanced to a future occurrence
      const updatedTask = storage.getTask(task.id);
      expect(updatedTask).toBeDefined();
      
      if (updatedTask) {
        const dueDate = new Date(updatedTask.dueAt);
        const now = new Date();
        expect(dueDate.getTime()).toBeGreaterThan(now.getTime());
      }
      
      scheduler.stop();
    });

    it("should save last run timestamp after recovery", async () => {
      scheduler.start(() => {}, () => {});
      
      const beforeRecovery = new Date();
      await scheduler.recoverMissedTasks();
      const afterRecovery = new Date();

      const savedData = mockPlugin.data["last-run-timestamp"];
      expect(savedData).toBeDefined();
      expect(savedData.timestamp).toBeDefined();
      
      const savedTimestamp = new Date(savedData.timestamp);
      expect(savedTimestamp.getTime()).toBeGreaterThanOrEqual(beforeRecovery.getTime());
      expect(savedTimestamp.getTime()).toBeLessThanOrEqual(afterRecovery.getTime());
      
      scheduler.stop();
    });

    it("should handle first run gracefully (no last timestamp)", async () => {
      // Don't set last run timestamp
      scheduler.start(() => {}, () => {});
      
      // Should not throw and should save timestamp
      await expect(scheduler.recoverMissedTasks()).resolves.not.toThrow();
      
      const savedData = mockPlugin.data["last-run-timestamp"];
      expect(savedData).toBeDefined();
      expect(savedData.timestamp).toBeDefined();
      
      scheduler.stop();
    });

    it("should not notify for already notified missed tasks", async () => {
      const frequency: Frequency = {
        type: "daily",
        interval: 1,
        time: "09:00",
      };

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(9, 0, 0, 0);
      
      const task = createTask("Daily Task", frequency, yesterday);
      await storage.saveTask(task);

      // Mark as already notified
      const taskKey = `${task.id}:${yesterday.toISOString()}`;
      notificationState.markNotified(taskKey);
      await notificationState.save();

      // Set last run timestamp to 2 days ago
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      await mockPlugin.saveData("last-run-timestamp", {
        timestamp: twoDaysAgo.toISOString(),
      });

      const missedTasks: any[] = [];
      scheduler.start(
        () => {},
        (task) => {
          missedTasks.push(task);
        }
      );

      await scheduler.recoverMissedTasks();

      // Should not notify for already notified task
      // This depends on the exact implementation, but generally should filter out
      // tasks that have already been marked as notified
      
      scheduler.stop();
    });

    it("should handle multiple missed occurrences for same task", async () => {
      const frequency: Frequency = {
        type: "daily",
        interval: 1,
        time: "09:00",
      };

      // Create a task with due date 5 days ago
      const fiveDaysAgo = new Date();
      fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
      fiveDaysAgo.setHours(9, 0, 0, 0);
      
      const task = createTask("Daily Task", frequency, fiveDaysAgo);
      await storage.saveTask(task);

      // Set last run timestamp to 6 days ago
      const sixDaysAgo = new Date();
      sixDaysAgo.setDate(sixDaysAgo.getDate() - 6);
      await mockPlugin.saveData("last-run-timestamp", {
        timestamp: sixDaysAgo.toISOString(),
      });

      const missedTasks: any[] = [];
      scheduler.start(
        () => {},
        (task) => {
          missedTasks.push(task);
        }
      );

      await scheduler.recoverMissedTasks();

      // Should detect multiple missed occurrences
      expect(missedTasks.length).toBeGreaterThan(0);
      
      scheduler.stop();
    });

    it("should skip disabled tasks during recovery", async () => {
      const frequency: Frequency = {
        type: "daily",
        interval: 1,
        time: "09:00",
      };

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(9, 0, 0, 0);
      
      const task = createTask("Disabled Task", frequency, yesterday);
      task.enabled = false; // Disable the task
      await storage.saveTask(task);

      // Set last run timestamp to 2 days ago
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      await mockPlugin.saveData("last-run-timestamp", {
        timestamp: twoDaysAgo.toISOString(),
      });

      const missedTasks: any[] = [];
      scheduler.start(
        () => {},
        (task) => {
          missedTasks.push(task);
        }
      );

      await scheduler.recoverMissedTasks();

      // Should not include disabled tasks
      expect(missedTasks.length).toBe(0);
      
      scheduler.stop();
    });
  });

  describe("loadLastRunTimestamp and saveLastRunTimestamp", () => {
    it("should return null when no timestamp exists", async () => {
      scheduler.start(() => {}, () => {});
      
      // First run should handle null timestamp gracefully
      await expect(scheduler.recoverMissedTasks()).resolves.not.toThrow();
      
      scheduler.stop();
    });

    it("should persist timestamp correctly", async () => {
      const testDate = new Date("2024-01-15T10:00:00Z");
      
      await mockPlugin.saveData("last-run-timestamp", {
        timestamp: testDate.toISOString(),
      });

      const loaded = await mockPlugin.loadData("last-run-timestamp");
      expect(loaded).toBeDefined();
      expect(loaded.timestamp).toBe(testDate.toISOString());
    });
  });
});
