import { Grouper } from './GrouperBase';
import type { Task } from '@/core/models/Task';
import { StatusRegistry } from '@/core/models/StatusRegistry';

export class StatusTypeGrouper extends Grouper {
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
    const registry = StatusRegistry.getInstance();
    const statusSymbol = task.statusSymbol || ' ';
    const status = registry.get(statusSymbol);
    return status.type;
  }
}

export class StatusNameGrouper extends Grouper {
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
    const registry = StatusRegistry.getInstance();
    const statusSymbol = task.statusSymbol || ' ';
    const status = registry.get(statusSymbol);
    return status.name;
  }
}
