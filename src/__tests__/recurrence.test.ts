import { describe, expect, it } from "vitest";
import { RecurrenceEngineRRULE as RecurrenceEngine } from "../core/engine/recurrence/RecurrenceEngineRRULE";

describe("RecurrenceEngine", () => {
  it("calculates next daily occurrence", () => {
    const engine = new RecurrenceEngine();
    const current = new Date("2025-01-01T09:00:00Z");
    const next = engine.calculateNext(current, {
      type: "daily",
      interval: 1,
      time: "09:00",
    });

    expect(next.toISOString()).toBe("2025-01-02T09:00:00.000Z");
  });

  it("calculates next weekly occurrence on specified weekday", () => {
    const engine = new RecurrenceEngine();
    const current = new Date("2025-01-06T09:00:00Z"); // Monday
    const next = engine.calculateNext(current, {
      type: "weekly",
      interval: 1,
      weekdays: [3],
      time: "09:00",
    });

    expect(next.toISOString()).toBe("2025-01-09T09:00:00.000Z");
  });

  it("clamps monthly occurrence to last day of month", () => {
    const engine = new RecurrenceEngine();
    const current = new Date("2025-01-31T09:00:00Z");
    const next = engine.calculateNext(current, {
      type: "monthly",
      interval: 1,
      dayOfMonth: 31,
      time: "09:00",
    });

    expect(next.toISOString()).toBe("2025-02-28T09:00:00.000Z");
  });
});
