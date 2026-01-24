import { describe, expect, it, vi } from "vitest";
import { createTask } from "@/core/models/Task";
import { evaluateEscalation } from "@/core/escalation/EscalationEvaluator";
import { DEFAULT_ESCALATION_SETTINGS } from "@/core/settings/PluginSettings";

describe("EscalationEvaluator", () => {
  it("returns on-time when due date is today or later", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-10T08:00:00Z"));

    const task = createTask("On-time", { type: "daily", interval: 1 });
    task.dueAt = new Date("2024-01-10T12:00:00Z").toISOString();

    const result = evaluateEscalation(task, { settings: DEFAULT_ESCALATION_SETTINGS });
    expect(result.level).toBe(0);
    expect(result.daysOverdue).toBe(0);

    vi.useRealTimers();
  });

  it("assigns warning level for 1-2 days overdue", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-10T08:00:00Z"));

    const task = createTask("Warning", { type: "daily", interval: 1 });
    task.dueAt = new Date("2024-01-08T08:00:00Z").toISOString();

    const result = evaluateEscalation(task, { settings: DEFAULT_ESCALATION_SETTINGS });
    expect(result.level).toBe(1);
    expect(result.daysOverdue).toBe(2);

    vi.useRealTimers();
  });

  it("uses scheduled date when due date is missing and setting is enabled", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-10T08:00:00Z"));

    const task = createTask("Scheduled", { type: "daily", interval: 1 });
    task.dueAt = "";
    task.scheduledAt = new Date("2024-01-03T08:00:00Z").toISOString();

    const result = evaluateEscalation(task, { settings: DEFAULT_ESCALATION_SETTINGS });
    expect(result.level).toBe(2);
    expect(result.daysOverdue).toBe(7);

    vi.useRealTimers();
  });

  it("ignores completed tasks", () => {
    const task = createTask("Done", { type: "daily", interval: 1 });
    task.status = "done";
    task.dueAt = new Date("2024-01-01T08:00:00Z").toISOString();

    const result = evaluateEscalation(task, { settings: DEFAULT_ESCALATION_SETTINGS });
    expect(result.level).toBe(0);
  });
});
