import { describe, expect, it, vi } from "vitest";
import { Scheduler } from "../core/engine/Scheduler";
import { createTask } from "../core/models/Task";

describe("Scheduler", () => {
  it("fires due task once per occurrence", () => {
    const task = createTask(
      "Test task",
      { type: "daily", interval: 1, time: "09:00" },
      new Date()
    );
    task.enabled = true;

    const storage = {
      getEnabledTasks: () => [task],
      getTask: () => task,
      saveTask: vi.fn(),
    };

    // No notification state provided, so it uses fallback logic
    const scheduler = new Scheduler(storage as any, undefined, 1000);
    let dueCount = 0;

    scheduler.start(() => {
      dueCount += 1;
    });

    expect(dueCount).toBe(1);

    scheduler.runOnce();
    expect(dueCount).toBe(1);

    scheduler.stop();
  });
});
