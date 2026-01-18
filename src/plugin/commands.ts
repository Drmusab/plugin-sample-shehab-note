/**
 * Slash commands and keyboard shortcuts for SiYuan
 */

import type { Plugin } from "siyuan";
import type { TaskRepositoryProvider } from "@/core/storage/TaskRepository";
import type { RecurrenceEngine } from "@/core/engine/RecurrenceEngine";
import { createTask } from "@/core/models/Task";
import { pluginEventBus } from "@/core/events/PluginEventBus";
import { TaskCommands } from "@/commands/TaskCommands";
import * as logger from "@/utils/logger";

/**
 * Register slash commands and keyboard shortcuts
 */
export function registerCommands(
  plugin: Plugin,
  repository: TaskRepositoryProvider,
  recurrenceEngine?: RecurrenceEngine
): void {
  const taskCommands = new TaskCommands(repository, recurrenceEngine);

  // Slash command: /task or /recurring - Create recurring task from selection
  plugin.addCommand({
    langKey: "createRecurringTask",
    hotkey: "⌘⇧R",
    callback: () => {
      dispatchCreateTaskEvent();
    },
  });

  // Hotkey: ⌘⇧T - Open Recurring Tasks dock
  plugin.addCommand({
    langKey: "openRecurringTasksDock",
    hotkey: "⌘⇧T",
    callback: () => {
      // Open the dock
      plugin.openDock();
    },
  });

  // Hotkey: ⌘⇧D - Quick complete next due task
  plugin.addCommand({
    langKey: "quickCompleteNextTask",
    hotkey: "⌘⇧D",
    callback: async () => {
      await quickCompleteNextTask(repository, taskCommands);
    },
  });

  // Hotkey: ⌘⇧X - Toggle task status
  plugin.addCommand({
    langKey: "toggleTaskStatus",
    hotkey: "⌘⇧X",
    callback: async () => {
      const taskId = await getCurrentTaskId();
      if (taskId) {
        await taskCommands.toggleStatus(taskId);
      }
    },
  });

  // Hotkey: ⌘⇧E - Open task editor
  plugin.addCommand({
    langKey: "openTaskEditor",
    hotkey: "⌘⇧E",
    callback: () => {
      dispatchEditTaskEvent();
    },
  });

  // Hotkey: ⌘⇧N - Quick add task
  plugin.addCommand({
    langKey: "quickAddTask",
    hotkey: "⌘⇧N",
    callback: () => {
      dispatchCreateTaskEvent();
    },
  });

  logger.info("Registered slash commands and hotkeys");
}

/**
 * Dispatch event to open task creation dialog
 */
function dispatchCreateTaskEvent(): void {
  // Use pluginEventBus for internal communication
  pluginEventBus.emit('task:create', {
    source: 'command',
  });
  
  // Also dispatch window event for backward compatibility
  const event = new CustomEvent("recurring-task-create", {
    detail: {
      source: "command",
    },
  });
  window.dispatchEvent(event);
}

/**
 * Dispatch event to open task editor
 */
function dispatchEditTaskEvent(): void {
  pluginEventBus.emit('task:edit', {
    source: 'command',
  });
  
  const event = new CustomEvent("recurring-task-edit", {
    detail: {
      source: "command",
    },
  });
  window.dispatchEvent(event);
}

/**
 * Quick complete the next due task
 */
async function quickCompleteNextTask(
  repository: TaskRepositoryProvider,
  taskCommands: TaskCommands
): Promise<void> {
  try {
    const tasks = repository.getTodayAndOverdueTasks();
    if (tasks.length === 0) {
      logger.info("No tasks due today");
      return;
    }

    // Get the most overdue task
    const task = tasks[0];
    
    // Use TaskCommands to complete the task
    await taskCommands.completeTask(task.id);
    
    logger.info(`Quick completing task: ${task.name}`);
  } catch (err) {
    logger.error("Failed to quick complete task", err);
  }
}

/**
 * Get current task ID from selection/cursor
 * This is a placeholder - in a real implementation, this would
 * interact with SiYuan's API to get the current block
 */
async function getCurrentTaskId(): Promise<string | null> {
  // TODO: Implement SiYuan block detection
  // For now, return null
  return null;
}
