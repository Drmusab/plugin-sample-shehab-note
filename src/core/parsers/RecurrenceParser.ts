import type { Frequency } from "../models/Frequency";

/**
 * Parsed recurrence result
 */
export interface ParsedRecurrence {
  frequency: Frequency;
  raw: string;
  isValid: boolean;
  error?: string;
}

/**
 * Natural language recurrence parser
 * Converts human-readable recurrence strings to Frequency objects
 */
export class RecurrenceParser {
  /**
   * Parse natural language recurrence string to Frequency object
   * 
   * Supported syntax:
   * - every day
   * - every 3 days
   * - every week
   * - every week on Monday
   * - every 2 weeks on Monday, Friday
   * - every month
   * - every month on the 15th
   * - every year
   */
  static parse(input: string): ParsedRecurrence {
    const raw = input;
    const normalized = input.trim().toLowerCase();

    if (!normalized) {
      return {
        frequency: { type: "daily", interval: 1 },
        raw,
        isValid: false,
        error: "Recurrence string cannot be empty",
      };
    }

    // Match "every" pattern
    const everyMatch = normalized.match(/^every\s+(.+)$/);
    if (!everyMatch) {
      return {
        frequency: { type: "daily", interval: 1 },
        raw,
        isValid: false,
        error: "Recurrence must start with 'every'",
      };
    }

    const rest = everyMatch[1];

    // Try to parse "weekday" or "weekend" pattern
    if (rest === 'weekday' || rest === 'weekdays') {
      // Monday=0 to Friday=4
      return {
        frequency: { type: "weekly", interval: 1, weekdays: [0, 1, 2, 3, 4] },
        raw,
        isValid: true,
      };
    }

    if (rest === 'weekend' || rest === 'weekends') {
      // Saturday=5, Sunday=6
      return {
        frequency: { type: "weekly", interval: 1, weekdays: [5, 6] },
        raw,
        isValid: true,
      };
    }

    // Try to parse daily pattern: "every [N] day[s]"
    const dailyMatch = rest.match(/^(\d+\s+)?days?$/);
    if (dailyMatch) {
      const interval = dailyMatch[1] ? parseInt(dailyMatch[1]) : 1;
      return {
        frequency: { type: "daily", interval },
        raw,
        isValid: true,
      };
    }

    // Try to parse weekly pattern: "every [N] week[s] [on <days>]"
    const weeklyMatch = rest.match(/^(\d+\s+)?weeks?(?:\s+on\s+(.+))?$/);
    if (weeklyMatch) {
      const interval = weeklyMatch[1] ? parseInt(weeklyMatch[1]) : 1;
      const daysStr = weeklyMatch[2];

      if (!daysStr) {
        // No specific days, default to current day of week
        return {
          frequency: { type: "weekly", interval, weekdays: [1] }, // Default to Monday
          raw,
          isValid: true,
        };
      }

      // Parse day names
      const weekdays = this.parseDayNames(daysStr);
      if (weekdays.length === 0) {
        return {
          frequency: { type: "weekly", interval, weekdays: [1] },
          raw,
          isValid: false,
          error: "Invalid day names",
        };
      }

      return {
        frequency: { type: "weekly", interval, weekdays },
        raw,
        isValid: true,
      };
    }

    // Try to parse monthly pattern: "every [N] month[s] [on the <day>]"
    const monthlyMatch = rest.match(/^(\d+\s+)?months?(?:\s+on\s+the\s+(\d+)(?:st|nd|rd|th)?)?$/);
    if (monthlyMatch) {
      const interval = monthlyMatch[1] ? parseInt(monthlyMatch[1]) : 1;
      const dayOfMonth = monthlyMatch[2] ? parseInt(monthlyMatch[2]) : 1;

      if (dayOfMonth < 1 || dayOfMonth > 31) {
        return {
          frequency: { type: "monthly", interval, dayOfMonth: 1 },
          raw,
          isValid: false,
          error: "Day of month must be between 1 and 31",
        };
      }

      return {
        frequency: { type: "monthly", interval, dayOfMonth },
        raw,
        isValid: true,
      };
    }

    // Try to parse yearly pattern: "every [N] year[s]"
    const yearlyMatch = rest.match(/^(\d+\s+)?years?$/);
    if (yearlyMatch) {
      const interval = yearlyMatch[1] ? parseInt(yearlyMatch[1]) : 1;
      return {
        frequency: { type: "yearly", interval, month: 0, dayOfMonth: 1 },
        raw,
        isValid: true,
      };
    }

    return {
      frequency: { type: "daily", interval: 1 },
      raw,
      isValid: false,
      error: "Unrecognized recurrence pattern",
    };
  }

  /**
   * Convert Frequency object to human-readable string
   */
  static stringify(frequency: Frequency): string {
    const interval = frequency.interval;
    const intervalStr = interval > 1 ? `${interval} ` : "";

    switch (frequency.type) {
      case "daily":
        return interval === 1 ? "every day" : `every ${interval} days`;

      case "weekly": {
        const weekStr = interval === 1 ? "week" : `${interval} weeks`;
        if (frequency.weekdays.length === 0) {
          return `every ${weekStr}`;
        }
        const dayNames = frequency.weekdays.map(d => this.getDayName(d)).join(", ");
        return `every ${weekStr} on ${dayNames}`;
      }

      case "monthly": {
        const monthStr = interval === 1 ? "month" : `${interval} months`;
        const daySuffix = this.getDaySuffix(frequency.dayOfMonth);
        return `every ${monthStr} on the ${frequency.dayOfMonth}${daySuffix}`;
      }

      case "yearly": {
        const yearStr = interval === 1 ? "year" : `${interval} years`;
        return `every ${yearStr}`;
      }

      default:
        return "every day";
    }
  }

  /**
   * Parse comma-separated day names to weekday numbers
   * Monday=0, Sunday=6
   */
  private static parseDayNames(daysStr: string): number[] {
    const dayMap: Record<string, number> = {
      monday: 0,
      mon: 0,
      tuesday: 1,
      tue: 1,
      wednesday: 2,
      wed: 2,
      thursday: 3,
      thu: 3,
      friday: 4,
      fri: 4,
      saturday: 5,
      sat: 5,
      sunday: 6,
      sun: 6,
    };

    const days = daysStr.split(",").map(d => d.trim().toLowerCase());
    const weekdays: number[] = [];

    for (const day of days) {
      if (day in dayMap) {
        weekdays.push(dayMap[day]);
      }
    }

    return weekdays;
  }

  /**
   * Get day name from weekday number (0=Monday, 6=Sunday)
   */
  private static getDayName(weekday: number): string {
    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    return days[weekday] || "Monday";
  }

  /**
   * Get ordinal suffix for day of month (1st, 2nd, 3rd, 4th, etc.)
   */
  private static getDaySuffix(day: number): string {
    if (day >= 11 && day <= 13) {
      return "th";
    }
    switch (day % 10) {
      case 1: return "st";
      case 2: return "nd";
      case 3: return "rd";
      default: return "th";
    }
  }
}
