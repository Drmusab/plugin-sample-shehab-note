/**
 * Slash commands and keyboard shortcuts for SiYuan
 */

import type { Plugin } from "siyuan";
import type { TaskStorage } from "@/core/storage/TaskStorage";
import { createTask } from "@/core/models/Task";
import * as logger from "@/utils/logger";

/**
 * Register slash commands and keyboard shortcuts
 */
export function registerCommands(plugin: Plugin, storage: TaskStorage): void {
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
      await quickCompleteNextTask(storage);
    },
  });

  logger.info("Registered slash commands and hotkeys");
}

/**
 * Dispatch event to open task creation dialog
 */
function dispatchCreateTaskEvent(): void {
  const event = new CustomEvent("recurring-task-create", {
    detail: {
      source: "command",
    },
  });
  window.dispatchEvent(event);
}

/**
 * Quick complete the next due task
 */
async function quickCompleteNextTask(storage: TaskStorage): Promise<void> {
  try {
    const tasks = storage.getTodayAndOverdueTasks();
    if (tasks.length === 0) {
      logger.info("No tasks due today");
      return;
    }

    // Get the most overdue task
    const task = tasks[0];
    
    // Dispatch complete event
    const event = new CustomEvent("recurring-task-complete", {
      detail: {
        taskId: task.id,
      },
    });
    window.dispatchEvent(event);
    
    logger.info(`Quick completing task: ${task.name}`);
  } catch (err) {
    logger.error("Failed to quick complete task", err);
  }
}
