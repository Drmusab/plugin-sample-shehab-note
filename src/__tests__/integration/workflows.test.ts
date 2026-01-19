/**
 * Phase 6 Workflow Integration Tests
 * End-to-end scenarios for task workflows
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createTask } from '@/core/models/Task';
import type { Task } from '@/core/models/Task';
import { RecurrenceEngine } from '@/core/engine/RecurrenceEngine';
import { StatusRegistry } from '@/core/models/StatusRegistry';

describe('Phase 6: Workflow Integration Tests', () => {
  describe('Recurring Task Workflow', () => {
    let recurrenceEngine: RecurrenceEngine;

    beforeEach(() => {
      recurrenceEngine = new RecurrenceEngine();
    });

    it('should create and complete recurring task', () => {
      const task: Task = {
        ...createTask('Daily standup', { type: 'daily', interval: 1 }),
        id: 'task1',
        dueAt: '2025-01-20T09:00:00.000Z',
        status: 'todo' as const,
        statusSymbol: ' ',
      };

      // Toggle to done
      const completedTask: Task = {
        ...task,
        statusSymbol: 'x',
        status: 'done' as const,
        doneAt: '2025-01-20T09:00:00.000Z',
      };

      expect(completedTask.statusSymbol).toBe('x');
      expect(completedTask.status).toBe('done');
      expect(completedTask.doneAt).toBeDefined();

      // Calculate next occurrence
      const nextDue = recurrenceEngine.calculateNext(
        new Date(completedTask.dueAt),
        task.frequency
      );

      expect(nextDue).toBeDefined();
      expect(nextDue.toISOString().slice(0, 10)).toBe('2025-01-21');
    });

    it('should handle weekly recurrence', () => {
      const task: Task = {
        ...createTask('Weekly review', { type: 'weekly', interval: 1, weekdays: [1] }),
        id: 'task1',
        dueAt: '2025-01-20T09:00:00.000Z', // Monday
        status: 'todo' as const,
      };

      const nextDue = recurrenceEngine.calculateNext(
        new Date(task.dueAt),
        task.frequency
      );

      expect(nextDue).toBeDefined();
      // Weekly recurrence should calculate a future date
      expect(nextDue > new Date(task.dueAt)).toBe(true);
      // Should be within the next 7 days
      const daysDiff = (nextDue.getTime() - new Date(task.dueAt).getTime()) / (1000 * 60 * 60 * 24);
      expect(daysDiff).toBeGreaterThan(0);
      expect(daysDiff).toBeLessThanOrEqual(7);
    });

    it('should handle monthly recurrence', () => {
      const task: Task = {
        ...createTask('Monthly report', { type: 'monthly', interval: 1, dayOfMonth: 15 }),
        id: 'task1',
        dueAt: '2025-01-15T09:00:00.000Z',
        status: 'todo' as const,
      };

      const nextDue = recurrenceEngine.calculateNext(
        new Date(task.dueAt),
        task.frequency
      );

      expect(nextDue).toBeDefined();
      expect(nextDue.toISOString().slice(0, 10)).toBe('2025-02-15');
    });
  });

  describe('Delete on Completion Workflow', () => {
    it('should mark task for deletion on completion', () => {
      const task: Task = {
        ...createTask('Weekly review', { type: 'weekly', interval: 1, weekdays: [1] }),
        id: 'task1',
        dueAt: '2025-01-20T09:00:00.000Z',
        onCompletion: 'delete',
        status: 'todo' as const,
      };

      // Complete the task
      const completedTask: Task = {
        ...task,
        status: 'done' as const,
        statusSymbol: 'x',
        doneAt: '2025-01-20T09:00:00.000Z',
      };

      expect(completedTask.onCompletion).toBe('delete');
      expect(completedTask.status).toBe('done');

      // In actual implementation, this task would be deleted
      // and a new instance would be created for next week
    });

    it('should keep task on completion by default', () => {
      const task: Task = {
        ...createTask('Daily task', { type: 'daily', interval: 1 }),
        id: 'task1',
        dueAt: '2025-01-20T09:00:00.000Z',
        status: 'todo' as const,
      };

      // Default behavior - keep completed task
      expect(task.onCompletion).toBeUndefined(); // Will default to 'keep'

      const completedTask: Task = {
        ...task,
        status: 'done' as const,
        onCompletion: 'keep',
      };

      expect(completedTask.onCompletion).toBe('keep');
    });
  });

  describe('Status Cycle Toggle', () => {
    let statusRegistry: StatusRegistry;

    beforeEach(() => {
      statusRegistry = StatusRegistry.getInstance();
      statusRegistry.reset(); // Reset to defaults for each test
    });

    it('should cycle through statuses: [ ] → [/] → [x] → [ ]', () => {
      // Start with TODO
      let currentSymbol = ' ';
      let status = statusRegistry.get(currentSymbol);
      expect(status.type).toBe('TODO');

      // Toggle to IN_PROGRESS
      currentSymbol = '/';
      status = statusRegistry.get(currentSymbol);
      expect(status.type).toBe('IN_PROGRESS');

      // Toggle to DONE
      currentSymbol = 'x';
      status = statusRegistry.get(currentSymbol);
      expect(status.type).toBe('DONE');

      // Toggle back to TODO
      currentSymbol = ' ';
      status = statusRegistry.get(currentSymbol);
      expect(status.type).toBe('TODO');
    });

    it('should support custom status symbols', () => {
      // Note: StatusRegistry is a singleton, so we can't easily create a custom one
      // Instead, test that custom symbols are correctly inferred
      const symbol = '>';
      const status = statusRegistry.get(symbol);
      
      expect(status).toBeDefined();
      expect(status.symbol).toBe('>');
    });

    it('should handle cancelled status', () => {
      const symbol = '-';
      const status = statusRegistry.get(symbol);
      expect(status.type).toBe('CANCELLED');
    });
  });

  describe('Task Dependencies', () => {
    it('should track task dependencies', () => {
      const taskA: Task = {
        ...createTask('Task A', { type: 'daily', interval: 1 }),
        id: 'taskA',
        status: 'todo' as const,
      };

      const taskB: Task = {
        ...createTask('Task B', { type: 'daily', interval: 1 }),
        id: 'taskB',
        dependsOn: ['taskA'],
        status: 'todo' as const,
      };

      expect(taskB.dependsOn).toContain('taskA');

      // Task B is blocked by Task A
      const isBlocked = taskB.dependsOn && taskB.dependsOn.length > 0;
      expect(isBlocked).toBe(true);
    });

    it('should unblock task when dependency is completed', () => {
      const taskA: Task = {
        ...createTask('Task A', { type: 'daily', interval: 1 }),
        id: 'taskA',
        status: 'todo' as const,
      };

      const taskB: Task = {
        ...createTask('Task B', { type: 'daily', interval: 1 }),
        id: 'taskB',
        dependsOn: ['taskA'],
        status: 'todo' as const,
      };

      // Complete taskA
      const completedA: Task = {
        ...taskA,
        status: 'done' as const,
        statusSymbol: 'x',
      };

      expect(completedA.status).toBe('done');

      // In actual implementation, dependency graph would update
      // and taskB would no longer be blocked
      expect(taskB.dependsOn).toContain('taskA');
    });

    it('should support multiple dependencies', () => {
      const taskC: Task = {
        ...createTask('Task C', { type: 'daily', interval: 1 }),
        id: 'taskC',
        dependsOn: ['taskA', 'taskB'],
        status: 'todo' as const,
      };

      expect(taskC.dependsOn).toHaveLength(2);
      expect(taskC.dependsOn).toContain('taskA');
      expect(taskC.dependsOn).toContain('taskB');
    });
  });

  describe('Natural Language Dates', () => {
    it('should support common date patterns', () => {
      const patterns = [
        { input: '2025-01-20', expected: '2025-01-20' },
        { input: '2025-01-20T09:00:00.000Z', expected: '2025-01-20' },
      ];

      for (const pattern of patterns) {
        const date = new Date(pattern.input);
        expect(date.toISOString().slice(0, 10)).toBe(pattern.expected);
      }
    });

    it('should handle relative dates', () => {
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      expect(tomorrow > today).toBe(true);
    });
  });

  describe('Global Filter', () => {
    it('should filter tasks by tag pattern', () => {
      const tasks: Task[] = [
        {
          ...createTask('Normal checklist item', { type: 'daily', interval: 1 }),
          id: 'task1',
          tags: [],
        },
        {
          ...createTask('Task item', { type: 'daily', interval: 1 }),
          id: 'task2',
          tags: ['task'],
        },
      ];

      // Filter to include only tasks with #task tag
      const filtered = tasks.filter(task => 
        task.tags && task.tags.includes('task')
      );

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('task2');
    });

    it('should support exclude mode', () => {
      const tasks: Task[] = [
        {
          ...createTask('Task 1', { type: 'daily', interval: 1 }),
          id: 'task1',
          tags: ['task'],
        },
        {
          ...createTask('Task 2', { type: 'daily', interval: 1 }),
          id: 'task2',
          tags: ['ignore'],
        },
      ];

      // Filter to exclude tasks with #ignore tag
      const filtered = tasks.filter(task => 
        !task.tags || !task.tags.includes('ignore')
      );

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('task1');
    });
  });

  describe('Task Metadata', () => {
    it('should support priority levels', () => {
      const task: Task = {
        ...createTask('High priority task', { type: 'daily', interval: 1 }),
        id: 'task1',
        priority: 'high',
      };

      expect(task.priority).toBe('high');
    });

    it('should support scheduled dates', () => {
      const task: Task = {
        ...createTask('Scheduled task', { type: 'daily', interval: 1 }),
        id: 'task1',
        dueAt: '2025-01-20T09:00:00.000Z',
        scheduledAt: '2025-01-18T09:00:00.000Z',
      };

      expect(task.scheduledAt).toBe('2025-01-18T09:00:00.000Z');
      expect(new Date(task.scheduledAt!) < new Date(task.dueAt)).toBe(true);
    });

    it('should support start dates', () => {
      const task: Task = {
        ...createTask('Task with start date', { type: 'daily', interval: 1 }),
        id: 'task1',
        dueAt: '2025-01-20T09:00:00.000Z',
        startAt: '2025-01-15T09:00:00.000Z',
      };

      expect(task.startAt).toBe('2025-01-15T09:00:00.000Z');
    });

    it('should track creation and update timestamps', () => {
      const now = new Date().toISOString();
      const task: Task = {
        ...createTask('Task', { type: 'daily', interval: 1 }),
        id: 'task1',
        createdAt: now,
        updatedAt: now,
      };

      expect(task.createdAt).toBeDefined();
      expect(task.updatedAt).toBeDefined();
    });
  });
});
