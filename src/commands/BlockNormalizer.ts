/**
 * Block Normalizer - Converts saved tasks back to canonical inline format
 */

import type { Task } from "@/core/models/Task";
import type { ParsedTask } from "@/parser/InlineTaskParser";
import { normalizeTask } from "@/parser/InlineTaskParser";
import type { TaskRepositoryProvider } from "@/core/storage/TaskRepository";
import type { SiYuanBlockAPI } from "@/core/api/SiYuanApiAdapter";
import * as logger from "@/utils/logger";
import { toast } from "@/utils/notifications";

/**
 * Save task and normalize the associated block content
 */
export async function saveAndNormalizeBlock(
  task: Task,
  blockId: string,
  repository: TaskRepositoryProvider,
  blockApi: SiYuanBlockAPI
): Promise<void> {
  // 1. Save to storage
  const savedTask = await repository.saveTask(task);
  
  logger.info("Task saved, normalizing block", { taskId: savedTask.id, blockId });

  // 2. Convert Task to ParsedTask format for normalization
  const parsedTask: ParsedTask = {
    description: savedTask.name || "",
    status: savedTask.status || 'todo',
    dueDate: savedTask.dueAt ? savedTask.dueAt.substring(0, 10) : undefined,
    scheduledDate: savedTask.scheduledAt ? savedTask.scheduledAt.substring(0, 10) : undefined,
    startDate: savedTask.startAt ? savedTask.startAt.substring(0, 10) : undefined,
    priority: savedTask.priority === 'high' ? 'high' : 
              savedTask.priority === 'low' ? 'low' :
              savedTask.priority === 'normal' ? 'medium' : undefined,
    id: savedTask.id,
    tags: savedTask.tags,
    recurrence: savedTask.frequency ? {
      rule: savedTask.frequency.rrule || '',
      mode: 'scheduled' // Default mode, could be enhanced later
    } : undefined,
    dependsOn: savedTask.dependsOn
  };

  // 3. Normalize inline content
  const normalizedContent = normalizeTask(parsedTask);
  
  logger.info("Normalized content", { normalizedContent });

  // 4. Update block via SiYuan API
  try {
    await updateBlockContent(blockId, normalizedContent, blockApi);
    logger.info("Block normalized successfully");
  } catch (error) {
    logger.error("Block normalization failed", error);
    // Don't fail the whole operation - task is already saved
    toast.warning("Task saved, but block update failed. Please refresh.");
  }
}

/**
 * Update block content using SiYuan API
 * Note: SiYuan's updateBlock API works with markdown content
 */
async function updateBlockContent(
  blockId: string,
  content: string,
  blockApi: SiYuanBlockAPI
): Promise<void> {
  // Use setBlockAttrs to update the block's content
  // In SiYuan, we typically update the markdown directly via API
  // For now, we'll set a custom attribute to track the normalization
  await blockApi.setBlockAttrs(blockId, {
    'custom-recurring-task-normalized': 'true',
    'custom-task-content': content
  });
  
  // Note: Full block content update would require a different API call
  // This is a placeholder that demonstrates the concept
  // In production, you'd use the SQL API or kernel API to update block markdown
}
