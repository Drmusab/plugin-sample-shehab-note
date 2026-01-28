/**
 * Unit tests for TaskDraftAdapter
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TaskDraftAdapter } from '../../src/adapters/TaskDraftAdapter';
import type { Task as RecurringTask } from '../../src/core/models/Task';
import type { Frequency } from '../../src/core/models/Frequency';
import { StatusImpl } from '../../src/vendor/obsidian-tasks/types/Status';
import { Priority } from '../../src/vendor/obsidian-tasks/types/Task';

describe('TaskDraftAdapter', () => {
  describe('Status Mapping', () => {
    it('should map TODO status to recurring', () => {
      const status = new StatusImpl(' ', 'Todo', 'TODO');
      const result = TaskDraftAdapter.mapStatusToRecurring(status);
      expect(result).toBe('todo');
    });

    it('should map DONE status to recurring', () => {
      const status = new StatusImpl('x', 'Done', 'DONE');
      const result = TaskDraftAdapter.mapStatusToRecurring(status);
      expect(result).toBe('done');
    });

    it('should map CANCELLED status to recurring', () => {
      const status = new StatusImpl('-', 'Cancelled', 'CANCELLED');
      const result = TaskDraftAdapter.mapStatusToRecurring(status);
      expect(result).toBe('cancelled');
    });

    it('should map recurring status to Obsidian TODO', () => {
      const status = TaskDraftAdapter.mapStatusToObsidian('todo');
      expect(status.type).toBe('TODO');
      expect(status.symbol).toBe(' ');
    });

    it('should map recurring status to Obsidian DONE', () => {
      const status = TaskDraftAdapter.mapStatusToObsidian('done');
      expect(status.type).toBe('DONE');
      expect(status.symbol).toBe('x');
    });

    it('should map recurring status to Obsidian CANCELLED', () => {
      const status = TaskDraftAdapter.mapStatusToObsidian('cancelled');
      expect(status.type).toBe('CANCELLED');
      expect(status.symbol).toBe('-');
    });

    it('should default to TODO for undefined status', () => {
      const status = TaskDraftAdapter.mapStatusToObsidian(undefined);
      expect(status.type).toBe('TODO');
    });
  });

  describe('Priority Mapping', () => {
    it('should map highest priority to recurring', () => {
      const result = TaskDraftAdapter.mapPriorityToRecurring('highest');
      expect(result).toBe('highest');
    });

    it('should map normal priority to recurring', () => {
      const result = TaskDraftAdapter.mapPriorityToRecurring('normal');
      expect(result).toBe('normal');
    });

    it('should map none to normal priority', () => {
      const result = TaskDraftAdapter.mapPriorityToRecurring('none');
      expect(result).toBe('normal');
    });

    it('should map recurring priority to Obsidian string', () => {
      const result = TaskDraftAdapter.mapPriorityToObsidian('highest');
      expect(result).toBe('highest');
    });

    it('should map normal priority to none', () => {
      const result = TaskDraftAdapter.mapPriorityToObsidian('normal');
      expect(result).toBe('none');
    });

    it('should map undefined priority to none', () => {
      const result = TaskDraftAdapter.mapPriorityToObsidian(undefined);
      expect(result).toBe('none');
    });

    it('should map recurring priority to Obsidian enum', () => {
      const result = TaskDraftAdapter.mapPriorityToObsidianEnum('highest');
      expect(result).toBe(Priority.Highest);
    });

    it('should default to Normal for undefined priority', () => {
      const result = TaskDraftAdapter.mapPriorityToObsidianEnum(undefined);
      expect(result).toBe(Priority.Normal);
    });
  });

  describe('Date Utilities', () => {
    it('should parse valid date string to ISO', () => {
      const result = TaskDraftAdapter.parseDate('2026-04-15');
      expect(result).toBeDefined();
      expect(result).toContain('2026-04-15');
    });

    it('should return undefined for empty date string', () => {
      const result = TaskDraftAdapter.parseDate('');
      expect(result).toBeUndefined();
    });

    it('should return undefined for null date', () => {
      const result = TaskDraftAdapter.parseDate(null);
      expect(result).toBeUndefined();
    });

    it('should return undefined for invalid date string', () => {
      const result = TaskDraftAdapter.parseDate('invalid-date');
      expect(result).toBeUndefined();
    });

    it('should format ISO timestamp to date string', () => {
      const result = TaskDraftAdapter.formatDateForUI('2026-04-15T10:30:00.000Z');
      expect(result).toBe('2026-04-15');
    });

    it('should return empty string for undefined timestamp', () => {
      const result = TaskDraftAdapter.formatDateForUI(undefined);
      expect(result).toBe('');
    });

    it('should validate valid date strings', () => {
      expect(TaskDraftAdapter.isValidDateString('2026-04-15')).toBe(true);
      expect(TaskDraftAdapter.isValidDateString('2026-04-15T10:30:00Z')).toBe(true);
    });

    it('should reject invalid date strings', () => {
      expect(TaskDraftAdapter.isValidDateString('invalid')).toBe(false);
      expect(TaskDraftAdapter.isValidDateString('')).toBe(false);
    });
  });

  describe('Frequency to RRule Conversion', () => {
    it('should convert daily frequency to rrule', () => {
      const frequency: Frequency = { type: 'daily', interval: 1 };
      const result = TaskDraftAdapter.frequencyToRRule(frequency);
      expect(result).toBe('every day');
    });

    it('should convert daily frequency with interval', () => {
      const frequency: Frequency = { type: 'daily', interval: 3 };
      const result = TaskDraftAdapter.frequencyToRRule(frequency);
      expect(result).toBe('every 3 days');
    });

    it('should convert weekly frequency to rrule', () => {
      const frequency: Frequency = { type: 'weekly', interval: 1, weekdays: [0, 2, 4] };
      const result = TaskDraftAdapter.frequencyToRRule(frequency);
      expect(result).toContain('every week on');
      expect(result).toContain('Monday');
      expect(result).toContain('Wednesday');
      expect(result).toContain('Friday');
    });

    it('should convert monthly frequency to rrule', () => {
      const frequency: Frequency = { type: 'monthly', interval: 1, dayOfMonth: 15 };
      const result = TaskDraftAdapter.frequencyToRRule(frequency);
      expect(result).toBe('every month on the 15');
    });

    it('should convert yearly frequency to rrule', () => {
      const frequency: Frequency = { type: 'yearly', interval: 1, month: 3, dayOfMonth: 15 };
      const result = TaskDraftAdapter.frequencyToRRule(frequency);
      expect(result).toContain('every year on');
      expect(result).toContain('April');
      expect(result).toContain('15');
    });

    it('should handle null frequency', () => {
      const result = TaskDraftAdapter.frequencyToRRule(undefined);
      expect(result).toBeNull();
    });
  });

  describe('RRule to Frequency Conversion', () => {
    it('should convert daily rrule to frequency', () => {
      const result = TaskDraftAdapter.rRuleToFrequency('every day');
      expect(result.type).toBe('daily');
      expect(result.interval).toBe(1);
    });

    it('should convert daily rrule with interval', () => {
      const result = TaskDraftAdapter.rRuleToFrequency('every 3 days');
      expect(result.type).toBe('daily');
      expect(result.interval).toBe(3);
    });

    it('should convert weekly rrule to frequency', () => {
      const result = TaskDraftAdapter.rRuleToFrequency('every week');
      expect(result.type).toBe('weekly');
      expect(result.interval).toBe(1);
    });

    it('should convert weekly rrule with weekdays', () => {
      const result = TaskDraftAdapter.rRuleToFrequency('every week on Monday, Wednesday, Friday');
      expect(result.type).toBe('weekly');
      expect(result.interval).toBe(1);
      if ('weekdays' in result) {
        expect(result.weekdays).toContain(0); // Monday
        expect(result.weekdays).toContain(2); // Wednesday
        expect(result.weekdays).toContain(4); // Friday
      }
    });

    it('should convert monthly rrule to frequency', () => {
      const result = TaskDraftAdapter.rRuleToFrequency('every month on the 15');
      expect(result.type).toBe('monthly');
      expect(result.interval).toBe(1);
      if ('dayOfMonth' in result) {
        expect(result.dayOfMonth).toBe(15);
      }
    });

    it('should convert yearly rrule to frequency', () => {
      const result = TaskDraftAdapter.rRuleToFrequency('every year on April 15');
      expect(result.type).toBe('yearly');
      expect(result.interval).toBe(1);
      if ('month' in result && 'dayOfMonth' in result) {
        expect(result.month).toBe(3); // April is month 3 (0-indexed)
        expect(result.dayOfMonth).toBe(15);
      }
    });

    it('should default to daily for empty rrule', () => {
      const result = TaskDraftAdapter.rRuleToFrequency('');
      expect(result.type).toBe('daily');
      expect(result.interval).toBe(1);
    });

    it('should default to daily for null rrule', () => {
      const result = TaskDraftAdapter.rRuleToFrequency(null);
      expect(result.type).toBe('daily');
      expect(result.interval).toBe(1);
    });

    it('should default to daily for invalid rrule', () => {
      const result = TaskDraftAdapter.rRuleToFrequency('invalid pattern');
      expect(result.type).toBe('daily');
      expect(result.interval).toBe(1);
    });
  });

  describe('Dependency Mapping', () => {
    it('should map task objects to IDs', () => {
      const tasks = [
        { id: 'task1', description: 'Task 1' },
        { id: 'task2', description: 'Task 2' },
      ] as any[];
      
      const result = TaskDraftAdapter.mapDependenciesToIds(tasks);
      expect(result).toEqual(['task1', 'task2']);
    });

    it('should filter out empty IDs', () => {
      const tasks = [
        { id: 'task1', description: 'Task 1' },
        { id: '', description: 'Task 2' },
        { id: 'task3', description: 'Task 3' },
      ] as any[];
      
      const result = TaskDraftAdapter.mapDependenciesToIds(tasks);
      expect(result).toEqual(['task1', 'task3']);
    });

    it('should map IDs to task objects', () => {
      const allTasks: RecurringTask[] = [
        {
          id: 'task1',
          name: 'Task 1',
          dueAt: '2026-04-15T10:00:00Z',
          frequency: { type: 'daily', interval: 1 },
          enabled: true,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        },
        {
          id: 'task2',
          name: 'Task 2',
          dueAt: '2026-04-16T10:00:00Z',
          frequency: { type: 'daily', interval: 1 },
          enabled: true,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        },
      ];
      
      const result = TaskDraftAdapter.mapIdsToTasks(['task1', 'task2'], allTasks);
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('task1');
      expect(result[1].id).toBe('task2');
    });

    it('should filter out non-existent IDs', () => {
      const allTasks: RecurringTask[] = [
        {
          id: 'task1',
          name: 'Task 1',
          dueAt: '2026-04-15T10:00:00Z',
          frequency: { type: 'daily', interval: 1 },
          enabled: true,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        },
      ];
      
      const result = TaskDraftAdapter.mapIdsToTasks(['task1', 'task999'], allTasks);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('task1');
    });
  });

  describe('Validation', () => {
    it('should validate task with required fields', () => {
      const editableTask = {
        description: 'Test Task',
        status: new StatusImpl(' ', 'Todo', 'TODO'),
        priority: 'normal',
        recurrenceRule: 'every day',
        dueDate: '2026-04-15',
        startDate: '',
        scheduledDate: '',
        createdDate: '',
        doneDate: '',
        cancelledDate: '',
        forwardOnly: false,
        blockedBy: [],
        blocking: [],
      } as any;

      expect(() => TaskDraftAdapter.validate(editableTask)).not.toThrow();
    });

    it('should throw error for missing task name', () => {
      const editableTask = {
        description: '',
        status: new StatusImpl(' ', 'Todo', 'TODO'),
        priority: 'normal',
        recurrenceRule: 'every day',
        dueDate: '2026-04-15',
        startDate: '',
        scheduledDate: '',
        createdDate: '',
        doneDate: '',
        cancelledDate: '',
        forwardOnly: false,
        blockedBy: [],
        blocking: [],
      } as any;

      expect(() => TaskDraftAdapter.validate(editableTask)).toThrow('Task name is required');
    });

    it('should throw error for invalid due date', () => {
      const editableTask = {
        description: 'Test Task',
        status: new StatusImpl(' ', 'Todo', 'TODO'),
        priority: 'normal',
        recurrenceRule: 'every day',
        dueDate: 'invalid-date',
        startDate: '',
        scheduledDate: '',
        createdDate: '',
        doneDate: '',
        cancelledDate: '',
        forwardOnly: false,
        blockedBy: [],
        blocking: [],
      } as any;

      expect(() => TaskDraftAdapter.validate(editableTask)).toThrow('Invalid due date format');
    });
  });

  describe('createEmptyEditableTask', () => {
    it('should create an empty editable task', () => {
      const result = TaskDraftAdapter.createEmptyEditableTask();
      
      expect(result).toBeDefined();
      expect(result.description).toBe('');
      expect(result.status.type).toBe('TODO');
    });
  });

  describe('toEditableTask and fromEditableTask roundtrip', () => {
    it('should convert recurring task to editable and back', () => {
      const originalTask: RecurringTask = {
        id: 'task123',
        name: 'Test Task',
        dueAt: '2026-04-15T10:00:00Z',
        frequency: { type: 'daily', interval: 2 },
        enabled: true,
        status: 'todo',
        priority: 'high',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        completionCount: 5,
        missCount: 1,
        currentStreak: 3,
        bestStreak: 5,
        recentCompletions: [],
        snoozeCount: 0,
        maxSnoozes: 3,
        version: 1,
        timezone: 'UTC',
      };

      const editableTask = TaskDraftAdapter.toEditableTask(originalTask, [originalTask]);
      const convertedBack = TaskDraftAdapter.fromEditableTask(editableTask, originalTask);

      expect(convertedBack.id).toBe(originalTask.id);
      expect(convertedBack.name).toBe(originalTask.name);
      expect(convertedBack.status).toBe('todo');
      expect(convertedBack.priority).toBe('high');
      expect(convertedBack.frequency.type).toBe('daily');
      expect(convertedBack.frequency.interval).toBe(2);
    });
  });
});
