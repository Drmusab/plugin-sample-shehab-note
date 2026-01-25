import { Router } from '../webhook/Router';
import { TaskCommandHandler, ITaskManager } from './handlers/TaskCommandHandler';
import { QueryCommandHandler, IStorageService } from './handlers/QueryCommandHandler';
import { RecurrenceCommandHandler } from './handlers/RecurrenceCommandHandler';
import { PreviewCommandHandler } from './handlers/PreviewCommandHandler';
import { TaskValidator } from './validation/TaskValidator';
import { RecurrenceLimitsConfig } from '../config/WebhookConfig';
import { IRecurrenceEngine } from '../services/RecurrenceEngine';
import { ISchedulerService } from '../services/SchedulerService';
import { WebhookError } from '../webhook/types/Error';

/**
 * Command registry - registers all command handlers
 */
export class CommandRegistry {
  private taskHandler: TaskCommandHandler;
  private queryHandler: QueryCommandHandler;
  private recurrenceHandler: RecurrenceCommandHandler;
  private previewHandler: PreviewCommandHandler;

  constructor(
    private router: Router,
    taskManager: ITaskManager,
    storage: IStorageService,
    recurrenceEngine: IRecurrenceEngine,
    scheduler: ISchedulerService,
    recurrenceLimits: RecurrenceLimitsConfig
  ) {
    const validator = new TaskValidator(recurrenceLimits);
    
    this.taskHandler = new TaskCommandHandler(taskManager, validator);
    this.queryHandler = new QueryCommandHandler(storage);
    this.recurrenceHandler = new RecurrenceCommandHandler(
      taskManager,
      recurrenceEngine,
      scheduler,
      validator
    );
    this.previewHandler = new PreviewCommandHandler(taskManager);

    this.registerCommands();
  }

  /**
   * Register all commands
   */
  private registerCommands(): void {
    // Task commands
    this.router.register('v1/tasks/create', this.wrapHandler(
      (data, context) => this.taskHandler.handleCreate(data, context)
    ));

    this.router.register('v1/tasks/update', this.wrapHandler(
      (data, context) => this.taskHandler.handleUpdate(data, context)
    ));

    this.router.register('v1/tasks/complete', this.wrapHandler(
      (data, context) => this.taskHandler.handleComplete(data, context)
    ));

    this.router.register('v1/tasks/delete', this.wrapHandler(
      (data, context) => this.taskHandler.handleDelete(data, context)
    ));

    this.router.register('v1/tasks/get', this.wrapHandler(
      (data, context) => this.taskHandler.handleGet(data, context)
    ));

    // Query commands
    this.router.register('v1/query/list', this.wrapHandler(
      (data, context) => this.queryHandler.handleList(data, context)
    ));

    // Recurrence commands
    this.router.register('v1/recurrence/pause', this.wrapHandler(
      (data, context) => this.recurrenceHandler.handlePause(data, context)
    ));

    this.router.register('v1/recurrence/resume', this.wrapHandler(
      (data, context) => this.recurrenceHandler.handleResume(data, context)
    ));

    this.router.register('v1/recurrence/skip', this.wrapHandler(
      (data, context) => this.recurrenceHandler.handleSkip(data, context)
    ));

    this.router.register('v1/recurrence/update-pattern', this.wrapHandler(
      (data, context) => this.recurrenceHandler.handleUpdatePattern(data, context)
    ));

    this.router.register('v1/recurrence/recalculate', this.wrapHandler(
      (data, context) => this.recurrenceHandler.handleRecalculate(data, context)
    ));

    // Preview commands
    this.router.register('v1/recurrence/preview-occurrences', this.wrapHandler(
      (data, context) => this.previewHandler.handlePreview(data, context)
    ));
  }

  /**
   * Wrap handler to convert CommandResult to router format
   */
  private wrapHandler(
    handler: (data: any, context: any) => Promise<any>
  ): (command: string, data: any, context: any) => Promise<any> {
    return async (command: string, data: any, context: any) => {
      const result = await handler(data, context);
      if (result.status === 'error') {
        throw new WebhookError(
          result.error!.code as any,
          result.error!.message,
          result.error!.details
        );
      }
      return result.result;
    };
  }
}
