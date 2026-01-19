/**
 * Phase 6 Integration Tests
 * Tests for optimization, migration, and performance features
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TaskIndex } from '@/core/storage/TaskIndex';
import { createTask } from '@/core/models/Task';
import type { Task } from '@/core/models/Task';
import { PerformanceProfiler } from '@/utils/PerformanceProfiler';
import { FeatureFlagManager } from '@/core/settings/FeatureFlags';

describe('Phase 6: Optimization + Migration + Tests', () => {
  describe('TaskIndex - Incremental Updates', () => {
    let index: TaskIndex;
    let tasks: Task[];

    beforeEach(() => {
      index = new TaskIndex(0); // No debounce for tests
      tasks = [];
    });

    it('should build index from tasks', async () => {
      const task1 = {
        ...createTask('Task 1', { type: 'daily', interval: 1 }),
        id: 'task1',
        status: 'todo' as const,
        tags: ['work'],
      };
      const task2 = {
        ...createTask('Task 2', { type: 'daily', interval: 1 }),
        id: 'task2',
        status: 'done' as const,
        tags: ['personal'],
      };

      tasks = [task1, task2];
      await index.rebuildIndex(tasks);

      expect(index.getAllTasks()).toHaveLength(2);
      expect(index.getById('task1')).toBeDefined();
      expect(index.getById('task2')).toBeDefined();
    });

    it('should query tasks by status', async () => {
      const task1 = {
        ...createTask('Task 1', { type: 'daily', interval: 1 }),
        id: 'task1',
        status: 'todo' as const,
      };
      const task2 = {
        ...createTask('Task 2', { type: 'daily', interval: 1 }),
        id: 'task2',
        status: 'done' as const,
      };

      tasks = [task1, task2];
      await index.rebuildIndex(tasks);

      const todoTasks = index.getByStatus('todo');
      expect(todoTasks).toHaveLength(1);
      expect(todoTasks[0].id).toBe('task1');

      const doneTasks = index.getByStatus('done');
      expect(doneTasks).toHaveLength(1);
      expect(doneTasks[0].id).toBe('task2');
    });

    it('should query tasks by tag', async () => {
      const task1 = {
        ...createTask('Task 1', { type: 'daily', interval: 1 }),
        id: 'task1',
        tags: ['work', 'urgent'],
      };
      const task2 = {
        ...createTask('Task 2', { type: 'daily', interval: 1 }),
        id: 'task2',
        tags: ['personal'],
      };

      tasks = [task1, task2];
      await index.rebuildIndex(tasks);

      const workTasks = index.getByTag('work');
      expect(workTasks).toHaveLength(1);
      expect(workTasks[0].id).toBe('task1');

      const personalTasks = index.getByTag('personal');
      expect(personalTasks).toHaveLength(1);
      expect(personalTasks[0].id).toBe('task2');
    });

    it('should handle block change events', async () => {
      const task1 = {
        ...createTask('Task 1', { type: 'daily', interval: 1 }),
        id: 'task1',
        linkedBlockId: 'block1',
      };

      await index.rebuildIndex([task1]);

      // Update task
      const updatedTask = {
        ...task1,
        name: 'Updated Task 1',
      };

      index.onBlockChanged('block1', 'updated content', updatedTask);

      // Wait for debounce (we set debounce to 0)
      await new Promise(resolve => setTimeout(resolve, 10));

      const retrieved = index.getById('task1');
      expect(retrieved?.name).toBe('Updated Task 1');
    });

    it('should handle block deletion', async () => {
      const task1 = {
        ...createTask('Task 1', { type: 'daily', interval: 1 }),
        id: 'task1',
        linkedBlockId: 'block1',
      };

      await index.rebuildIndex([task1]);
      expect(index.getById('task1')).toBeDefined();

      index.onBlockDeleted('block1');

      expect(index.getById('task1')).toBeUndefined();
    });

    it('should batch process large task sets', async () => {
      // Create 2000 tasks
      const largeTasks: Task[] = [];
      for (let i = 0; i < 2000; i++) {
        largeTasks.push({
          ...createTask(`Task ${i}`, { type: 'daily', interval: 1 }),
          id: `task${i}`,
          status: i % 2 === 0 ? 'todo' as const : 'done' as const,
        });
      }

      let progressCount = 0;
      await index.rebuildIndex(largeTasks, (percent) => {
        progressCount++;
      });

      expect(index.getAllTasks()).toHaveLength(2000);
      expect(progressCount).toBeGreaterThan(0); // Progress callback was called
    });
  });

  describe('PerformanceProfiler', () => {
    let profiler: PerformanceProfiler;

    beforeEach(() => {
      profiler = new PerformanceProfiler(1000);
    });

    it('should measure async operations', async () => {
      const result = await profiler.measure('test-op', async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'done';
      });

      expect(result).toBe('done');

      const stats = profiler.getStats('test-op');
      expect(stats).toBeDefined();
      expect(stats!.count).toBe(1);
      expect(stats!.avg).toBeGreaterThan(0);
    });

    it('should measure sync operations', () => {
      const result = profiler.measureSync('sync-op', () => {
        return 42;
      });

      expect(result).toBe(42);

      const stats = profiler.getStats('sync-op');
      expect(stats).toBeDefined();
      expect(stats!.count).toBe(1);
    });

    it('should calculate percentiles correctly', async () => {
      for (let i = 0; i < 100; i++) {
        profiler.record('multi-op', i);
      }

      const stats = profiler.getStats('multi-op');
      expect(stats).toBeDefined();
      expect(stats!.count).toBe(100);
      expect(stats!.min).toBe(0);
      expect(stats!.max).toBe(99);
      expect(stats!.avg).toBeCloseTo(49.5, 0);
      expect(stats!.p95).toBeGreaterThanOrEqual(94);
    });

    it('should track multiple operations', async () => {
      await profiler.measure('op1', async () => 1);
      await profiler.measure('op2', async () => 2);

      const allStats = profiler.getAllStats();
      expect(allStats.size).toBe(2);
      expect(allStats.has('op1')).toBe(true);
      expect(allStats.has('op2')).toBe(true);
    });

    it('should clear measurements', async () => {
      await profiler.measure('op1', async () => 1);
      expect(profiler.getStats('op1')).toBeDefined();

      profiler.clear();
      expect(profiler.getStats('op1')).toBeNull();
    });
  });

  describe('FeatureFlagManager', () => {
    let manager: FeatureFlagManager;

    beforeEach(() => {
      manager = new FeatureFlagManager();
    });

    it('should have default flags enabled', () => {
      expect(manager.isEnabled('emoji-format')).toBe(true);
      expect(manager.isEnabled('dependencies')).toBe(true);
      expect(manager.isEnabled('query-language')).toBe(true);
    });

    it('should have filename-date disabled by default', () => {
      expect(manager.isEnabled('filename-date')).toBe(false);
    });

    it('should enable and disable flags', () => {
      manager.disable('emoji-format');
      expect(manager.isEnabled('emoji-format')).toBe(false);

      manager.enable('emoji-format');
      expect(manager.isEnabled('emoji-format')).toBe(true);
    });

    it('should export and load configuration', () => {
      manager.disable('emoji-format');
      manager.enable('filename-date');

      const config = manager.exportConfig();
      expect(config['emoji-format']).toBe(false);
      expect(config['filename-date']).toBe(true);

      // Create new manager and load config
      const newManager = new FeatureFlagManager();
      newManager.loadFromConfig(config);

      expect(newManager.isEnabled('emoji-format')).toBe(false);
      expect(newManager.isEnabled('filename-date')).toBe(true);
    });

    it('should register custom flags', () => {
      manager.registerFlag({
        key: 'custom-feature',
        name: 'Custom Feature',
        description: 'A custom feature flag',
        enabled: false,
      });

      expect(manager.isEnabled('custom-feature')).toBe(false);
      
      manager.enable('custom-feature');
      expect(manager.isEnabled('custom-feature')).toBe(true);
    });

    it('should get all flags', () => {
      const flags = manager.getAllFlags();
      expect(flags.length).toBeGreaterThanOrEqual(6);
      
      const emojiFlag = flags.find(f => f.key === 'emoji-format');
      expect(emojiFlag).toBeDefined();
      expect(emojiFlag!.name).toBe('Emoji Task Format');
    });
  });

  describe('10k Task Performance', () => {
    it('should load 10k tasks efficiently', async () => {
      const profiler = new PerformanceProfiler();
      const index = new TaskIndex();

      // Create 10k tasks
      const tasks: Task[] = [];
      for (let i = 0; i < 10000; i++) {
        tasks.push({
          ...createTask(`Task ${i}`, { type: 'daily', interval: 1 }),
          id: `task${i}`,
          status: i % 3 === 0 ? 'done' as const : 'todo' as const,
          tags: [`tag${i % 10}`],
        });
      }

      // Test rebuild performance (target: < 5 seconds)
      const duration = await profiler.measure('index-rebuild', async () => {
        await index.rebuildIndex(tasks);
      });

      const stats = profiler.getStats('index-rebuild');
      expect(stats).toBeDefined();
      expect(stats!.avg).toBeLessThan(5000); // Less than 5 seconds

      expect(index.getAllTasks()).toHaveLength(10000);
    });

    it('should query 10k tasks efficiently', async () => {
      const profiler = new PerformanceProfiler();
      const index = new TaskIndex();

      // Create and index 10k tasks
      const tasks: Task[] = [];
      for (let i = 0; i < 10000; i++) {
        tasks.push({
          ...createTask(`Task ${i}`, { type: 'daily', interval: 1 }),
          id: `task${i}`,
          status: i % 3 === 0 ? 'done' as const : 'todo' as const,
          tags: [`tag${i % 10}`],
        });
      }

      await index.rebuildIndex(tasks);

      // Test query performance (target: < 500ms)
      const result = profiler.measureSync('query-tasks', () => {
        return index.getByStatus('todo');
      });

      const stats = profiler.getStats('query-tasks');
      expect(stats).toBeDefined();
      expect(stats!.avg).toBeLessThan(500); // Less than 500ms

      // Verify results
      expect(result.length).toBeGreaterThan(0);
    });
  });
});
