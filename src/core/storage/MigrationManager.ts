/**
 * Data schema migration manager
 */

import type { Plugin } from "siyuan";
import type { Task } from "@/core/models/Task";
import { CURRENT_SCHEMA_VERSION } from "@/utils/constants";
import * as logger from "@/utils/logger";

export class MigrationManager {
  private plugin: Plugin;

  constructor(plugin: Plugin) {
    this.plugin = plugin;
  }

  /**
   * Get current schema version
   */
  getCurrentVersion(): number {
    return CURRENT_SCHEMA_VERSION;
  }

  /**
   * Create a backup before migration
   */
  async createBackup(storageKey: string): Promise<void> {
    try {
      const data = await this.plugin.loadData(storageKey);
      if (data) {
        const backupKey = `${storageKey}-backup-${Date.now()}`;
        await this.plugin.saveData(backupKey, data);
        logger.info(`Created backup: ${backupKey}`);
      }
    } catch (err) {
      logger.error("Failed to create backup", err);
      throw err;
    }
  }

  /**
   * Run all pending migrations
   */
  async migrate(storageKey: string): Promise<void> {
    try {
      const data = await this.plugin.loadData(storageKey);
      if (!data) {
        logger.info("No data to migrate");
        return;
      }

      const tasks: Task[] = Array.isArray(data) ? data : Array.isArray(data.tasks) ? data.tasks : [];
      if (tasks.length === 0) {
        logger.info("No data to migrate");
        return;
      }

      let migrated = false;

      for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];
        const originalVersion = task.version || 0;
        
        if (originalVersion < CURRENT_SCHEMA_VERSION) {
          // Create backup before first migration
          if (!migrated) {
            await this.createBackup(storageKey);
            migrated = true;
          }

          tasks[i] = this.migrateTask(task, originalVersion);
          logger.info(`Migrated task ${task.id} from v${originalVersion} to v${CURRENT_SCHEMA_VERSION}`);
        }
      }

      if (migrated) {
        const payload = Array.isArray(data) ? tasks : { ...data, tasks };
        await this.plugin.saveData(storageKey, payload);
        logger.info(`Migration complete: ${tasks.length} tasks processed`);
      } else {
        logger.info("No migration needed - all tasks up to date");
      }
    } catch (err) {
      logger.error("Migration failed", err);
      throw err;
    }
  }

  /**
   * Migrate a single task through all versions
   */
  private migrateTask(task: Task, fromVersion: number): Task {
    let migrated = { ...task };

    // v0 -> v1: Add version field
    if (fromVersion < 1) {
      migrated.version = 1;
    }

    // v1 -> v2: Add timezone, analytics, priority, tags, notification settings
    if (fromVersion < 2) {
      migrated = {
        ...migrated,
        version: 2,
        timezone: migrated.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        completionCount: migrated.completionCount || 0,
        missCount: migrated.missCount || 0,
        currentStreak: migrated.currentStreak || 0,
        bestStreak: migrated.bestStreak || 0,
        recentCompletions: migrated.recentCompletions || [],
        priority: migrated.priority || "normal",
        tags: migrated.tags || [],
        notificationChannels: migrated.notificationChannels || [],
        snoozeCount: migrated.snoozeCount || 0,
        maxSnoozes: migrated.maxSnoozes || 3,
      };
    }

    // v2 -> v3: Add escalation policy, linked block content, category, description
    if (fromVersion < 3) {
      migrated = {
        ...migrated,
        version: 3,
        escalationPolicy: migrated.escalationPolicy || {
          enabled: false,
          levels: [],
        },
        linkedBlockContent: migrated.linkedBlockContent || undefined,
        category: migrated.category || undefined,
        description: migrated.description || undefined,
      };
    }

    return migrated;
  }
}
