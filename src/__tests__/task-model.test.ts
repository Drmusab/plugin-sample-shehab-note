import { describe, expect, it, beforeEach } from "vitest";
import { calculateTaskHealth, recordCompletion, recordMiss, createTask } from "../core/models/Task";
import type { Task } from "../core/models/Task";

describe("Task Model", () => {
  describe("createTask", () => {
    it("creates a task with default values", () => {
      const task = createTask(
        "Test Task",
        { type: "daily", interval: 1, time: "09:00" }
      );

      expect(task.name).toBe("Test Task");
      expect(task.enabled).toBe(true);
      expect(task.priority).toBe("normal");
      expect(task.completionCount).toBe(0);
      expect(task.missCount).toBe(0);
      expect(task.currentStreak).toBe(0);
      expect(task.bestStreak).toBe(0);
      expect(task.snoozeCount).toBe(0);
      expect(task.maxSnoozes).toBe(3);
      expect(task.version).toBe(5);
      expect(Array.isArray(task.recentCompletions)).toBe(true);
    });

    it("includes timezone information", () => {
      const task = createTask(
        "Test Task",
        { type: "daily", interval: 1, time: "09:00" }
      );

      expect(task.timezone).toBeDefined();
      expect(typeof task.timezone).toBe("string");
    });
  });

  describe("recordCompletion", () => {
    let task: Task;

    beforeEach(() => {
      task = createTask(
        "Test Task",
        { type: "daily", interval: 1, time: "09:00" }
      );
    });

    it("increments completion count", () => {
      recordCompletion(task);
      expect(task.completionCount).toBe(1);

      recordCompletion(task);
      expect(task.completionCount).toBe(2);
    });

    it("updates current streak", () => {
      recordCompletion(task);
      expect(task.currentStreak).toBe(1);

      recordCompletion(task);
      expect(task.currentStreak).toBe(2);
    });

    it("updates best streak", () => {
      recordCompletion(task);
      recordCompletion(task);
      recordCompletion(task);
      
      expect(task.bestStreak).toBe(3);
      expect(task.currentStreak).toBe(3);
    });

    it("maintains best streak when current is lower", () => {
      recordCompletion(task);
      recordCompletion(task);
      recordCompletion(task);
      
      task.currentStreak = 1; // Simulate streak break
      recordCompletion(task);
      
      expect(task.bestStreak).toBe(3);
      expect(task.currentStreak).toBe(2);
    });

    it("adds to recent completions", () => {
      recordCompletion(task);
      expect(task.recentCompletions?.length).toBe(1);

      recordCompletion(task);
      expect(task.recentCompletions?.length).toBe(2);
    });

    it("limits recent completions to 10", () => {
      for (let i = 0; i < 15; i++) {
        recordCompletion(task);
      }
      
      expect(task.recentCompletions?.length).toBe(10);
    });

    it("resets snooze count", () => {
      task.snoozeCount = 3;
      recordCompletion(task);
      expect(task.snoozeCount).toBe(0);
    });

    it("updates lastCompletedAt and updatedAt", () => {
      const before = new Date().toISOString();
      recordCompletion(task);
      
      expect(task.lastCompletedAt).toBeDefined();
      expect(task.updatedAt).toBeDefined();
      expect(task.lastCompletedAt! >= before).toBe(true);
    });
  });

  describe("recordMiss", () => {
    let task: Task;

    beforeEach(() => {
      task = createTask(
        "Test Task",
        { type: "daily", interval: 1, time: "09:00" }
      );
    });

    it("increments miss count", () => {
      recordMiss(task);
      expect(task.missCount).toBe(1);

      recordMiss(task);
      expect(task.missCount).toBe(2);
    });

    it("resets current streak", () => {
      task.currentStreak = 5;
      recordMiss(task);
      expect(task.currentStreak).toBe(0);
    });

    it("does not affect best streak", () => {
      task.bestStreak = 10;
      recordMiss(task);
      expect(task.bestStreak).toBe(10);
    });

    it("updates updatedAt timestamp", () => {
      const before = new Date().toISOString();
      recordMiss(task);
      expect(task.updatedAt >= before).toBe(true);
    });
  });

  describe("calculateTaskHealth", () => {
    it("returns 100 for new tasks with no history", () => {
      const task = createTask(
        "Test Task",
        { type: "daily", interval: 1, time: "09:00" }
      );
      expect(calculateTaskHealth(task)).toBe(100);
    });

    it("calculates health based on completion rate", () => {
      const task = createTask(
        "Test Task",
        { type: "daily", interval: 1, time: "09:00" }
      );
      
      task.completionCount = 7;
      task.missCount = 3;
      // 70% completion rate -> 70 * 0.7 = 49 base score
      const health = calculateTaskHealth(task);
      expect(health).toBeGreaterThanOrEqual(49);
      expect(health).toBeLessThanOrEqual(70);
    });

    it("adds streak bonus to health score", () => {
      const task = createTask(
        "Test Task",
        { type: "daily", interval: 1, time: "09:00" }
      );
      
      task.completionCount = 10;
      task.missCount = 0;
      task.currentStreak = 5;
      
      const health = calculateTaskHealth(task);
      // 100% completion = 70 points, 5 streak = 15 bonus = 85
      expect(health).toBeGreaterThanOrEqual(85);
    });

    it("caps health at 100", () => {
      const task = createTask(
        "Test Task",
        { type: "daily", interval: 1, time: "09:00" }
      );
      
      task.completionCount = 100;
      task.missCount = 0;
      task.currentStreak = 50; // Would give excessive bonus
      
      const health = calculateTaskHealth(task);
      expect(health).toBe(100);
    });

    it("returns low health for poor completion rate", () => {
      const task = createTask(
        "Test Task",
        { type: "daily", interval: 1, time: "09:00" }
      );
      
      task.completionCount = 2;
      task.missCount = 8;
      task.currentStreak = 0;
      
      const health = calculateTaskHealth(task);
      expect(health).toBeLessThanOrEqual(20);
    });
  });

});
