import { Grouper } from './GrouperBase';
import type { Task } from '@/core/models/Task';

export class PriorityGrouper extends Grouper {
  group(tasks: Task[]): Map<string, Task[]> {
    const groups = new Map<string, Task[]>();
    
    for (const task of tasks) {
      const key = this.getGroupKey(task);
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(task);
    }
    
    return groups;
  }

  getGroupKey(task: Task): string {
    const priority = task.priority || 'normal';
    // Capitalize first letter for display
    return priority.charAt(0).toUpperCase() + priority.slice(1);
  }
}
