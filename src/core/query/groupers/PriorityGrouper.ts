import { Grouper } from './GrouperBase';
import type { Task } from '@/core/models/Task';

export class PriorityGrouper extends Grouper {
  getGroupKey(task: Task): string {
    const priority = task.priority || 'normal';
    // Capitalize first letter for display
    return priority.charAt(0).toUpperCase() + priority.slice(1);
  }
}
