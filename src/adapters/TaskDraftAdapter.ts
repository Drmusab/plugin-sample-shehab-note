/**
 * TaskDraftAdapter - Clean bidirectional adapter between:
 * - Obsidian-Tasks UI models (EditableTask)
 * - Recurring plugin domain models (Task)
 * 
 * This adapter is the critical isolation layer that prevents UI logic from contaminating business logic.
 */

import type { Task as RecurringTask } from '@/core/models/Task';
import type { Frequency } from '@/core/models/Frequency';
import type { TaskPriority } from '@/core/models/Task';
import { EditableTask } from '@/vendor/obsidian-tasks/ui/EditableTask';
import type { Task as ObsidianTask } from '@/vendor/obsidian-tasks/types/Task';
import type { Status } from '@/vendor/obsidian-tasks/types/Status';
import { StatusImpl, StatusRegistry, StatusType } from '@/vendor/obsidian-tasks/types/Status';
import { Priority } from '@/vendor/obsidian-tasks/types/Task';
import { GlobalFilter } from '@/vendor/obsidian-tasks/shims/ObsidianShim';

export class TaskDraftAdapter {
  /**
   * Convert Recurring Task → Obsidian EditableTask (for UI display)
   * This is called when opening the task editor
   */
  static toEditableTask(
    recurringTask: RecurringTask,
    allTasks: RecurringTask[]
  ): EditableTask {
    // Convert all recurring tasks to obsidian tasks for dependency lookup
    const allObsidianTasks = allTasks.map(t => this.toObsidianTaskStub(t));
    
    // Create the main obsidian task stub
    const obsidianTask = this.toObsidianTaskStub(recurringTask);
    
    // Use EditableTask.fromTask to create the editable instance
    return EditableTask.fromTask(obsidianTask, allObsidianTasks);
  }

  /**
   * Convert Obsidian EditableTask → Recurring Task (for storage)
   * This is called when user clicks "Apply" in the editor
   */
  static fromEditableTask(
    editableTask: EditableTask,
    originalTask?: RecurringTask
  ): RecurringTask {
    const now = new Date().toISOString();
    
    // Remove global filter from description
    const name = GlobalFilter.getInstance().removeAsWordFrom(editableTask.description).trim();
    
    // Parse dates
    const dueAt = this.parseDate(editableTask.dueDate) || now;
    const startAt = this.parseDate(editableTask.startDate);
    const scheduledAt = this.parseDate(editableTask.scheduledDate);
    const createdAt = this.parseDate(editableTask.createdDate) || originalTask?.createdAt || now;
    const doneAt = this.parseDate(editableTask.doneDate);
    const cancelledAt = this.parseDate(editableTask.cancelledDate);
    
    // Parse frequency from recurrence rule
    const frequency = this.rRuleToFrequency(editableTask.recurrenceRule);
    
    // Map status
    const status = this.mapStatusToRecurring(editableTask.status);
    
    // Map priority
    const priority = this.mapPriorityToRecurring(editableTask.priority);
    
    // Map dependencies
    const blockedBy = this.mapDependenciesToIds(editableTask.blockedBy);
    const blocks = this.mapDependenciesToIds(editableTask.blocking);
    
    return {
      id: originalTask?.id || this.generateTaskId(),
      name,
      dueAt,
      frequency,
      enabled: status === 'todo',
      status,
      priority,
      startAt,
      scheduledAt,
      createdAt,
      doneAt,
      cancelledAt,
      updatedAt: now,
      blockedBy,
      blocks,
      
      // Preserve original task metadata
      completionCount: originalTask?.completionCount || 0,
      missCount: originalTask?.missCount || 0,
      currentStreak: originalTask?.currentStreak || 0,
      bestStreak: originalTask?.bestStreak || 0,
      recentCompletions: originalTask?.recentCompletions || [],
      snoozeCount: originalTask?.snoozeCount || 0,
      maxSnoozes: originalTask?.maxSnoozes || 3,
      version: originalTask?.version || 1,
      timezone: originalTask?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      lastCompletedAt: originalTask?.lastCompletedAt,
    };
  }

  /**
   * Create an empty EditableTask for new task creation
   */
  static createEmptyEditableTask(): EditableTask {
    const emptyTask: ObsidianTask = {
      description: '',
      status: new StatusImpl(' ', 'Todo', 'TODO'),
      priority: Priority.Normal,
      dueDate: null,
      scheduledDate: null,
      startDate: null,
      createdDate: null,
      doneDate: null,
      cancelledDate: null,
      recurrence: null,
      dependsOn: [],
      id: this.generateTaskId(),
      path: '',
      recurrenceRule: '',
    };
    
    return EditableTask.fromTask(emptyTask, []);
  }

  /**
   * Validate EditableTask before conversion
   * @throws Error if validation fails
   */
  static validate(editableTask: EditableTask): void {
    // Check required fields
    if (!editableTask.description?.trim()) {
      throw new Error('Task name is required');
    }

    // Validate recurrence rule if provided
    if (editableTask.recurrenceRule) {
      try {
        const frequency = this.rRuleToFrequency(editableTask.recurrenceRule);
        if (!this.isValidFrequency(frequency)) {
          throw new Error('Invalid recurrence rule format');
        }
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        throw new Error(`Invalid recurrence rule: ${errorMessage}`);
      }
    }

    // Validate dates
    if (editableTask.dueDate && !this.isValidDateString(editableTask.dueDate)) {
      throw new Error('Invalid due date format');
    }
    if (editableTask.startDate && !this.isValidDateString(editableTask.startDate)) {
      throw new Error('Invalid start date format');
    }
    if (editableTask.scheduledDate && !this.isValidDateString(editableTask.scheduledDate)) {
      throw new Error('Invalid scheduled date format');
    }
  }

  // ============================================================================
  // Field Mapping Utilities
  // ============================================================================

  /**
   * Map Obsidian Status → Recurring status string
   */
  public static mapStatusToRecurring(status: Status): 'todo' | 'done' | 'cancelled' {
    if (status.type === 'DONE') return 'done';
    if (status.type === 'CANCELLED') return 'cancelled';
    return 'todo'; // Default to TODO for in-progress, etc.
  }

  /**
   * Map Recurring status → Obsidian Status object
   */
  public static mapStatusToObsidian(status?: string): Status {
    switch (status) {
      case 'done':
        return new StatusImpl('x', 'Done', 'DONE');
      case 'cancelled':
        return new StatusImpl('-', 'Cancelled', 'CANCELLED');
      default:
        return new StatusImpl(' ', 'Todo', 'TODO');
    }
  }

  /**
   * Map Obsidian priority string → Recurring priority
   */
  public static mapPriorityToRecurring(priority: string): TaskPriority {
    const normalized = priority.toLowerCase();
    switch (normalized) {
      case 'highest':
        return 'highest';
      case 'high':
        return 'high';
      case 'medium':
        return 'medium';
      case 'low':
        return 'low';
      case 'lowest':
        return 'lowest';
      case 'none':
      case 'normal':
      default:
        return 'normal';
    }
  }

  /**
   * Map Recurring priority → Obsidian priority string
   */
  public static mapPriorityToObsidian(priority?: TaskPriority): string {
    if (!priority || priority === 'normal') return 'none';
    return priority;
  }

  /**
   * Map Recurring priority → Obsidian Priority enum
   */
  public static mapPriorityToObsidianEnum(priority?: TaskPriority): Priority {
    switch (priority) {
      case 'highest':
        return Priority.Highest;
      case 'high':
        return Priority.High;
      case 'medium':
        return Priority.Medium;
      case 'low':
        return Priority.Low;
      case 'lowest':
        return Priority.Lowest;
      case 'normal':
      default:
        return Priority.Normal;
    }
  }

  // ============================================================================
  // Date Utilities
  // ============================================================================

  /**
   * Parse user-friendly date input → ISO 8601
   */
  public static parseDate(dateString: string | null | undefined): string | undefined {
    if (!dateString || dateString.trim() === '') {
      return undefined;
    }
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return undefined;
      }
      return date.toISOString();
    } catch {
      return undefined;
    }
  }

  /**
   * Convert ISO timestamp → date string for UI input
   */
  public static formatDateForUI(isoTimestamp?: string): string {
    if (!isoTimestamp) return '';
    try {
      return new Date(isoTimestamp).toISOString().split('T')[0]; // YYYY-MM-DD
    } catch {
      return '';
    }
  }

  /**
   * Check if date string is valid
   */
  public static isValidDateString(dateString: string): boolean {
    if (!dateString) return false;
    const date = new Date(dateString);
    return !isNaN(date.getTime());
  }

  // ============================================================================
  // Frequency ↔ RRule Conversion
  // ============================================================================

  /**
   * Convert Frequency → RRule string (for Obsidian UI)
   */
  public static frequencyToRRule(frequency?: Frequency): string | null {
    if (!frequency) return null;

    const { type, interval = 1 } = frequency;

    // Handle simple cases
    switch (type) {
      case 'daily':
        return interval === 1 ? 'every day' : `every ${interval} days`;
        
      case 'weekly':
        if ('weekdays' in frequency && frequency.weekdays && frequency.weekdays.length > 0) {
          const days = frequency.weekdays.map(d => this.weekdayToString(d)).join(', ');
          return interval === 1 
            ? `every week on ${days}` 
            : `every ${interval} weeks on ${days}`;
        }
        return interval === 1 ? 'every week' : `every ${interval} weeks`;
        
      case 'monthly':
        if ('dayOfMonth' in frequency && frequency.dayOfMonth) {
          return interval === 1 
            ? `every month on the ${frequency.dayOfMonth}` 
            : `every ${interval} months on the ${frequency.dayOfMonth}`;
        }
        return interval === 1 ? 'every month' : `every ${interval} months`;
        
      case 'yearly':
        if ('month' in frequency && 'dayOfMonth' in frequency) {
          const monthName = this.monthToString(frequency.month);
          return interval === 1 
            ? `every year on ${monthName} ${frequency.dayOfMonth}` 
            : `every ${interval} years on ${monthName} ${frequency.dayOfMonth}`;
        }
        return interval === 1 ? 'every year' : `every ${interval} years`;
        
      default:
        return null;
    }
  }

  /**
   * Convert RRule string → Frequency (for storage)
   */
  public static rRuleToFrequency(rrule: string | null | undefined): Frequency {
    if (!rrule || rrule.trim() === '') {
      // Default to daily if no recurrence specified
      return {
        type: 'daily',
        interval: 1,
      };
    }

    const lower = rrule.toLowerCase().trim();

    // Parse weekly patterns first (before checking for 'day' which is in 'weekday')
    if (lower.includes('week')) {
      const intervalMatch = lower.match(/every (\d+) weeks?/);
      const interval = intervalMatch ? parseInt(intervalMatch[1]) : 1;
      
      // Try to extract weekdays
      const weekdays = this.extractWeekdays(lower);
      
      if (weekdays.length > 0) {
        return {
          type: 'weekly',
          interval,
          weekdays,
        };
      }
      
      return {
        type: 'weekly',
        interval,
        weekdays: [1], // Default to Monday
      };
    }

    // Parse daily patterns
    if (lower.includes('day')) {
      const match = lower.match(/every (\d+) days?/);
      return {
        type: 'daily',
        interval: match ? parseInt(match[1]) : 1,
      };
    }

    // Parse monthly patterns
    if (lower.includes('month')) {
      const intervalMatch = lower.match(/every (\d+) months?/);
      const interval = intervalMatch ? parseInt(intervalMatch[1]) : 1;
      
      const dayMatch = lower.match(/on (?:the )?(\d+)/);
      const dayOfMonth = dayMatch ? parseInt(dayMatch[1]) : 1;
      
      return {
        type: 'monthly',
        interval,
        dayOfMonth,
      };
    }

    // Parse yearly patterns
    if (lower.includes('year')) {
      const intervalMatch = lower.match(/every (\d+) years?/);
      const interval = intervalMatch ? parseInt(intervalMatch[1]) : 1;
      
      // Try to extract month and day
      const monthDay = this.extractMonthAndDay(lower);
      
      return {
        type: 'yearly',
        interval,
        month: monthDay.month,
        dayOfMonth: monthDay.day,
      };
    }

    // Default to daily
    return {
      type: 'daily',
      interval: 1,
    };
  }

  /**
   * Helper: Convert weekday number to string
   * Note: This codebase uses 0=Monday convention, not JavaScript's 0=Sunday
   */
  private static weekdayToString(weekday: number): string {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    return days[weekday] || 'Monday';
  }

  /**
   * Helper: Convert month number to string
   */
  private static monthToString(month: number): string {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[month] || 'January';
  }

  /**
   * Helper: Extract weekdays from text
   * Note: Returns weekdays in 0=Monday convention
   */
  private static extractWeekdays(text: string): number[] {
    const weekdays: number[] = [];
    const lower = text.toLowerCase();
    
    // Use more specific patterns to avoid ambiguity
    // Check full day names first, then abbreviations with word boundaries
    if (lower.match(/\bmonday\b/)) weekdays.push(0);
    if (lower.match(/\btuesday\b/)) weekdays.push(1);
    if (lower.match(/\bwednesday\b/)) weekdays.push(2);
    if (lower.match(/\bthursday\b/)) weekdays.push(3);
    if (lower.match(/\bfriday\b/)) weekdays.push(4);
    if (lower.match(/\bsaturday\b/)) weekdays.push(5);
    if (lower.match(/\bsunday\b/)) weekdays.push(6);
    
    return weekdays;
  }

  /**
   * Helper: Extract month and day from text
   */
  private static extractMonthAndDay(text: string): { month: number; day: number } {
    const lower = text.toLowerCase();
    
    const months = [
      'january', 'february', 'march', 'april', 'may', 'june',
      'july', 'august', 'september', 'october', 'november', 'december'
    ];
    
    let month = 0;
    let monthIndex = -1;
    for (let i = 0; i < months.length; i++) {
      const index = lower.indexOf(months[i]);
      if (index !== -1) {
        month = i;
        monthIndex = index;
        break;
      }
    }
    
    // Extract the day number that appears after the month name
    let day = 1;
    if (monthIndex !== -1) {
      const afterMonth = text.substring(monthIndex);
      const dayMatch = afterMonth.match(/\b(\d+)\b/);
      day = dayMatch ? parseInt(dayMatch[1]) : 1;
    } else {
      // If no month found, just get the first number
      const dayMatch = text.match(/\b(\d+)\b/);
      day = dayMatch ? parseInt(dayMatch[1]) : 1;
    }
    
    return { month, day };
  }

  /**
   * Validate frequency object
   */
  private static isValidFrequency(frequency: Frequency): boolean {
    if (!frequency || !frequency.type || !frequency.interval) {
      return false;
    }
    
    if (frequency.interval < 1) {
      return false;
    }
    
    if (frequency.type === 'weekly') {
      return (
        'weekdays' in frequency &&
        Array.isArray(frequency.weekdays) &&
        frequency.weekdays.length > 0 &&
        frequency.weekdays.every((day) => day >= 0 && day <= 6)
      );
    }

    if (frequency.type === 'monthly') {
      return 'dayOfMonth' in frequency && 
        frequency.dayOfMonth >= 1 && 
        frequency.dayOfMonth <= 31;
    }

    if (frequency.type === 'yearly') {
      return (
        'month' in frequency &&
        'dayOfMonth' in frequency &&
        frequency.month >= 0 &&
        frequency.month <= 11 &&
        frequency.dayOfMonth >= 1 &&
        frequency.dayOfMonth <= 31
      );
    }
    
    return true;
  }

  // ============================================================================
  // Dependency Mapping
  // ============================================================================

  /**
   * Convert Task object array → ID array
   */
  public static mapDependenciesToIds(tasks: ObsidianTask[]): string[] {
    return tasks.map(t => t.id).filter(id => id && id !== '');
  }

  /**
   * Convert ID array → Task object array
   * @param ids - Task IDs from recurring task
   * @param allTasks - Full task list for lookup
   */
  public static mapIdsToTasks(
    ids: string[],
    allTasks: RecurringTask[]
  ): ObsidianTask[] {
    return ids
      .map(id => allTasks.find(t => t.id === id))
      .filter((t): t is RecurringTask => t !== undefined)
      .map(t => this.toObsidianTaskStub(t));
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Convert a recurring task to an Obsidian task stub (for EditableTask compatibility)
   */
  public static toObsidianTaskStub(task: RecurringTask): ObsidianTask {
    return {
      description: task.name,
      status: this.mapStatusToObsidian(task.status),
      priority: this.mapPriorityToObsidianEnum(task.priority),
      dueDate: this.formatDateForUI(task.dueAt),
      scheduledDate: this.formatDateForUI(task.scheduledAt),
      startDate: this.formatDateForUI(task.startAt),
      createdDate: this.formatDateForUI(task.createdAt),
      doneDate: this.formatDateForUI(task.doneAt),
      cancelledDate: this.formatDateForUI(task.cancelledAt),
      recurrence: this.frequencyToRRule(task.frequency),
      recurrenceRule: this.frequencyToRRule(task.frequency) || '',
      dependsOn: task.blockedBy || task.dependsOn || [],
      id: task.id,
      path: task.path || '',
    };
  }

  /**
   * Generate a unique task ID
   */
  private static generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }
}
