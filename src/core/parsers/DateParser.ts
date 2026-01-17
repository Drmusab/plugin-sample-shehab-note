export interface ParsedDate {
  date: Date | null;
  isValid: boolean;
  error?: string;
  original: string;
}

export class DateParser {
  /**
   * Parse a date string (natural language or ISO format)
   */
  static parse(input: string, referenceDate: Date = new Date()): ParsedDate {
    const trimmed = input.trim().toLowerCase();
    const original = input;

    if (!trimmed) {
      return { date: null, isValid: false, error: 'Empty date string', original };
    }

    // Try ISO format first (YYYY-MM-DD)
    const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
      const date = new Date(trimmed);
      if (!isNaN(date.getTime())) {
        return { date, isValid: true, original };
      }
    }

    // Natural language parsing
    const today = new Date(referenceDate);
    today.setHours(0, 0, 0, 0);

    // Simple keywords
    if (trimmed === 'today') {
      return { date: today, isValid: true, original };
    }
    if (trimmed === 'tomorrow') {
      const date = new Date(today);
      date.setDate(date.getDate() + 1);
      return { date, isValid: true, original };
    }
    if (trimmed === 'yesterday') {
      const date = new Date(today);
      date.setDate(date.getDate() - 1);
      return { date, isValid: true, original };
    }

    // "in X days/weeks/months"
    const inMatch = trimmed.match(/^in\s+(\d+)\s+(day|days|week|weeks|month|months)$/);
    if (inMatch) {
      const amount = parseInt(inMatch[1]);
      const unit = inMatch[2];
      const date = new Date(today);
      if (unit.startsWith('day')) {
        date.setDate(date.getDate() + amount);
      } else if (unit.startsWith('week')) {
        date.setDate(date.getDate() + amount * 7);
      } else if (unit.startsWith('month')) {
        date.setMonth(date.getMonth() + amount);
      }
      return { date, isValid: true, original };
    }

    // "X days/weeks ago"
    const agoMatch = trimmed.match(/^(\d+)\s+(day|days|week|weeks|month|months)\s+ago$/);
    if (agoMatch) {
      const amount = parseInt(agoMatch[1]);
      const unit = agoMatch[2];
      const date = new Date(today);
      if (unit.startsWith('day')) {
        date.setDate(date.getDate() - amount);
      } else if (unit.startsWith('week')) {
        date.setDate(date.getDate() - amount * 7);
      } else if (unit.startsWith('month')) {
        date.setMonth(date.getMonth() - amount);
      }
      return { date, isValid: true, original };
    }

    // "next/last Monday/Tuesday/etc"
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const nextLastMatch = trimmed.match(/^(next|last)\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)$/);
    if (nextLastMatch) {
      const direction = nextLastMatch[1];
      const targetDay = dayNames.indexOf(nextLastMatch[2]);
      const currentDay = today.getDay();
      let daysToAdd = targetDay - currentDay;
      
      if (direction === 'next') {
        if (daysToAdd <= 0) daysToAdd += 7;
      } else {
        if (daysToAdd >= 0) daysToAdd -= 7;
      }
      
      const date = new Date(today);
      date.setDate(date.getDate() + daysToAdd);
      return { date, isValid: true, original };
    }

    // "this/next/last week/month"
    const periodMatch = trimmed.match(/^(this|next|last)\s+(week|month)$/);
    if (periodMatch) {
      const period = periodMatch[1];
      const unit = periodMatch[2];
      const date = new Date(today);
      
      if (unit === 'week') {
        const dayOfWeek = date.getDay();
        const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        date.setDate(date.getDate() + daysToMonday);
        
        if (period === 'next') date.setDate(date.getDate() + 7);
        else if (period === 'last') date.setDate(date.getDate() - 7);
      } else if (unit === 'month') {
        date.setDate(1);
        if (period === 'next') date.setMonth(date.getMonth() + 1);
        else if (period === 'last') date.setMonth(date.getMonth() - 1);
      }
      
      return { date, isValid: true, original };
    }

    return { date: null, isValid: false, error: `Could not parse date: ${input}`, original };
  }

  /**
   * Format a date to ISO string (YYYY-MM-DD)
   */
  static toISODateString(date: Date): string {
    return date.toISOString().split('T')[0];
  }
}
