/**
 * Frequency types for recurring tasks
 */
export type FrequencyType = "daily" | "weekly" | "monthly";

/**
 * Frequency/Recurrence rule definition
 */
export type Frequency =
  | {
      /** Type of recurrence */
      type: "daily";
      /** Interval multiplier (e.g., every 2 days) */
      interval: number;
      /** Optional fixed time in HH:mm format (e.g., "09:00") */
      time?: string;
    }
  | {
      /** Type of recurrence */
      type: "weekly";
      /** Interval multiplier (e.g., every 2 weeks) */
      interval: number;
      /** For weekly rules: days of week (0-6, Monday-Sunday) */
      weekdays: number[];
      /** Optional fixed time in HH:mm format (e.g., "09:00") */
      time?: string;
    }
  | {
      /** Type of recurrence */
      type: "monthly";
      /** Interval multiplier (e.g., every 2 months) */
      interval: number;
      /** Day of month (1-31) */
      dayOfMonth: number;
      /** Optional fixed time in HH:mm format (e.g., "09:00") */
      time?: string;
    };

/**
 * Creates a default daily frequency
 */
export function createDefaultFrequency(): Frequency {
  return {
    type: "daily",
    interval: 1,
    time: "09:00",
  };
}

/**
 * Validates a frequency object
 */
export function isValidFrequency(frequency: Frequency): boolean {
  if (!frequency || !frequency.type || !frequency.interval) {
    return false;
  }
  
  if (frequency.interval < 1) {
    return false;
  }
  
  if (frequency.type === "weekly") {
    return (
      Array.isArray(frequency.weekdays) &&
      frequency.weekdays.length > 0 &&
      frequency.weekdays.every((day) => day >= 0 && day <= 6)
    );
  }

  if (frequency.type === "monthly") {
    return frequency.dayOfMonth >= 1 && frequency.dayOfMonth <= 31;
  }
  
  return true;
}
