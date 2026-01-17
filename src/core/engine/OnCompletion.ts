import type { Task } from "@/core/models/Task";
import * as logger from "@/utils/logger";

export type OnCompletionAction = 'keep' | 'delete';

export interface OnCompletionResult {
  success: boolean;
  warnings?: string[];
  error?: string;
}

/**
 * Handler for task completion actions
 * Manages what happens to a task when it's completed (keep or delete)
 */
export class OnCompletionHandler {
  private siyuanApi: any;

  constructor(siyuanApi?: any) {
    this.siyuanApi = siyuanApi;
  }

  /**
   * Execute the onCompletion action for a task
   * @param task - The task being completed
   * @param action - keep or delete
   * @returns Result with success/error and warnings
   */
  async execute(task: Task, action: OnCompletionAction): Promise<OnCompletionResult> {
    try {
      if (action === 'keep') {
        // Keep action: task stays in place, just marked as done
        logger.info(`Task "${task.name}" completed and kept`, { taskId: task.id });
        return { success: true };
      }

      if (action === 'delete') {
        // Delete action: check for nested items first
        if (!task.linkedBlockId) {
          // No linked block, can't delete from document
          logger.warn(`Task "${task.name}" has no linkedBlockId, cannot delete from document`, { taskId: task.id });
          return { 
            success: true,
            warnings: ['Task has no linked block, removed from task list only']
          };
        }

        // Check for nested items
        const hasNested = await this.hasNestedItems(task.linkedBlockId);
        if (hasNested) {
          logger.warn(`Cannot delete task with nested items`, { 
            taskId: task.id, 
            blockId: task.linkedBlockId 
          });
          return {
            success: false,
            error: "Cannot delete task with nested items",
            warnings: ['Task has sub-items. Please remove them first or use "keep" mode.']
          };
        }

        // Safe to delete
        if (this.siyuanApi && this.siyuanApi.deleteBlock) {
          await this.siyuanApi.deleteBlock({ id: task.linkedBlockId });
          logger.info(`Task "${task.name}" completed and deleted from document`, { 
            taskId: task.id,
            blockId: task.linkedBlockId 
          });
        } else {
          logger.warn('SiYuan API not available, cannot delete block from document');
          return {
            success: true,
            warnings: ['Block could not be deleted from document (API unavailable)']
          };
        }

        return { success: true };
      }

      return {
        success: false,
        error: `Unknown onCompletion action: ${action}`
      };
    } catch (err) {
      logger.error(`Failed to execute onCompletion action`, {
        taskId: task.id,
        action,
        error: err
      });
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Check if task has nested children (sub-items)
   * @param taskBlockId - SiYuan block ID of the task
   * @returns true if task has child blocks
   */
  async hasNestedItems(taskBlockId: string): Promise<boolean> {
    if (!this.siyuanApi || !this.siyuanApi.getChildBlocks) {
      // If API not available, assume no nested items (safer default)
      logger.warn('SiYuan API not available for nested item check');
      return false;
    }

    try {
      const children = await this.siyuanApi.getChildBlocks({ id: taskBlockId });
      return children && children.length > 0;
    } catch (err) {
      logger.error('Failed to check for nested items', { blockId: taskBlockId, error: err });
      // On error, assume has nested items (safer default - prevents deletion)
      return true;
    }
  }
}
