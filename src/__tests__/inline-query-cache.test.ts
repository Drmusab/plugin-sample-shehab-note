import { describe, expect, it, beforeEach } from "vitest";
import { InlineQueryCache } from "@/core/inline-query/InlineQueryCache";
import type { QueryResult } from "@/core/query/QueryEngine";

describe("InlineQueryCache", () => {
  let cache: InlineQueryCache;
  
  const mockResult: QueryResult = {
    tasks: [],
    groups: new Map(),
    totalCount: 0,
  };

  beforeEach(() => {
    cache = new InlineQueryCache(60000, 3); // 60s TTL, max size 3
  });

  describe("LRU eviction", () => {
    it("should evict least recently used entry when cache is full", () => {
      cache.set("key1", mockResult);
      cache.set("key2", mockResult);
      cache.set("key3", mockResult);
      
      // Access key1 to make it recently used
      cache.get("key1");
      
      // Add key4, should evict key2 (least recently used)
      cache.set("key4", mockResult);
      
      expect(cache.get("key1")).not.toBeNull();
      expect(cache.get("key2")).toBeNull(); // evicted
      expect(cache.get("key3")).not.toBeNull();
      expect(cache.get("key4")).not.toBeNull();
    });

    it("should not exceed max size", () => {
      cache.set("key1", mockResult);
      cache.set("key2", mockResult);
      cache.set("key3", mockResult);
      cache.set("key4", mockResult);
      cache.set("key5", mockResult);
      
      const metrics = cache.getMetrics();
      expect(metrics.size).toBe(3);
      expect(metrics.evictions).toBe(2);
    });
  });

  describe("metrics tracking", () => {
    it("should track cache hits and misses", () => {
      cache.set("key1", mockResult);
      
      cache.get("key1"); // hit
      cache.get("key2"); // miss
      cache.get("key1"); // hit
      cache.get("key3"); // miss
      
      const metrics = cache.getMetrics();
      expect(metrics.hits).toBe(2);
      expect(metrics.misses).toBe(2);
    });

    it("should track evictions", () => {
      cache.set("key1", mockResult);
      cache.set("key2", mockResult);
      cache.set("key3", mockResult);
      cache.set("key4", mockResult); // triggers eviction
      
      const metrics = cache.getMetrics();
      expect(metrics.evictions).toBe(1);
    });

    it("should reset metrics", () => {
      cache.set("key1", mockResult);
      cache.get("key1");
      cache.get("key2");
      
      cache.resetMetrics();
      
      const metrics = cache.getMetrics();
      expect(metrics.hits).toBe(0);
      expect(metrics.misses).toBe(0);
      expect(metrics.evictions).toBe(0);
    });
  });

  describe("TTL expiration", () => {
    it("should expire entries after TTL", () => {
      const shortTTLCache = new InlineQueryCache(100); // 100ms TTL
      shortTTLCache.set("key1", mockResult);
      
      expect(shortTTLCache.get("key1")).not.toBeNull();
      
      // Wait for expiration
      return new Promise((resolve) => {
        setTimeout(() => {
          expect(shortTTLCache.get("key1")).toBeNull();
          resolve(undefined);
        }, 150);
      });
    });

    it("should update lastAccessedAt on get", () => {
      cache.set("key1", mockResult);
      
      // Get the entry
      const entry1 = cache.get("key1");
      expect(entry1).not.toBeNull();
      const firstAccessTime = entry1!.lastAccessedAt;
      
      // Wait a bit
      return new Promise((resolve) => {
        setTimeout(() => {
          const entry2 = cache.get("key1");
          expect(entry2).not.toBeNull();
          expect(entry2!.lastAccessedAt).toBeGreaterThan(firstAccessTime);
          resolve(undefined);
        }, 10);
      });
    });
  });

  describe("buildKey", () => {
    it("should generate consistent cache keys", () => {
      const key1 = cache.buildKey("query1", "hash1");
      const key2 = cache.buildKey("query1", "hash1");
      const key3 = cache.buildKey("query2", "hash1");
      
      expect(key1).toBe(key2);
      expect(key1).not.toBe(key3);
    });
  });

  describe("clear", () => {
    it("should clear all entries", () => {
      cache.set("key1", mockResult);
      cache.set("key2", mockResult);
      
      cache.clear();
      
      expect(cache.get("key1")).toBeNull();
      expect(cache.get("key2")).toBeNull();
      expect(cache.getMetrics().size).toBe(0);
    });
  });
});
