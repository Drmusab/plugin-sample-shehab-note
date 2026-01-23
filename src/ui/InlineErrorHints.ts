/**
 * Inline Error Hints - Display parse errors in a user-friendly way
 */

import type { ParseError } from "@/parser/InlineTaskParser";
import { toast } from "@/utils/notifications";
import * as logger from "@/utils/logger";

/**
 * Show parse error to user with actionable feedback
 */
export function showParseErrorHint(error: ParseError, blockId: string): void {
  logger.warn("Task parse error", { error, blockId });
  
  // Show user-friendly notification
  const message = `Invalid task syntax: ${error.message}`;
  toast.warning(message, 5000);
  
  // Log additional context if available
  if (error.token) {
    logger.info("Problematic token", { token: error.token });
  }
  if (error.position !== undefined) {
    logger.info("Error position", { position: error.position });
  }
}
