import type { Plugin } from "siyuan";
import type { Task } from "@/core/models/Task";
import { STORAGE_ACTIVE_KEY } from "@/utils/constants";
import * as logger from "@/utils/logger";

export class ActiveTaskStore {
  private plugin: Plugin;

  constructor(plugin: Plugin) {
    this.plugin = plugin;
  }

  async loadActive(): Promise<Map<string, Task>> {
    try {
      const data = await this.plugin.loadData(STORAGE_ACTIVE_KEY);
      if (data && Array.isArray(data.tasks)) {
        return new Map(data.tasks.map((task: Task) => [task.id, task]));
      }
    } catch (err) {
      logger.error("Failed to load active tasks", err);
    }
    return new Map();
  }

  async saveActive(tasks: Map<string, Task>): Promise<void> {
    try {
      const payload = { tasks: Array.from(tasks.values()) };
      await this.plugin.saveData(STORAGE_ACTIVE_KEY, payload);
      logger.info(`Saved ${payload.tasks.length} active tasks`);
    } catch (err) {
      logger.error("Failed to save active tasks", err);
      throw err;
    }
  }
}
