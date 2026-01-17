import { describe, it, expect } from 'vitest';
import { AndFilter, OrFilter, NotFilter } from '@/core/query/filters/BooleanFilter';
import { Filter } from '@/core/query/filters/FilterBase';
import { createTask } from '@/core/models/Task';
import type { Task } from '@/core/models/Task';

// Simple mock filters for testing
class AlwaysTrueFilter extends Filter {
  matches(task: Task): boolean {
    return true;
  }
}

class AlwaysFalseFilter extends Filter {
  matches(task: Task): boolean {
    return false;
  }
}

class HasTagsFilter extends Filter {
  matches(task: Task): boolean {
    return task.tags !== undefined && task.tags.length > 0;
  }
}

describe('BooleanFilter', () => {
  const testTask = createTask('Test Task', { type: 'daily', interval: 1 });

  describe('AndFilter', () => {
    it('should return true when both filters match', () => {
      const filter = new AndFilter(new AlwaysTrueFilter(), new AlwaysTrueFilter());
      expect(filter.matches(testTask)).toBe(true);
    });

    it('should return false when left filter does not match', () => {
      const filter = new AndFilter(new AlwaysFalseFilter(), new AlwaysTrueFilter());
      expect(filter.matches(testTask)).toBe(false);
    });

    it('should return false when right filter does not match', () => {
      const filter = new AndFilter(new AlwaysTrueFilter(), new AlwaysFalseFilter());
      expect(filter.matches(testTask)).toBe(false);
    });

    it('should return false when both filters do not match', () => {
      const filter = new AndFilter(new AlwaysFalseFilter(), new AlwaysFalseFilter());
      expect(filter.matches(testTask)).toBe(false);
    });

    it('should work with real filters', () => {
      const taskWithTags = {
        ...testTask,
        tags: ['#work'],
      };
      
      const filter = new AndFilter(new HasTagsFilter(), new AlwaysTrueFilter());
      expect(filter.matches(taskWithTags)).toBe(true);
      
      const taskWithoutTags = {
        ...testTask,
        tags: [],
      };
      expect(filter.matches(taskWithoutTags)).toBe(false);
    });
  });

  describe('OrFilter', () => {
    it('should return true when both filters match', () => {
      const filter = new OrFilter(new AlwaysTrueFilter(), new AlwaysTrueFilter());
      expect(filter.matches(testTask)).toBe(true);
    });

    it('should return true when left filter matches', () => {
      const filter = new OrFilter(new AlwaysTrueFilter(), new AlwaysFalseFilter());
      expect(filter.matches(testTask)).toBe(true);
    });

    it('should return true when right filter matches', () => {
      const filter = new OrFilter(new AlwaysFalseFilter(), new AlwaysTrueFilter());
      expect(filter.matches(testTask)).toBe(true);
    });

    it('should return false when both filters do not match', () => {
      const filter = new OrFilter(new AlwaysFalseFilter(), new AlwaysFalseFilter());
      expect(filter.matches(testTask)).toBe(false);
    });

    it('should work with real filters', () => {
      const taskWithTags = {
        ...testTask,
        tags: ['#work'],
      };
      
      const filter = new OrFilter(new HasTagsFilter(), new AlwaysFalseFilter());
      expect(filter.matches(taskWithTags)).toBe(true);
      
      const taskWithoutTags = {
        ...testTask,
        tags: [],
      };
      expect(filter.matches(taskWithoutTags)).toBe(false);
    });
  });

  describe('NotFilter', () => {
    it('should negate true to false', () => {
      const filter = new NotFilter(new AlwaysTrueFilter());
      expect(filter.matches(testTask)).toBe(false);
    });

    it('should negate false to true', () => {
      const filter = new NotFilter(new AlwaysFalseFilter());
      expect(filter.matches(testTask)).toBe(true);
    });

    it('should work with real filters', () => {
      const taskWithTags = {
        ...testTask,
        tags: ['#work'],
      };
      
      const filter = new NotFilter(new HasTagsFilter());
      expect(filter.matches(taskWithTags)).toBe(false);
      
      const taskWithoutTags = {
        ...testTask,
        tags: [],
      };
      expect(filter.matches(taskWithoutTags)).toBe(true);
    });
  });

  describe('Complex nested expressions', () => {
    it('should handle AND(OR, NOT)', () => {
      // (true OR false) AND NOT(false) = true AND true = true
      const filter = new AndFilter(
        new OrFilter(new AlwaysTrueFilter(), new AlwaysFalseFilter()),
        new NotFilter(new AlwaysFalseFilter())
      );
      expect(filter.matches(testTask)).toBe(true);
    });

    it('should handle OR(AND, AND)', () => {
      // (true AND true) OR (false AND true) = true OR false = true
      const filter = new OrFilter(
        new AndFilter(new AlwaysTrueFilter(), new AlwaysTrueFilter()),
        new AndFilter(new AlwaysFalseFilter(), new AlwaysTrueFilter())
      );
      expect(filter.matches(testTask)).toBe(true);
    });

    it('should handle NOT(AND(NOT, NOT))', () => {
      // NOT(NOT(true) AND NOT(true)) = NOT(false AND false) = NOT(false) = true
      const filter = new NotFilter(
        new AndFilter(
          new NotFilter(new AlwaysTrueFilter()),
          new NotFilter(new AlwaysTrueFilter())
        )
      );
      expect(filter.matches(testTask)).toBe(true);
    });
  });
});
