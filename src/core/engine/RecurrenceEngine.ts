import type { Frequency } from "@/core/models/Frequency";
import * as logger from "@/utils/logger";
import { addDays, addWeeks, setTimeWithFallback, parseTime } from "@/utils/date";
import { MAX_RECURRENCE_ITERATIONS, MAX_RECOVERY_ITERATIONS } from "@/utils/constants";
import { RRule, rrulestr } from 'rrule';
import { toUTC, fromUTC, getUserTimezone } from "@/utils/timezone";

/**
 * @deprecated This custom recurrence engine is deprecated in favor of RecurrenceEngineRRULE.
 * It will be removed in v2.0.0 after all tasks are migrated to RRULE format.
 * DO NOT use this for new code.
 * 
 * For new code, use: import { RecurrenceEngineRRULE } from "@/core/engine/recurrence/RecurrenceEngineRRULE"
 * 
 * RecurrenceEngine calculates next occurrence dates based on frequency rules
 */
export class RecurrenceEngine {
  private normalizeInterval(interval: number): number {
    if (!Number.isFinite(interval) || interval < 1) {
      return 1;
    }
    return Math.floor(interval);
  }

  private normalizeWeekdays(weekdays?: number[]): number[] {
    if (!Array.isArray(weekdays)) {
      return [];
    }

    const unique = new Set<number>();
    for (const weekday of weekdays) {
      if (Number.isFinite(weekday) && weekday >= 0 && weekday <= 6) {
        unique.add(Math.floor(weekday));
      }
    }

    return Array.from(unique).sort((a, b) => a - b);
  }

  private normalizeDayOfMonth(dayOfMonth: number | undefined, fallback: number): number {
    const candidate = Number.isFinite(dayOfMonth) ? Math.floor(dayOfMonth as number) : fallback;
    return Math.min(Math.max(candidate, 1), 31);
  }

  private normalizeMonth(month: number | undefined, fallback: number): number {
    const candidate = Number.isFinite(month) ? Math.floor(month as number) : fallback;
    return Math.min(Math.max(candidate, 0), 11);
  }

  /**
   * Calculate the next occurrence date based on frequency
   * @param currentDue Current due date
   * @param frequency Recurrence rule
   * @param options Optional configuration (completionDate for "when done", whenDone flag override, timezone)
   * @returns Next occurrence date
   */
  calculateNext(
    currentDue: Date, 
    frequency: Frequency,
    options?: { completionDate?: Date; whenDone?: boolean; timezone?: string }
  ): Date {
    // Get timezone from options or use user's timezone
    const timezone = options?.timezone || getUserTimezone();
    
    // If frequency has rruleString, use rrule directly
    if (frequency.rruleString) {
      return this.calculateNextWithRRule(currentDue, frequency, options);
    }
    
    // Determine base date: use whenDone from options (if provided), 
    // then from frequency object, defaulting to false
    const whenDone = options?.whenDone ?? frequency.whenDone ?? false;
    
    // If whenDone is true and completionDate provided, calculate from completion date
    const baseDate = (whenDone && options?.completionDate) 
      ? options.completionDate 
      : currentDue;

    const { type, time } = frequency;
    const interval = this.normalizeInterval(frequency.interval);
    let nextDate: Date;

    switch (type) {
      case "daily":
        nextDate = this.calculateNextDaily(baseDate, interval);
        break;
      case "weekly":
        nextDate = this.calculateNextWeekly(
          baseDate,
          interval,
          this.normalizeWeekdays(frequency.weekdays)
        );
        break;
      case "monthly":
        nextDate = this.calculateNextMonthly(
          baseDate,
          interval,
          this.normalizeDayOfMonth(frequency.dayOfMonth, baseDate.getDate())
        );
        break;
      case "yearly":
        nextDate = this.calculateNextYearly(
          baseDate,
          interval,
          this.normalizeMonth(frequency.month, baseDate.getMonth()),
          this.normalizeDayOfMonth(frequency.dayOfMonth, baseDate.getDate())
        );
        break;
      default:
        throw new Error(`Unknown frequency type: ${type}`);
    }

    // Apply fixed time if specified
    if (time) {
      const { hours, minutes } = parseTime(time);
      if (Number.isFinite(hours) && Number.isFinite(minutes)) {
        const { date, shifted } = setTimeWithFallback(nextDate, hours, minutes);
        if (shifted) {
          logger.warn("DST shift detected while applying recurrence time", {
            requestedTime: time,
            original: nextDate.toISOString(),
            adjusted: date.toISOString(),
          });
        }
        nextDate = date;
      }
    }

    return nextDate;
  }

  /**
   * Calculate next occurrence using rrule
   */
  private calculateNextWithRRule(
    currentDue: Date,
    frequency: Frequency,
    options?: { completionDate?: Date; whenDone?: boolean }
  ): Date {
    try {
      // Determine base date: use whenDone from options (if provided), 
      // then from frequency object, defaulting to false
      const whenDone = options?.whenDone ?? frequency.whenDone ?? false;
      
      // If whenDone is true and completionDate provided, calculate from completion date
      const baseDate = (whenDone && options?.completionDate) 
        ? options.completionDate 
        : currentDue;

      // Parse the rrule string
      const rrule = rrulestr(frequency.rruleString!);
      
      // Get the next occurrence after the base date
      const nextOccurrence = rrule.after(baseDate, false);
      
      if (!nextOccurrence) {
        // If no next occurrence (e.g., UNTIL date passed), fall back to legacy logic
        logger.warn("RRule returned no next occurrence, falling back to legacy logic", {
          rruleString: frequency.rruleString,
          baseDate: baseDate.toISOString()
        });
        // Create a new frequency object without rruleString
        const { rruleString, naturalLanguage, ...legacyFrequency } = frequency as any;
        return this.calculateNext(baseDate, legacyFrequency as Frequency, options);
      }

      // Apply fixed time if specified in frequency
      let nextDate = nextOccurrence;
      if (frequency.time) {
        const { hours, minutes } = parseTime(frequency.time);
        if (Number.isFinite(hours) && Number.isFinite(minutes)) {
          const { date, shifted } = setTimeWithFallback(nextDate, hours, minutes);
          if (shifted) {
            logger.warn("DST shift detected while applying recurrence time", {
              requestedTime: frequency.time,
              original: nextDate.toISOString(),
              adjusted: date.toISOString(),
            });
          }
          nextDate = date;
        }
      }

      return nextDate;
    } catch (error) {
      // If rrule parsing fails, fall back to legacy logic
      logger.error("Failed to parse rrule, falling back to legacy logic", {
        error: error instanceof Error ? error.message : String(error),
        rruleString: frequency.rruleString
      });
      
      // Create a new frequency object without rruleString
      const { rruleString, naturalLanguage, ...legacyFrequency } = frequency as any;
      return this.calculateNext(currentDue, legacyFrequency as Frequency, options);
    }
  }

  /**
   * Calculate next daily occurrence
   */
  private calculateNextDaily(currentDue: Date, interval: number): Date {
    return addDays(currentDue, interval);
  }

  /**
   * Calculate next weekly occurrence
   */
  private calculateNextWeekly(
    currentDue: Date,
    interval: number,
    weekdays?: number[]
  ): Date {
    if (!weekdays || weekdays.length === 0) {
      // No specific weekdays, just add weeks
      return addWeeks(currentDue, interval);
    }

    const currentDay = this.getMondayIndex(currentDue);
    const maxIterations = Math.min(MAX_RECURRENCE_ITERATIONS, interval * 14);

    for (let daysAhead = 1; daysAhead <= maxIterations; daysAhead++) {
      const weeksSinceCurrent = Math.floor((currentDay + daysAhead) / 7);
      if (weeksSinceCurrent % interval !== 0) {
        continue;
      }

      const candidate = addDays(currentDue, daysAhead);
      const candidateDay = this.getMondayIndex(candidate);
      if (weekdays.includes(candidateDay)) {
        return candidate;
      }
    }

    logger.warn("Weekly recurrence guard hit, falling back to interval weeks.", {
      currentDue: currentDue.toISOString(),
      interval,
      weekdays,
    });
    return addWeeks(currentDue, interval);
  }

  /**
   * Convert JS Date.getDay() (Sunday=0) to Monday-based index (Monday=0).
   */
  private getMondayIndex(date: Date): number {
    return (date.getDay() + 6) % 7;
  }

  /**
   * Calculate next monthly occurrence
   */
  private calculateNextMonthly(
    currentDue: Date,
    interval: number,
    dayOfMonth?: number
  ): Date {
    const targetDay = dayOfMonth ?? currentDue.getDate();
    // Preserve the original day-of-month intent (e.g., 31st) and clip only for
    // the target month. This ensures Jan 31 -> Feb 28/29, then resumes on Mar 31
    // because the stored targetDay stays 31, avoiding "sticky" February dates.
    const currentYear = currentDue.getFullYear();
    const currentMonth = currentDue.getMonth();
    const totalMonths = currentMonth + interval;
    const year = currentYear + Math.floor(totalMonths / 12);
    const month = ((totalMonths % 12) + 12) % 12;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const day = Math.min(targetDay, daysInMonth);
    const nextDate = new Date(currentDue);
    nextDate.setFullYear(year, month, day);
    return nextDate;
  }

  /**
   * Calculate next yearly occurrence
   */
  private calculateNextYearly(
    currentDue: Date,
    interval: number,
    month: number,
    dayOfMonth?: number
  ): Date {
    const targetDay = dayOfMonth ?? currentDue.getDate();
    const year = currentDue.getFullYear() + interval;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const day = Math.min(targetDay, daysInMonth);
    const nextDate = new Date(currentDue);
    nextDate.setFullYear(year, month, day);
    return nextDate;
  }

  /**
   * Get all occurrences within a date range
   * @param startDate Start of range
   * @param endDate End of range
   * @param frequency Recurrence rule
   * @param firstOccurrence First occurrence date
   * @returns Array of occurrence dates
   */
  getOccurrencesInRange(
    startDate: Date,
    endDate: Date,
    frequency: Frequency,
    firstOccurrence: Date
  ): Date[] {
    const occurrences: Date[] = [];
    let currentDate = new Date(firstOccurrence);

    // Safety limit to prevent infinite loops for malformed frequencies or
    // extreme ranges while keeping recurrence deterministic.
    let iterations = 0;

    while (currentDate <= endDate && iterations < MAX_RECURRENCE_ITERATIONS) {
      if (currentDate >= startDate) {
        occurrences.push(new Date(currentDate));
      }
      currentDate = this.calculateNext(currentDate, frequency);
      iterations++;
    }

    return occurrences;
  }

  /**
   * Get all missed occurrences between two dates
   * Used for recovering missed tasks after plugin restart
   * @param lastCheckedAt Last time tasks were checked
   * @param now Current time
   * @param frequency Recurrence rule
   * @param firstOccurrence First occurrence date (task creation date)
   * @returns Array of missed occurrence dates
   */
  getMissedOccurrences(
    lastCheckedAt: Date,
    now: Date,
    frequency: Frequency,
    firstOccurrence: Date
  ): Date[] {
    const missed: Date[] = [];
    let current = new Date(firstOccurrence);
    
    // Advance to first occurrence after lastCheckedAt. Uses the same recurrence
    // math to preserve month-end clipping and stored dayOfMonth intent.
    let advanceIterations = 0;
    
    while (current <= lastCheckedAt && advanceIterations < MAX_RECURRENCE_ITERATIONS) {
      current = this.calculateNext(current, frequency);
      advanceIterations++;
    }
    
    // Collect all occurrences between lastCheckedAt and now with a recovery
    // cap to avoid runaway loops for long downtime or corrupt timestamps.
    let iterations = 0;
    
    while (current < now && iterations < MAX_RECOVERY_ITERATIONS) {
      missed.push(new Date(current));
      current = this.calculateNext(current, frequency);
      iterations++;
    }
    if (iterations >= MAX_RECOVERY_ITERATIONS) {
      logger.warn("Recovery iteration cap hit while computing missed occurrences", {
        lastCheckedAt: lastCheckedAt.toISOString(),
        now: now.toISOString(),
        frequency,
        firstOccurrence: firstOccurrence.toISOString(),
        cap: MAX_RECOVERY_ITERATIONS,
      });
    }

    return missed;
  }
}
