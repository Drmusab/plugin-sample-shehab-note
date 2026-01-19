import { describe, it, expect, beforeEach } from 'vitest';
import { DependencyGraph } from '@/core/engine/DependencyGraph';
import { FilenameDateExtractor, type FilenameDateConfig } from '@/core/settings/FilenameDate';
import { GlobalFilter, type GlobalFilterConfig } from '@/core/settings/GlobalFilter';
import { QueryEngine, type TaskIndex } from '@/core/query/QueryEngine';
import { createTask } from '@/core/models/Task';
import type { Task } from '@/core/models/Task';

describe('Phase 5 Integration', () => {
  describe('DependencyGraph with QueryEngine', () => {
    let graph: DependencyGraph;
    let engine: QueryEngine;
    let tasks: Task[];
    let taskIndex: TaskIndex;

    beforeEach(() => {
      tasks = [];
      taskIndex = {
        getAllTasks: () => tasks,
      };
      graph = new DependencyGraph();
      engine = new QueryEngine(taskIndex);
      engine.setDependencyGraph(graph);
    });

    it('should create task with dependency and query blocked tasks', () => {
      const taskA = {
        ...createTask('Task A', { type: 'daily', interval: 1 }),
        id: 'a',
        name: 'Task A',
        status: 'todo' as const,
      };
      const taskB = {
        ...createTask('Task B', { type: 'daily', interval: 1 }),
        id: 'b',
        name: 'Task B',
        dependsOn: ['a'],
        status: 'todo' as const,
      };

      tasks = [taskA, taskB];
      graph.buildGraph(tasks);

      expect(graph.isBlocked('b')).toBe(true);
      expect(graph.isBlocked('a')).toBe(false);

      // Query for blocked tasks
      const result = engine.executeString('is blocked');
      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0].id).toBe('b');
    });

    it('should query unblocked tasks after completing dependency', () => {
      const taskA = {
        ...createTask('Task A', { type: 'daily', interval: 1 }),
        id: 'a',
        name: 'Task A',
        status: 'todo' as const,
      };
      const taskB = {
        ...createTask('Task B', { type: 'daily', interval: 1 }),
        id: 'b',
        name: 'Task B',
        dependsOn: ['a'],
        status: 'todo' as const,
      };

      tasks = [taskA, taskB];
      graph.buildGraph(tasks);

      // Initially blocked
      let result = engine.executeString('is blocked');
      expect(result.tasks).toHaveLength(1);

      // Complete taskA
      taskA.status = 'done';
      graph.buildGraph(tasks);

      // Now unblocked
      result = engine.executeString('is blocked');
      expect(result.tasks).toHaveLength(0);

      result = engine.executeString('is not blocked');
      expect(result.tasks).toHaveLength(2);
    });

    it('should query tasks that are blocking others', () => {
      const taskA = {
        ...createTask('Task A', { type: 'daily', interval: 1 }),
        id: 'a',
        name: 'Task A',
        status: 'todo' as const,
      };
      const taskB = {
        ...createTask('Task B', { type: 'daily', interval: 1 }),
        id: 'b',
        name: 'Task B',
        dependsOn: ['a'],
        status: 'todo' as const,
      };
      const taskC = {
        ...createTask('Task C', { type: 'daily', interval: 1 }),
        id: 'c',
        name: 'Task C',
        dependsOn: ['a'],
        status: 'todo' as const,
      };

      tasks = [taskA, taskB, taskC];
      graph.buildGraph(tasks);

      const result = engine.executeString('is blocking');
      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0].id).toBe('a');
    });

    it('should handle complex dependency chains', () => {
      const taskA = {
        ...createTask('Task A', { type: 'daily', interval: 1 }),
        id: 'a',
        name: 'Task A',
        status: 'todo' as const,
      };
      const taskB = {
        ...createTask('Task B', { type: 'daily', interval: 1 }),
        id: 'b',
        name: 'Task B',
        dependsOn: ['a'],
        status: 'todo' as const,
      };
      const taskC = {
        ...createTask('Task C', { type: 'daily', interval: 1 }),
        id: 'c',
        name: 'Task C',
        dependsOn: ['b'],
        status: 'todo' as const,
      };

      tasks = [taskA, taskB, taskC];
      graph.buildGraph(tasks);

      // B and C should be blocked
      const blockedResult = engine.executeString('is blocked');
      expect(blockedResult.tasks).toHaveLength(2);
      expect(blockedResult.tasks.map(t => t.id)).toContain('b');
      expect(blockedResult.tasks.map(t => t.id)).toContain('c');

      // A and B should be blocking (A blocks B, B blocks C)
      const blockingResult = engine.executeString('is blocking');
      expect(blockingResult.tasks).toHaveLength(2);
      expect(blockingResult.tasks.map(t => t.id)).toContain('a');
      expect(blockingResult.tasks.map(t => t.id)).toContain('b');
    });
  });

  describe('FilenameDate integration', () => {
    it('should apply filename date to tasks without explicit date', () => {
      const config: FilenameDateConfig = {
        enabled: true,
        patterns: ['YYYY-MM-DD'],
        folders: ['daily/'],
        targetField: 'scheduled',
      };

      const task = createTask('Do something', { type: 'daily', interval: 1 });
      delete task.scheduledAt;

      const filepath = 'daily/2025-01-18-notes.md';

      const extractor = new FilenameDateExtractor();
      const updated = extractor.applyFilenameDate(task, filepath, config);

      expect(updated.scheduledAt).toBeDefined();
      const date = new Date(updated.scheduledAt!);
      expect(date.getFullYear()).toBe(2025);
      expect(date.getMonth()).toBe(0);
      expect(date.getDate()).toBe(18);
    });

    it('should not override existing dates', () => {
      const config: FilenameDateConfig = {
        enabled: true,
        patterns: ['YYYY-MM-DD'],
        folders: ['daily/'],
        targetField: 'scheduled',
      };

      const existingDate = new Date('2025-01-01').toISOString();
      const task = createTask('Do something', { type: 'daily', interval: 1 });
      task.scheduledAt = existingDate;

      const filepath = 'daily/2025-01-18-notes.md';

      const extractor = new FilenameDateExtractor();
      const updated = extractor.applyFilenameDate(task, filepath, config);

      expect(updated.scheduledAt).toBe(existingDate);
    });

    it('should support multiple date formats', () => {
      const config: FilenameDateConfig = {
        enabled: true,
        patterns: ['YYYY-MM-DD', 'YYYYMMDD', 'DD-MM-YYYY'],
        folders: [],
        targetField: 'due',
      };

      const extractor = new FilenameDateExtractor();

      // Test YYYY-MM-DD
      const task1 = createTask('Task 1', { type: 'daily', interval: 1 });
      delete task1.dueAt;
      const updated1 = extractor.applyFilenameDate(task1, '2025-01-18.md', config);
      expect(updated1.dueAt).toBeDefined();

      // Test YYYYMMDD
      const task2 = createTask('Task 2', { type: 'daily', interval: 1 });
      delete task2.dueAt;
      const updated2 = extractor.applyFilenameDate(task2, '20250118.md', config);
      expect(updated2.dueAt).toBeDefined();

      // Test DD-MM-YYYY
      const task3 = createTask('Task 3', { type: 'daily', interval: 1 });
      delete task3.dueAt;
      const updated3 = extractor.applyFilenameDate(task3, '18-01-2025.md', config);
      expect(updated3.dueAt).toBeDefined();
    });
  });

  describe('GlobalFilter integration', () => {
    it('should filter tasks based on tag pattern in include mode', () => {
      const config: GlobalFilterConfig = {
        enabled: true,
        mode: 'include',
        tagPattern: '#task',
      };

      const filter = new GlobalFilter();

      expect(filter.isTask('- [ ] Buy milk', 'any.md', config)).toBe(false);
      expect(filter.isTask('- [ ] Review PR #task', 'any.md', config)).toBe(true);
    });

    it('should filter tasks based on path pattern in exclude mode', () => {
      const config: GlobalFilterConfig = {
        enabled: true,
        mode: 'exclude',
        pathPattern: 'shopping/',
      };

      const filter = new GlobalFilter();

      expect(filter.isTask('- [ ] Buy milk', 'shopping/list.md', config)).toBe(false);
      expect(filter.isTask('- [ ] Review PR', 'work/tasks.md', config)).toBe(true);
    });

    it('should support combined tag and path patterns', () => {
      const config: GlobalFilterConfig = {
        enabled: true,
        mode: 'include',
        tagPattern: '#task',
        pathPattern: 'work/',
      };

      const filter = new GlobalFilter();

      // Must match both tag AND path
      expect(filter.isTask('- [ ] Review PR #task', 'work/tasks.md', config)).toBe(true);
      expect(filter.isTask('- [ ] Review PR #task', 'personal/todo.md', config)).toBe(false);
      expect(filter.isTask('- [ ] Review PR', 'work/tasks.md', config)).toBe(false);
    });

    it('should support regex patterns', () => {
      const config: GlobalFilterConfig = {
        enabled: true,
        mode: 'include',
        regex: '/\\[priority::/i',
      };

      const filter = new GlobalFilter();

      expect(filter.isTask('- [ ] Task [priority:: high]', 'any.md', config)).toBe(true);
      expect(filter.isTask('- [ ] Task without priority', 'any.md', config)).toBe(false);
    });
  });

  describe('Combined Phase 5 features', () => {
    it('should work together: dependencies + filename dates + global filter', () => {
      // Setup tasks with dependencies
      const taskA = {
        ...createTask('Design wireframes', { type: 'daily', interval: 1 }),
        id: 'a',
        name: 'Design wireframes #task',
        status: 'todo' as const,
      };
      const taskB = {
        ...createTask('Implement feature', { type: 'daily', interval: 1 }),
        id: 'b',
        name: 'Implement feature #task',
        dependsOn: ['a'],
        status: 'todo' as const,
      };

      // Build dependency graph
      const graph = new DependencyGraph();
      graph.buildGraph([taskA, taskB]);

      // Apply filename dates
      const filenameConfig: FilenameDateConfig = {
        enabled: true,
        patterns: ['YYYY-MM-DD'],
        folders: ['daily/'],
        targetField: 'scheduled',
      };
      const extractor = new FilenameDateExtractor();
      const taskAWithDate = extractor.applyFilenameDate(taskA, 'daily/2025-01-18.md', filenameConfig);
      const taskBWithDate = extractor.applyFilenameDate(taskB, 'daily/2025-01-18.md', filenameConfig);

      // Filter with global filter
      const filterConfig: GlobalFilterConfig = {
        enabled: true,
        mode: 'include',
        tagPattern: '#task',
      };
      const filter = new GlobalFilter();

      // Verify dependencies work
      expect(graph.isBlocked('b')).toBe(true);
      expect(graph.isBlocked('a')).toBe(false);

      // Verify filename dates were applied
      expect(taskAWithDate.scheduledAt).toBeDefined();
      expect(taskBWithDate.scheduledAt).toBeDefined();

      // Verify global filter works
      expect(filter.isTask(taskA.name, 'daily/2025-01-18.md', filterConfig)).toBe(true);
      expect(filter.isTask(taskB.name, 'daily/2025-01-18.md', filterConfig)).toBe(true);
    });
  });
});
