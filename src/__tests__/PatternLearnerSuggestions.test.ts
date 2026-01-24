import { describe, it, expect, beforeEach } from "vitest";
import { PatternLearner } from "@/core/ml/PatternLearner";
import type { PatternLearnerState } from "@/core/ml/PatternLearnerStore";
import type { SmartRecurrenceSettings } from "@/core/settings/PluginSettings";
import type { Task } from "@/core/models/Task";
import type { TaskRepositoryProvider } from "@/core/storage/TaskRepository";

class MemoryPatternLearnerStore {
  state: PatternLearnerState = { version: 1, tasks: {} };

  async load(): Promise<PatternLearnerState> {
    return this.state;
  }

  async save(state: PatternLearnerState): Promise<void> {
    this.state = state;
  }

  async clear(): Promise<void> {
    this.state = { version: 1, tasks: {} };
  }
}

function createSettings(overrides: Partial<SmartRecurrenceSettings> = {}): SmartRecurrenceSettings {
  return {
    enabled: true,
    autoAdjust: false,
    minCompletionsForLearning: 10,
    confidenceThreshold: 0.7,
    sensitivity: "conservative",
    minSampleSize: 5,
    minConfidence: 0.75,
    ...overrides,
  };
}

function createRepository(task: Task): TaskRepositoryProvider {
  return {
    getTask: (id: string) => (id === task.id ? task : undefined),
    getAllTasks: () => [task],
    getTaskByBlockId: () => undefined,
    getEnabledTasks: () => [task],
    getTasksDueOnOrBefore: () => [],
    getTodayAndOverdueTasks: () => [],
    getTasksInRange: () => [],
    saveTask: async () => {},
    deleteTask: async () => {},
    archiveTask: async () => {},
    loadArchive: async () => [],
    flush: async () => {},
  };
}

function createTask(id: string): Task {
  const now = new Date().toISOString();
  return {
    id,
    name: "Test Task",
    dueAt: now,
    frequency: { type: "daily", interval: 1 },
    enabled: true,
    createdAt: now,
    updatedAt: now,
  };
}

function addCompletions(
  learner: PatternLearner,
  taskId: string,
  dates: Date[]
): void {
  for (const date of dates) {
    learner.recordCompletion(taskId, date.toISOString());
  }
}

describe("PatternLearner recurrence suggestions", () => {
  let store: MemoryPatternLearnerStore;
  let task: Task;
  let learner: PatternLearner;
  let settings: SmartRecurrenceSettings;

  beforeEach(async () => {
    store = new MemoryPatternLearnerStore();
    task = createTask("task-1");
    settings = createSettings();
    learner = new PatternLearner({
      store,
      repository: createRepository(task),
      settingsProvider: () => settings,
    });
    await learner.load();
  });

  it("detects weekly patterns on specific weekdays", () => {
    const now = new Date();
    const anchorMonday = new Date(now);
    const diffToMonday = (anchorMonday.getUTCDay() + 6) % 7;
    anchorMonday.setUTCDate(anchorMonday.getUTCDate() - diffToMonday - 35);
    anchorMonday.setUTCHours(9, 0, 0, 0);
    const dates: Date[] = [];
    for (let week = 0; week < 6; week++) {
      const base = new Date(anchorMonday);
      base.setUTCDate(anchorMonday.getUTCDate() + week * 7);
      const monday = new Date(base);
      const wednesday = new Date(base);
      const friday = new Date(base);
      wednesday.setUTCDate(base.getUTCDate() + 2);
      friday.setUTCDate(base.getUTCDate() + 4);
      dates.push(monday, wednesday, friday);
    }

    addCompletions(learner, task.id, dates);

    const suggestion = learner.analyzeTask(task.id);
    expect(suggestion).not.toBeNull();
    expect(suggestion?.suggestedRRule).toContain("FREQ=WEEKLY");
    expect(suggestion?.evidence.byDay).toEqual(expect.arrayContaining(["MO", "WE", "FR"]));
  });

  it("detects daily patterns", () => {
    const start = new Date();
    start.setUTCHours(8, 0, 0, 0);
    start.setUTCDate(start.getUTCDate() - 6);
    const dates = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(start);
      date.setUTCDate(start.getUTCDate() + i);
      return date;
    });

    addCompletions(learner, task.id, dates);

    const suggestion = learner.analyzeTask(task.id);
    expect(suggestion).not.toBeNull();
    expect(suggestion?.suggestedRRule).toContain("FREQ=DAILY");
  });

  it("detects monthly day-of-month patterns", () => {
    const base = new Date();
    base.setUTCDate(15);
    base.setUTCHours(10, 0, 0, 0);
    const dates = [0, 1, 2, 3, 4].map((monthOffset) => {
      const date = new Date(base);
      date.setUTCMonth(base.getUTCMonth() - (4 - monthOffset));
      return date;
    });

    addCompletions(learner, task.id, dates);

    const suggestion = learner.analyzeTask(task.id);
    expect(suggestion).not.toBeNull();
    expect(suggestion?.suggestedRRule).toContain("FREQ=MONTHLY");
    expect(suggestion?.evidence.byMonthDay).toEqual([15]);
  });

  it("tolerates jitter within the same day", () => {
    const start = new Date();
    start.setUTCHours(6, 0, 0, 0);
    start.setUTCDate(start.getUTCDate() - 5);
    const dates = Array.from({ length: 6 }, (_, i) => {
      const date = new Date(start);
      date.setUTCDate(start.getUTCDate() + i);
      date.setUTCHours(i % 2 === 0 ? 6 : 18);
      return date;
    });

    addCompletions(learner, task.id, dates);

    const suggestion = learner.analyzeTask(task.id);
    expect(suggestion).not.toBeNull();
    expect(suggestion?.suggestedRRule).toContain("FREQ=DAILY");
  });

  it("rejecting a suggestion lowers future confidence", async () => {
    settings = createSettings({ minConfidence: 0.85 });
    learner = new PatternLearner({
      store,
      repository: createRepository(task),
      settingsProvider: () => settings,
    });
    await learner.load();
    const start = new Date();
    start.setUTCHours(8, 0, 0, 0);
    start.setUTCDate(start.getUTCDate() - 6);
    const dates = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(start);
      date.setUTCDate(start.getUTCDate() + i);
      return date;
    });
    addCompletions(learner, task.id, dates);
    const suggestion = learner.analyzeTask(task.id);
    expect(suggestion).not.toBeNull();
    if (!suggestion) {
      return;
    }
    const suggestionId = learner.getSuggestionId(suggestion);
    learner.rejectSuggestion(task.id, suggestionId);
    const nextSuggestion = learner.analyzeTask(task.id);
    expect(nextSuggestion).toBeNull();
  });

  it("accepting a suggestion stores feedback", () => {
    const start = new Date();
    start.setUTCHours(9, 0, 0, 0);
    start.setUTCDate(start.getUTCDate() - 5);
    const dates = Array.from({ length: 6 }, (_, i) => {
      const date = new Date(start);
      date.setUTCDate(start.getUTCDate() + i);
      return date;
    });
    addCompletions(learner, task.id, dates);
    const suggestion = learner.analyzeTask(task.id);
    expect(suggestion).not.toBeNull();
    if (!suggestion) {
      return;
    }
    const suggestionId = learner.getSuggestionId(suggestion);
    learner.acceptSuggestion(task.id, suggestionId);
    expect(store.state.tasks[task.id].feedback).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ suggestionId, accepted: true }),
      ])
    );
  });
});
