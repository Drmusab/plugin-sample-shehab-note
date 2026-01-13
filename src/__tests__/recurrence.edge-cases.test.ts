import { describe, it, expect } from "vitest";
import { RecurrenceEngine } from "@/core/engine/RecurrenceEngine";
import type { Frequency } from "@/core/models/Frequency";
import { MAX_RECOVERY_ITERATIONS } from "@/utils/constants";

describe("RecurrenceEngine - Edge Cases", () => {
  const engine = new RecurrenceEngine();
  const findDstTransitions = (year: number) => {
    const transitions: Array<{ date: Date; offsetChange: number }> = [];
    let previousOffset = new Date(year, 0, 1, 12, 0, 0).getTimezoneOffset();

    for (let month = 0; month < 12; month++) {
      for (let day = 1; day <= 31; day++) {
        const current = new Date(year, month, day, 12, 0, 0);
        if (current.getMonth() !== month) {
          break;
        }
        const currentOffset = current.getTimezoneOffset();
        if (currentOffset !== previousOffset) {
          transitions.push({
            date: new Date(current.getFullYear(), current.getMonth(), current.getDate()),
            offsetChange: currentOffset - previousOffset,
          });
          previousOffset = currentOffset;
        }
      }
    }

    return transitions;
  };

  describe("getMissedOccurrences", () => {
    it("should return all missed occurrences between two dates", () => {
      const lastCheckedAt = new Date("2024-01-01T09:00:00Z");
      const now = new Date("2024-01-05T09:00:00Z");
      const firstOccurrence = new Date("2023-12-31T09:00:00Z");
      const frequency: Frequency = {
        type: "daily",
        interval: 1,
        time: "09:00",
      };

      const missed = engine.getMissedOccurrences(
        lastCheckedAt,
        now,
        frequency,
        firstOccurrence
      );

      // Should return 3 missed days: Jan 2, 3, 4 (not including Jan 1 as it's <= lastCheckedAt, and Jan 5 as it's not < now)
      expect(missed.length).toBe(3);
      expect(missed[0].toISOString()).toContain("2024-01-02T09:00:00");
      expect(missed[2].toISOString()).toContain("2024-01-04T09:00:00");
    });

    it("should return empty array if no occurrences were missed", () => {
      const lastCheckedAt = new Date("2024-01-10T09:00:00Z");
      const now = new Date("2024-01-10T10:00:00Z");
      const firstOccurrence = new Date("2024-01-01T09:00:00Z");
      const frequency: Frequency = {
        type: "daily",
        interval: 1,
        time: "09:00",
      };

      const missed = engine.getMissedOccurrences(
        lastCheckedAt,
        now,
        frequency,
        firstOccurrence
      );

      expect(missed.length).toBe(0);
    });

    it("should handle weekly frequency with missed occurrences", () => {
      const lastCheckedAt = new Date("2024-01-01T09:00:00Z"); // Monday
      const now = new Date("2024-01-22T09:00:00Z"); // Monday 3 weeks later
      const firstOccurrence = new Date("2023-12-25T09:00:00Z"); // Monday
      const frequency: Frequency = {
        type: "weekly",
        interval: 1,
        time: "09:00",
        weekdays: [0], // Monday (in SiYuan, 0 = Monday)
      };

      const missed = engine.getMissedOccurrences(
        lastCheckedAt,
        now,
        frequency,
        firstOccurrence
      );

      // Should return 2 missed Mondays: Jan 8, 15 (not including Jan 22 as it's not < now)
      expect(missed.length).toBe(2);
    });

    it("should handle monthly frequency with missed occurrences", () => {
      const lastCheckedAt = new Date("2024-01-15T09:00:00Z");
      const now = new Date("2024-06-15T09:00:00Z");
      const firstOccurrence = new Date("2023-12-15T09:00:00Z");
      const frequency: Frequency = {
        type: "monthly",
        interval: 1,
        time: "09:00",
        dayOfMonth: 15,
      };

      const missed = engine.getMissedOccurrences(
        lastCheckedAt,
        now,
        frequency,
        firstOccurrence
      );

      // Should return 4 missed months: Feb, Mar, Apr, May (not including Jun as it's not < now)
      expect(missed.length).toBe(4);
    });

    it("should respect safety limit to prevent infinite loops", () => {
      const lastCheckedAt = new Date("2020-01-01T09:00:00Z");
      const now = new Date("2025-01-01T09:00:00Z"); // 5 years later
      const firstOccurrence = new Date("2020-01-01T09:00:00Z");
      const frequency: Frequency = {
        type: "daily",
        interval: 1,
        time: "09:00",
      };

      const missed = engine.getMissedOccurrences(
        lastCheckedAt,
        now,
        frequency,
        firstOccurrence
      );

      // Should hit safety limit of MAX_RECOVERY_ITERATIONS
      expect(missed.length).toBeLessThanOrEqual(MAX_RECOVERY_ITERATIONS);
    });

    it("should cap missed daily occurrences for multi-year downtime", () => {
      const lastCheckedAt = new Date("2018-01-01T09:00:00Z");
      const now = new Date("2024-01-01T09:00:00Z");
      const firstOccurrence = new Date("2018-01-01T09:00:00Z");
      const frequency: Frequency = {
        type: "daily",
        interval: 1,
        time: "09:00",
      };

      const missed = engine.getMissedOccurrences(
        lastCheckedAt,
        now,
        frequency,
        firstOccurrence
      );

      expect(missed.length).toBeLessThanOrEqual(MAX_RECOVERY_ITERATIONS);
    });

    it("should cover weekly downtime without skipping occurrences", () => {
      const lastCheckedAt = new Date("2024-02-01T09:00:00Z");
      const now = new Date("2024-03-01T09:00:00Z");
      const firstOccurrence = new Date("2024-01-04T09:00:00Z");
      const frequency: Frequency = {
        type: "weekly",
        interval: 1,
        time: "09:00",
      };

      const missed = engine.getMissedOccurrences(
        lastCheckedAt,
        now,
        frequency,
        firstOccurrence
      );

      expect(missed.length).toBeGreaterThan(2);
      expect(missed.length).toBeLessThan(6);
    });

    it("should cover monthly downtime across year boundaries", () => {
      const lastCheckedAt = new Date("2023-11-15T09:00:00Z");
      const now = new Date("2024-03-15T09:00:00Z");
      const firstOccurrence = new Date("2023-10-15T09:00:00Z");
      const frequency: Frequency = {
        type: "monthly",
        interval: 1,
        time: "09:00",
        dayOfMonth: 15,
      };

      const missed = engine.getMissedOccurrences(
        lastCheckedAt,
        now,
        frequency,
        firstOccurrence
      );

      expect(missed.length).toBe(3);
      expect(missed[0].toISOString()).toContain("2023-12-15T09:00:00");
    });
  });

  describe("Monthly recurrence - Month-end handling", () => {
    it("should handle month-end dates correctly (Jan 31 -> Feb 28)", () => {
      const currentDue = new Date("2024-01-31T09:00:00Z");
      const frequency: Frequency = {
        type: "monthly",
        interval: 1,
        time: "09:00",
        dayOfMonth: 31,
      };

      const next = engine.calculateNext(currentDue, frequency);

      // Feb 2024 has 29 days (leap year), should clamp to Feb 29
      expect(next.getDate()).toBe(29);
      expect(next.getMonth()).toBe(1); // February
    });

    it("should handle month-end dates correctly (Jan 31 -> Feb 28 non-leap year)", () => {
      const currentDue = new Date("2023-01-31T09:00:00Z");
      const frequency: Frequency = {
        type: "monthly",
        interval: 1,
        time: "09:00",
        dayOfMonth: 31,
      };

      const next = engine.calculateNext(currentDue, frequency);

      // Feb 2023 has 28 days (non-leap year), should clamp to Feb 28
      expect(next.getDate()).toBe(28);
      expect(next.getMonth()).toBe(1); // February
    });

    it("should handle month transitions with varying days", () => {
      const currentDue = new Date("2024-01-31T09:00:00Z");
      const frequency: Frequency = {
        type: "monthly",
        interval: 1,
        time: "09:00",
        dayOfMonth: 31,
      };

      // Jan 31 -> Feb 29
      let next = engine.calculateNext(currentDue, frequency);
      expect(next.getDate()).toBe(29);
      expect(next.getMonth()).toBe(1);

      // Feb 29 -> Mar 31
      next = engine.calculateNext(next, frequency);
      expect(next.getDate()).toBe(31);
      expect(next.getMonth()).toBe(2);

      // Mar 31 -> Apr 30
      next = engine.calculateNext(next, frequency);
      expect(next.getDate()).toBe(30);
      expect(next.getMonth()).toBe(3);
    });

    it("should resume original day-of-month after February clipping", () => {
      const currentDue = new Date("2023-01-31T09:00:00Z");
      const frequency: Frequency = {
        type: "monthly",
        interval: 1,
        time: "09:00",
        dayOfMonth: 31,
      };

      const feb = engine.calculateNext(currentDue, frequency);
      expect(feb.toISOString()).toBe("2023-02-28T09:00:00.000Z");

      const mar = engine.calculateNext(feb, frequency);
      expect(mar.toISOString()).toBe("2023-03-31T09:00:00.000Z");
    });

    it("should roll over year boundaries correctly", () => {
      const currentDue = new Date("2023-12-31T09:00:00Z");
      const frequency: Frequency = {
        type: "monthly",
        interval: 1,
        time: "09:00",
        dayOfMonth: 31,
      };

      const next = engine.calculateNext(currentDue, frequency);
      expect(next.toISOString()).toBe("2024-01-31T09:00:00.000Z");
    });
  });

  describe("Weekly recurrence - Edge cases", () => {
    it("should handle multiple weekdays correctly", () => {
      const currentDue = new Date("2024-01-01T09:00:00Z"); // Monday
      const frequency: Frequency = {
        type: "weekly",
        interval: 1,
        time: "09:00",
        weekdays: [0, 2, 4], // Mon, Wed, Fri
      };

      // Mon -> Wed
      let next = engine.calculateNext(currentDue, frequency);
      expect(next.getDay()).toBe(3); // Wednesday

      // Wed -> Fri
      next = engine.calculateNext(next, frequency);
      expect(next.getDay()).toBe(5); // Friday

      // Fri -> Mon (next week)
      next = engine.calculateNext(next, frequency);
      expect(next.getDay()).toBe(1); // Monday
    });

    it("should handle empty weekdays array", () => {
      const currentDue = new Date("2024-01-01T09:00:00Z");
      const frequency: Frequency = {
        type: "weekly",
        interval: 2,
        time: "09:00",
        weekdays: [],
      };

      const next = engine.calculateNext(currentDue, frequency);

      // Should add 2 weeks
      const expected = new Date(currentDue);
      expected.setDate(expected.getDate() + 14);
      expect(next.getDate()).toBe(expected.getDate());
    });
  });

  describe("Fixed time handling", () => {
    it("should apply fixed time to daily recurrence", () => {
      const currentDue = new Date("2024-01-01T14:30:00Z");
      const frequency: Frequency = {
        type: "daily",
        interval: 1,
        time: "09:00",
      };

      const next = engine.calculateNext(currentDue, frequency);

      expect(next.getHours()).toBe(9);
      expect(next.getMinutes()).toBe(0);
    });

    it("should apply fixed time to monthly recurrence", () => {
      const currentDue = new Date("2024-01-15T14:30:00Z");
      const frequency: Frequency = {
        type: "monthly",
        interval: 1,
        time: "09:00",
        dayOfMonth: 15,
      };

      const next = engine.calculateNext(currentDue, frequency);

      expect(next.getHours()).toBe(9);
      expect(next.getMinutes()).toBe(0);
      expect(next.getDate()).toBe(15);
    });
  });

  describe("DST handling", () => {
    it("shifts forward when requested time is skipped by DST", () => {
      const transitions = findDstTransitions(2024);
      const springForward = transitions.find((transition) => transition.offsetChange < 0);
      if (!springForward) {
        return;
      }

      const currentDue = new Date(springForward.date);
      currentDue.setDate(currentDue.getDate() - 1);
      currentDue.setHours(9, 0, 0, 0);

      const next = engine.calculateNext(currentDue, {
        type: "daily",
        interval: 1,
        time: "02:30",
      });

      expect(next.getDate()).toBe(springForward.date.getDate());
      expect(next.getHours() === 2 && next.getMinutes() === 30).toBe(false);
    });

    it("preserves time when DST falls back", () => {
      const transitions = findDstTransitions(2024);
      const fallBack = transitions.find((transition) => transition.offsetChange > 0);
      if (!fallBack) {
        return;
      }

      const currentDue = new Date(fallBack.date);
      currentDue.setDate(currentDue.getDate() - 1);
      currentDue.setHours(9, 0, 0, 0);

      const next = engine.calculateNext(currentDue, {
        type: "daily",
        interval: 1,
        time: "01:30",
      });

      expect(next.getHours()).toBe(1);
      expect(next.getMinutes()).toBe(30);
    });
  });
});
