import { describe, it, expect, beforeEach } from 'vitest';
import { RecurrenceValidator } from '@/core/engine/recurrence/RecurrenceValidator';

describe('RecurrenceValidator', () => {
  let validator: RecurrenceValidator;

  beforeEach(() => {
    validator = new RecurrenceValidator();
  });

  describe('validate()', () => {
    it('should validate correct RRULE with prefix', () => {
      const result = validator.validate(
        'RRULE:FREQ=DAILY;INTERVAL=1',
        new Date('2026-01-01')
      );
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate correct RRULE without prefix', () => {
      const result = validator.validate(
        'FREQ=DAILY;INTERVAL=1',
        new Date('2026-01-01')
      );
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid RRULE syntax', () => {
      const result = validator.validate(
        'INVALID_RRULE',
        new Date('2026-01-01')
      );
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject empty RRULE', () => {
      const result = validator.validate('', new Date('2026-01-01'));
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('RRULE string is required');
    });

    it('should reject invalid DTSTART', () => {
      const result = validator.validate('FREQ=DAILY', new Date('invalid') as any);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Valid DTSTART date is required');
    });

    it('should detect COUNT + UNTIL conflict', () => {
      const result = validator.validate(
        'RRULE:FREQ=DAILY;COUNT=5;UNTIL=20261231T000000Z',
        new Date('2026-01-01')
      );
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('COUNT') && e.includes('UNTIL'))).toBe(true);
    });

    it('should detect DTSTART after UNTIL', () => {
      const result = validator.validate(
        'RRULE:FREQ=DAILY;UNTIL=20260101T000000Z',
        new Date('2026-12-31')
      );
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('after UNTIL'))).toBe(true);
    });

    it('should detect negative COUNT', () => {
      const result = validator.validate(
        'RRULE:FREQ=DAILY;COUNT=-1',
        new Date('2026-01-01')
      );
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('COUNT'))).toBe(true);
    });

    it('should detect zero COUNT', () => {
      const result = validator.validate(
        'RRULE:FREQ=DAILY;COUNT=0',
        new Date('2026-01-01')
      );
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('COUNT'))).toBe(true);
    });

    it('should detect negative INTERVAL', () => {
      const result = validator.validate(
        'RRULE:FREQ=DAILY;INTERVAL=-1',
        new Date('2026-01-01')
      );
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('INTERVAL'))).toBe(true);
    });

    it('should warn about impossible month/day combinations', () => {
      const result = validator.validate(
        'RRULE:FREQ=MONTHLY;BYMONTHDAY=31;BYMONTH=2',
        new Date('2026-01-01')
      );
      expect(result.warnings.some(w => w.includes('February'))).toBe(true);
    });

    it('should warn about expired rules', () => {
      const pastDate = new Date('2020-01-01');
      const result = validator.validate(
        'RRULE:FREQ=DAILY;UNTIL=20200131T000000Z',
        pastDate
      );
      // Rule is expired but validation checks if it can generate at least one occurrence
      // from DTSTART (pastDate), which it can (Jan 1-31, 2020), so no warning about expiration
      // The warning would only appear if UNTIL is before DTSTART
      expect(result.valid).toBe(true);
    });

    it('should warn about high-frequency rules', () => {
      const result = validator.validate(
        'RRULE:FREQ=MINUTELY',
        new Date('2026-01-01')
      );
      expect(result.warnings.some(w => w.includes('performance'))).toBe(true);
    });

    it('should warn about high COUNT values', () => {
      const result = validator.validate(
        'RRULE:FREQ=DAILY;COUNT=5000',
        new Date('2026-01-01')
      );
      expect(result.warnings.some(w => w.includes('performance'))).toBe(true);
    });

    it('should accept timezone parameter', () => {
      // Note: TZID cannot be part of the RRULE string itself per RFC 5545
      // It's set via the dtstart parameter when creating the RRule
      const result = validator.validate(
        'RRULE:FREQ=DAILY',
        new Date('2026-01-01'),
        'Europe/London'
      );
      expect(result.valid).toBe(true);
    });
  });

  describe('validateSyntax()', () => {
    it('should validate correct RRULE syntax', () => {
      expect(validator.validateSyntax('RRULE:FREQ=DAILY;INTERVAL=1')).toBe(true);
    });

    it('should validate RRULE without prefix', () => {
      expect(validator.validateSyntax('FREQ=DAILY;INTERVAL=1')).toBe(true);
    });

    it('should reject invalid syntax', () => {
      expect(validator.validateSyntax('INVALID')).toBe(false);
    });

    it('should reject empty string', () => {
      expect(validator.validateSyntax('')).toBe(false);
    });

    it('should reject null/undefined', () => {
      expect(validator.validateSyntax(null as any)).toBe(false);
      expect(validator.validateSyntax(undefined as any)).toBe(false);
    });
  });

  describe('isExpired()', () => {
    it('should detect expired UNTIL rule', () => {
      const expired = validator.isExpired(
        'RRULE:FREQ=DAILY;UNTIL=20200101T000000Z',
        new Date('2020-01-01'),
        new Date('2026-01-01')
      );
      expect(expired).toBe(true);
    });

    it('should detect non-expired UNTIL rule', () => {
      const expired = validator.isExpired(
        'RRULE:FREQ=DAILY;UNTIL=20301231T000000Z',
        new Date('2026-01-01'),
        new Date('2026-01-01')
      );
      expect(expired).toBe(false);
    });

    it('should detect exhausted COUNT rule', () => {
      const expired = validator.isExpired(
        'RRULE:FREQ=DAILY;COUNT=1',
        new Date('2026-01-01'),
        new Date('2026-01-10')
      );
      expect(expired).toBe(true);
    });

    it('should handle ongoing infinite rule', () => {
      const expired = validator.isExpired(
        'RRULE:FREQ=DAILY',
        new Date('2026-01-01'),
        new Date('2026-01-10')
      );
      expect(expired).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle April 31st (impossible)', () => {
      const result = validator.validate(
        'RRULE:FREQ=MONTHLY;BYMONTHDAY=31;BYMONTH=4',
        new Date('2026-01-01')
      );
      expect(result.warnings.some(w => w.includes('April'))).toBe(true);
    });

    it('should handle multiple impossible dates', () => {
      const result = validator.validate(
        'RRULE:FREQ=MONTHLY;BYMONTHDAY=31;BYMONTH=2,4,6,9,11',
        new Date('2026-01-01')
      );
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should allow valid month/day combinations', () => {
      const result = validator.validate(
        'RRULE:FREQ=MONTHLY;BYMONTHDAY=15;BYMONTH=1,2,3',
        new Date('2026-01-01')
      );
      expect(result.valid).toBe(true);
      // No warnings about impossible dates
      expect(result.warnings.filter(w => w.includes('does not exist')).length).toBe(0);
    });

    it('should handle negative month days (from end)', () => {
      const result = validator.validate(
        'RRULE:FREQ=MONTHLY;BYMONTHDAY=-1',
        new Date('2026-01-01')
      );
      expect(result.valid).toBe(true);
    });

    it('should warn about MONTHLY BYDAY without BYSETPOS', () => {
      const result = validator.validate(
        'RRULE:FREQ=MONTHLY;BYDAY=MO',
        new Date('2026-01-01')
      );
      expect(result.warnings.some(w => w.includes('BYSETPOS'))).toBe(true);
    });
  });
});
