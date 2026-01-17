import { describe, it, expect } from 'vitest';
import { DateParser } from '@/core/parsers/DateParser';

describe('DateParser', () => {
  const referenceDate = new Date('2024-01-15T12:00:00Z'); // Monday, Jan 15, 2024

  describe('parse - ISO format', () => {
    it('should parse valid ISO date format', () => {
      const result = DateParser.parse('2024-01-20', referenceDate);
      expect(result.isValid).toBe(true);
      expect(result.date).not.toBeNull();
      expect(result.date!.toISOString().split('T')[0]).toBe('2024-01-20');
    });

    it('should handle different ISO dates', () => {
      const result = DateParser.parse('2025-12-31', referenceDate);
      expect(result.isValid).toBe(true);
      expect(result.date).not.toBeNull();
      expect(result.date!.toISOString().split('T')[0]).toBe('2025-12-31');
    });
  });

  describe('parse - simple keywords', () => {
    it('should parse "today"', () => {
      const result = DateParser.parse('today', referenceDate);
      expect(result.isValid).toBe(true);
      expect(result.date).not.toBeNull();
      expect(result.date!.toISOString().split('T')[0]).toBe('2024-01-15');
    });

    it('should parse "tomorrow"', () => {
      const result = DateParser.parse('tomorrow', referenceDate);
      expect(result.isValid).toBe(true);
      expect(result.date).not.toBeNull();
      expect(result.date!.toISOString().split('T')[0]).toBe('2024-01-16');
    });

    it('should parse "yesterday"', () => {
      const result = DateParser.parse('yesterday', referenceDate);
      expect(result.isValid).toBe(true);
      expect(result.date).not.toBeNull();
      expect(result.date!.toISOString().split('T')[0]).toBe('2024-01-14');
    });

    it('should be case insensitive', () => {
      const result1 = DateParser.parse('Today', referenceDate);
      const result2 = DateParser.parse('TOMORROW', referenceDate);
      expect(result1.isValid).toBe(true);
      expect(result2.isValid).toBe(true);
    });
  });

  describe('parse - "in X days/weeks/months"', () => {
    it('should parse "in 1 day"', () => {
      const result = DateParser.parse('in 1 day', referenceDate);
      expect(result.isValid).toBe(true);
      expect(result.date!.toISOString().split('T')[0]).toBe('2024-01-16');
    });

    it('should parse "in 3 days"', () => {
      const result = DateParser.parse('in 3 days', referenceDate);
      expect(result.isValid).toBe(true);
      expect(result.date!.toISOString().split('T')[0]).toBe('2024-01-18');
    });

    it('should parse "in 1 week"', () => {
      const result = DateParser.parse('in 1 week', referenceDate);
      expect(result.isValid).toBe(true);
      expect(result.date!.toISOString().split('T')[0]).toBe('2024-01-22');
    });

    it('should parse "in 2 weeks"', () => {
      const result = DateParser.parse('in 2 weeks', referenceDate);
      expect(result.isValid).toBe(true);
      expect(result.date!.toISOString().split('T')[0]).toBe('2024-01-29');
    });

    it('should parse "in 1 month"', () => {
      const result = DateParser.parse('in 1 month', referenceDate);
      expect(result.isValid).toBe(true);
      expect(result.date!.toISOString().split('T')[0]).toBe('2024-02-15');
    });

    it('should parse "in 3 months"', () => {
      const result = DateParser.parse('in 3 months', referenceDate);
      expect(result.isValid).toBe(true);
      expect(result.date!.toISOString().split('T')[0]).toBe('2024-04-15');
    });
  });

  describe('parse - "X days/weeks ago"', () => {
    it('should parse "1 day ago"', () => {
      const result = DateParser.parse('1 day ago', referenceDate);
      expect(result.isValid).toBe(true);
      expect(result.date!.toISOString().split('T')[0]).toBe('2024-01-14');
    });

    it('should parse "3 days ago"', () => {
      const result = DateParser.parse('3 days ago', referenceDate);
      expect(result.isValid).toBe(true);
      expect(result.date!.toISOString().split('T')[0]).toBe('2024-01-12');
    });

    it('should parse "1 week ago"', () => {
      const result = DateParser.parse('1 week ago', referenceDate);
      expect(result.isValid).toBe(true);
      expect(result.date!.toISOString().split('T')[0]).toBe('2024-01-08');
    });

    it('should parse "2 weeks ago"', () => {
      const result = DateParser.parse('2 weeks ago', referenceDate);
      expect(result.isValid).toBe(true);
      expect(result.date!.toISOString().split('T')[0]).toBe('2024-01-01');
    });

    it('should parse "1 month ago"', () => {
      const result = DateParser.parse('1 month ago', referenceDate);
      expect(result.isValid).toBe(true);
      expect(result.date!.toISOString().split('T')[0]).toBe('2023-12-15');
    });
  });

  describe('parse - "next/last weekday"', () => {
    it('should parse "next Monday" (reference is Monday, so next Monday)', () => {
      const result = DateParser.parse('next Monday', referenceDate);
      expect(result.isValid).toBe(true);
      expect(result.date!.toISOString().split('T')[0]).toBe('2024-01-22'); // Next Monday
    });

    it('should parse "next Friday"', () => {
      const result = DateParser.parse('next Friday', referenceDate);
      expect(result.isValid).toBe(true);
      expect(result.date!.toISOString().split('T')[0]).toBe('2024-01-19'); // This Friday
    });

    it('should parse "next Sunday"', () => {
      const result = DateParser.parse('next Sunday', referenceDate);
      expect(result.isValid).toBe(true);
      expect(result.date!.toISOString().split('T')[0]).toBe('2024-01-21');
    });

    it('should parse "last Monday"', () => {
      const result = DateParser.parse('last Monday', referenceDate);
      expect(result.isValid).toBe(true);
      expect(result.date!.toISOString().split('T')[0]).toBe('2024-01-08'); // Last Monday
    });

    it('should parse "last Friday"', () => {
      const result = DateParser.parse('last Friday', referenceDate);
      expect(result.isValid).toBe(true);
      expect(result.date!.toISOString().split('T')[0]).toBe('2024-01-12'); // Last Friday
    });

    it('should be case insensitive', () => {
      const result = DateParser.parse('Next TUESDAY', referenceDate);
      expect(result.isValid).toBe(true);
    });
  });

  describe('parse - "this/next/last week/month"', () => {
    it('should parse "this week" (Monday of current week)', () => {
      const result = DateParser.parse('this week', referenceDate);
      expect(result.isValid).toBe(true);
      expect(result.date!.toISOString().split('T')[0]).toBe('2024-01-15'); // Already Monday
    });

    it('should parse "next week"', () => {
      const result = DateParser.parse('next week', referenceDate);
      expect(result.isValid).toBe(true);
      expect(result.date!.toISOString().split('T')[0]).toBe('2024-01-22'); // Monday next week
    });

    it('should parse "last week"', () => {
      const result = DateParser.parse('last week', referenceDate);
      expect(result.isValid).toBe(true);
      expect(result.date!.toISOString().split('T')[0]).toBe('2024-01-08'); // Monday last week
    });

    it('should parse "this month" (1st of current month)', () => {
      const result = DateParser.parse('this month', referenceDate);
      expect(result.isValid).toBe(true);
      expect(result.date!.toISOString().split('T')[0]).toBe('2024-01-01');
    });

    it('should parse "next month"', () => {
      const result = DateParser.parse('next month', referenceDate);
      expect(result.isValid).toBe(true);
      expect(result.date!.toISOString().split('T')[0]).toBe('2024-02-01');
    });

    it('should parse "last month"', () => {
      const result = DateParser.parse('last month', referenceDate);
      expect(result.isValid).toBe(true);
      expect(result.date!.toISOString().split('T')[0]).toBe('2023-12-01');
    });
  });

  describe('parse - invalid input', () => {
    it('should handle empty string', () => {
      const result = DateParser.parse('', referenceDate);
      expect(result.isValid).toBe(false);
      expect(result.date).toBeNull();
      expect(result.error).toBe('Empty date string');
    });

    it('should handle unparseable input', () => {
      const result = DateParser.parse('not a date', referenceDate);
      expect(result.isValid).toBe(false);
      expect(result.date).toBeNull();
      expect(result.error).toContain('Could not parse date');
    });

    it('should preserve original input', () => {
      const result = DateParser.parse('invalid date', referenceDate);
      expect(result.original).toBe('invalid date');
    });
  });

  describe('toISODateString', () => {
    it('should format date to YYYY-MM-DD', () => {
      const date = new Date('2024-01-15T12:34:56Z');
      const formatted = DateParser.toISODateString(date);
      expect(formatted).toBe('2024-01-15');
    });

    it('should handle different dates', () => {
      const date = new Date('2025-12-31T23:59:59Z');
      const formatted = DateParser.toISODateString(date);
      expect(formatted).toBe('2025-12-31');
    });

    it('should pad single-digit months and days', () => {
      const date = new Date('2024-03-05T00:00:00Z');
      const formatted = DateParser.toISODateString(date);
      expect(formatted).toBe('2024-03-05');
    });
  });

  describe('edge cases', () => {
    it('should handle reference date at end of month', () => {
      const endOfMonth = new Date('2024-01-31T12:00:00Z');
      const result = DateParser.parse('in 1 month', endOfMonth);
      expect(result.isValid).toBe(true);
      // Feb has only 29 days in 2024 (leap year), should handle gracefully
    });

    it('should handle whitespace in input', () => {
      const result = DateParser.parse('  tomorrow  ', referenceDate);
      expect(result.isValid).toBe(true);
      expect(result.date!.toISOString().split('T')[0]).toBe('2024-01-16');
    });
  });
});
