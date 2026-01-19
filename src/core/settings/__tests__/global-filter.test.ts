import { describe, it, expect, beforeEach } from 'vitest';
import { GlobalFilter, type GlobalFilterConfig } from '../GlobalFilter';

describe('GlobalFilter', () => {
  let filter: GlobalFilter;
  let config: GlobalFilterConfig;

  beforeEach(() => {
    filter = new GlobalFilter();
    config = {
      enabled: true,
      mode: 'include',
    };
  });

  describe('isTask with disabled filter', () => {
    it('should treat all items as tasks when disabled', () => {
      config.enabled = false;
      
      expect(filter.isTask('- [ ] Task 1', 'any.md', config)).toBe(true);
      expect(filter.isTask('- [ ] Task 2 #not-task', 'any.md', config)).toBe(true);
    });
  });

  describe('isTask with include mode', () => {
    it('should only include items with matching tag', () => {
      config.mode = 'include';
      config.tagPattern = '#task';
      
      expect(filter.isTask('- [ ] Review PR #task', 'any.md', config)).toBe(true);
      expect(filter.isTask('- [ ] Buy milk', 'any.md', config)).toBe(false);
    });

    it('should only include items in matching path', () => {
      config.mode = 'include';
      config.pathPattern = 'tasks/';
      
      expect(filter.isTask('- [ ] Do something', 'tasks/work.md', config)).toBe(true);
      expect(filter.isTask('- [ ] Do something', 'shopping/list.md', config)).toBe(false);
    });

    it('should only include items matching regex', () => {
      config.mode = 'include';
      config.regex = '/\\[priority::/';
      
      expect(filter.isTask('- [ ] Task [priority:: high]', 'any.md', config)).toBe(true);
      expect(filter.isTask('- [ ] Task without priority', 'any.md', config)).toBe(false);
    });

    it('should require all patterns to match (AND logic)', () => {
      config.mode = 'include';
      config.tagPattern = '#task';
      config.pathPattern = 'work/';
      
      expect(filter.isTask('- [ ] Do work #task', 'work/project.md', config)).toBe(true);
      expect(filter.isTask('- [ ] Do work #task', 'personal/todo.md', config)).toBe(false);
      expect(filter.isTask('- [ ] Do work', 'work/project.md', config)).toBe(false);
    });

    it('should return false when no patterns are configured', () => {
      config.mode = 'include';
      // No patterns set
      
      expect(filter.isTask('- [ ] Any task', 'any.md', config)).toBe(false);
    });
  });

  describe('isTask with exclude mode', () => {
    it('should exclude items with matching tag', () => {
      config.mode = 'exclude';
      config.tagPattern = '#not-task';
      
      expect(filter.isTask('- [ ] Buy milk #not-task', 'any.md', config)).toBe(false);
      expect(filter.isTask('- [ ] Review PR', 'any.md', config)).toBe(true);
    });

    it('should exclude items in matching path', () => {
      config.mode = 'exclude';
      config.pathPattern = 'shopping/';
      
      expect(filter.isTask('- [ ] Buy milk', 'shopping/list.md', config)).toBe(false);
      expect(filter.isTask('- [ ] Review PR', 'work/tasks.md', config)).toBe(true);
    });

    it('should exclude items matching regex', () => {
      config.mode = 'exclude';
      config.regex = '/^- \\[ \\] Buy/';
      
      expect(filter.isTask('- [ ] Buy groceries', 'any.md', config)).toBe(false);
      expect(filter.isTask('- [ ] Complete project', 'any.md', config)).toBe(true);
    });

    it('should exclude when all patterns match (AND logic)', () => {
      config.mode = 'exclude';
      config.tagPattern = '#shopping';
      config.pathPattern = 'personal/';
      
      expect(filter.isTask('- [ ] Buy milk #shopping', 'personal/list.md', config)).toBe(false);
      expect(filter.isTask('- [ ] Buy milk #shopping', 'work/notes.md', config)).toBe(true);
      expect(filter.isTask('- [ ] Work task', 'personal/list.md', config)).toBe(true);
    });

    it('should include all when no patterns are configured', () => {
      config.mode = 'exclude';
      // No patterns set
      
      expect(filter.isTask('- [ ] Any task', 'any.md', config)).toBe(true);
    });
  });

  describe('regex pattern matching', () => {
    it('should handle regex with flags', () => {
      config.mode = 'include';
      config.regex = '/TASK/i'; // case insensitive
      
      expect(filter.isTask('- [ ] task in lowercase', 'any.md', config)).toBe(true);
      expect(filter.isTask('- [ ] TASK in uppercase', 'any.md', config)).toBe(true);
    });

    it('should handle regex without delimiters', () => {
      config.mode = 'include';
      config.regex = '\\[due::'; // without /.../ delimiters
      
      expect(filter.isTask('- [ ] Task [due:: 2025-01-18]', 'any.md', config)).toBe(true);
      expect(filter.isTask('- [ ] Task without due', 'any.md', config)).toBe(false);
    });

    it('should handle invalid regex gracefully', () => {
      config.mode = 'include';
      config.regex = '/[invalid(/'; // malformed regex
      
      // Should return false for invalid regex
      expect(filter.isTask('- [ ] Any task', 'any.md', config)).toBe(false);
    });
  });

  describe('path pattern matching', () => {
    it('should handle paths with backslashes', () => {
      config.mode = 'include';
      config.pathPattern = 'tasks/';
      
      expect(filter.isTask('- [ ] Task', 'tasks\\work.md', config)).toBe(true);
    });

    it('should handle partial path matches', () => {
      config.mode = 'include';
      config.pathPattern = 'daily/';
      
      expect(filter.isTask('- [ ] Task', 'work/daily/notes.md', config)).toBe(true);
    });
  });

  describe('tag pattern matching', () => {
    it('should match tags anywhere in line', () => {
      config.mode = 'include';
      config.tagPattern = '#work';
      
      expect(filter.isTask('- [ ] #work Review PR', 'any.md', config)).toBe(true);
      expect(filter.isTask('- [ ] Review PR #work', 'any.md', config)).toBe(true);
      expect(filter.isTask('- [ ] Review #work PR', 'any.md', config)).toBe(true);
    });

    it('should be case-sensitive', () => {
      config.mode = 'include';
      config.tagPattern = '#task';
      
      expect(filter.isTask('- [ ] Do something #task', 'any.md', config)).toBe(true);
      expect(filter.isTask('- [ ] Do something #TASK', 'any.md', config)).toBe(false);
    });
  });
});
