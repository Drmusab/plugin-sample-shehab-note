import * as logger from "@/utils/logger";

export function snoozeTask(taskId: string, minutes: number): void {
  window.dispatchEvent(new CustomEvent("task-snooze", {
    detail: { taskId, minutes },
  }));
  logger.info(`Snoozing task ${taskId} for ${minutes} minutes`);
}

export function snoozeToTomorrow(taskId: string): void {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minutesUntilTomorrow = Math.floor((tomorrow.getTime() - now.getTime()) / (60 * 1000));

  window.dispatchEvent(new CustomEvent("task-snooze", {
    detail: { taskId, minutes: minutesUntilTomorrow },
  }));
  logger.info(`Snoozing task ${taskId} to tomorrow`);
}
