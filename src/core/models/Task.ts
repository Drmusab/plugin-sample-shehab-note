import type { Frequency } from "./Frequency";
import { isValidFrequency } from "./Frequency";
import { MAX_RECENT_COMPLETIONS, CURRENT_SCHEMA_VERSION } from "@/utils/constants";

/**
 * Task entity representing a recurring task
 */
export interface Task {
  /** Unique task identifier */
  id: string;
  
  /** Task title/name */
  name: string;
  
  /** Timestamp of last completion (ISO string) */
  lastCompletedAt?: string;
  
  /** Current due date & time (ISO string) */
  dueAt: string;
  
  /** Recurrence rule definition */
  frequency: Frequency;
  
  /** Whether task is active */
  enabled: boolean;

  /** Linked block ID in Shehab-Note */
  linkedBlockId?: string;

  /** Cached block content for quick access */
  linkedBlockContent?: string;

  /** Priority for routing */
  priority?: "low" | "normal" | "high" | "urgent";

  /** Tags for routing */
  tags?: string[];

  /** Notification channels (e.g., ["email", "slack"]) */
  notificationChannels?: string[];

  /** Timezone for scheduling */
  timezone?: string;

  /** Category for grouping */
  category?: string;

  /** Description/notes */
  description?: string;

  /** Analytics: Number of completions */
  completionCount?: number;

  /** Analytics: Number of misses */
  missCount?: number;

  /** Analytics: Current completion streak */
  currentStreak?: number;

  /** Analytics: Best completion streak */
  bestStreak?: number;

  /** Recent completion timestamps (ISO strings) */
  recentCompletions?: string[];

  /** Snooze count for this occurrence */
  snoozeCount?: number;

  /** Maximum number of snoozes allowed */
  maxSnoozes?: number;

  /** Escalation policy for missed tasks */
  escalationPolicy?: {
    enabled: boolean;
    levels: Array<{
      missCount: number;
      action: "notify" | "escalate" | "disable";
      channels?: string[];
    }>;
  };

  /** Schema version for migrations */
  version?: number;
  
  /** Creation timestamp (ISO string) */
  createdAt: string;
  
  /** Last update timestamp (ISO string) */
  updatedAt: string;

  // New fields for Obsidian-Tasks feature parity
  
  /** Task status (replaces boolean 'enabled' semantically) */
  status?: 'todo' | 'done' | 'cancelled';
  
  /** Human-readable recurrence string */
  recurrenceText?: string;
  
  /** When to start working on task (ISO string) */
  scheduledAt?: string;
  
  /** Earliest date task can begin (ISO string) */
  startAt?: string;
  
  /** Task IDs this task depends on */
  dependsOn?: string[];
  
  /** Task IDs blocking this task */
  blockedBy?: string[];
  
  /** Links recurring task instances */
  seriesId?: string;
  
  /** Which instance in recurring series */
  occurrenceIndex?: number;
  
  /** Cancellation timestamp (ISO string) */
  cancelledAt?: string;

  /** Action to take when task is completed */
  onCompletion?: 'keep' | 'delete';

  /** The character in the checkbox for line-based tasks */
  statusSymbol?: string;
}

/**
 * Creates a new task with default values
 */
export function createTask(
  name: string,
  frequency: Frequency,
  dueAt?: Date
): Task {
  const now = new Date().toISOString();
  const dueDate = dueAt || new Date();
  
  return {
    id: generateTaskId(),
    name,
    lastCompletedAt: undefined,
    dueAt: dueDate.toISOString(),
    frequency,
    enabled: true,
    priority: "normal",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    completionCount: 0,
    missCount: 0,
    currentStreak: 0,
    bestStreak: 0,
    recentCompletions: [],
    snoozeCount: 0,
    maxSnoozes: 3,
    version: CURRENT_SCHEMA_VERSION,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Generates a unique task ID
 */
function generateTaskId(): string {
  return `task_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Create a duplicate task with a new ID and timestamps.
 */
export function duplicateTask(task: Task, overrides: Partial<Task> = {}): Task {
  const now = new Date().toISOString();
  const clone: Task = {
    ...task,
    id: generateTaskId(),
    createdAt: now,
    updatedAt: now,
    lastCompletedAt: undefined,
    completionCount: 0,
    missCount: 0,
    currentStreak: 0,
    bestStreak: 0,
    recentCompletions: [],
    snoozeCount: 0,
  };

  return {
    ...clone,
    ...overrides,
  };
}

/**
 * Type guard to check if an object is a valid Task
 */
export function isTask(obj: unknown): obj is Task {
  if (!obj || typeof obj !== "object") {
    return false;
  }
  
  const candidate = obj as Record<string, unknown>;
  
  return (
    typeof candidate.id === "string" &&
    candidate.id.length > 0 &&
    typeof candidate.name === "string" &&
    typeof candidate.dueAt === "string" &&
    typeof candidate.enabled === "boolean" &&
    candidate.frequency !== undefined &&
    isValidFrequency(candidate.frequency as any) &&
    typeof candidate.createdAt === "string" &&
    typeof candidate.updatedAt === "string"
  );
}

/**
 * Record a task completion
 */
export function recordCompletion(task: Task): void {
  const now = new Date().toISOString();
  
  // Update completion count
  task.completionCount = (task.completionCount || 0) + 1;
  
  // Update streaks
  task.currentStreak = (task.currentStreak || 0) + 1;
  task.bestStreak = Math.max(task.bestStreak || 0, task.currentStreak);
  
  // Add to recent completions
  if (!task.recentCompletions) {
    task.recentCompletions = [];
  }
  task.recentCompletions.push(now);
  
  // Keep only the most recent completions
  if (task.recentCompletions.length > MAX_RECENT_COMPLETIONS) {
    task.recentCompletions = task.recentCompletions.slice(-MAX_RECENT_COMPLETIONS);
  }
  
  // Reset snooze count
  task.snoozeCount = 0;
  
  // Update timestamps
  task.lastCompletedAt = now;
  task.updatedAt = now;
}

/**
 * Record a task miss
 */
export function recordMiss(task: Task): void {
  // Update miss count
  task.missCount = (task.missCount || 0) + 1;
  
  // Reset current streak
  task.currentStreak = 0;
  
  // Update timestamp
  task.updatedAt = new Date().toISOString();
}

/**
 * Calculate task health score (0-100)
 * Based on completion rate and streak
 */
export function calculateTaskHealth(task: Task): number {
  const completions = task.completionCount || 0;
  const misses = task.missCount || 0;
  const total = completions + misses;
  
  if (total === 0) {
    return 100; // New task, optimistic
  }
  
  // Base score from completion rate
  const completionRate = completions / total;
  let score = completionRate * 70; // 70% weight
  
  // Bonus from current streak (up to 30 points)
  const streak = task.currentStreak || 0;
  const streakBonus = Math.min(30, streak * 3);
  score += streakBonus;
  
  return Math.round(Math.min(100, score));
}

/**
 * Check if task is blocked by dependencies
 */
export function isBlocked(task: Task, allTasks: Task[]): boolean {
  if (!task.blockedBy || task.blockedBy.length === 0) {
    return false;
  }
  
  // Check if any blocking task is not completed
  const blockingTasks = allTasks.filter(t => task.blockedBy?.includes(t.id));
  return blockingTasks.some(t => {
    // Check new status field first, fallback to enabled for backward compatibility
    if (t.status) {
      return t.status !== 'done';
    }
    return t.enabled;
  });
}

/**
 * Check if task is active/incomplete (helper for backward compatibility)
 */
export function isTaskActive(task: Task): boolean {
  // Check new status field first, fallback to enabled for backward compatibility
  if (task.status) {
    return task.status === 'todo';
  }
  return task.enabled;
}

/**
 * Check if task is overdue
 */
export function isOverdue(task: Task): boolean {
  const now = new Date();
  const dueDate = new Date(task.dueAt);
  
  // Task must be active/incomplete to be overdue
  if (!isTaskActive(task)) {
    return false;
  }
  
  return dueDate < now;
}

/**
 * Check if task is due today
 */
export function isDueToday(task: Task): boolean {
  const now = new Date();
  const dueDate = new Date(task.dueAt);
  
  return (
    dueDate.getFullYear() === now.getFullYear() &&
    dueDate.getMonth() === now.getMonth() &&
    dueDate.getDate() === now.getDate()
  );
}
