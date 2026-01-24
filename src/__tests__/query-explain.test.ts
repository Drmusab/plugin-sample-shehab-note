import { describe, it, expect } from "vitest";
import { QueryParser } from "@/core/query/QueryParser";
import { QueryEngine } from "@/core/query/QueryEngine";
import { createTask } from "@/core/models/Task";
import type { Task } from "@/core/models/Task";
import type { TaskIndex } from "@/core/query/QueryEngine";

// Mock task index
class MockTaskIndex implements TaskIndex {
  private tasks: Task[] = [];

  constructor(tasks: Task[] = []) {
    this.tasks = tasks;
  }

  getAllTasks(): Task[] {
    return this.tasks;
  }

  addTask(task: Task): void {
    this.tasks.push(task);
  }
}

describe("Query Explain Mode", () => {
  describe("QueryParser - explain instruction", () => {
    it("should parse 'explain' instruction", () => {
      const parser = new QueryParser();
      const ast = parser.parse("explain");
      
      expect(ast.explain).toBe(true);
    });

    it("should parse 'EXPLAIN' instruction (case insensitive)", () => {
      const parser = new QueryParser();
      const ast = parser.parse("EXPLAIN");
      
      expect(ast.explain).toBe(true);
    });

    it("should parse explain with filters", () => {
      const parser = new QueryParser();
      const ast = parser.parse("done\nexplain");
      
      expect(ast.explain).toBe(true);
      expect(ast.filters.length).toBe(1);
    });

    it("should not set explain for non-explain queries", () => {
      const parser = new QueryParser();
      const ast = parser.parse("done");
      
      expect(ast.explain).toBeUndefined();
    });

    it("should parse explain with sort and limit", () => {
      const parser = new QueryParser();
      const ast = parser.parse("done\nsort by due\nlimit 10\nexplain");
      
      expect(ast.explain).toBe(true);
      expect(ast.filters.length).toBe(1);
      expect(ast.sort).toBeDefined();
      expect(ast.limit).toBe(10);
    });
  });

  describe("QueryEngine - explanation generation", () => {
    it("should generate explanation for simple filter", () => {
      const taskIndex = new MockTaskIndex();
      const engine = new QueryEngine(taskIndex);
      const parser = new QueryParser();
      
      const ast = parser.parse("done\nexplain");
      const result = engine.execute(ast);
      
      expect(result.explanation).toBeDefined();
      expect(result.explanation).toContain("Filters:");
      expect(result.explanation).toContain("done");
    });

    it("should generate explanation for multiple filters", () => {
      const taskIndex = new MockTaskIndex();
      const engine = new QueryEngine(taskIndex);
      const parser = new QueryParser();
      
      const ast = parser.parse("done\npriority is high\nexplain");
      const result = engine.execute(ast);
      
      expect(result.explanation).toBeDefined();
      expect(result.explanation).toContain("Priority");
    });

    it("should generate explanation with sort", () => {
      const taskIndex = new MockTaskIndex();
      const engine = new QueryEngine(taskIndex);
      const parser = new QueryParser();
      
      const ast = parser.parse("done\nsort by due\nexplain");
      const result = engine.execute(ast);
      
      expect(result.explanation).toBeDefined();
      expect(result.explanation).toContain("Sort:");
      expect(result.explanation).toContain("due");
    });

    it("should generate explanation with limit", () => {
      const taskIndex = new MockTaskIndex();
      const engine = new QueryEngine(taskIndex);
      const parser = new QueryParser();
      
      const ast = parser.parse("done\nlimit 5\nexplain");
      const result = engine.execute(ast);
      
      expect(result.explanation).toBeDefined();
      expect(result.explanation).toContain("Limit:");
      expect(result.explanation).toContain("5");
    });

    it("should generate explanation with group", () => {
      const taskIndex = new MockTaskIndex();
      const engine = new QueryEngine(taskIndex);
      const parser = new QueryParser();
      
      const ast = parser.parse("done\ngroup by priority\nexplain");
      const result = engine.execute(ast);
      
      expect(result.explanation).toBeDefined();
      expect(result.explanation).toContain("Group:");
      expect(result.explanation).toContain("priority");
    });

    it("should generate explanation for query with no filters", () => {
      const taskIndex = new MockTaskIndex();
      const engine = new QueryEngine(taskIndex);
      const parser = new QueryParser();
      
      const ast = parser.parse("explain");
      const result = engine.execute(ast);
      
      expect(result.explanation).toBeDefined();
      expect(result.explanation).toContain("None");
    });

    it("should generate explanation for tag filter", () => {
      const taskIndex = new MockTaskIndex();
      const engine = new QueryEngine(taskIndex);
      const parser = new QueryParser();
      
      const ast = parser.parse("tag includes #work\nexplain");
      const result = engine.execute(ast);
      
      expect(result.explanation).toBeDefined();
      expect(result.explanation).toContain("Tag includes");
      expect(result.explanation).toContain("#work");
    });

    it("should generate explanation for urgency filter", () => {
      const taskIndex = new MockTaskIndex();
      const engine = new QueryEngine(taskIndex);
      const parser = new QueryParser();

      const ast = parser.parse("urgency above 80\nexplain");
      const result = engine.execute(ast);

      expect(result.explanation).toBeDefined();
      expect(result.explanation).toContain("Urgency");
    });

    it("should generate explanation for escalation filter", () => {
      const taskIndex = new MockTaskIndex();
      const engine = new QueryEngine(taskIndex);
      const parser = new QueryParser();

      const ast = parser.parse("escalation >= critical\nexplain");
      const result = engine.execute(ast);

      expect(result.explanation).toBeDefined();
      expect(result.explanation).toContain("Escalation");
    });

    it("should generate explanation for path filter", () => {
      const taskIndex = new MockTaskIndex();
      const engine = new QueryEngine(taskIndex);
      const parser = new QueryParser();
      
      const ast = parser.parse("path includes /projects/\nexplain");
      const result = engine.execute(ast);
      
      expect(result.explanation).toBeDefined();
      expect(result.explanation).toContain("Path");
      expect(result.explanation).toContain("/projects/");
    });

    it("should not generate explanation when explain is false", () => {
      const taskIndex = new MockTaskIndex();
      const engine = new QueryEngine(taskIndex);
      const parser = new QueryParser();
      
      const ast = parser.parse("done");
      const result = engine.execute(ast);
      
      expect(result.explanation).toBeUndefined();
    });

    it("should generate explanation for boolean AND filter", () => {
      const taskIndex = new MockTaskIndex();
      const engine = new QueryEngine(taskIndex);
      const parser = new QueryParser();
      
      const ast = parser.parse("done AND priority is high\nexplain");
      const result = engine.execute(ast);
      
      expect(result.explanation).toBeDefined();
      expect(result.explanation).toContain("AND");
    });

    it("should generate explanation for done filter", () => {
      const taskIndex = new MockTaskIndex();
      const engine = new QueryEngine(taskIndex);
      const parser = new QueryParser();
      
      const ast = parser.parse("done\nexplain");
      const result = engine.execute(ast);
      
      expect(result.explanation).toBeDefined();
      expect(result.explanation).toContain("done");
    });

    it("should generate comprehensive explanation", () => {
      const task1 = createTask("Task 1", { type: "daily", interval: 1 });
      task1.status = "todo";
      task1.priority = "high";
      
      const taskIndex = new MockTaskIndex([task1]);
      const engine = new QueryEngine(taskIndex);
      const parser = new QueryParser();
      
      const ast = parser.parse(
        "done\npriority is high\nsort by due\ngroup by priority\nlimit 10\nexplain"
      );
      const result = engine.execute(ast);
      
      expect(result.explanation).toBeDefined();
      expect(result.explanation).toContain("Filters:");
      expect(result.explanation).toContain("Sort:");
      expect(result.explanation).toContain("Group:");
      expect(result.explanation).toContain("Limit:");
    });
  });
});
