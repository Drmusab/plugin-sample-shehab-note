import { describe, it, expect } from 'vitest';
import { DescriptionRegexFilter } from '@/core/query/filters/DescriptionRegexFilter';
import { PathRegexFilter } from '@/core/query/filters/PathRegexFilter';
import { TagRegexFilter } from '@/core/query/filters/TagRegexFilter';
import type { Task } from '@/core/models/Task';
import type { RegexSpec } from '@/core/query/utils/RegexMatcher';

describe('Regex Filters', () => {
  describe('DescriptionRegexFilter', () => {
    it('should match task name with case-insensitive flag', () => {
      const spec: RegexSpec = { pattern: 'urgent', flags: 'i' };
      const filter = new DescriptionRegexFilter(spec);
      
      const task: Task = {
        id: '1',
        name: 'URGENT task',
        dueAt: '2024-01-01T00:00:00Z',
        frequency: { type: 'daily', interval: 1 },
        enabled: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };
      
      expect(filter.matches(task)).toBe(true);
    });

    it('should match task description', () => {
      const spec: RegexSpec = { pattern: 'important' };
      const filter = new DescriptionRegexFilter(spec);
      
      const task: Task = {
        id: '1',
        name: 'Task',
        description: 'This is important',
        dueAt: '2024-01-01T00:00:00Z',
        frequency: { type: 'daily', interval: 1 },
        enabled: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };
      
      expect(filter.matches(task)).toBe(true);
    });

    it('should match either name or description', () => {
      const spec: RegexSpec = { pattern: 'bug\\s*#\\d+' };
      const filter = new DescriptionRegexFilter(spec);
      
      const task1: Task = {
        id: '1',
        name: 'Fix bug #123',
        dueAt: '2024-01-01T00:00:00Z',
        frequency: { type: 'daily', interval: 1 },
        enabled: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };
      
      const task2: Task = {
        id: '2',
        name: 'Task',
        description: 'Related to bug #456',
        dueAt: '2024-01-01T00:00:00Z',
        frequency: { type: 'daily', interval: 1 },
        enabled: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };
      
      expect(filter.matches(task1)).toBe(true);
      expect(filter.matches(task2)).toBe(true);
    });

    it('should not match when pattern does not match', () => {
      const spec: RegexSpec = { pattern: 'urgent' };
      const filter = new DescriptionRegexFilter(spec);
      
      const task: Task = {
        id: '1',
        name: 'Normal task',
        dueAt: '2024-01-01T00:00:00Z',
        frequency: { type: 'daily', interval: 1 },
        enabled: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };
      
      expect(filter.matches(task)).toBe(false);
    });

    it('should respect case sensitivity without flag', () => {
      const spec: RegexSpec = { pattern: 'urgent' };
      const filter = new DescriptionRegexFilter(spec);
      
      const task: Task = {
        id: '1',
        name: 'URGENT task',
        dueAt: '2024-01-01T00:00:00Z',
        frequency: { type: 'daily', interval: 1 },
        enabled: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };
      
      expect(filter.matches(task)).toBe(false);
    });

    it('should negate match when negate is true', () => {
      const spec: RegexSpec = { pattern: 'urgent', flags: 'i' };
      const filter = new DescriptionRegexFilter(spec, true);
      
      const task: Task = {
        id: '1',
        name: 'Normal task',
        dueAt: '2024-01-01T00:00:00Z',
        frequency: { type: 'daily', interval: 1 },
        enabled: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };
      
      expect(filter.matches(task)).toBe(true);
    });

    it('should handle missing description', () => {
      const spec: RegexSpec = { pattern: 'test' };
      const filter = new DescriptionRegexFilter(spec);
      
      const task: Task = {
        id: '1',
        name: 'Task name',
        dueAt: '2024-01-01T00:00:00Z',
        frequency: { type: 'daily', interval: 1 },
        enabled: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };
      
      expect(filter.matches(task)).toBe(false);
    });

    it('should match OR pattern', () => {
      const spec: RegexSpec = { pattern: 'urgent|asap', flags: 'i' };
      const filter = new DescriptionRegexFilter(spec);
      
      const task1: Task = {
        id: '1',
        name: 'URGENT task',
        dueAt: '2024-01-01T00:00:00Z',
        frequency: { type: 'daily', interval: 1 },
        enabled: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };
      
      const task2: Task = {
        id: '2',
        name: 'Do this asap',
        dueAt: '2024-01-01T00:00:00Z',
        frequency: { type: 'daily', interval: 1 },
        enabled: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };
      
      expect(filter.matches(task1)).toBe(true);
      expect(filter.matches(task2)).toBe(true);
    });
  });

  describe('PathRegexFilter', () => {
    it('should match task path', () => {
      const spec: RegexSpec = { pattern: 'archive' };
      const filter = new PathRegexFilter(spec);
      
      const task: Task = {
        id: '1',
        name: 'Task',
        path: 'notes/archive/old.md',
        dueAt: '2024-01-01T00:00:00Z',
        frequency: { type: 'daily', interval: 1 },
        enabled: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };
      
      expect(filter.matches(task)).toBe(true);
    });

    it('should match path with regex pattern', () => {
      const spec: RegexSpec = { pattern: 'archive|templates' };
      const filter = new PathRegexFilter(spec);
      
      const task1: Task = {
        id: '1',
        name: 'Task',
        path: 'archive/file.md',
        dueAt: '2024-01-01T00:00:00Z',
        frequency: { type: 'daily', interval: 1 },
        enabled: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };
      
      const task2: Task = {
        id: '2',
        name: 'Task',
        path: 'templates/task.md',
        dueAt: '2024-01-01T00:00:00Z',
        frequency: { type: 'daily', interval: 1 },
        enabled: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };
      
      expect(filter.matches(task1)).toBe(true);
      expect(filter.matches(task2)).toBe(true);
    });

    it('should treat missing path as empty string', () => {
      const spec: RegexSpec = { pattern: 'test' };
      const filter = new PathRegexFilter(spec);
      
      const task: Task = {
        id: '1',
        name: 'Task',
        dueAt: '2024-01-01T00:00:00Z',
        frequency: { type: 'daily', interval: 1 },
        enabled: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };
      
      expect(filter.matches(task)).toBe(false);
    });

    it('should negate match when negate is true', () => {
      const spec: RegexSpec = { pattern: 'archive' };
      const filter = new PathRegexFilter(spec, true);
      
      const task: Task = {
        id: '1',
        name: 'Task',
        path: 'notes/current/file.md',
        dueAt: '2024-01-01T00:00:00Z',
        frequency: { type: 'daily', interval: 1 },
        enabled: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };
      
      expect(filter.matches(task)).toBe(true);
    });
  });

  describe('TagRegexFilter', () => {
    it('should match any tag in array', () => {
      const spec: RegexSpec = { pattern: 'work' };
      const filter = new TagRegexFilter(spec);
      
      const task: Task = {
        id: '1',
        name: 'Task',
        tags: ['#work', '#urgent'],
        dueAt: '2024-01-01T00:00:00Z',
        frequency: { type: 'daily', interval: 1 },
        enabled: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };
      
      expect(filter.matches(task)).toBe(true);
    });

    it('should match tag with pattern', () => {
      const spec: RegexSpec = { pattern: '^#context/' };
      const filter = new TagRegexFilter(spec);
      
      const task: Task = {
        id: '1',
        name: 'Task',
        tags: ['#context/home', '#work'],
        dueAt: '2024-01-01T00:00:00Z',
        frequency: { type: 'daily', interval: 1 },
        enabled: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };
      
      expect(filter.matches(task)).toBe(true);
    });

    it('should return negated result for empty tags', () => {
      const spec: RegexSpec = { pattern: 'work' };
      const filter = new TagRegexFilter(spec);
      
      const task: Task = {
        id: '1',
        name: 'Task',
        tags: [],
        dueAt: '2024-01-01T00:00:00Z',
        frequency: { type: 'daily', interval: 1 },
        enabled: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };
      
      expect(filter.matches(task)).toBe(false);
    });

    it('should return negated result for missing tags', () => {
      const spec: RegexSpec = { pattern: 'work' };
      const filter = new TagRegexFilter(spec);
      
      const task: Task = {
        id: '1',
        name: 'Task',
        dueAt: '2024-01-01T00:00:00Z',
        frequency: { type: 'daily', interval: 1 },
        enabled: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };
      
      expect(filter.matches(task)).toBe(false);
    });

    it('should negate match when negate is true', () => {
      const spec: RegexSpec = { pattern: 'work' };
      const filter = new TagRegexFilter(spec, true);
      
      const task: Task = {
        id: '1',
        name: 'Task',
        tags: ['#personal', '#home'],
        dueAt: '2024-01-01T00:00:00Z',
        frequency: { type: 'daily', interval: 1 },
        enabled: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };
      
      expect(filter.matches(task)).toBe(true);
    });

    it('should negate match for empty tags when negate is true', () => {
      const spec: RegexSpec = { pattern: 'work' };
      const filter = new TagRegexFilter(spec, true);
      
      const task: Task = {
        id: '1',
        name: 'Task',
        tags: [],
        dueAt: '2024-01-01T00:00:00Z',
        frequency: { type: 'daily', interval: 1 },
        enabled: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };
      
      expect(filter.matches(task)).toBe(true);
    });

    it('should match with OR pattern', () => {
      const spec: RegexSpec = { pattern: 'work|urgent' };
      const filter = new TagRegexFilter(spec);
      
      const task1: Task = {
        id: '1',
        name: 'Task',
        tags: ['#work'],
        dueAt: '2024-01-01T00:00:00Z',
        frequency: { type: 'daily', interval: 1 },
        enabled: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };
      
      const task2: Task = {
        id: '2',
        name: 'Task',
        tags: ['#urgent'],
        dueAt: '2024-01-01T00:00:00Z',
        frequency: { type: 'daily', interval: 1 },
        enabled: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };
      
      expect(filter.matches(task1)).toBe(true);
      expect(filter.matches(task2)).toBe(true);
    });
  });
});
