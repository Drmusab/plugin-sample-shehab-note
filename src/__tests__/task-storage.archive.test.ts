import { describe, it, expect, beforeEach, vi } from "vitest";
import { TaskStorage } from "@/core/storage/TaskStorage";
import { ArchiveTaskStore } from "@/core/storage/ArchiveTaskStore";
import { createTask } from "@/core/models/Task";
import type { Frequency } from "@/core/models/Frequency";
import {
  STORAGE_ACTIVE_KEY,
  STORAGE_ARCHIVE_KEY,
  STORAGE_LEGACY_BACKUP_KEY,
  STORAGE_LEGACY_KEY,
} from "@/utils/constants";

const mockPlugin = {
  loadData: vi.fn(),
  saveData: vi.fn(),
  data: {} as Record<string, any>,
} as any;

const frequency: Frequency = {
  type: "daily",
  interval: 1,
  time: "09:00",
};

const baseDate = new Date("2024-01-01T09:00:00.000Z");

function createCompletedTask(name: string, completedAt: Date) {
  const task = createTask(name, frequency);
  task.lastCompletedAt = completedAt.toISOString();
  task.updatedAt = completedAt.toISOString();
  return task;
}

describe("TaskStorage - Archive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPlugin.data = {};
    mockPlugin.loadData.mockImplementation((key: string) => Promise.resolve(mockPlugin.data[key]));
    mockPlugin.saveData.mockImplementation((key: string, value: any) => {
      mockPlugin.data[key] = value;
      return Promise.resolve();
    });
  });

  it("does not load archive data on init", async () => {
    const task = createTask("Active", frequency);
    mockPlugin.data[STORAGE_ACTIVE_KEY] = { tasks: [task] };
    mockPlugin.data[STORAGE_ARCHIVE_KEY] = {
      version: 1,
      totalCount: 1,
      chunks: [
        {
          key: `${STORAGE_ARCHIVE_KEY}-2024-1`,
          year: 2024,
          sequence: 1,
          count: 1,
          start: baseDate.toISOString(),
          end: baseDate.toISOString(),
        },
      ],
    };
    mockPlugin.data[`${STORAGE_ARCHIVE_KEY}-2024-1`] = { tasks: [createCompletedTask("Archived", baseDate)] };

    const storage = new TaskStorage(mockPlugin);
    await storage.init();

    expect(mockPlugin.loadData).toHaveBeenCalledWith(STORAGE_ACTIVE_KEY);
    expect(mockPlugin.loadData).not.toHaveBeenCalledWith(STORAGE_ARCHIVE_KEY);
    expect(mockPlugin.loadData).not.toHaveBeenCalledWith(`${STORAGE_ARCHIVE_KEY}-2024-1`);
  });

  it("archives completed tasks and retrieves them with filters", async () => {
    const storage = new TaskStorage(mockPlugin);
    await storage.init();

    const completedAt = new Date("2024-03-10T10:00:00.000Z");
    const task = createCompletedTask("Completed", completedAt);

    await storage.archiveTask(task);

    const all = await storage.loadArchive();
    expect(all.length).toBe(1);

    const filtered = await storage.loadArchive({
      from: "2024-03-01T00:00:00.000Z",
      to: "2024-03-31T23:59:59.999Z",
      taskId: task.id,
    });
    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe(task.id);
  });

  it("migrates legacy storage and preserves data", async () => {
    const activeTask = createTask("Active Task", frequency);
    const archivedTask = createTask("Archived Task", frequency);
    archivedTask.enabled = false;
    archivedTask.lastCompletedAt = baseDate.toISOString();
    archivedTask.updatedAt = baseDate.toISOString();

    mockPlugin.data[STORAGE_LEGACY_KEY] = {
      tasks: [activeTask, archivedTask],
    };

    const storage = new TaskStorage(mockPlugin);
    await storage.init();

    expect(mockPlugin.data[STORAGE_LEGACY_BACKUP_KEY]).toBeDefined();
    expect(mockPlugin.data[STORAGE_ACTIVE_KEY]).toBeDefined();

    const activeTasks = storage.getAllTasks();
    expect(activeTasks.length).toBe(1);
    expect(activeTasks[0].id).toBe(activeTask.id);

    const archive = await storage.loadArchive();
    expect(archive.length).toBe(1);
    expect(archive[0].id).toBe(archivedTask.id);
  });

  it("handles large archive datasets with chunking", async () => {
    const archiveStore = new ArchiveTaskStore(mockPlugin);
    const tasks = Array.from({ length: 5000 }, (_, index) =>
      createCompletedTask(`Task ${index + 1}`, new Date(baseDate.getTime() + index * 1000))
    );

    await archiveStore.archiveTasks(tasks);

    const index = mockPlugin.data[STORAGE_ARCHIVE_KEY];
    expect(index.totalCount).toBe(5000);
    expect(index.chunks.length).toBeGreaterThan(1);

    const limited = await archiveStore.loadArchive({ limit: 50 });
    expect(limited.length).toBe(50);
  });
});
