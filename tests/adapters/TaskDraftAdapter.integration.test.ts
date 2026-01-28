/**
 * Integration tests for TaskDraftAdapter
 * 
 * Tests the full roundtrip conversion between RecurringTask and EditableTask,
 * including edge cases, validation, and data integrity.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TaskDraftAdapter } from '../../src/adapters/TaskDraftAdapter';
import type { Task as RecurringTask } from '../../src/core/models/Task';
import type { Frequency } from '../../src/core/models/Frequency';
import { EditableTask } from '../../src/vendor/obsidian-tasks/ui/EditableTask';

describe('TaskDraftAdapter Integration Tests', () => {
  describe('Full Roundtrip Conversion', () => {
    it('should preserve all data in a complete roundtrip', () => {
      // Create a comprehensive recurring task
      const originalTask: RecurringTask = {
        id: 'task-123',
        name: 'Complete Integration Test',
        description: 'Test task with all fields',
        dueAt: '2026-04-15T14:30:00.000Z',
        startAt: '2026-04-14T08:00:00.000Z',
        scheduledAt: '2026-04-15T10:00:00.000Z',
        frequency: {
          type: 'weekly',
          interval: 2,
          weekdays: [0, 2, 4], // 0=Monday, 2=Wednesday, 4=Friday (0-indexed from Monday)
        },
        enabled: true,
        status: 'todo',
        priority: 'high',
        blockedBy: ['task-456'],
        blocks: ['task-789'],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-15T10:00:00.000Z',
        completionCount: 5,
        missCount: 1,
        currentStreak: 3,
        bestStreak: 5,
        recentCompletions: [],
        snoozeCount: 0,
        maxSnoozes: 3,
        version: 1,
        timezone: 'America/New_York',
      };

      // Create dependency tasks for resolution
      const dependencyTask1: RecurringTask = {
        id: 'task-456',
        name: 'Dependency 1',
        dueAt: '2026-04-14T10:00:00.000Z',
        frequency: { type: 'daily', interval: 1 },
        enabled: true,
        status: 'todo',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        completionCount: 0,
        missCount: 0,
        currentStreak: 0,
        bestStreak: 0,
        recentCompletions: [],
        snoozeCount: 0,
        maxSnoozes: 3,
        version: 1,
        timezone: 'UTC',
      };

      const dependencyTask2: RecurringTask = {
        id: 'task-789',
        name: 'Dependency 2',
        dueAt: '2026-04-16T10:00:00.000Z',
        frequency: { type: 'daily', interval: 1 },
        enabled: true,
        status: 'todo',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        completionCount: 0,
        missCount: 0,
        currentStreak: 0,
        bestStreak: 0,
        recentCompletions: [],
        snoozeCount: 0,
        maxSnoozes: 3,
        version: 1,
        timezone: 'UTC',
      };

      const allTasks = [originalTask, dependencyTask1, dependencyTask2];

      // Convert to EditableTask
      const editableTask = TaskDraftAdapter.toEditableTask(originalTask, allTasks);

      // Verify conversion to EditableTask
      expect(editableTask.description).toBe('Complete Integration Test');
      expect(editableTask.priority).toBe('high');
      expect(editableTask.status.type).toBe('TODO');
      expect(editableTask.dueDate).toBe('2026-04-15');
      expect(editableTask.startDate).toBe('2026-04-14');
      expect(editableTask.scheduledDate).toBe('2026-04-15');
      expect(editableTask.recurrenceRule).toContain('week');
      expect(editableTask.blockedBy).toHaveLength(1);

      // Convert back to RecurringTask
      const convertedBack = TaskDraftAdapter.fromEditableTask(editableTask, originalTask);

      // Verify core fields preserved
      expect(convertedBack.id).toBe(originalTask.id);
      expect(convertedBack.name).toBe(originalTask.name);
      expect(convertedBack.priority).toBe(originalTask.priority);
      expect(convertedBack.status).toBe(originalTask.status);
      
      // Verify frequency preserved
      expect(convertedBack.frequency.type).toBe('weekly');
      expect(convertedBack.frequency.interval).toBe(2);
      if ('weekdays' in convertedBack.frequency) {
        expect(convertedBack.frequency.weekdays).toContain(0);
        expect(convertedBack.frequency.weekdays).toContain(2);
        expect(convertedBack.frequency.weekdays).toContain(4);
      }

      // Verify metadata preserved
      expect(convertedBack.completionCount).toBe(5);
      expect(convertedBack.currentStreak).toBe(3);
      expect(convertedBack.timezone).toBe('America/New_York');
    });

    it('should handle minimal task with only required fields', () => {
      const minimalTask: RecurringTask = {
        id: 'minimal-task',
        name: 'Minimal Task',
        dueAt: '2026-04-15T10:00:00.000Z',
        frequency: { type: 'daily', interval: 1 },
        enabled: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        completionCount: 0,
        missCount: 0,
        currentStreak: 0,
        bestStreak: 0,
        recentCompletions: [],
        snoozeCount: 0,
        maxSnoozes: 3,
        version: 1,
        timezone: 'UTC',
      };

      const editableTask = TaskDraftAdapter.toEditableTask(minimalTask, [minimalTask]);
      const convertedBack = TaskDraftAdapter.fromEditableTask(editableTask, minimalTask);

      expect(convertedBack.id).toBe(minimalTask.id);
      expect(convertedBack.name).toBe(minimalTask.name);
      expect(convertedBack.frequency.type).toBe('daily');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty description gracefully', () => {
      const emptyDescTask = {
        description: '',
        status: TaskDraftAdapter.mapStatusToObsidian('todo'),
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

      expect(() => TaskDraftAdapter.validate(emptyDescTask)).toThrow('Task name is required');
    });

    it('should handle whitespace-only description', () => {
      const whitespaceTask = {
        description: '   ',
        status: TaskDraftAdapter.mapStatusToObsidian('todo'),
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

      expect(() => TaskDraftAdapter.validate(whitespaceTask)).toThrow('Task name is required');
    });

    it('should reject invalid date formats', () => {
      const invalidDateTask = {
        description: 'Test Task',
        status: TaskDraftAdapter.mapStatusToObsidian('todo'),
        priority: 'normal',
        recurrenceRule: 'every day',
        dueDate: 'not-a-date',
        startDate: '',
        scheduledDate: '',
        createdDate: '',
        doneDate: '',
        cancelledDate: '',
        forwardOnly: false,
        blockedBy: [],
        blocking: [],
      } as any;

      expect(() => TaskDraftAdapter.validate(invalidDateTask)).toThrow('Invalid due date format');
    });

    it('should reject start date after due date', () => {
      const invalidOrderTask = {
        description: 'Test Task',
        status: TaskDraftAdapter.mapStatusToObsidian('todo'),
        priority: 'normal',
        recurrenceRule: 'every day',
        dueDate: '2026-04-15',
        startDate: '2026-04-20',
        scheduledDate: '',
        createdDate: '',
        doneDate: '',
        cancelledDate: '',
        forwardOnly: false,
        blockedBy: [],
        blocking: [],
      } as any;

      expect(() => TaskDraftAdapter.validate(invalidOrderTask)).toThrow('Start date cannot be after due date');
    });

    it('should reject scheduled date after due date', () => {
      const invalidScheduledTask = {
        description: 'Test Task',
        status: TaskDraftAdapter.mapStatusToObsidian('todo'),
        priority: 'normal',
        recurrenceRule: 'every day',
        dueDate: '2026-04-15',
        startDate: '',
        scheduledDate: '2026-04-20',
        createdDate: '',
        doneDate: '',
        cancelledDate: '',
        forwardOnly: false,
        blockedBy: [],
        blocking: [],
      } as any;

      expect(() => TaskDraftAdapter.validate(invalidScheduledTask)).toThrow('Scheduled date cannot be after due date');
    });

    it('should reject zero interval recurrence', () => {
      const zeroIntervalTask = {
        description: 'Test Task',
        status: TaskDraftAdapter.mapStatusToObsidian('todo'),
        priority: 'normal',
        recurrenceRule: 'every 0 days',
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

      // Note: "every 0 days" gets parsed as interval 0, which is then caught by
      // the frequency validation check that rejects invalid format before the
      // specific interval check runs
      expect(() => TaskDraftAdapter.validate(zeroIntervalTask)).toThrow('Invalid recurrence rule');
    });

    it('should reject unreasonably large intervals', () => {
      const largeIntervalTask = {
        description: 'Test Task',
        status: TaskDraftAdapter.mapStatusToObsidian('todo'),
        priority: 'normal',
        recurrenceRule: 'every 2000 days',
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

      expect(() => TaskDraftAdapter.validate(largeIntervalTask)).toThrow('Recurrence interval is too large');
    });

    it('should handle null and undefined dates', () => {
      const result1 = TaskDraftAdapter.parseDate(null);
      expect(result1).toBeUndefined();

      const result2 = TaskDraftAdapter.parseDate(undefined);
      expect(result2).toBeUndefined();

      const result3 = TaskDraftAdapter.parseDate('');
      expect(result3).toBeUndefined();
    });
  });

  describe('Complex Recurrence Rules', () => {
    it('should handle weekly recurrence with multiple weekdays', () => {
      const frequency: Frequency = {
        type: 'weekly',
        interval: 1,
        weekdays: [0, 2, 4],
      };

      const rrule = TaskDraftAdapter.frequencyToRRule(frequency);
      expect(rrule).toContain('week');
      expect(rrule).toContain('Monday');
      expect(rrule).toContain('Wednesday');
      expect(rrule).toContain('Friday');

      const convertedBack = TaskDraftAdapter.rRuleToFrequency(rrule!);
      expect(convertedBack.type).toBe('weekly');
      if ('weekdays' in convertedBack) {
        expect(convertedBack.weekdays).toContain(0);
        expect(convertedBack.weekdays).toContain(2);
        expect(convertedBack.weekdays).toContain(4);
      }
    });

    it('should handle monthly recurrence with specific day', () => {
      const frequency: Frequency = {
        type: 'monthly',
        interval: 2,
        dayOfMonth: 15,
      };

      const rrule = TaskDraftAdapter.frequencyToRRule(frequency);
      expect(rrule).toContain('month');
      expect(rrule).toContain('15');

      const convertedBack = TaskDraftAdapter.rRuleToFrequency(rrule!);
      expect(convertedBack.type).toBe('monthly');
      if ('dayOfMonth' in convertedBack) {
        expect(convertedBack.dayOfMonth).toBe(15);
      }
    });

    it('should handle yearly recurrence with month and day', () => {
      const frequency: Frequency = {
        type: 'yearly',
        interval: 1,
        month: 11,
        dayOfMonth: 25,
      };

      const rrule = TaskDraftAdapter.frequencyToRRule(frequency);
      expect(rrule).toContain('year');
      expect(rrule).toContain('December');
      expect(rrule).toContain('25');

      const convertedBack = TaskDraftAdapter.rRuleToFrequency(rrule!);
      expect(convertedBack.type).toBe('yearly');
      if ('month' in convertedBack && 'dayOfMonth' in convertedBack) {
        expect(convertedBack.month).toBe(11);
        expect(convertedBack.dayOfMonth).toBe(25);
      }
    });

    it('should handle daily recurrence with large interval', () => {
      const frequency: Frequency = {
        type: 'daily',
        interval: 30,
      };

      const rrule = TaskDraftAdapter.frequencyToRRule(frequency);
      expect(rrule).toBe('every 30 days');

      const convertedBack = TaskDraftAdapter.rRuleToFrequency(rrule!);
      expect(convertedBack.type).toBe('daily');
      expect(convertedBack.interval).toBe(30);
    });
  });

  describe('Dependency Mapping', () => {
    it('should correctly map dependencies in both directions', () => {
      const task1: RecurringTask = {
        id: 'task-1',
        name: 'Task 1',
        dueAt: '2026-04-15T10:00:00.000Z',
        frequency: { type: 'daily', interval: 1 },
        enabled: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        completionCount: 0,
        missCount: 0,
        currentStreak: 0,
        bestStreak: 0,
        recentCompletions: [],
        snoozeCount: 0,
        maxSnoozes: 3,
        version: 1,
        timezone: 'UTC',
        blockedBy: ['task-2', 'task-3'],
        blocks: ['task-4'],
      };

      const task2: RecurringTask = {
        id: 'task-2',
        name: 'Task 2',
        dueAt: '2026-04-14T10:00:00.000Z',
        frequency: { type: 'daily', interval: 1 },
        enabled: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        completionCount: 0,
        missCount: 0,
        currentStreak: 0,
        bestStreak: 0,
        recentCompletions: [],
        snoozeCount: 0,
        maxSnoozes: 3,
        version: 1,
        timezone: 'UTC',
      };

      const task3: RecurringTask = {
        id: 'task-3',
        name: 'Task 3',
        dueAt: '2026-04-13T10:00:00.000Z',
        frequency: { type: 'daily', interval: 1 },
        enabled: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        completionCount: 0,
        missCount: 0,
        currentStreak: 0,
        bestStreak: 0,
        recentCompletions: [],
        snoozeCount: 0,
        maxSnoozes: 3,
        version: 1,
        timezone: 'UTC',
      };

      const task4: RecurringTask = {
        id: 'task-4',
        name: 'Task 4',
        dueAt: '2026-04-16T10:00:00.000Z',
        frequency: { type: 'daily', interval: 1 },
        enabled: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        completionCount: 0,
        missCount: 0,
        currentStreak: 0,
        bestStreak: 0,
        recentCompletions: [],
        snoozeCount: 0,
        maxSnoozes: 3,
        version: 1,
        timezone: 'UTC',
      };

      const allTasks = [task1, task2, task3, task4];

      // Convert to EditableTask
      const editableTask = TaskDraftAdapter.toEditableTask(task1, allTasks);

      // Verify blockedBy dependencies
      expect(editableTask.blockedBy).toHaveLength(2);
      expect(editableTask.blockedBy.some(t => t.id === 'task-2')).toBe(true);
      expect(editableTask.blockedBy.some(t => t.id === 'task-3')).toBe(true);

      // Convert back
      const convertedBack = TaskDraftAdapter.fromEditableTask(editableTask, task1);

      // Verify dependencies preserved
      expect(convertedBack.blockedBy).toHaveLength(2);
      expect(convertedBack.blockedBy).toContain('task-2');
      expect(convertedBack.blockedBy).toContain('task-3');
    });

    it('should handle tasks with no dependencies', () => {
      const taskNoDeps: RecurringTask = {
        id: 'task-no-deps',
        name: 'Independent Task',
        dueAt: '2026-04-15T10:00:00.000Z',
        frequency: { type: 'daily', interval: 1 },
        enabled: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        completionCount: 0,
        missCount: 0,
        currentStreak: 0,
        bestStreak: 0,
        recentCompletions: [],
        snoozeCount: 0,
        maxSnoozes: 3,
        version: 1,
        timezone: 'UTC',
      };

      const editableTask = TaskDraftAdapter.toEditableTask(taskNoDeps, [taskNoDeps]);
      expect(editableTask.blockedBy).toHaveLength(0);
      expect(editableTask.blocking).toHaveLength(0);

      const convertedBack = TaskDraftAdapter.fromEditableTask(editableTask, taskNoDeps);
      expect(convertedBack.blockedBy || []).toHaveLength(0);
      expect(convertedBack.blocks || []).toHaveLength(0);
    });

    it('should filter out non-existent dependencies', () => {
      const ids = ['task-1', 'task-999', 'task-2'];
      const allTasks: RecurringTask[] = [
        {
          id: 'task-1',
          name: 'Task 1',
          dueAt: '2026-04-15T10:00:00.000Z',
          frequency: { type: 'daily', interval: 1 },
          enabled: true,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          completionCount: 0,
          missCount: 0,
          currentStreak: 0,
          bestStreak: 0,
          recentCompletions: [],
          snoozeCount: 0,
          maxSnoozes: 3,
          version: 1,
          timezone: 'UTC',
        },
        {
          id: 'task-2',
          name: 'Task 2',
          dueAt: '2026-04-16T10:00:00.000Z',
          frequency: { type: 'daily', interval: 1 },
          enabled: true,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          completionCount: 0,
          missCount: 0,
          currentStreak: 0,
          bestStreak: 0,
          recentCompletions: [],
          snoozeCount: 0,
          maxSnoozes: 3,
          version: 1,
          timezone: 'UTC',
        },
      ];

      const result = TaskDraftAdapter.mapIdsToTasks(ids, allTasks);
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('task-1');
      expect(result[1].id).toBe('task-2');
    });
  });

  describe('Status and Priority Mapping', () => {
    it('should correctly map all status types', () => {
      const statuses: Array<'todo' | 'done' | 'cancelled'> = ['todo', 'done', 'cancelled'];
      
      for (const status of statuses) {
        const obsidianStatus = TaskDraftAdapter.mapStatusToObsidian(status);
        const backToRecurring = TaskDraftAdapter.mapStatusToRecurring(obsidianStatus);
        expect(backToRecurring).toBe(status);
      }
    });

    it('should correctly map all priority levels', () => {
      const priorities: Array<'lowest' | 'low' | 'normal' | 'medium' | 'high' | 'highest'> = [
        'lowest', 'low', 'normal', 'medium', 'high', 'highest'
      ];
      
      for (const priority of priorities) {
        const obsidianPriority = TaskDraftAdapter.mapPriorityToObsidian(priority);
        const backToRecurring = TaskDraftAdapter.mapPriorityToRecurring(obsidianPriority);
        expect(backToRecurring).toBe(priority);
      }
    });
  });

  describe('Empty Task Creation', () => {
    it('should create valid empty editable task', () => {
      const emptyTask = TaskDraftAdapter.createEmptyEditableTask();
      
      expect(emptyTask).toBeDefined();
      expect(emptyTask.description).toBe('');
      expect(emptyTask.status.type).toBe('TODO');
      expect(emptyTask.priority).toBe('none');
      expect(emptyTask.blockedBy).toHaveLength(0);
      expect(emptyTask.blocking).toHaveLength(0);
    });
  });
});
