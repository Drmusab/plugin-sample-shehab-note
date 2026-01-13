import type { Task } from "@/core/models/Task";
import type { TaskStorage } from "@/core/storage/TaskStorage";

export class TaskService {
  private storage: TaskStorage;

  constructor(storage: TaskStorage) {
    this.storage = storage;
  }

  loadTasks(): Task[] {
    return this.storage.getAllTasks().map((task) => ({ ...task }));
  }

  getTodayAndOverdueTasks(): Task[] {
    return this.storage.getTodayAndOverdueTasks();
  }

  getTaskByBlockId(blockId: string): Task | undefined {
    return this.storage.getTaskByBlockId(blockId);
  }

  saveTask(task: Task): Promise<void> {
    return this.storage.saveTask(task);
  }

  deleteTask(taskId: string): Promise<void> {
    return this.storage.deleteTask(taskId);
  }
}
