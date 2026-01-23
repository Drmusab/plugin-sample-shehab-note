import { describe, it, expect, beforeEach } from 'vitest';
import { RRuleCache } from '@/core/engine/recurrence/RRuleCache';

describe('RRuleCache', () => {
  let cache: RRuleCache;

  beforeEach(() => {
    cache = new RRuleCache(10); // Small cache for testing
  });

  describe('constructor', () => {
    it('should create cache with default size', () => {
      const defaultCache = new RRuleCache();
      expect(defaultCache.size).toBe(0);
    });

    it('should create cache with custom size', () => {
      const customCache = new RRuleCache(50);
      const stats = customCache.getStats();
      expect(stats.maxSize).toBe(50);
    });

    it('should reject invalid size', () => {
      expect(() => new RRuleCache(0)).toThrow();
      expect(() => new RRuleCache(-1)).toThrow();
    });
  });

  describe('getOrParse()', () => {
    it('should parse and cache new RRULE', () => {
      const rrule = cache.getOrParse(
        'test-key',
        'RRULE:FREQ=DAILY;INTERVAL=1',
        new Date('2026-01-01')
      );

      expect(rrule).toBeDefined();
      expect(cache.size).toBe(1);
      expect(cache.has('test-key')).toBe(true);
    });

    it('should return cached RRULE on second call', () => {
      const rrule1 = cache.getOrParse(
        'test-key',
        'RRULE:FREQ=DAILY;INTERVAL=1',
        new Date('2026-01-01')
      );

      const rrule2 = cache.getOrParse(
        'test-key',
        'RRULE:FREQ=DAILY;INTERVAL=1',
        new Date('2026-01-01')
      );

      expect(rrule1).toBe(rrule2); // Same object reference
      expect(cache.size).toBe(1); // Still only one entry

      const stats = cache.getStats();
      expect(stats.totalHits).toBe(1);
      expect(stats.totalMisses).toBe(1);
    });

    it('should parse RRULE without prefix', () => {
      const rrule = cache.getOrParse(
        'test-key',
        'FREQ=DAILY;INTERVAL=1',
        new Date('2026-01-01')
      );

      expect(rrule).toBeDefined();
    });

    it('should apply timezone if provided', () => {
      const rrule = cache.getOrParse(
        'test-key',
        'FREQ=DAILY;INTERVAL=1',
        new Date('2026-01-01'),
        'America/New_York'
      );

      expect(rrule).toBeDefined();
      expect(rrule.origOptions.tzid).toBe('America/New_York');
    });

    it('should throw on invalid RRULE', () => {
      expect(() => {
        cache.getOrParse(
          'test-key',
          'INVALID',
          new Date('2026-01-01')
        );
      }).toThrow();
    });
  });

  describe('LRU eviction', () => {
    it('should evict oldest entry when cache is full', () => {
      // Fill cache to max size
      for (let i = 0; i < 10; i++) {
        cache.getOrParse(
          `key-${i}`,
          'FREQ=DAILY;INTERVAL=1',
          new Date('2026-01-01')
        );
      }

      expect(cache.size).toBe(10);
      expect(cache.has('key-0')).toBe(true);

      // Add one more - should evict key-0 (oldest)
      cache.getOrParse(
        'key-10',
        'FREQ=DAILY;INTERVAL=1',
        new Date('2026-01-01')
      );

      expect(cache.size).toBe(10);
      expect(cache.has('key-0')).toBe(false); // Evicted
      expect(cache.has('key-10')).toBe(true); // New entry
    });

    it('should update access time on cache hit', () => {
      // Add two entries
      cache.getOrParse('key-1', 'FREQ=DAILY;INTERVAL=1', new Date('2026-01-01'));
      cache.getOrParse('key-2', 'FREQ=DAILY;INTERVAL=1', new Date('2026-01-01'));

      // Access key-1 to make it more recent
      cache.getOrParse('key-1', 'FREQ=DAILY;INTERVAL=1', new Date('2026-01-01'));

      // Fill cache (need to add 9 more to exceed maxSize of 10)
      for (let i = 3; i <= 11; i++) {
        cache.getOrParse(`key-${i}`, 'FREQ=DAILY;INTERVAL=1', new Date('2026-01-01'));
      }

      // key-2 should be evicted (oldest), key-1 should remain (accessed more recently)
      expect(cache.has('key-1')).toBe(true);
      expect(cache.has('key-2')).toBe(false);
    });
  });

  describe('invalidate()', () => {
    it('should remove specific cache entry', () => {
      cache.getOrParse('key-1', 'FREQ=DAILY;INTERVAL=1', new Date('2026-01-01'));
      cache.getOrParse('key-2', 'FREQ=DAILY;INTERVAL=1', new Date('2026-01-01'));

      expect(cache.size).toBe(2);

      const removed = cache.invalidate('key-1');
      expect(removed).toBe(true);
      expect(cache.size).toBe(1);
      expect(cache.has('key-1')).toBe(false);
      expect(cache.has('key-2')).toBe(true);
    });

    it('should return false if key does not exist', () => {
      const removed = cache.invalidate('nonexistent');
      expect(removed).toBe(false);
    });
  });

  describe('invalidateTask()', () => {
    it('should remove all entries for a task', () => {
      cache.getOrParse('task-1:rule-1', 'FREQ=DAILY;INTERVAL=1', new Date('2026-01-01'));
      cache.getOrParse('task-1:rule-2', 'FREQ=WEEKLY;BYDAY=MO', new Date('2026-01-01'));
      cache.getOrParse('task-2:rule-1', 'FREQ=DAILY;INTERVAL=1', new Date('2026-01-01'));

      expect(cache.size).toBe(3);

      const removed = cache.invalidateTask('task-1');
      expect(removed).toBe(2);
      expect(cache.size).toBe(1);
      expect(cache.has('task-1:rule-1')).toBe(false);
      expect(cache.has('task-1:rule-2')).toBe(false);
      expect(cache.has('task-2:rule-1')).toBe(true);
    });

    it('should return 0 if no entries match', () => {
      cache.getOrParse('task-1:rule-1', 'FREQ=DAILY;INTERVAL=1', new Date('2026-01-01'));
      
      const removed = cache.invalidateTask('task-2');
      expect(removed).toBe(0);
      expect(cache.size).toBe(1);
    });
  });

  describe('clear()', () => {
    it('should remove all cache entries', () => {
      cache.getOrParse('key-1', 'FREQ=DAILY;INTERVAL=1', new Date('2026-01-01'));
      cache.getOrParse('key-2', 'FREQ=WEEKLY;BYDAY=MO', new Date('2026-01-01'));

      expect(cache.size).toBe(2);

      cache.clear();

      expect(cache.size).toBe(0);
      const stats = cache.getStats();
      expect(stats.totalHits).toBe(0);
      expect(stats.totalMisses).toBe(0);
    });
  });

  describe('getStats()', () => {
    it('should return accurate statistics', () => {
      const stats1 = cache.getStats();
      expect(stats1.size).toBe(0);
      expect(stats1.hitRate).toBe(0);

      // Add entry (miss)
      cache.getOrParse('key-1', 'FREQ=DAILY;INTERVAL=1', new Date('2026-01-01'));

      const stats2 = cache.getStats();
      expect(stats2.size).toBe(1);
      expect(stats2.totalMisses).toBe(1);
      expect(stats2.totalHits).toBe(0);

      // Access entry (hit)
      cache.getOrParse('key-1', 'FREQ=DAILY;INTERVAL=1', new Date('2026-01-01'));

      const stats3 = cache.getStats();
      expect(stats3.totalHits).toBe(1);
      expect(stats3.hitRate).toBe(0.5); // 1 hit / 2 total requests
    });
  });

  describe('getEntry()', () => {
    it('should return cache entry with metadata', () => {
      cache.getOrParse('key-1', 'FREQ=DAILY;INTERVAL=1', new Date('2026-01-01'));

      const entry = cache.getEntry('key-1');
      expect(entry).toBeDefined();
      expect(entry!.key).toBe('key-1');
      expect(entry!.hits).toBe(0);
      expect(entry!.rrule).toBeDefined();
      expect(entry!.createdAt).toBeGreaterThan(0);
      expect(entry!.lastAccess).toBeGreaterThan(0);
    });

    it('should update hit count on access', () => {
      cache.getOrParse('key-1', 'FREQ=DAILY;INTERVAL=1', new Date('2026-01-01'));
      
      const entry1 = cache.getEntry('key-1');
      expect(entry1!.hits).toBe(0);

      cache.getOrParse('key-1', 'FREQ=DAILY;INTERVAL=1', new Date('2026-01-01'));
      
      const entry2 = cache.getEntry('key-1');
      expect(entry2!.hits).toBe(1);

      cache.getOrParse('key-1', 'FREQ=DAILY;INTERVAL=1', new Date('2026-01-01'));
      
      const entry3 = cache.getEntry('key-1');
      expect(entry3!.hits).toBe(2);
    });

    it('should return undefined for missing entry', () => {
      const entry = cache.getEntry('nonexistent');
      expect(entry).toBeUndefined();
    });
  });

  describe('keys()', () => {
    it('should return all cache keys', () => {
      cache.getOrParse('key-1', 'FREQ=DAILY;INTERVAL=1', new Date('2026-01-01'));
      cache.getOrParse('key-2', 'FREQ=WEEKLY;BYDAY=MO', new Date('2026-01-01'));

      const keys = cache.keys();
      expect(keys).toHaveLength(2);
      expect(keys).toContain('key-1');
      expect(keys).toContain('key-2');
    });

    it('should return empty array for empty cache', () => {
      const keys = cache.keys();
      expect(keys).toHaveLength(0);
    });
  });

  describe('pruneOld()', () => {
    it('should remove entries older than max age', async () => {
      // Add entry
      cache.getOrParse('key-1', 'FREQ=DAILY;INTERVAL=1', new Date('2026-01-01'));

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 50));

      // Add another entry
      cache.getOrParse('key-2', 'FREQ=DAILY;INTERVAL=1', new Date('2026-01-01'));

      // Prune entries older than 25ms (should remove key-1)
      const pruned = cache.pruneOld(25);

      expect(pruned).toBe(1);
      expect(cache.has('key-1')).toBe(false);
      expect(cache.has('key-2')).toBe(true);
    });

    it('should not prune recent entries', () => {
      cache.getOrParse('key-1', 'FREQ=DAILY;INTERVAL=1', new Date('2026-01-01'));

      const pruned = cache.pruneOld(10000); // 10 seconds
      expect(pruned).toBe(0);
      expect(cache.size).toBe(1);
    });

    it('should return 0 if no entries to prune', () => {
      const pruned = cache.pruneOld(1000);
      expect(pruned).toBe(0);
    });
  });

  describe('has()', () => {
    it('should return true for existing key', () => {
      cache.getOrParse('key-1', 'FREQ=DAILY;INTERVAL=1', new Date('2026-01-01'));
      expect(cache.has('key-1')).toBe(true);
    });

    it('should return false for missing key', () => {
      expect(cache.has('nonexistent')).toBe(false);
    });
  });
});
