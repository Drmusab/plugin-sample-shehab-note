/**
 * Slash commands and keyboard shortcuts for SiYuan
 */

import type { Plugin } from "siyuan";
import { eventBus } from "@/core/EventBus";
import { taskManager } from "@/core";
import * as logger from "@/utils/logger";

/**
 * Register slash commands and keyboard shortcuts
 */
export function registerCommands(plugin: Plugin): void {
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
      await quickCompleteNextTask();
    },
  });

  logger.info("Registered slash commands and hotkeys");
}

/**
 * Dispatch event to open task creation dialog
 */
function dispatchCreateTaskEvent(): void {
  eventBus.emit("recurring-task-create", {
    source: "command",
  });
}

/**
 * Quick complete the next due task
 */
async function quickCompleteNextTask(): Promise<void> {
  try {
    if (!taskManager.isReady()) {
      logger.info("Task manager not ready");
      return;
    }

    const tasks = taskManager.getStorage().getTodayAndOverdueTasks();
    if (tasks.length === 0) {
      logger.info("No tasks due today");
      return;
    }

    // Get the most overdue task
    const task = tasks[0];
    
    // Dispatch complete event
    eventBus.emit("recurring-task-complete", {
      taskId: task.id,
    });
    
    logger.info(`Quick completing task: ${task.name}`);
  } catch (err) {
    logger.error("Failed to quick complete task", err);
  }
}
