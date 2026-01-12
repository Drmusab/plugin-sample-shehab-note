import type { Frequency } from "@/core/models/Frequency";
import { addDays, addWeeks, setTime, parseTime } from "@/utils/date";
import { MAX_RECURRENCE_ITERATIONS, MAX_RECOVERY_ITERATIONS } from "@/utils/constants";

/**
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

  /**
   * Calculate the next occurrence date based on frequency
   * @param currentDue Current due date
   * @param frequency Recurrence rule
   * @returns Next occurrence date
   */
  calculateNext(currentDue: Date, frequency: Frequency): Date {
    const { type, time } = frequency;
    const interval = this.normalizeInterval(frequency.interval);
    let nextDate: Date;

    switch (type) {
      case "daily":
        nextDate = this.calculateNextDaily(currentDue, interval);
        break;
      case "weekly":
        nextDate = this.calculateNextWeekly(
          currentDue,
          interval,
          this.normalizeWeekdays(frequency.weekdays)
        );
        break;
      case "monthly":
        nextDate = this.calculateNextMonthly(
          currentDue,
          interval,
          this.normalizeDayOfMonth(frequency.dayOfMonth, currentDue.getDate())
        );
        break;
      default:
        throw new Error(`Unknown frequency type: ${type}`);
    }

    // Apply fixed time if specified
    if (time) {
      const { hours, minutes } = parseTime(time);
      if (Number.isFinite(hours) && Number.isFinite(minutes)) {
        nextDate = setTime(nextDate, hours, minutes);
      }
    }

    return nextDate;
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

    // Find next occurrence on specified weekdays
    const currentDay = (currentDue.getDay() + 6) % 7;
    let daysToAdd = 0;
    let found = false;

    // Sort weekdays to process in order
    const sortedWeekdays = weekdays;

    // First, check remaining days in current week
    for (const weekday of sortedWeekdays) {
      if (weekday > currentDay) {
        daysToAdd = weekday - currentDay;
        found = true;
        break;
      }
    }

    // If not found in current week, go to next interval period
    if (!found) {
      // Move to first weekday in the next occurrence
      const firstWeekday = sortedWeekdays[0];
      // Calculate days to the first weekday of next interval
      const daysToEndOfWeek = 7 - currentDay;
      const weeksToSkip = interval - 1;
      daysToAdd = daysToEndOfWeek + (weeksToSkip * 7) + firstWeekday;
    }

    return addDays(currentDue, daysToAdd);
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

    // Safety limit to prevent infinite loops
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
    
    // Advance to first occurrence after lastCheckedAt
    let advanceIterations = 0;
    
    while (current <= lastCheckedAt && advanceIterations < MAX_RECURRENCE_ITERATIONS) {
      current = this.calculateNext(current, frequency);
      advanceIterations++;
    }
    
    // Collect all occurrences between lastCheckedAt and now
    let iterations = 0;
    
    while (current < now && iterations < MAX_RECOVERY_ITERATIONS) {
      missed.push(new Date(current));
      current = this.calculateNext(current, frequency);
      iterations++;
    }
    
    return missed;
  }
}
