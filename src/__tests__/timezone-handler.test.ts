import { describe, expect, it } from "vitest";
import { TimezoneHandler } from "../core/engine/TimezoneHandler";

describe("TimezoneHandler", () => {
  const handler = new TimezoneHandler();

  describe("getTimezone", () => {
    it("returns a timezone string", () => {
      const tz = handler.getTimezone();
      expect(typeof tz).toBe("string");
      expect(tz.length).toBeGreaterThan(0);
    });
  });

  describe("isSameLocalDay", () => {
    it("returns true for dates on the same day", () => {
      const date1 = new Date("2024-01-15T10:00:00");
      const date2 = new Date("2024-01-15T15:00:00");
      expect(handler.isSameLocalDay(date1, date2)).toBe(true);
    });

    it("returns false for dates on different days", () => {
      const date1 = new Date("2024-01-15T23:00:00");
      const date2 = new Date("2024-01-16T01:00:00");
      expect(handler.isSameLocalDay(date1, date2)).toBe(false);
    });
  });

  describe("isToday", () => {
    it("returns true for current date", () => {
      const now = new Date();
      expect(handler.isToday(now)).toBe(true);
    });

    it("returns false for yesterday", () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      expect(handler.isToday(yesterday)).toBe(false);
    });
  });

  describe("isPast", () => {
    it("returns true for past dates", () => {
      const past = new Date("2020-01-01");
      expect(handler.isPast(past)).toBe(true);
    });

    it("returns false for future dates", () => {
      const future = new Date();
      future.setFullYear(future.getFullYear() + 1);
      expect(handler.isPast(future)).toBe(false);
    });
  });

  describe("addDays", () => {
    it("adds days correctly", () => {
      const date = new Date("2024-01-15");
      const result = handler.addDays(date, 5);
      expect(result.getDate()).toBe(20);
    });

    it("handles month transitions", () => {
      const date = new Date("2024-01-30");
      const result = handler.addDays(date, 5);
      expect(result.getMonth()).toBe(1); // February
      expect(result.getDate()).toBe(4);
    });
  });

  describe("getRelativeTime", () => {
    it("returns 'now' for dates within a minute", () => {
      const now = new Date();
      expect(handler.getRelativeTime(now)).toBe("now");
    });

    it("returns minutes for recent times", () => {
      const future = new Date();
      future.setMinutes(future.getMinutes() + 30);
      const result = handler.getRelativeTime(future);
      expect(result).toContain("30m");
    });

    it("returns hours for times within a day", () => {
      const future = new Date();
      future.setHours(future.getHours() + 5);
      const result = handler.getRelativeTime(future);
      expect(result).toContain("5h");
    });

    it("returns days for times beyond a day", () => {
      const future = new Date();
      future.setDate(future.getDate() + 3);
      const result = handler.getRelativeTime(future);
      expect(result).toContain("3d");
    });
  });

  describe("startOfLocalDay", () => {
    it("returns start of day", () => {
      const date = new Date("2024-01-15T15:30:45");
      const result = handler.startOfLocalDay(date);
      expect(result.getHours()).toBe(0);
      expect(result.getMinutes()).toBe(0);
      expect(result.getSeconds()).toBe(0);
      expect(result.getMilliseconds()).toBe(0);
    });
  });

  describe("endOfLocalDay", () => {
    it("returns end of day", () => {
      const date = new Date("2024-01-15T10:30:45");
      const result = handler.endOfLocalDay(date);
      expect(result.getHours()).toBe(23);
      expect(result.getMinutes()).toBe(59);
      expect(result.getSeconds()).toBe(59);
    });
  });

  describe("tomorrow", () => {
    it("returns tomorrow's date", () => {
      const today = new Date();
      const tomorrow = handler.tomorrow();
      const diff = tomorrow.getTime() - today.getTime();
      const daysDiff = diff / (1000 * 60 * 60 * 24);
      expect(daysDiff).toBeGreaterThanOrEqual(0.9);
      expect(daysDiff).toBeLessThanOrEqual(1.1);
    });
  });

  describe("nextWeek", () => {
    it("returns date one week from now", () => {
      const today = new Date();
      const nextWeek = handler.nextWeek();
      const diff = nextWeek.getTime() - today.getTime();
      const daysDiff = diff / (1000 * 60 * 60 * 24);
      expect(daysDiff).toBeGreaterThanOrEqual(6.9);
      expect(daysDiff).toBeLessThanOrEqual(7.1);
    });
  });
});
