import type { Task } from "@/core/models/Task";
import type { Frequency } from "@/core/models/Frequency";
import { RRule, rrulestr } from "rrule";
import { getUserTimezone } from "@/utils/timezone";
import * as logger from "@/utils/logger";

/**
 * RecurrenceEngine using RFC 5545-compliant RRULE as single source of truth
 * 
 * This is the ONLY module that should import 'rrule' library directly.
 * All other modules must use this adapter to ensure consistent behavior.
 */
export class RecurrenceEngineRRULE {
  // Cache parsed RRule objects for performance
  private rruleCache = new Map<string, RRule>();

  /**
   * Get next occurrence after a reference date
   * @param task - Task with RRULE
   * @param from - Reference date (completion date for whenDone, dueAt otherwise)
   * @returns Next occurrence or null if series ended
   */
  getNextOccurrence(task: Task, from: Date): Date | null {
    if (!task.frequency?.rruleString) {
      logger.warn("Task has no RRULE string", { taskId: task.id });
      return null;
    }

    try {
      const rrule = this.getRRule(task);
      const baseDate = this.getBaseDate(task, from);
      
      // Get next occurrence after baseDate (false = non-inclusive)
      const next = rrule.after(baseDate, false);
      
      if (!next) {
        return null;
      }

      // Apply fixed time if specified
      return this.applyFixedTime(next, task.frequency);
    } catch (error) {
      logger.error("Failed to get next occurrence", {
        taskId: task.id,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Get all occurrences in a date range (for calendar views)
   * @param task - Task with RRULE
   * @param from - Start of range
   * @param to - End of range
   * @returns Array of occurrence dates
   */
  getOccurrencesBetween(task: Task, from: Date, to: Date): Date[] {
    if (!task.frequency?.rruleString) {
      logger.warn("Task has no RRULE string", { taskId: task.id });
      return [];
    }

    try {
      const rrule = this.getRRule(task);
      
      // Get all occurrences in range (inclusive)
      const occurrences = rrule.between(from, to, true);
      
      // Apply fixed time if specified
      return occurrences.map(date => this.applyFixedTime(date, task.frequency));
    } catch (error) {
      logger.error("Failed to get occurrences between dates", {
        taskId: task.id,
        from: from.toISOString(),
        to: to.toISOString(),
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }

  /**
   * Check if a specific date is a valid occurrence
   * @param task - Task with RRULE
   * @param date - Date to check
   * @returns true if date matches RRULE
   */
  isOccurrenceOn(task: Task, date: Date): boolean {
    if (!task.frequency?.rruleString) {
      return false;
    }

    try {
      const rrule = this.getRRule(task);
      
      // Get occurrences on the same day
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      
      const occurrences = rrule.between(startOfDay, endOfDay, true);
      return occurrences.length > 0;
    } catch (error) {
      logger.error("Failed to check if date is occurrence", {
        taskId: task.id,
        date: date.toISOString(),
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * Validate RRULE string and provide human-readable errors
   * @param rruleString - RRULE to validate
   * @returns { valid: boolean, error?: string }
   */
  validateRRule(rruleString: string): { valid: boolean; error?: string } {
    if (!rruleString || typeof rruleString !== 'string') {
      return { valid: false, error: 'RRULE string is required' };
    }

    try {
      // Try to parse the RRULE
      const rrule = rrulestr(rruleString);
      
      // Basic validation: ensure it can generate at least one occurrence
      const now = new Date();
      const next = rrule.after(now, true);
      
      if (!next) {
        // Check if it's a terminated series (UNTIL or COUNT)
        const options = rrule.options;
        if (options.until && options.until < now) {
          return { valid: false, error: 'RRULE has expired (UNTIL date is in the past)' };
        }
        if (options.count && options.count === 0) {
          return { valid: false, error: 'RRULE COUNT is 0' };
        }
      }

      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Invalid RRULE format'
      };
    }
  }

  /**
   * Convert RRULE to human-readable text
   * @param rruleString - RRULE to convert
   * @returns "Every weekday", "Monthly on the 15th", etc.
   */
  toNaturalLanguage(rruleString: string): string {
    try {
      const rrule = rrulestr(rruleString);
      return rrule.toText();
    } catch (error) {
      logger.error("Failed to convert RRULE to natural language", {
        rruleString,
        error: error instanceof Error ? error.message : String(error)
      });
      return rruleString;
    }
  }

  /**
   * Get or create cached RRule instance
   */
  private getRRule(task: Task): RRule {
    const cacheKey = `${task.id}:${task.frequency.rruleString}`;
    
    let rrule = this.rruleCache.get(cacheKey);
    if (rrule) {
      return rrule;
    }

    // Parse and cache
    rrule = rrulestr(task.frequency.rruleString!);
    
    // Set dtstart from frequency if available
    if (task.frequency.dtstart) {
      const dtstart = new Date(task.frequency.dtstart);
      rrule.options.dtstart = dtstart;
    }
    
    // Set timezone
    const timezone = task.frequency.timezone || task.timezone || getUserTimezone();
    rrule.options.tzid = timezone;
    
    this.rruleCache.set(cacheKey, rrule);
    return rrule;
  }

  /**
   * Determine base date for next occurrence calculation
   * For whenDone tasks, use completion date; otherwise use due date
   */
  private getBaseDate(task: Task, from: Date): Date {
    const whenDone = task.frequency.whenDone ?? task.whenDone ?? false;
    
    if (whenDone) {
      // For whenDone, calculate from the reference date (completion date)
      return from;
    }
    
    // For fixed schedule, calculate from the reference date but maintain original schedule
    return from;
  }

  /**
   * Apply fixed time to a date if specified in frequency
   */
  private applyFixedTime(date: Date, frequency: Frequency): Date {
    if (!frequency.time) {
      return date;
    }

    try {
      const [hours, minutes] = frequency.time.split(':').map(Number);
      if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
        return date;
      }

      const result = new Date(date);
      result.setHours(hours, minutes, 0, 0);
      return result;
    } catch (error) {
      logger.warn("Failed to apply fixed time", {
        time: frequency.time,
        error: error instanceof Error ? error.message : String(error)
      });
      return date;
    }
  }

  /**
   * Clear the RRule cache (useful for testing or memory management)
   */
  clearCache(): void {
    this.rruleCache.clear();
  }

  /**
   * Get cache size (useful for monitoring)
   */
  getCacheSize(): number {
    return this.rruleCache.size;
  }
}
