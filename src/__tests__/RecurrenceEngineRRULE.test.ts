import { describe, it, expect, beforeEach } from 'vitest';
import { RecurrenceEngineRRULE } from '@/core/engine/recurrence/RecurrenceEngineRRULE';
import type { Task } from '@/core/models/Task';
import { RRule } from 'rrule';

describe('RecurrenceEngineRRULE', () => {
  let engine: RecurrenceEngineRRULE;

  beforeEach(() => {
    engine = new RecurrenceEngineRRULE();
  });

  describe('getNextOccurrence', () => {
    it('should calculate next occurrence for daily task', () => {
      const task: Partial<Task> = {
        id: 'test-1',
        frequency: {
          type: 'daily',
          interval: 1,
          rruleString: 'RRULE:FREQ=DAILY;INTERVAL=1',
          dtstart: '2026-01-01T09:00:00Z',
        },
        dueAt: '2026-01-01T09:00:00Z',
      };

      const from = new Date('2026-01-01T09:00:00Z');
      const next = engine.getNextOccurrence(task as Task, from);

      expect(next).not.toBeNull();
      expect(next!.toISOString()).toBe('2026-01-02T09:00:00.000Z');
    });

    it('should calculate next occurrence for weekly task', () => {
      const task: Partial<Task> = {
        id: 'test-2',
        frequency: {
          type: 'weekly',
          interval: 1,
          weekdays: [0], // Monday
          rruleString: 'RRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=MO',
          dtstart: '2026-01-05T09:00:00Z', // Monday, Jan 5, 2026
        },
        dueAt: '2026-01-05T09:00:00Z',
      };

      const from = new Date('2026-01-05T09:00:00Z');
      const next = engine.getNextOccurrence(task as Task, from);

      expect(next).not.toBeNull();
      // Next Monday should be Jan 12
      expect(next!.toISOString()).toBe('2026-01-12T09:00:00.000Z');
    });

    it('should handle monthly on 31st (February)', () => {
      const task: Partial<Task> = {
        id: 'test-3',
        frequency: {
          type: 'monthly',
          interval: 1,
          dayOfMonth: 31,
          rruleString: 'RRULE:FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=-1', // Last day of month
          dtstart: '2026-01-31T09:00:00Z',
        },
        dueAt: '2026-01-31T09:00:00Z',
      };

      const from = new Date('2026-01-31T09:00:00Z');
      const next = engine.getNextOccurrence(task as Task, from);

      expect(next).not.toBeNull();
      // Next should be Feb 28, 2026 (last day of February)
      expect(next!.toISOString()).toBe('2026-02-28T09:00:00.000Z');
    });

    it('should handle every weekday pattern', () => {
      const task: Partial<Task> = {
        id: 'test-4',
        frequency: {
          type: 'weekly',
          interval: 1,
          weekdays: [0, 1, 2, 3, 4], // Mon-Fri
          rruleString: 'RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR',
          dtstart: '2026-01-05T09:00:00Z', // Monday
        },
        dueAt: '2026-01-05T09:00:00Z',
      };

      const from = new Date('2026-01-05T09:00:00Z'); // Monday
      const next = engine.getNextOccurrence(task as Task, from);

      expect(next).not.toBeNull();
      // Next should be Tuesday, Jan 6
      expect(next!.toISOString()).toBe('2026-01-06T09:00:00.000Z');
    });

    it('should apply fixed time to occurrence', () => {
      const task: Partial<Task> = {
        id: 'test-5',
        frequency: {
          type: 'daily',
          interval: 1,
          time: '14:30',
          rruleString: 'RRULE:FREQ=DAILY;INTERVAL=1',
          dtstart: '2026-01-01T09:00:00Z',
        },
        dueAt: '2026-01-01T09:00:00Z',
      };

      const from = new Date('2026-01-01T09:00:00Z');
      const next = engine.getNextOccurrence(task as Task, from);

      expect(next).not.toBeNull();
      // Should have time 14:30
      expect(next!.getHours()).toBe(14);
      expect(next!.getMinutes()).toBe(30);
    });

    it('should return null for task without rruleString', () => {
      const task: Partial<Task> = {
        id: 'test-6',
        frequency: {
          type: 'daily',
          interval: 1,
        },
        dueAt: '2026-01-01T09:00:00Z',
      };

      const from = new Date('2026-01-01T09:00:00Z');
      const next = engine.getNextOccurrence(task as Task, from);

      expect(next).toBeNull();
    });

    it('should return null when series has ended (UNTIL)', () => {
      const task: Partial<Task> = {
        id: 'test-7',
        frequency: {
          type: 'daily',
          interval: 1,
          rruleString: 'RRULE:FREQ=DAILY;INTERVAL=1;UNTIL=20260105T000000Z',
          dtstart: '2026-01-01T09:00:00Z',
        },
        dueAt: '2026-01-01T09:00:00Z',
      };

      const from = new Date('2026-01-10T09:00:00Z'); // After UNTIL
      const next = engine.getNextOccurrence(task as Task, from);

      expect(next).toBeNull();
    });
  });

  describe('getOccurrencesBetween', () => {
    it('should return all occurrences in range', () => {
      const task: Partial<Task> = {
        id: 'test-8',
        frequency: {
          type: 'daily',
          interval: 1,
          rruleString: 'RRULE:FREQ=DAILY;INTERVAL=1',
          dtstart: '2026-01-01T09:00:00Z',
        },
        dueAt: '2026-01-01T09:00:00Z',
      };

      const from = new Date('2026-01-01T00:00:00Z');
      const to = new Date('2026-01-05T23:59:59Z');
      const occurrences = engine.getOccurrencesBetween(task as Task, from, to);

      expect(occurrences).toHaveLength(5); // Jan 1-5
    });

    it('should apply fixed time to all occurrences', () => {
      const task: Partial<Task> = {
        id: 'test-9',
        frequency: {
          type: 'daily',
          interval: 1,
          time: '15:00',
          rruleString: 'RRULE:FREQ=DAILY;INTERVAL=1',
          dtstart: '2026-01-01T09:00:00Z',
        },
        dueAt: '2026-01-01T09:00:00Z',
      };

      const from = new Date('2026-01-01T00:00:00Z');
      const to = new Date('2026-01-03T23:59:59Z');
      const occurrences = engine.getOccurrencesBetween(task as Task, from, to);

      expect(occurrences).toHaveLength(3);
      occurrences.forEach(date => {
        expect(date.getHours()).toBe(15);
        expect(date.getMinutes()).toBe(0);
      });
    });
  });

  describe('isOccurrenceOn', () => {
    it('should return true if date matches occurrence', () => {
      const task: Partial<Task> = {
        id: 'test-10',
        frequency: {
          type: 'daily',
          interval: 1,
          rruleString: 'RRULE:FREQ=DAILY;INTERVAL=1',
          dtstart: '2026-01-01T09:00:00Z',
        },
        dueAt: '2026-01-01T09:00:00Z',
      };

      const date = new Date('2026-01-02T14:00:00Z'); // Jan 2 is an occurrence
      const result = engine.isOccurrenceOn(task as Task, date);

      expect(result).toBe(true);
    });

    it('should return false if date does not match occurrence', () => {
      const task: Partial<Task> = {
        id: 'test-11',
        frequency: {
          type: 'weekly',
          interval: 1,
          weekdays: [0], // Monday only
          rruleString: 'RRULE:FREQ=WEEKLY;BYDAY=MO',
          dtstart: '2026-01-05T09:00:00Z', // Monday
        },
        dueAt: '2026-01-05T09:00:00Z',
      };

      const date = new Date('2026-01-06T14:00:00Z'); // Tuesday - not an occurrence
      const result = engine.isOccurrenceOn(task as Task, date);

      expect(result).toBe(false);
    });
  });

  describe('validateRRule', () => {
    it('should validate correct RRULE with prefix', () => {
      const result = engine.validateRRule('RRULE:FREQ=DAILY;INTERVAL=1');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should validate correct RRULE without prefix', () => {
      const result = engine.validateRRule('FREQ=DAILY;INTERVAL=1');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject invalid RRULE', () => {
      const result = engine.validateRRule('INVALID_RRULE');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject empty RRULE', () => {
      const result = engine.validateRRule('');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('RRULE string is required');
    });
  });

  describe('toNaturalLanguage', () => {
    it('should convert daily RRULE to text', () => {
      const text = engine.toNaturalLanguage('RRULE:FREQ=DAILY;INTERVAL=1');
      expect(text.toLowerCase()).toContain('day');
    });

    it('should convert daily RRULE without prefix to text', () => {
      const text = engine.toNaturalLanguage('FREQ=DAILY;INTERVAL=1');
      expect(text.toLowerCase()).toContain('day');
    });

    it('should convert weekly RRULE to text', () => {
      const text = engine.toNaturalLanguage('RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR');
      expect(text.toLowerCase()).toContain('week');
    });

    it('should handle invalid RRULE gracefully', () => {
      const text = engine.toNaturalLanguage('INVALID');
      expect(text).toBe('INVALID'); // Should return original string
    });
  });

  describe('cache', () => {
    it('should cache RRule objects', () => {
      const task: Partial<Task> = {
        id: 'test-12',
        frequency: {
          type: 'daily',
          interval: 1,
          rruleString: 'RRULE:FREQ=DAILY;INTERVAL=1',
          dtstart: '2026-01-01T09:00:00Z',
        },
        dueAt: '2026-01-01T09:00:00Z',
      };

      const from = new Date('2026-01-01T09:00:00Z');
      
      // First call should populate cache
      engine.getNextOccurrence(task as Task, from);
      const cacheSize1 = engine.getCacheSize();
      expect(cacheSize1).toBe(1);

      // Second call should use cache
      engine.getNextOccurrence(task as Task, from);
      const cacheSize2 = engine.getCacheSize();
      expect(cacheSize2).toBe(1); // Should still be 1
    });

    it('should allow clearing cache', () => {
      const task: Partial<Task> = {
        id: 'test-13',
        frequency: {
          type: 'daily',
          interval: 1,
          rruleString: 'RRULE:FREQ=DAILY;INTERVAL=1',
          dtstart: '2026-01-01T09:00:00Z',
        },
        dueAt: '2026-01-01T09:00:00Z',
      };

      const from = new Date('2026-01-01T09:00:00Z');
      engine.getNextOccurrence(task as Task, from);
      
      expect(engine.getCacheSize()).toBeGreaterThan(0);
      
      engine.clearCache();
      expect(engine.getCacheSize()).toBe(0);
    });
  });
});
