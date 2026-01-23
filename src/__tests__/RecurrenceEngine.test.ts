import { describe, it, expect, beforeEach } from 'vitest';
import { RecurrenceEngine } from '@/core/engine/recurrence/RecurrenceEngine';
import type { Task } from '@/core/models/Task';

describe('RecurrenceEngine', () => {
  let engine: RecurrenceEngine;

  beforeEach(() => {
    engine = new RecurrenceEngine();
  });

  describe('next()', () => {
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
      const next = engine.next(task as Task, from);

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
          dtstart: '2026-01-05T09:00:00Z',
        },
        dueAt: '2026-01-05T09:00:00Z',
      };

      const from = new Date('2026-01-05T09:00:00Z');
      const next = engine.next(task as Task, from);

      expect(next).not.toBeNull();
      expect(next!.toISOString()).toBe('2026-01-12T09:00:00.000Z');
    });

    it('should handle monthly on 31st (February edge case)', () => {
      const task: Partial<Task> = {
        id: 'test-3',
        frequency: {
          type: 'monthly',
          interval: 1,
          dayOfMonth: 31,
          rruleString: 'RRULE:FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=-1',
          dtstart: '2026-01-31T09:00:00Z',
        },
        dueAt: '2026-01-31T09:00:00Z',
      };

      const from = new Date('2026-01-31T09:00:00Z');
      const next = engine.next(task as Task, from);

      expect(next).not.toBeNull();
      expect(next!.toISOString()).toBe('2026-02-28T09:00:00.000Z');
    });

    it('should apply fixed time to occurrence', () => {
      const task: Partial<Task> = {
        id: 'test-4',
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
      const next = engine.next(task as Task, from);

      expect(next).not.toBeNull();
      expect(next!.getHours()).toBe(14);
      expect(next!.getMinutes()).toBe(30);
    });

    it('should return null for task without rruleString', () => {
      const task: Partial<Task> = {
        id: 'test-5',
        frequency: {
          type: 'daily',
          interval: 1,
        },
        dueAt: '2026-01-01T09:00:00Z',
      };

      const from = new Date('2026-01-01T09:00:00Z');
      const next = engine.next(task as Task, from);

      expect(next).toBeNull();
    });

    it('should return null when series has ended (UNTIL)', () => {
      const task: Partial<Task> = {
        id: 'test-6',
        frequency: {
          type: 'daily',
          interval: 1,
          rruleString: 'RRULE:FREQ=DAILY;INTERVAL=1;UNTIL=20260105T000000Z',
          dtstart: '2026-01-01T09:00:00Z',
        },
        dueAt: '2026-01-01T09:00:00Z',
      };

      const from = new Date('2026-01-10T09:00:00Z');
      const next = engine.next(task as Task, from);

      expect(next).toBeNull();
    });

    it('should respect COUNT limit', () => {
      const task: Partial<Task> = {
        id: 'test-7',
        frequency: {
          type: 'daily',
          interval: 1,
          rruleString: 'RRULE:FREQ=DAILY;INTERVAL=1;COUNT=3',
          dtstart: '2026-01-01T09:00:00Z',
        },
        dueAt: '2026-01-01T09:00:00Z',
      };

      // COUNT=3 means only 3 occurrences total: Jan 1, 2, 3
      // When asking from Dec 31, we should get Jan 1, 2, 3
      const occurrences = [];
      let current = new Date('2025-12-31T09:00:00Z'); // Start before dtstart
      
      // Get occurrences until we can't anymore
      for (let i = 0; i < 5; i++) {
        const next = engine.next(task as Task, current);
        if (next) {
          occurrences.push(next);
          current = next;
        } else {
          break;
        }
      }

      // Should have exactly 3 occurrences (Jan 1, 2, 3)
      expect(occurrences).toHaveLength(3);
      
      // Asking after the last occurrence should return null
      const afterCount = engine.next(task as Task, current);
      expect(afterCount).toBeNull();
    });
  });

  describe('preview()', () => {
    it('should generate preview of upcoming occurrences', () => {
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
      const preview = engine.preview(task as Task, from, 5);

      expect(preview).toHaveLength(5);
      expect(preview[0].toISOString()).toBe('2026-01-01T09:00:00.000Z');
      expect(preview[4].toISOString()).toBe('2026-01-05T09:00:00.000Z');
    });

    it('should cap preview at 500 occurrences', () => {
      const task: Partial<Task> = {
        id: 'test-9',
        frequency: {
          type: 'daily',
          interval: 1,
          rruleString: 'RRULE:FREQ=DAILY;INTERVAL=1',
          dtstart: '2026-01-01T09:00:00Z',
        },
        dueAt: '2026-01-01T09:00:00Z',
      };

      const from = new Date('2026-01-01T00:00:00Z');
      const preview = engine.preview(task as Task, from, 1000);

      expect(preview.length).toBeLessThanOrEqual(500);
    });

    it('should apply fixed time to all preview occurrences', () => {
      const task: Partial<Task> = {
        id: 'test-10',
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
      const preview = engine.preview(task as Task, from, 3);

      expect(preview).toHaveLength(3);
      preview.forEach(date => {
        expect(date.getHours()).toBe(15);
        expect(date.getMinutes()).toBe(0);
      });
    });
  });

  describe('between()', () => {
    it('should return all occurrences in range', () => {
      const task: Partial<Task> = {
        id: 'test-11',
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
      const occurrences = engine.between(task as Task, from, to);

      expect(occurrences).toHaveLength(5);
    });

    it('should handle weekly occurrences in range', () => {
      const task: Partial<Task> = {
        id: 'test-12',
        frequency: {
          type: 'weekly',
          interval: 1,
          weekdays: [0, 2], // Monday and Wednesday
          rruleString: 'RRULE:FREQ=WEEKLY;BYDAY=MO,WE',
          dtstart: '2026-01-05T09:00:00Z', // Monday
        },
        dueAt: '2026-01-05T09:00:00Z',
      };

      const from = new Date('2026-01-05T00:00:00Z');
      const to = new Date('2026-01-11T23:59:59Z');
      const occurrences = engine.between(task as Task, from, to);

      // Should have Mon 5, Wed 7 (week 1)
      expect(occurrences.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('isValid()', () => {
    it('should validate correct RRULE', () => {
      const result = engine.isValid('RRULE:FREQ=DAILY;INTERVAL=1', new Date('2026-01-01'));
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid RRULE syntax', () => {
      const result = engine.isValid('INVALID', new Date('2026-01-01'));
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should detect COUNT + UNTIL conflict', () => {
      const result = engine.isValid(
        'RRULE:FREQ=DAILY;COUNT=5;UNTIL=20261231T000000Z',
        new Date('2026-01-01')
      );
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('COUNT') && e.includes('UNTIL'))).toBe(true);
    });

    it('should detect DTSTART after UNTIL', () => {
      const result = engine.isValid(
        'RRULE:FREQ=DAILY;UNTIL=20260101T000000Z',
        new Date('2026-12-31')
      );
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('after UNTIL'))).toBe(true);
    });

    it('should warn about impossible dates', () => {
      const result = engine.isValid(
        'RRULE:FREQ=MONTHLY;BYMONTHDAY=31;BYMONTH=2',
        new Date('2026-01-01')
      );
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('explain()', () => {
    it('should generate explanation for next occurrence', () => {
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

      const ref = new Date('2026-01-01T09:00:00Z');
      const explanation = engine.explain(task as Task, ref);

      expect(explanation.taskId).toBe('test-13');
      expect(explanation.referenceDate).toBe(ref.toISOString());
      expect(explanation.rule).toBe('RRULE:FREQ=DAILY;INTERVAL=1');
      expect(explanation.mode).toBe('fixed');
      expect(explanation.resultDate).not.toBeNull();
      expect(explanation.evaluationSteps.length).toBeGreaterThan(0);
    });

    it('should detect whenDone mode', () => {
      const task: Partial<Task> = {
        id: 'test-14',
        frequency: {
          type: 'daily',
          interval: 1,
          whenDone: true,
          rruleString: 'RRULE:FREQ=DAILY;INTERVAL=1',
          dtstart: '2026-01-01T09:00:00Z',
        },
        dueAt: '2026-01-01T09:00:00Z',
        whenDone: true,
      };

      const ref = new Date('2026-01-01T09:00:00Z');
      const explanation = engine.explain(task as Task, ref);

      expect(explanation.mode).toBe('whenDone');
    });

    it('should explain task without RRULE', () => {
      const task: Partial<Task> = {
        id: 'test-15',
        frequency: {
          type: 'daily',
          interval: 1,
        },
        dueAt: '2026-01-01T09:00:00Z',
      };

      const ref = new Date('2026-01-01T09:00:00Z');
      const explanation = engine.explain(task as Task, ref);

      expect(explanation.resultDate).toBeNull();
      expect(explanation.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('getMissedOccurrences()', () => {
    it('should return empty for skip policy', () => {
      const task: Partial<Task> = {
        id: 'test-16',
        frequency: {
          type: 'daily',
          interval: 1,
          rruleString: 'RRULE:FREQ=DAILY;INTERVAL=1',
          dtstart: '2026-01-01T09:00:00Z',
        },
        dueAt: '2026-01-01T09:00:00Z',
      };

      const lastChecked = new Date('2026-01-01T00:00:00Z');
      const now = new Date('2026-01-10T00:00:00Z');
      
      const result = engine.getMissedOccurrences(task as Task, lastChecked, now, {
        policy: 'skip'
      });

      expect(result.missedDates).toHaveLength(0);
      expect(result.count).toBe(0);
    });

    it('should detect missed occurrences with catch-up policy', () => {
      const task: Partial<Task> = {
        id: 'test-17',
        frequency: {
          type: 'daily',
          interval: 1,
          rruleString: 'RRULE:FREQ=DAILY;INTERVAL=1',
          dtstart: '2026-01-01T09:00:00Z',
        },
        dueAt: '2026-01-01T09:00:00Z',
      };

      const lastChecked = new Date('2026-01-01T00:00:00Z');
      const now = new Date('2026-01-05T23:59:59Z');
      
      const result = engine.getMissedOccurrences(task as Task, lastChecked, now, {
        policy: 'catch-up'
      });

      expect(result.missedDates.length).toBeGreaterThan(0);
      expect(result.count).toBeGreaterThan(0);
    });

    it('should respect maxMissed limit', () => {
      const task: Partial<Task> = {
        id: 'test-18',
        frequency: {
          type: 'daily',
          interval: 1,
          rruleString: 'RRULE:FREQ=DAILY;INTERVAL=1',
          dtstart: '2026-01-01T09:00:00Z',
        },
        dueAt: '2026-01-01T09:00:00Z',
      };

      const lastChecked = new Date('2026-01-01T00:00:00Z');
      const now = new Date('2026-01-30T00:00:00Z');
      
      const result = engine.getMissedOccurrences(task as Task, lastChecked, now, {
        policy: 'catch-up',
        maxMissed: 5
      });

      expect(result.missedDates.length).toBeLessThanOrEqual(5);
      if (result.count > 5) {
        expect(result.limitReached).toBe(true);
      }
    });
  });

  describe('cache', () => {
    it('should cache RRule objects', () => {
      const task: Partial<Task> = {
        id: 'test-19',
        frequency: {
          type: 'daily',
          interval: 1,
          rruleString: 'RRULE:FREQ=DAILY;INTERVAL=1',
          dtstart: '2026-01-01T09:00:00Z',
        },
        dueAt: '2026-01-01T09:00:00Z',
      };

      const from = new Date('2026-01-01T09:00:00Z');
      
      // First call
      engine.next(task as Task, from);
      const stats1 = engine.getCacheStats();
      
      // Second call should use cache
      engine.next(task as Task, from);
      const stats2 = engine.getCacheStats();
      
      expect(stats2.totalHits).toBeGreaterThan(stats1.totalHits);
    });

    it('should allow cache clearing', () => {
      const task: Partial<Task> = {
        id: 'test-20',
        frequency: {
          type: 'daily',
          interval: 1,
          rruleString: 'RRULE:FREQ=DAILY;INTERVAL=1',
          dtstart: '2026-01-01T09:00:00Z',
        },
        dueAt: '2026-01-01T09:00:00Z',
      };

      const from = new Date('2026-01-01T09:00:00Z');
      engine.next(task as Task, from);
      
      const stats1 = engine.getCacheStats();
      expect(stats1.size).toBeGreaterThan(0);
      
      engine.clearCache();
      
      const stats2 = engine.getCacheStats();
      expect(stats2.size).toBe(0);
    });

    it('should invalidate task cache entries', () => {
      const task: Partial<Task> = {
        id: 'test-21',
        frequency: {
          type: 'daily',
          interval: 1,
          rruleString: 'RRULE:FREQ=DAILY;INTERVAL=1',
          dtstart: '2026-01-01T09:00:00Z',
        },
        dueAt: '2026-01-01T09:00:00Z',
      };

      const from = new Date('2026-01-01T09:00:00Z');
      engine.next(task as Task, from);
      
      const removed = engine.invalidateTask('test-21');
      expect(removed).toBeGreaterThan(0);
    });
  });

  describe('isOccurrenceOn()', () => {
    it('should return true if date matches occurrence', () => {
      const task: Partial<Task> = {
        id: 'test-22',
        frequency: {
          type: 'daily',
          interval: 1,
          rruleString: 'RRULE:FREQ=DAILY;INTERVAL=1',
          dtstart: '2026-01-01T09:00:00Z',
        },
        dueAt: '2026-01-01T09:00:00Z',
      };

      const date = new Date('2026-01-02T14:00:00Z');
      const result = engine.isOccurrenceOn(task as Task, date);

      expect(result).toBe(true);
    });

    it('should return false if date does not match occurrence', () => {
      const task: Partial<Task> = {
        id: 'test-23',
        frequency: {
          type: 'weekly',
          interval: 1,
          weekdays: [0], // Monday only
          rruleString: 'RRULE:FREQ=WEEKLY;BYDAY=MO',
          dtstart: '2026-01-05T09:00:00Z',
        },
        dueAt: '2026-01-05T09:00:00Z',
      };

      const date = new Date('2026-01-06T14:00:00Z'); // Tuesday
      const result = engine.isOccurrenceOn(task as Task, date);

      expect(result).toBe(false);
    });
  });

  describe('toNaturalLanguage()', () => {
    it('should convert daily RRULE to text', () => {
      const text = engine.toNaturalLanguage('RRULE:FREQ=DAILY;INTERVAL=1');
      expect(text.toLowerCase()).toContain('day');
    });

    it('should convert weekly RRULE to text', () => {
      const text = engine.toNaturalLanguage('RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR');
      expect(text.toLowerCase()).toContain('week');
    });

    it('should handle RRULE without prefix', () => {
      const text = engine.toNaturalLanguage('FREQ=DAILY;INTERVAL=1');
      expect(text.toLowerCase()).toContain('day');
    });
  });

  describe('edge cases', () => {
    it('should handle leap year February 29', () => {
      const task: Partial<Task> = {
        id: 'test-24',
        frequency: {
          type: 'yearly',
          interval: 1,
          month: 1, // February
          dayOfMonth: 29,
          rruleString: 'RRULE:FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=29',
          dtstart: '2024-02-29T09:00:00Z', // Leap year
        },
        dueAt: '2024-02-29T09:00:00Z',
      };

      const from = new Date('2024-02-29T09:00:00Z');
      const next = engine.next(task as Task, from);

      expect(next).not.toBeNull();
      // Next Feb 29 is in 2028
      expect(next!.getFullYear()).toBe(2028);
      expect(next!.getMonth()).toBe(1); // February
      expect(next!.getDate()).toBe(29);
    });

    it('should handle every weekday pattern', () => {
      const task: Partial<Task> = {
        id: 'test-25',
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
      const next = engine.next(task as Task, from);

      expect(next).not.toBeNull();
      expect(next!.toISOString()).toBe('2026-01-06T09:00:00.000Z'); // Tuesday
    });
  });
});
