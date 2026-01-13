/**
 * Block context menu integration for SiYuan
 * Based on patterns from plugin-block-reminder (blockIconEvent) and siyuan-plugin-task-list (addBlockMenuForTaskNode)
 */

import type { Plugin } from "siyuan";
import { TaskManager } from "@/core/managers/TaskManager";
import * as logger from "@/utils/logger";
import { snoozeTask, snoozeToTomorrow } from "@/utils/snooze";

/**
 * Register block context menu items
 */
export function registerBlockMenu(plugin: Plugin): void {
  // Add context menu item when clicking block icons
  plugin.eventBus.on('click-blockicon', ({ detail }: any) => {
    const blockElements = detail.blockElements;
    if (!blockElements || blockElements.length === 0) {
      return;
    }
    
    const blockElement = blockElements[0];
    const blockId = blockElement?.getAttribute('data-node-id');
    if (!blockId) {
      return;
    }
    
    const blockContent = blockElement?.textContent || '';
    
    // Add "Create Recurring Task" menu item
    detail.menu.addItem({
      icon: 'iconCalendar',
      label: plugin.i18n?.createRecurringTask || 'Create Recurring Task',
      click: () => {
        window.dispatchEvent(new CustomEvent('recurring-task-create', {
          detail: {
            source: 'block-menu',
            linkedBlockId: blockId,
            linkedBlockContent: blockContent,
            suggestedName: extractTaskName(blockContent),
            suggestedTime: extractTimeFromContent(blockContent),
          }
        }));
      },
    });
    
    // Check if block already has a recurring task
    try {
      const manager = TaskManager.getInstance();
      if (manager.isReady()) {
        const storage = manager.getStorage();
        const existingTask = storage.getTaskByBlockId(blockId);
        
        if (existingTask) {
          // Add separator
          detail.menu.addSeparator();
          
          // Add quick actions for existing task
          detail.menu.addItem({
            icon: 'iconCheck',
            label: plugin.i18n?.completeTask || 'Complete Task',
            click: () => {
              window.dispatchEvent(new CustomEvent('recurring-task-complete', {
                detail: { taskId: existingTask.id }
              }));
            },
          });
          
          // Add snooze submenu
          const snoozeSubmenu: any[] = [
            {
              label: '15 minutes',
              click: () => snoozeTask(existingTask.id, 15),
            },
            {
              label: '1 hour',
              click: () => snoozeTask(existingTask.id, 60),
            },
            {
              label: 'Tomorrow',
              click: () => snoozeToTomorrow(existingTask.id),
            },
          ];
          
          detail.menu.addItem({
            icon: 'iconClock',
            label: plugin.i18n?.snoozeTask || 'Snooze Task',
            submenu: snoozeSubmenu,
          });
        }
      }
    } catch (err) {
      // TaskManager not available, skip quick actions
      logger.debug('TaskManager not available for quick actions');
    }
  });

  logger.info("Registered block context menu");
}

/**
 * Extract task name from block content
 */
function extractTaskName(content: string): string {
  // Extract first line or first 50 chars
  const firstLine = content.split('\n')[0].trim();
  return firstLine.length > 50 ? firstLine.substring(0, 50) + '...' : firstLine;
}

/**
 * Extract time from block content
 * Looks for patterns like "09:00", "9:00 AM", "14:30"
 */
export function extractTimeFromContent(content: string): string | null {
  // Pattern: HH:mm or H:mm with optional AM/PM
  const timePattern = /\b(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?\b/;
  const match = content.match(timePattern);
  
  if (match) {
    let hours = parseInt(match[1], 10);
    const minutes = match[2];
    const meridiem = match[3]?.toUpperCase();
    
    // Convert to 24-hour format if needed
    if (meridiem === "PM" && hours < 12) {
      hours += 12;
    } else if (meridiem === "AM" && hours === 12) {
      hours = 0;
    }
    
    return `${hours.toString().padStart(2, "0")}:${minutes}`;
  }
  
  return null;
}

/**
 * Create task from block
 */
export function createTaskFromBlock(blockId: string, blockContent: string): void {
  const time = extractTimeFromContent(blockContent);
  
  // Dispatch event to create task with block info
  const event = new CustomEvent("recurring-task-create", {
    detail: {
      source: "block",
      blockId,
      blockContent,
      time,
    },
  });
  window.dispatchEvent(event);
  
  logger.info(`Creating task from block: ${blockId}`);
}
