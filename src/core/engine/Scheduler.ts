import type { Task } from "@/core/models/Task";
import type { TaskStorage } from "@/core/storage/TaskStorage";
import { RecurrenceEngine } from "./RecurrenceEngine";
import { NotificationState } from "./NotificationState";
import { TimezoneHandler } from "./TimezoneHandler";
import { recordCompletion, recordMiss } from "@/core/models/Task";
import { MISSED_GRACE_PERIOD_MS, SCHEDULER_INTERVAL_MS, LAST_RUN_TIMESTAMP_KEY, MAX_RECOVERY_ITERATIONS } from "@/utils/constants";
import * as logger from "@/utils/logger";
import type { Plugin } from "siyuan";

/**
 * Scheduler manages task timing and triggers notifications
 */
export class Scheduler {
  private storage: TaskStorage;
  private recurrenceEngine: RecurrenceEngine;
  private notificationState: NotificationState | null = null;
  private fallbackNotified: Set<string> = new Set();
  private fallbackMissed: Set<string> = new Set();
  private timezoneHandler: TimezoneHandler;
  private intervalId: number | null = null;
  private isChecking = false;
  private isRunning = false;
  private onTaskDue: ((task: Task) => void) | null = null;
  private onTaskMissed: ((task: Task) => void) | null = null;
  private intervalMs: number;
  private plugin: Plugin | null = null;

  constructor(
    storage: TaskStorage,
    notificationState?: NotificationState,
    intervalMs: number = SCHEDULER_INTERVAL_MS,
    plugin?: Plugin
  ) {
    this.storage = storage;
    this.recurrenceEngine = new RecurrenceEngine();
    this.notificationState = notificationState || null;
    this.timezoneHandler = new TimezoneHandler();
    this.intervalMs = intervalMs;
    this.plugin = plugin || null;
  }

  /**
   * Start the scheduler
   */
  start(
    onTaskDue: (task: Task) => void,
    onTaskMissed?: (task: Task) => void
  ): void {
    this.onTaskDue = onTaskDue;
    this.onTaskMissed = onTaskMissed ?? null;
    this.checkDueTasks(); // Check immediately
    this.isRunning = true;

    const scheduleNextTick = (): void => {
      if (!this.isRunning) {
        return;
      }
      const now = Date.now();
      const intervalMs = this.intervalMs > 0 ? this.intervalMs : SCHEDULER_INTERVAL_MS;
      const delay = intervalMs - (now % intervalMs);
      this.intervalId = setTimeout(() => {
        this.checkDueTasks();
        scheduleNextTick();
      }, delay) as unknown as number;
    };

    // Use a self-correcting timeout to prevent long-uptime drift.
    scheduleNextTick();

    logger.info("Scheduler started");
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (this.intervalId !== null) {
      clearTimeout(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    logger.info("Scheduler stopped");
  }

  /**
   * Run the scheduler check once (useful for tests)
   */
  runOnce(): void {
    this.checkDueTasks();
  }

  /**
   * Check if a task is active
   */
  isActive(task: Task): boolean {
    return task.enabled === true;
  }

  /**
   * Check for tasks that are due and trigger notifications
   */
  private checkDueTasks(): void {
    if (this.isChecking) {
      return;
    }
    this.isChecking = true;
    const now = new Date();
    const tasks = this.storage.getEnabledTasks();

    try {
      for (const task of tasks) {
        if (!this.isActive(task)) {
          continue;
        }

        const dueDate = new Date(task.dueAt);
        const isDue = dueDate <= now;

        // Generate task key for deduplication
        const taskKey = this.notificationState
          ? this.notificationState.generateTaskKey(task.id, task.dueAt)
          : `${task.id}-${task.dueAt}`;

        // Check if task is due
        if (isDue && this.onTaskDue) {
          const alreadyNotified = this.notificationState
            ? this.notificationState.hasNotified(taskKey)
            : this.fallbackNotified.has(taskKey);

          if (!alreadyNotified) {
            this.onTaskDue(task);

            if (this.notificationState) {
              this.notificationState.markNotified(taskKey);
              // Save state asynchronously
              void this.notificationState.save();
            } else {
              this.fallbackNotified.add(taskKey);
            }

            logger.info(`Task due: ${task.name}`, { taskId: task.id, dueAt: task.dueAt });
          }
        }

        // Check if task is missed
        const lastCompletedAt = task.lastCompletedAt
          ? new Date(task.lastCompletedAt)
          : null;

        if (
          isDue &&
          this.onTaskMissed &&
          now.getTime() - dueDate.getTime() >= MISSED_GRACE_PERIOD_MS &&
          (!lastCompletedAt || lastCompletedAt < dueDate)
        ) {
          const alreadyMissed = this.notificationState
            ? this.notificationState.hasMissed(taskKey)
            : this.fallbackMissed.has(taskKey);

          if (!alreadyMissed) {
            this.onTaskMissed(task);

            if (this.notificationState) {
              this.notificationState.markMissed(taskKey);
              this.notificationState.incrementEscalation(task.id);
              // Save state asynchronously
              void this.notificationState.save();
            } else {
              this.fallbackMissed.add(taskKey);
            }

            logger.warn(`Task missed: ${task.name}`, { taskId: task.id, dueAt: task.dueAt });
          }
        }
      }
    } finally {
      this.isChecking = false;
    }
  }

  /**
   * Mark a task as done and reschedule
   */
  async markTaskDone(taskId: string): Promise<void> {
    const task = this.storage.getTask(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    // Record completion (updates analytics)
    recordCompletion(task);

    const completionSnapshot = JSON.parse(JSON.stringify(task));
    await this.storage.archiveTask(completionSnapshot);

    // Calculate next occurrence
    const currentDue = new Date(task.dueAt);
    const nextDue = this.recurrenceEngine.calculateNext(
      currentDue,
      task.frequency
    );

    // Update task
    task.dueAt = nextDue.toISOString();
    await this.storage.saveTask(task);

    // Reset escalation
    if (this.notificationState) {
      this.notificationState.resetEscalation(task.id);
      await this.notificationState.save();
    }

    logger.info(`Task "${task.name}" completed and rescheduled to ${nextDue.toISOString()}`);
  }

  /**
   * Delay a task by specified minutes
   */
  async delayTask(taskId: string, delayMinutes: number): Promise<void> {
    const task = this.storage.getTask(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    const currentDue = new Date(task.dueAt);
    const delayed = new Date(currentDue.getTime() + delayMinutes * 60 * 1000);

    task.dueAt = delayed.toISOString();
    task.snoozeCount = (task.snoozeCount || 0) + 1;
    await this.storage.saveTask(task);

    logger.info(`Task "${task.name}" delayed by ${delayMinutes} minutes to ${delayed.toISOString()}`);
  }

  /**
   * Delay a task to tomorrow
   */
  async delayToTomorrow(taskId: string): Promise<void> {
    const task = this.storage.getTask(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    const currentDue = new Date(task.dueAt);
    const tomorrow = this.timezoneHandler.tomorrow();
    
    // Preserve the time from the current due date
    tomorrow.setHours(
      currentDue.getHours(),
      currentDue.getMinutes(),
      0,
      0
    );

    task.dueAt = tomorrow.toISOString();
    task.snoozeCount = (task.snoozeCount || 0) + 1;
    await this.storage.saveTask(task);

    logger.info(`Task "${task.name}" delayed to tomorrow: ${tomorrow.toISOString()}`);
  }

  /**
   * Skip a task occurrence and reschedule to next recurrence
   */
  async skipOccurrence(taskId: string): Promise<void> {
    const task = this.storage.getTask(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    // Record as a miss
    recordMiss(task);

    const currentDue = new Date(task.dueAt);
    const nextDue = this.recurrenceEngine.calculateNext(
      currentDue,
      task.frequency
    );

    task.dueAt = nextDue.toISOString();
    await this.storage.saveTask(task);

    logger.info(`Task "${task.name}" skipped to ${nextDue.toISOString()}`);
  }

  /**
   * Legacy method - kept for backward compatibility
   */
  async delayTaskToTomorrow(taskId: string): Promise<void> {
    return this.delayToTomorrow(taskId);
  }

  /**
   * Legacy method - kept for backward compatibility
   */
  async skipTaskOccurrence(taskId: string): Promise<void> {
    return this.skipOccurrence(taskId);
  }

  /**
   * Recover missed tasks from the last plugin session
   * Based on patterns from siyuan-dailynote-today (RoutineEventHandler)
   */
  async recoverMissedTasks(): Promise<void> {
    const lastRunAt = await this.loadLastRunTimestamp();
    const now = new Date();
    
    if (!lastRunAt) {
      // First run, save timestamp and exit
      await this.saveLastRunTimestamp(now);
      logger.info("First run detected, no recovery needed");
      return;
    }

    logger.info(`Recovering missed tasks since ${lastRunAt.toISOString()}`);
    
    for (const task of this.storage.getEnabledTasks()) {
      try {
        const missedOccurrences = this.recurrenceEngine.getMissedOccurrences(
          lastRunAt,
          now,
          task.frequency,
          new Date(task.createdAt)
        );
        
        for (const missedAt of missedOccurrences) {
          const taskKey = `${task.id}:${missedAt.toISOString()}`;
          const hasMissed = this.notificationState
            ? this.notificationState.hasMissed(taskKey)
            : this.fallbackMissed.has(taskKey);

          if (!hasMissed && this.onTaskMissed) {
            this.onTaskMissed(task);
            
            if (this.notificationState) {
              this.notificationState.markMissed(taskKey);
            } else {
              this.fallbackMissed.add(taskKey);
            }
          }
        }
        
        // Advance task to next future occurrence if it's in the past
        await this.advanceToNextFutureOccurrence(task, now);
      } catch (err) {
        logger.error(`Failed to recover task ${task.id}:`, err);
      }
    }
    
    // Save notification state if available
    if (this.notificationState) {
      await this.notificationState.save();
    }
    
    await this.saveLastRunTimestamp(now);
    logger.info("Missed task recovery completed");
  }

  /**
   * Advance a task to the next occurrence in the future
   */
  private async advanceToNextFutureOccurrence(task: Task, now: Date): Promise<void> {
    const currentDue = new Date(task.dueAt);
    
    if (currentDue >= now) {
      // Task is already in the future
      return;
    }

    let nextDue = currentDue;
    let iterations = 0;

    // Keep advancing until we find a future occurrence, but cap iterations to
    // avoid infinite loops for corrupt timestamps or extreme downtime.
    while (nextDue < now && iterations < MAX_RECOVERY_ITERATIONS) {
      nextDue = this.recurrenceEngine.calculateNext(nextDue, task.frequency);
      iterations++;
    }

    if (nextDue > currentDue) {
      task.dueAt = nextDue.toISOString();
      await this.storage.saveTask(task);
      logger.info(`Advanced task "${task.name}" to ${nextDue.toISOString()}`);
    }
  }

  /**
   * Load last run timestamp from storage
   */
  private async loadLastRunTimestamp(): Promise<Date | null> {
    if (!this.plugin) {
      return null;
    }

    try {
      const data = await this.plugin.loadData(LAST_RUN_TIMESTAMP_KEY);
      if (data && data.timestamp) {
        return new Date(data.timestamp);
      }
    } catch (err) {
      logger.error("Failed to load last run timestamp:", err);
    }
    
    return null;
  }

  /**
   * Save last run timestamp to storage
   */
  private async saveLastRunTimestamp(timestamp: Date): Promise<void> {
    if (!this.plugin) {
      return;
    }

    try {
      await this.plugin.saveData(LAST_RUN_TIMESTAMP_KEY, {
        timestamp: timestamp.toISOString(),
      });
    } catch (err) {
      logger.error("Failed to save last run timestamp:", err);
    }
  }

  /**
   * Get recurrence engine for external use
   */
  getRecurrenceEngine(): RecurrenceEngine {
    return this.recurrenceEngine;
  }

  /**
   * Get timezone handler for external use
   */
  getTimezoneHandler(): TimezoneHandler {
    return this.timezoneHandler;
  }
}
