import type { Task } from '@/core/models/Task';

export abstract class Grouper {
  abstract getGroupKey(task: Task): string;

  /**
   * Default implementation of group() method
   * Subclasses can override for custom behavior
   */
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
}
