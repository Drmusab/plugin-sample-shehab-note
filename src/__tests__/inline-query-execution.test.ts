import { describe, expect, it } from "vitest";
import { createTask } from "@/core/models/Task";
import { QueryEngine } from "@/core/query/QueryEngine";
import { QueryParser } from "@/core/query/QueryParser";
import type { Task } from "@/core/models/Task";

describe("Inline query execution", () => {
  it("executes the same DSL for list rendering", () => {
    const taskA = createTask("Alpha", { type: "daily", interval: 1, time: "09:00" });
    taskA.status = "todo";
    taskA.priority = "high";
    taskA.dueAt = new Date("2024-01-10T09:00:00Z").toISOString();

    const taskB = createTask("Beta", { type: "daily", interval: 1, time: "09:00" });
    taskB.status = "done";
    taskB.dueAt = new Date("2024-01-09T09:00:00Z").toISOString();

    const tasks: Task[] = [taskA, taskB];
    const engine = new QueryEngine({ getAllTasks: () => tasks });
    const parser = new QueryParser();

    const ast = parser.parse("not done\nsort by due\nlimit 1");
    const result = engine.execute(ast);

    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].name).toBe("Alpha");
  });

  it("supports grouping in inline queries", () => {
    const taskA = createTask("Gamma", { type: "daily", interval: 1, time: "09:00" });
    taskA.status = "todo";
    taskA.priority = "high";

    const taskB = createTask("Delta", { type: "daily", interval: 1, time: "09:00" });
    taskB.status = "todo";
    taskB.priority = "low";

    const tasks: Task[] = [taskA, taskB];
    const engine = new QueryEngine({ getAllTasks: () => tasks });
    const parser = new QueryParser();

    const ast = parser.parse("not done\ngroup by priority");
    const result = engine.execute(ast);

    expect(result.groups).toBeDefined();
    expect(result.groups?.get("high")).toHaveLength(1);
    expect(result.groups?.get("low")).toHaveLength(1);
  });
});
