import { describe, it, expect, beforeEach } from 'vitest';
import { QueryEngine, type TaskIndex } from '@/core/query/QueryEngine';
import { QueryParser } from '@/core/query/QueryParser';
import type { Task } from '@/core/models/Task';
import { createTask } from '@/core/models/Task';
import { StatusType } from '@/core/models/Status';

describe('QueryEngine', () => {
  let engine: QueryEngine;
  let tasks: Task[];
  let taskIndex: TaskIndex;

  beforeEach(() => {
    // Create test tasks
    tasks = [
      {
        ...createTask('Task 1', { type: 'daily', interval: 1 }),
        statusSymbol: ' ',
        priority: 'high',
        tags: ['#work', '#urgent'],
        dueAt: new Date('2025-01-15').toISOString(),
      },
      {
        ...createTask('Task 2', { type: 'weekly', interval: 1, weekdays: [1] }),
        statusSymbol: 'x',
        priority: 'normal',
        tags: ['#personal'],
        dueAt: new Date('2025-01-20').toISOString(),
      },
      {
        ...createTask('Task 3', { type: 'monthly', interval: 1, dayOfMonth: 1 }),
        statusSymbol: '/',
        priority: 'low',
        tags: [],
        dueAt: new Date('2025-02-01').toISOString(),
      },
      {
        ...createTask('Task 4', { type: 'daily', interval: 1 }),
        statusSymbol: ' ',
        priority: 'highest',
        tags: ['#work'],
        dueAt: new Date('2025-01-10').toISOString(),
      },
    ];

    taskIndex = {
      getAllTasks: () => tasks,
    };

    engine = new QueryEngine(taskIndex);
  });

  describe('Simple filters', () => {
    it('should filter "not done" tasks', () => {
      const result = engine.executeString('not done');
      
      expect(result.tasks).toHaveLength(3);
      expect(result.tasks.every(t => t.statusSymbol !== 'x')).toBe(true);
    });

    it('should filter "done" tasks', () => {
      const result = engine.executeString('done');
      
      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0].statusSymbol).toBe('x');
    });
  });

  describe('Status filters', () => {
    it('should filter by status type TODO', () => {
      const result = engine.executeString('status.type is TODO');
      
      expect(result.tasks).toHaveLength(2);
      expect(result.tasks.every(t => t.statusSymbol === ' ')).toBe(true);
    });

    it('should filter by status type DONE', () => {
      const result = engine.executeString('status.type is DONE');
      
      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0].statusSymbol).toBe('x');
    });

    it('should filter by status type IN_PROGRESS', () => {
      const result = engine.executeString('status.type is IN_PROGRESS');
      
      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0].statusSymbol).toBe('/');
    });
  });

  describe('Date filters', () => {
    it('should filter tasks due before a date', () => {
      const result = engine.executeString('due before 2025-01-16');
      
      expect(result.tasks.length).toBeGreaterThan(0);
      expect(result.tasks.every(t => new Date(t.dueAt) < new Date('2025-01-16'))).toBe(true);
    });

    it('should filter tasks due after a date', () => {
      const result = engine.executeString('due after 2025-01-16');
      
      expect(result.tasks.length).toBeGreaterThan(0);
      expect(result.tasks.every(t => new Date(t.dueAt) > new Date('2025-01-16'))).toBe(true);
    });

    it('should filter tasks with has due date', () => {
      const result = engine.executeString('has due date');
      
      expect(result.tasks).toHaveLength(4);
    });
  });

  describe('Priority filters', () => {
    it('should filter by priority is high', () => {
      const result = engine.executeString('priority is high');
      
      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0].priority).toBe('high');
    });

    it('should filter by priority above normal', () => {
      const result = engine.executeString('priority above normal');
      
      expect(result.tasks.length).toBeGreaterThan(0);
      expect(result.tasks.every(t => t.priority === 'medium' || t.priority === 'high' || t.priority === 'highest')).toBe(true);
    });

    it('should filter by priority below high', () => {
      const result = engine.executeString('priority below high');
      
      expect(result.tasks.length).toBeGreaterThan(0);
      expect(result.tasks.every(t => t.priority === 'low' || t.priority === 'normal' || t.priority === 'medium')).toBe(true);
    });
  });

  describe('Tag filters', () => {
    it('should filter by tag includes', () => {
      const result = engine.executeString('tag includes #work');
      
      expect(result.tasks).toHaveLength(2);
      expect(result.tasks.every(t => t.tags?.includes('#work'))).toBe(true);
    });

    it('should filter by has tags', () => {
      const result = engine.executeString('has tags');
      
      expect(result.tasks).toHaveLength(3);
      expect(result.tasks.every(t => t.tags && t.tags.length > 0)).toBe(true);
    });

    it('should filter by no tags', () => {
      const result = engine.executeString('no tags');
      
      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0].tags).toHaveLength(0);
    });
  });

  describe('Recurrence filters', () => {
    it('should filter is recurring', () => {
      const result = engine.executeString('is recurring');
      
      // All test tasks have recurrence defined
      expect(result.tasks).toHaveLength(4);
    });
  });

  describe('Sorting', () => {
    it('should sort by due date ascending', () => {
      const result = engine.executeString('sort by due');
      
      expect(result.tasks).toHaveLength(4);
      for (let i = 1; i < result.tasks.length; i++) {
        const prev = new Date(result.tasks[i - 1].dueAt);
        const curr = new Date(result.tasks[i].dueAt);
        expect(prev.getTime()).toBeLessThanOrEqual(curr.getTime());
      }
    });

    it('should sort by due date descending', () => {
      const result = engine.executeString('sort by due reverse');
      
      expect(result.tasks).toHaveLength(4);
      for (let i = 1; i < result.tasks.length; i++) {
        const prev = new Date(result.tasks[i - 1].dueAt);
        const curr = new Date(result.tasks[i].dueAt);
        expect(prev.getTime()).toBeGreaterThanOrEqual(curr.getTime());
      }
    });

    it('should sort by priority', () => {
      const result = engine.executeString('sort by priority');
      
      const priorities = result.tasks.map(t => t.priority);
      // low < normal < high < highest
      expect(priorities).toEqual(['low', 'normal', 'high', 'highest']);
    });
  });

  describe('Grouping', () => {
    it('should group by status type', () => {
      const result = engine.executeString('group by status.type');
      
      expect(result.groups).toBeDefined();
      expect(result.groups?.size).toBeGreaterThan(0);
      
      const todoGroup = result.groups?.get(StatusType.TODO);
      expect(todoGroup).toBeDefined();
      expect(todoGroup?.every(t => t.statusSymbol === ' ')).toBe(true);
    });

    it('should group by priority', () => {
      const result = engine.executeString('group by priority');
      
      expect(result.groups).toBeDefined();
      expect(result.groups?.size).toBe(4); // low, normal, high, highest
    });

    it('should group by due date', () => {
      const result = engine.executeString('group by due');
      
      expect(result.groups).toBeDefined();
      expect(result.groups?.size).toBeGreaterThan(0);
    });
  });

  describe('Limit', () => {
    it('should limit results to specified number', () => {
      const result = engine.executeString('limit 2');
      
      expect(result.tasks).toHaveLength(2);
      expect(result.totalCount).toBe(4);
    });

    it('should limit with "limit to X tasks" syntax', () => {
      const result = engine.executeString('limit to 3 tasks');
      
      expect(result.tasks).toHaveLength(3);
    });
  });

  describe('Complex queries', () => {
    it('should apply multiple filters', () => {
      const query = `not done
tag includes #work
sort by due`;
      
      const result = engine.executeString(query);
      
      expect(result.tasks.length).toBeGreaterThan(0);
      expect(result.tasks.every(t => t.statusSymbol !== 'x')).toBe(true);
      expect(result.tasks.every(t => t.tags?.includes('#work'))).toBe(true);
    });

    it('should combine filters, sort, and limit', () => {
      const query = `not done
priority above normal
sort by due
limit 2`;
      
      const result = engine.executeString(query);
      
      expect(result.tasks).toHaveLength(2);
      expect(result.tasks.every(t => t.statusSymbol !== 'x')).toBe(true);
      expect(result.tasks.every(t => t.priority === 'high' || t.priority === 'highest')).toBe(true);
    });

    it('should combine filters with grouping', () => {
      const query = `not done
group by priority`;
      
      const result = engine.executeString(query);
      
      expect(result.groups).toBeDefined();
      expect(result.tasks.every(t => t.statusSymbol !== 'x')).toBe(true);
    });
  });

  describe('Performance', () => {
    it('should execute query on 100 tasks quickly', () => {
      // Create 100 tasks
      const largeTasks: Task[] = [];
      for (let i = 0; i < 100; i++) {
        largeTasks.push({
          ...createTask(`Task ${i}`, { type: 'daily', interval: 1 }),
          statusSymbol: i % 2 === 0 ? ' ' : 'x',
          priority: ['lowest', 'low', 'normal', 'medium', 'high', 'highest'][i % 6] as any,
          dueAt: new Date(2025, 0, (i % 30) + 1).toISOString(),
        });
      }

      const largeIndex: TaskIndex = {
        getAllTasks: () => largeTasks,
      };

      const largeEngine = new QueryEngine(largeIndex);
      const result = largeEngine.executeString('not done\nsort by due\nlimit 10');
      
      expect(result.executionTimeMs).toBeLessThan(100);
      expect(result.tasks).toHaveLength(10);
    });

    it('should track execution time', () => {
      const result = engine.executeString('not done');
      
      expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
      expect(typeof result.executionTimeMs).toBe('number');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty task list', () => {
      const emptyIndex: TaskIndex = {
        getAllTasks: () => [],
      };
      const emptyEngine = new QueryEngine(emptyIndex);
      
      const result = emptyEngine.executeString('not done');
      
      expect(result.tasks).toHaveLength(0);
      expect(result.totalCount).toBe(0);
    });

    it('should handle tasks with missing fields', () => {
      const tasksWithMissing: Task[] = [
        {
          ...createTask('Minimal task', { type: 'daily', interval: 1 }),
          priority: undefined,
          tags: undefined,
        },
      ];

      const minimalIndex: TaskIndex = {
        getAllTasks: () => tasksWithMissing,
      };

      const minimalEngine = new QueryEngine(minimalIndex);
      const result = minimalEngine.executeString('priority is normal');
      
      // Should handle undefined priority gracefully
      expect(result.tasks).toHaveLength(1);
    });

    it('should handle query with no results', () => {
      const result = engine.executeString('priority is lowest');
      
      expect(result.tasks).toHaveLength(0);
      expect(result.totalCount).toBe(4);
    });
  });

  describe('Integration with QueryParser', () => {
    it('should execute parsed AST', () => {
      const parser = new QueryParser();
      const ast = parser.parse('not done\nsort by due\nlimit 2');
      
      const result = engine.execute(ast);
      
      expect(result.tasks).toHaveLength(2);
    });
  });
});
