import { describe, expect, it } from "vitest";
import type { Frequency } from "@/core/models/Frequency";
import { createTask } from "@/core/models/Task";
import {
  getTodayAndOverdueTasks,
  removeTask,
  updateTaskById,
  upsertTask,
} from "@/components/dashboard/taskState";

const dailyFrequency: Frequency = {
  type: "daily",
  interval: 1,
};

describe("dashboard task state helpers", () => {
  it("updates only the affected task reference during rapid toggles", () => {
    const taskA = createTask("Task A", dailyFrequency);
    const taskB = createTask("Task B", dailyFrequency);

    let current = [taskA, taskB];
    for (let i = 0; i < 50; i += 1) {
      current = updateTaskById(current, taskA.id, (task) => ({
        ...task,
        enabled: !task.enabled,
      }));
    }

    const updatedTaskA = current.find((task) => task.id === taskA.id);
    const updatedTaskB = current.find((task) => task.id === taskB.id);

    expect(updatedTaskA?.enabled).toBe(taskA.enabled);
    expect(updatedTaskB).toBe(taskB);
  });

  it("filters today/overdue tasks without reloading the full list", () => {
    const now = new Date("2024-01-01T10:00:00.000Z");
    const todayTask = createTask("Today Task", dailyFrequency, new Date("2024-01-01T09:00:00.000Z"));
    const futureTask = createTask("Future Task", dailyFrequency, new Date("2024-01-02T09:00:00.000Z"));
    const disabledTask = createTask("Disabled Task", dailyFrequency, new Date("2024-01-01T08:00:00.000Z"));
    disabledTask.enabled = false;

    const results = getTodayAndOverdueTasks([todayTask, futureTask, disabledTask], now);

    expect(results).toEqual([todayTask]);
  });

  it("upserts and removes tasks while preserving untouched items", () => {
    const taskA = createTask("Task A", dailyFrequency);
    const taskB = createTask("Task B", dailyFrequency);
    const updatedTaskB = { ...taskB, name: "Task B Updated" };

    let current = [taskA];
    current = upsertTask(current, taskB);
    current = upsertTask(current, updatedTaskB);
    current = removeTask(current, taskA.id);

    expect(current).toEqual([updatedTaskB]);
  });
});
