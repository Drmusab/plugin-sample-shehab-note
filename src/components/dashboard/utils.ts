/**
 * Date utility functions for task date comparisons
 */

/**
 * Normalize a date to midnight (00:00:00) for date-only comparisons
 */
function normalizeDate(date: Date): Date {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

/**
 * Check if a date is today
 */
export function isToday(dueDate: string | null): boolean {
  if (!dueDate) return false;
  const date = normalizeDate(new Date(dueDate));
  const today = normalizeDate(new Date());
  return date.getTime() === today.getTime();
}

/**
 * Check if a date is in the future (after today)
 */
export function isUpcoming(dueDate: string | null): boolean {
  if (!dueDate) return false;
  const date = normalizeDate(new Date(dueDate));
  const today = normalizeDate(new Date());
  return date > today;
}

/**
 * Check if a date is overdue (before today)
 */
export function isOverdue(dueDate: string | null): boolean {
  if (!dueDate) return false;
  const date = normalizeDate(new Date(dueDate));
  const today = normalizeDate(new Date());
  return date < today;
}

/**
 * Format a due date to human-readable format
 */
export function formatDueDate(dueDate: string | null): string {
  if (!dueDate) return '';
  
  const date = normalizeDate(new Date(dueDate));
  const today = normalizeDate(new Date());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  if (date.getTime() === today.getTime()) {
    return 'Today';
  } else if (date.getTime() === tomorrow.getTime()) {
    return 'Tomorrow';
  } else if (date < today) {
    return 'Overdue';
  }
  
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
