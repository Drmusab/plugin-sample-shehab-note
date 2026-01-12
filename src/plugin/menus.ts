/**
 * Block context menu integration for SiYuan
 */

import type { Plugin } from "siyuan";
import * as logger from "@/utils/logger";

/**
 * Register block context menu items
 */
export function registerBlockMenu(plugin: Plugin): void {
  // Add context menu item when clicking block icons
  plugin.addDock({
    type: "file",
    position: "LeftBottom",
    size: { width: 200, height: 0 },
    icon: "",
    title: "",
  });

  logger.info("Registered block context menu");
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
