import type { Status } from './Status';

// Minimal Task interface for Obsidian-Tasks UI compatibility
export interface Task {
  description: string;
  status: Status;
  priority: Priority;
  dueDate: string | null;
  scheduledDate: string | null;
  startDate: string | null;
  createdDate: string | null;
  doneDate: string | null;
  cancelledDate: string | null;
  recurrence: string | null;
  dependsOn: string[];
  id: string;
  path: string;
  
  // For compatibility with EditableTask
  due?: TaskDate;
  scheduled?: TaskDate;
  start?: TaskDate;
  created?: TaskDate;
  done?: TaskDate;
  cancelled?: TaskDate;
  recurrenceRule?: string;
  onCompletion?: any;
  
  // Method for status handling
  handleNewStatus?(status: Status): Task[];
}

export class TaskDate {
  private date: string;
  
  constructor(date: string | null) {
    this.date = date || '';
  }
  
  formatAsDate(): string {
    return this.date;
  }
  
  static fromString(date: string | null): TaskDate {
    return new TaskDate(date);
  }
}

export enum Priority {
  Highest = '⏫',
  High = '🔺',
  Medium = '🔼',
  Normal = '',
  Low = '🔽',
  Lowest = '⏬',
}

export class Recurrence {
  private text: string;
  
  constructor(text: string) {
    this.text = text;
  }
  
  toText(): string {
    return this.text;
  }
  
  static fromText(params: { recurrenceRuleText: string; occurrence?: any } | string): Recurrence | null {
    const text = typeof params === 'string' ? params : params.recurrenceRuleText;
    if (!text) return null;
    return new Recurrence(text);
  }
}

export class Occurrence {
  constructor(params?: any) {
    // Stub constructor
  }
  
  static fromTaskDates(params: any): Occurrence {
    return new Occurrence();
  }
}

/**
 * Create an empty task for new task creation
 */
export function taskFromLine(params: { line: string; path: string }): Task {
  const task: Task = {
    description: params.line.replace(/^- \[([ x-])\]\s*/, ''),
    status: { symbol: ' ', name: 'Todo', type: 'TODO', isCompleted: () => false, isCancelled: () => false },
    priority: Priority.Normal,
    dueDate: null,
    scheduledDate: null,
    startDate: null,
    createdDate: null,
    doneDate: null,
    cancelledDate: null,
    recurrence: null,
    dependsOn: [],
    id: `task_${Date.now()}`,
    path: params.path,
    due: TaskDate.fromString(null),
    scheduled: TaskDate.fromString(null),
    start: TaskDate.fromString(null),
    created: TaskDate.fromString(null),
    done: TaskDate.fromString(null),
    cancelled: TaskDate.fromString(null),
    handleNewStatus: (newStatus: Status) => {
      const now = new Date().toISOString().split('T')[0];
      const updatedTask = { ...task, status: newStatus };
      
      if (newStatus.isCompleted()) {
        updatedTask.doneDate = now;
        updatedTask.done = TaskDate.fromString(now);
      }
      
      if (newStatus.isCancelled()) {
        updatedTask.cancelledDate = now;
        updatedTask.cancelled = TaskDate.fromString(now);
      }
      
      return [updatedTask];
    },
  };
  
  return task;
}

// Helper functions
export function ensureTaskHasId(task: Task, existingIds?: string[]): Task {
  if (!task.id || task.id === '') {
    task.id = generateUniqueId();
  }
  return task;
}

export function generateUniqueId(existingIds?: string[]): string {
  return `task_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

export function addDependencyToParent(parentTask: Task, childId: string): void {
  // Stub implementation
}

export function removeDependency(task: Task, dependencyId: string): void {
  // Stub implementation
}
