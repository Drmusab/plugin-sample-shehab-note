import type { QueryResult } from "@/core/query/QueryEngine";

export interface InlineQueryCacheEntry {
  result: QueryResult;
  updatedAt: number;
}

export class InlineQueryCache {
  private cache = new Map<string, InlineQueryCacheEntry>();

  constructor(private ttlMs: number = 60_000) {}

  buildKey(query: string, settingsHash: string): string {
    return `${query}::${settingsHash}`;
  }

  get(key: string): InlineQueryCacheEntry | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }
    if (this.ttlMs > 0 && Date.now() - entry.updatedAt > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }
    return entry;
  }

  set(key: string, result: QueryResult): void {
    this.cache.set(key, { result, updatedAt: Date.now() });
  }

  clear(): void {
    this.cache.clear();
  }
}
