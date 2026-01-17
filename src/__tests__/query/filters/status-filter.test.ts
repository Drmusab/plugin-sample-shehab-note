import { describe, it, expect } from 'vitest';
import { 
  StatusTypeFilter, 
  StatusNameFilter, 
  StatusSymbolFilter,
  DoneFilter,
  NotDoneFilter
} from '@/core/query/filters/StatusFilter';
import { createTask } from '@/core/models/Task';
import { StatusType } from '@/core/models/Status';

describe('StatusFilter', () => {
  describe('StatusTypeFilter', () => {
    it('should match task with TODO status', () => {
      const task = {
        ...createTask('Test', { type: 'daily', interval: 1 }),
        statusSymbol: ' ',
      };
      
      const filter = new StatusTypeFilter(StatusType.TODO);
      expect(filter.matches(task)).toBe(true);
    });

    it('should match task with DONE status', () => {
      const task = {
        ...createTask('Test', { type: 'daily', interval: 1 }),
        statusSymbol: 'x',
      };
      
      const filter = new StatusTypeFilter(StatusType.DONE);
      expect(filter.matches(task)).toBe(true);
    });

    it('should not match task with different status', () => {
      const task = {
        ...createTask('Test', { type: 'daily', interval: 1 }),
        statusSymbol: ' ',
      };
      
      const filter = new StatusTypeFilter(StatusType.DONE);
      expect(filter.matches(task)).toBe(false);
    });

    it('should negate match when negate is true', () => {
      const task = {
        ...createTask('Test', { type: 'daily', interval: 1 }),
        statusSymbol: ' ',
      };
      
      const filter = new StatusTypeFilter(StatusType.TODO, true);
      expect(filter.matches(task)).toBe(false);
    });
  });

  describe('StatusNameFilter', () => {
    it('should match task by status name', () => {
      const task = {
        ...createTask('Test', { type: 'daily', interval: 1 }),
        statusSymbol: ' ',
      };
      
      const filter = new StatusNameFilter('Todo');
      expect(filter.matches(task)).toBe(true);
    });

    it('should be case insensitive', () => {
      const task = {
        ...createTask('Test', { type: 'daily', interval: 1 }),
        statusSymbol: ' ',
      };
      
      const filter = new StatusNameFilter('todo');
      expect(filter.matches(task)).toBe(true);
    });

    it('should match partial names', () => {
      const task = {
        ...createTask('Test', { type: 'daily', interval: 1 }),
        statusSymbol: ' ',
      };
      
      const filter = new StatusNameFilter('od'); // matches "Todo"
      expect(filter.matches(task)).toBe(true);
    });

    it('should negate match when negate is true', () => {
      const task = {
        ...createTask('Test', { type: 'daily', interval: 1 }),
        statusSymbol: ' ',
      };
      
      const filter = new StatusNameFilter('Todo', true);
      expect(filter.matches(task)).toBe(false);
    });
  });

  describe('StatusSymbolFilter', () => {
    it('should match task by status symbol', () => {
      const task = {
        ...createTask('Test', { type: 'daily', interval: 1 }),
        statusSymbol: 'x',
      };
      
      const filter = new StatusSymbolFilter('x');
      expect(filter.matches(task)).toBe(true);
    });

    it('should not match different symbol', () => {
      const task = {
        ...createTask('Test', { type: 'daily', interval: 1 }),
        statusSymbol: 'x',
      };
      
      const filter = new StatusSymbolFilter(' ');
      expect(filter.matches(task)).toBe(false);
    });

    it('should handle default status symbol', () => {
      const task = createTask('Test', { type: 'daily', interval: 1 });
      
      const filter = new StatusSymbolFilter(' ');
      expect(filter.matches(task)).toBe(true);
    });
  });

  describe('DoneFilter', () => {
    it('should match done tasks', () => {
      const task = {
        ...createTask('Test', { type: 'daily', interval: 1 }),
        statusSymbol: 'x',
      };
      
      const filter = new DoneFilter();
      expect(filter.matches(task)).toBe(true);
    });

    it('should not match not-done tasks', () => {
      const task = {
        ...createTask('Test', { type: 'daily', interval: 1 }),
        statusSymbol: ' ',
      };
      
      const filter = new DoneFilter();
      expect(filter.matches(task)).toBe(false);
    });
  });

  describe('NotDoneFilter', () => {
    it('should match not-done tasks', () => {
      const task = {
        ...createTask('Test', { type: 'daily', interval: 1 }),
        statusSymbol: ' ',
      };
      
      const filter = new NotDoneFilter();
      expect(filter.matches(task)).toBe(true);
    });

    it('should not match done tasks', () => {
      const task = {
        ...createTask('Test', { type: 'daily', interval: 1 }),
        statusSymbol: 'x',
      };
      
      const filter = new NotDoneFilter();
      expect(filter.matches(task)).toBe(false);
    });

    it('should match in-progress tasks', () => {
      const task = {
        ...createTask('Test', { type: 'daily', interval: 1 }),
        statusSymbol: '/',
      };
      
      const filter = new NotDoneFilter();
      expect(filter.matches(task)).toBe(true);
    });
  });
});
