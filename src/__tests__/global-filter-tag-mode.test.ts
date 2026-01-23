import { describe, it, expect, beforeEach } from 'vitest';
import { GlobalFilter } from '@/core/filtering/GlobalFilter';
import type { GlobalFilterConfig } from '@/core/filtering/FilterRule';
import type { Task } from '@/core/models/Task';

describe('GlobalFilter - Tag-Based Mode', () => {
  let filter: GlobalFilter;

  beforeEach(() => {
    filter = GlobalFilter.getInstance();
    filter.reset(); // Reset to defaults before each test
  });

  describe('Tag-based filtering', () => {
    it('should include task with global filter tag when mode is tag', () => {
      const config: GlobalFilterConfig = {
        enabled: true,
        mode: 'tag',
        tag: '#task',
        removeFromDescription: false,
        activeProfileId: 'default',
        profiles: []
      };
      filter.updateConfig(config);

      const task: Partial<Task> = {
        name: 'Buy groceries #task',
        tags: ['#task', '#personal']
      };

      expect(filter.shouldIncludeTask(task as Task)).toBe(true);
    });

    it('should exclude task without global filter tag when mode is tag', () => {
      const config: GlobalFilterConfig = {
        enabled: true,
        mode: 'tag',
        tag: '#task',
        removeFromDescription: false,
        activeProfileId: 'default',
        profiles: []
      };
      filter.updateConfig(config);

      const task: Partial<Task> = {
        name: 'Buy groceries',
        tags: ['#personal']
      };

      expect(filter.shouldIncludeTask(task as Task)).toBe(false);
    });

    it('should be case-insensitive for tag matching', () => {
      const config: GlobalFilterConfig = {
        enabled: true,
        mode: 'tag',
        tag: '#Task',
        removeFromDescription: false,
        activeProfileId: 'default',
        profiles: []
      };
      filter.updateConfig(config);

      const task: Partial<Task> = {
        name: 'Buy groceries #task',
        tags: ['#task']
      };

      expect(filter.shouldIncludeTask(task as Task)).toBe(true);
    });

    it('should handle tag with or without # prefix', () => {
      const config: GlobalFilterConfig = {
        enabled: true,
        mode: 'tag',
        tag: 'task', // No # prefix
        removeFromDescription: false,
        activeProfileId: 'default',
        profiles: []
      };
      filter.updateConfig(config);

      const task: Partial<Task> = {
        name: 'Buy groceries #task',
        tags: ['#task']
      };

      expect(filter.shouldIncludeTask(task as Task)).toBe(true);
    });

    it('should work with shouldTreatAsTask for early filtering', () => {
      const config: GlobalFilterConfig = {
        enabled: true,
        mode: 'tag',
        tag: '#task',
        removeFromDescription: false,
        activeProfileId: 'default',
        profiles: []
      };
      filter.updateConfig(config);

      expect(filter.shouldTreatAsTask('- [ ] Buy groceries #task', '/notes/todo.md')).toBe(true);
      expect(filter.shouldTreatAsTask('- [ ] Buy groceries #personal', '/notes/todo.md')).toBe(false);
    });

    it('should include all tasks when filter is disabled', () => {
      const config: GlobalFilterConfig = {
        enabled: false,
        mode: 'tag',
        tag: '#task',
        removeFromDescription: false,
        activeProfileId: 'default',
        profiles: []
      };
      filter.updateConfig(config);

      const task: Partial<Task> = {
        name: 'Buy groceries',
        tags: ['#personal']
      };

      expect(filter.shouldIncludeTask(task as Task)).toBe(true);
    });
  });

  describe('removeTagFromDescription', () => {
    it('should remove global filter tag from description when enabled', () => {
      const config: GlobalFilterConfig = {
        enabled: true,
        mode: 'tag',
        tag: '#task',
        removeFromDescription: true,
        activeProfileId: 'default',
        profiles: []
      };
      filter.updateConfig(config);

      const description = 'Buy groceries #task for the week';
      const cleaned = filter.removeTagFromDescription(description);
      expect(cleaned).toBe('Buy groceries for the week');
    });

    it('should not remove tag when removeFromDescription is false', () => {
      const config: GlobalFilterConfig = {
        enabled: true,
        mode: 'tag',
        tag: '#task',
        removeFromDescription: false,
        activeProfileId: 'default',
        profiles: []
      };
      filter.updateConfig(config);

      const description = 'Buy groceries #task for the week';
      const cleaned = filter.removeTagFromDescription(description);
      expect(cleaned).toBe('Buy groceries #task for the week');
    });

    it('should not remove tag when filter is disabled', () => {
      const config: GlobalFilterConfig = {
        enabled: false,
        mode: 'tag',
        tag: '#task',
        removeFromDescription: true,
        activeProfileId: 'default',
        profiles: []
      };
      filter.updateConfig(config);

      const description = 'Buy groceries #task for the week';
      const cleaned = filter.removeTagFromDescription(description);
      expect(cleaned).toBe('Buy groceries #task for the week');
    });

    it('should not remove tag when mode is not tag', () => {
      const config: GlobalFilterConfig = {
        enabled: true,
        mode: 'all',
        tag: '#task',
        removeFromDescription: true,
        activeProfileId: 'default',
        profiles: []
      };
      filter.updateConfig(config);

      const description = 'Buy groceries #task for the week';
      const cleaned = filter.removeTagFromDescription(description);
      expect(cleaned).toBe('Buy groceries #task for the week');
    });

    it('should be case-insensitive when removing tag', () => {
      const config: GlobalFilterConfig = {
        enabled: true,
        mode: 'tag',
        tag: '#Task',
        removeFromDescription: true,
        activeProfileId: 'default',
        profiles: []
      };
      filter.updateConfig(config);

      const description = 'Buy groceries #task for the week';
      const cleaned = filter.removeTagFromDescription(description);
      expect(cleaned).toBe('Buy groceries for the week');
    });
  });
});
