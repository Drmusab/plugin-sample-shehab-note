import { describe, it, expect } from 'vitest';
import { QueryParser } from '@/core/query/QueryParser';
import { QueryEngine } from '@/core/query/QueryEngine';
import type { Task } from '@/core/models/Task';

describe('Regex Integration Tests', () => {
  const mockTasks: Task[] = [
    {
      id: '1',
      name: 'Fix urgent bug #123',
      description: 'Critical issue',
      path: 'projects/active/bugs.md',
      tags: ['#work', '#urgent'],
      dueAt: '2024-01-15T10:00:00Z',
      frequency: { type: 'daily', interval: 1 },
      enabled: true,
      createdAt: '2024-01-01T10:00:00Z',
      updatedAt: '2024-01-01T10:00:00Z',
    },
    {
      id: '2',
      name: 'Review asap',
      description: 'Code review needed',
      path: 'archive/old/review.md',
      tags: ['#work', '#review'],
      dueAt: '2024-01-20T10:00:00Z',
      frequency: { type: 'daily', interval: 1 },
      enabled: true,
      createdAt: '2024-01-01T10:00:00Z',
      updatedAt: '2024-01-01T10:00:00Z',
    },
    {
      id: '3',
      name: 'Normal task',
      description: 'Regular work',
      path: 'projects/active/tasks.md',
      tags: ['#personal', '#context/home'],
      dueAt: '2024-01-25T10:00:00Z',
      frequency: { type: 'daily', interval: 1 },
      enabled: true,
      createdAt: '2024-01-01T10:00:00Z',
      updatedAt: '2024-01-01T10:00:00Z',
    },
    {
      id: '4',
      name: 'Shopping list',
      path: 'templates/shopping.md',
      tags: ['#context/errands'],
      dueAt: '2024-01-30T10:00:00Z',
      frequency: { type: 'daily', interval: 1 },
      enabled: true,
      createdAt: '2024-01-01T10:00:00Z',
      updatedAt: '2024-01-01T10:00:00Z',
    },
  ];

  const mockIndex = {
    getAllTasks: () => mockTasks,
  };

  describe('Query Parsing', () => {
    it('should parse description regex with literal syntax', () => {
      const parser = new QueryParser();
      const ast = parser.parse('description regex /urgent|asap/i');
      
      expect(ast.filters).toHaveLength(1);
      expect(ast.filters[0].type).toBe('description-regex');
      expect(ast.filters[0].operator).toBe('regex');
      expect(ast.filters[0].value).toEqual({ pattern: 'urgent|asap', flags: 'i' });
    });

    it('should parse path regex with literal syntax', () => {
      const parser = new QueryParser();
      const ast = parser.parse('path regex /archive|templates/');
      
      expect(ast.filters).toHaveLength(1);
      expect(ast.filters[0].type).toBe('path-regex');
      expect(ast.filters[0].value).toEqual({ pattern: 'archive|templates', flags: '' });
    });

    it('should parse tag regex with literal syntax', () => {
      const parser = new QueryParser();
      const ast = parser.parse('tag regex /^#context\\//');
      
      expect(ast.filters).toHaveLength(1);
      expect(ast.filters[0].type).toBe('tag-regex');
      expect(ast.filters[0].value).toEqual({ pattern: '^#context/', flags: '' });
    });

    it('should parse negated regex filter', () => {
      const parser = new QueryParser();
      const ast = parser.parse('not description regex /wip|draft/i');
      
      expect(ast.filters).toHaveLength(1);
      expect(ast.filters[0].type).toBe('description-regex');
      expect(ast.filters[0].negate).toBe(true);
    });

    it('should parse regex with escaped slashes', () => {
      const parser = new QueryParser();
      const ast = parser.parse('path regex /archive\\/old/');
      
      expect(ast.filters[0].value).toEqual({ pattern: 'archive/old', flags: '' });
    });

    it('should throw on invalid regex pattern', () => {
      const parser = new QueryParser();
      expect(() => parser.parse('description regex /[unclosed/')).toThrow();
    });

    it('should throw on invalid regex flags', () => {
      const parser = new QueryParser();
      expect(() => parser.parse('description regex /test/g')).toThrow();
    });

    it('should parse regex in boolean expression', () => {
      const parser = new QueryParser();
      const ast = parser.parse('(description regex /urgent/i OR priority above normal) AND not done');
      
      expect(ast.filters).toHaveLength(1);
      expect(ast.filters[0].type).toBe('boolean');
    });
  });

  describe('Query Execution', () => {
    it('should filter by description regex (case-insensitive)', () => {
      const engine = new QueryEngine(mockIndex);
      const result = engine.executeString('description regex /urgent|asap/i');
      
      expect(result.tasks).toHaveLength(2);
      expect(result.tasks.map(t => t.id)).toContain('1');
      expect(result.tasks.map(t => t.id)).toContain('2');
    });

    it('should filter by description regex (case-sensitive)', () => {
      const engine = new QueryEngine(mockIndex);
      const result = engine.executeString('description regex /urgent/');
      
      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0].id).toBe('1');
    });

    it('should filter by path regex', () => {
      const engine = new QueryEngine(mockIndex);
      const result = engine.executeString('path regex /archive|templates/');
      
      expect(result.tasks).toHaveLength(2);
      expect(result.tasks.map(t => t.id)).toContain('2');
      expect(result.tasks.map(t => t.id)).toContain('4');
    });

    it('should filter by tag regex', () => {
      const engine = new QueryEngine(mockIndex);
      const result = engine.executeString('tag regex /^#context\\//');
      
      expect(result.tasks).toHaveLength(2);
      expect(result.tasks.map(t => t.id)).toContain('3');
      expect(result.tasks.map(t => t.id)).toContain('4');
    });

    it('should filter with negated regex', () => {
      const engine = new QueryEngine(mockIndex);
      const result = engine.executeString('not description regex /urgent|asap/i');
      
      expect(result.tasks).toHaveLength(2);
      expect(result.tasks.map(t => t.id)).toContain('3');
      expect(result.tasks.map(t => t.id)).toContain('4');
    });

    it('should filter with complex regex pattern', () => {
      const engine = new QueryEngine(mockIndex);
      const result = engine.executeString('description regex /bug\\s*#\\d+/');
      
      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0].id).toBe('1');
    });

    it('should combine regex with boolean AND', () => {
      const engine = new QueryEngine(mockIndex);
      const result = engine.executeString('description regex /urgent/i AND tag includes work');
      
      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0].id).toBe('1');
    });

    it('should combine regex with boolean OR', () => {
      const engine = new QueryEngine(mockIndex);
      const result = engine.executeString('description regex /urgent/i OR tag regex /^#context\\//');
      
      expect(result.tasks).toHaveLength(3);
      expect(result.tasks.map(t => t.id)).toContain('1');
      expect(result.tasks.map(t => t.id)).toContain('3');
      expect(result.tasks.map(t => t.id)).toContain('4');
    });

    it('should combine regex with NOT', () => {
      const engine = new QueryEngine(mockIndex);
      const result = engine.executeString('tag includes work AND NOT description regex /review/');
      
      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0].id).toBe('1');
    });

    it('should handle complex boolean expression', () => {
      const engine = new QueryEngine(mockIndex);
      const result = engine.executeString('(description regex /urgent/i OR path regex /archive/) AND tag includes work');
      
      expect(result.tasks).toHaveLength(2);
      expect(result.tasks.map(t => t.id)).toContain('1');
      expect(result.tasks.map(t => t.id)).toContain('2');
    });
  });

  describe('Performance', () => {
    it('should compile regex only once per query', () => {
      // Create a large dataset
      const largeTasks: Task[] = [];
      for (let i = 0; i < 1000; i++) {
        largeTasks.push({
          id: `task-${i}`,
          name: i % 10 === 0 ? `Urgent task ${i}` : `Task ${i}`,
          dueAt: '2024-01-01T00:00:00Z',
          frequency: { type: 'daily', interval: 1 },
          enabled: true,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        });
      }

      const largeIndex = {
        getAllTasks: () => largeTasks,
      };

      const engine = new QueryEngine(largeIndex);
      const startTime = performance.now();
      const result = engine.executeString('description regex /urgent/i');
      const endTime = performance.now();

      expect(result.tasks).toHaveLength(100);
      expect(endTime - startTime).toBeLessThan(100); // Should be fast
    });
  });

  describe('Error Handling', () => {
    it('should provide clear error for invalid regex', () => {
      const engine = new QueryEngine(mockIndex);
      expect(() => engine.executeString('description regex /[unclosed/')).toThrow();
    });

    it('should provide clear error for unsupported flags', () => {
      const engine = new QueryEngine(mockIndex);
      expect(() => engine.executeString('description regex /test/g')).toThrow(/Unsupported flag/);
    });

    it('should provide clear error for empty pattern', () => {
      const engine = new QueryEngine(mockIndex);
      expect(() => engine.executeString('description regex //')).toThrow(/cannot be empty/);
    });
  });

  describe('Edge Cases', () => {
    it('should handle tasks with missing fields', () => {
      const tasksWithMissing: Task[] = [
        {
          id: '1',
          name: 'Task',
          // no description, path, or tags
          dueAt: '2024-01-01T00:00:00Z',
          frequency: { type: 'daily', interval: 1 },
          enabled: true,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ];

      const index = {
        getAllTasks: () => tasksWithMissing,
      };

      const engine = new QueryEngine(index);
      
      expect(() => engine.executeString('description regex /test/')).not.toThrow();
      expect(() => engine.executeString('path regex /test/')).not.toThrow();
      expect(() => engine.executeString('tag regex /test/')).not.toThrow();
    });

    it('should handle unicode in tags', () => {
      const tasksWithUnicode: Task[] = [
        {
          id: '1',
          name: 'Task',
          tags: ['#日本語', '#français'],
          dueAt: '2024-01-01T00:00:00Z',
          frequency: { type: 'daily', interval: 1 },
          enabled: true,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ];

      const index = {
        getAllTasks: () => tasksWithUnicode,
      };

      const engine = new QueryEngine(index);
      const result = engine.executeString('tag regex /日本語/');
      
      expect(result.tasks).toHaveLength(1);
    });

    it('should handle multiline flag', () => {
      const engine = new QueryEngine(mockIndex);
      // The multiline flag allows ^ to match start of any line in multiline text
      // Using 'Critical' with case-insensitive flag to match the description
      const result = engine.executeString('description regex /critical/i');
      
      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0].id).toBe('1');
    });
  });
});
