import { describe, it, expect } from 'vitest';
import { placeholderResolver, type QueryContext } from '@/utils/PlaceholderResolver';

describe('PlaceholderResolver', () => {
  describe('resolve', () => {
    it('should resolve file.path placeholder', () => {
      const context: QueryContext = {
        filePath: 'projects/work/meeting-notes.md'
      };
      const query = 'path includes {{query.file.path}}';
      const resolved = placeholderResolver.resolve(query, context);
      expect(resolved).toBe('path includes projects/work/meeting-notes.md');
    });

    it('should resolve file.folder placeholder', () => {
      const context: QueryContext = {
        filePath: 'projects/work/meeting-notes.md'
      };
      const query = 'path includes {{query.file.folder}}';
      const resolved = placeholderResolver.resolve(query, context);
      expect(resolved).toBe('path includes projects/work');
    });

    it('should resolve file.name placeholder', () => {
      const context: QueryContext = {
        filePath: 'projects/work/meeting-notes.md'
      };
      const query = 'path includes {{query.file.name}}';
      const resolved = placeholderResolver.resolve(query, context);
      expect(resolved).toBe('path includes meeting-notes.md');
    });

    it('should resolve file.root placeholder', () => {
      const context: QueryContext = {
        filePath: 'projects/work/meeting-notes.md'
      };
      const query = 'path includes {{query.file.root}}';
      const resolved = placeholderResolver.resolve(query, context);
      expect(resolved).toBe('path includes projects');
    });

    it('should resolve multiple placeholders', () => {
      const context: QueryContext = {
        filePath: 'daily/2024/01/notes.md'
      };
      const query = 'path includes {{query.file.folder}} AND path includes {{query.file.name}}';
      const resolved = placeholderResolver.resolve(query, context);
      expect(resolved).toBe('path includes daily/2024/01 AND path includes notes.md');
    });

    it('should handle empty context gracefully', () => {
      const context: QueryContext = {};
      const query = 'path includes {{query.file.path}}';
      const resolved = placeholderResolver.resolve(query, context);
      expect(resolved).toBe('path includes ');
    });

    it('should not modify query without placeholders', () => {
      const context: QueryContext = {
        filePath: 'test/file.md'
      };
      const query = 'status is todo';
      const resolved = placeholderResolver.resolve(query, context);
      expect(resolved).toBe('status is todo');
    });
  });

  describe('hasPlaceholders', () => {
    it('should detect placeholders in query', () => {
      expect(placeholderResolver.hasPlaceholders('{{query.file.path}}')).toBe(true);
      expect(placeholderResolver.hasPlaceholders('path includes {{query.file.folder}}')).toBe(true);
    });

    it('should return false for query without placeholders', () => {
      expect(placeholderResolver.hasPlaceholders('status is todo')).toBe(false);
      expect(placeholderResolver.hasPlaceholders('due before today')).toBe(false);
    });
  });

  describe('extractPlaceholders', () => {
    it('should extract all placeholders', () => {
      const query = 'path includes {{query.file.folder}} AND {{query.file.name}}';
      const placeholders = placeholderResolver.extractPlaceholders(query);
      expect(placeholders).toEqual(['{{query.file.folder}}', '{{query.file.name}}']);
    });

    it('should return empty array for query without placeholders', () => {
      const query = 'status is todo';
      const placeholders = placeholderResolver.extractPlaceholders(query);
      expect(placeholders).toEqual([]);
    });

    it('should deduplicate identical placeholders', () => {
      const query = '{{query.file.path}} OR {{query.file.path}}';
      const placeholders = placeholderResolver.extractPlaceholders(query);
      expect(placeholders).toEqual(['{{query.file.path}}']);
    });
  });
});
