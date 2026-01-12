import type { Task } from "@/core/models/Task";

/**
 * Dashboard task state helpers.
 *
 * Data flow:
 * - The dashboard keeps its own in-memory list as the single UI source of truth.
 * - We only rehydrate from storage on initial load or explicit refresh events.
 * - Mutations return new arrays with stable references for unchanged tasks,
 *   minimizing DOM updates when using keyed {#each} blocks.
 *
 * Performance note:
 * - Previously every task change reloaded the full list from disk and re-rendered
 *   the entire table. Now only the touched task object is replaced in-memory.
 */

export function upsertTask(tasks: Task[], nextTask: Task): Task[] {
  const index = tasks.findIndex((task) => task.id === nextTask.id);
  if (index === -1) {
    return [...tasks, nextTask];
  }

  const updated = [...tasks];
  updated[index] = nextTask;
  return updated;
}

export function removeTask(tasks: Task[], taskId: string): Task[] {
  const next = tasks.filter((task) => task.id !== taskId);
  return next.length === tasks.length ? tasks : next;
}

export function updateTaskById(
  tasks: Task[],
  taskId: string,
  updater: (task: Task) => Task
): Task[] {
  let didUpdate = false;
  const next = tasks.map((task) => {
    if (task.id !== taskId) {
      return task;
    }
    didUpdate = true;
    return updater(task);
  });

  return didUpdate ? next : tasks;
}

export function getTodayAndOverdueTasks(tasks: Task[], now: Date = new Date()): Task[] {
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);

  return tasks.filter((task) => {
    if (!task.enabled) {
      return false;
    }
    const dueDate = new Date(task.dueAt);
    return dueDate <= endOfToday;
  });
}
