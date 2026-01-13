import type { Task } from "@/core/models/Task";
import { recordCompletion, recordMiss } from "@/core/models/Task";
import type { Scheduler } from "@/core/engine/Scheduler";
import type { EventService } from "@/services/EventService";
import type { RecurrenceEngine } from "@/core/engine/RecurrenceEngine";
import type { TimezoneHandler } from "@/core/engine/TimezoneHandler";

export class RecurringTaskService {
  private scheduler: Scheduler;
  private eventService: EventService;

  constructor(scheduler: Scheduler, eventService: EventService) {
    this.scheduler = scheduler;
    this.eventService = eventService;
  }

  getRecurrenceEngine(): RecurrenceEngine {
    return this.scheduler.getRecurrenceEngine();
  }

  getTimezoneHandler(): TimezoneHandler {
    return this.scheduler.getTimezoneHandler();
  }

  buildCompletionUpdate(task: Task): Task {
    const nextTask = { ...task };
    recordCompletion(nextTask);
    const nextDue = this.scheduler
      .getRecurrenceEngine()
      .calculateNext(new Date(nextTask.dueAt), nextTask.frequency);
    nextTask.dueAt = nextDue.toISOString();
    return nextTask;
  }

  buildSkipUpdate(task: Task): Task {
    const nextTask = { ...task };
    recordMiss(nextTask);
    const nextDue = this.scheduler
      .getRecurrenceEngine()
      .calculateNext(new Date(nextTask.dueAt), nextTask.frequency);
    nextTask.dueAt = nextDue.toISOString();
    return nextTask;
  }

  buildDelayToTomorrowUpdate(task: Task): Task {
    const nextTask = { ...task };
    const currentDue = new Date(nextTask.dueAt);
    const tomorrow = this.scheduler.getTimezoneHandler().tomorrow();
    tomorrow.setHours(currentDue.getHours(), currentDue.getMinutes(), 0, 0);
    nextTask.dueAt = tomorrow.toISOString();
    nextTask.snoozeCount = (nextTask.snoozeCount || 0) + 1;
    nextTask.updatedAt = new Date().toISOString();
    return nextTask;
  }

  async completeTask(task: Task): Promise<void> {
    await this.eventService.emitTaskEvent("task.completed", task);
    await this.scheduler.markTaskDone(task.id);
  }

  async snoozeToTomorrow(task: Task): Promise<void> {
    await this.eventService.emitTaskEvent("task.snoozed", task);
    await this.scheduler.delayTaskToTomorrow(task.id);
  }

  async skipTask(task: Task): Promise<void> {
    await this.eventService.emitTaskEvent("task.skipped", task);
    await this.scheduler.skipTaskOccurrence(task.id);
  }
}
