import { Grouper } from './GrouperBase';
import type { Task } from '@/core/models/Task';
import { StatusRegistry } from '@/core/models/StatusRegistry';

export class StatusTypeGrouper extends Grouper {
  getGroupKey(task: Task): string {
    const registry = StatusRegistry.getInstance();
    const statusSymbol = task.statusSymbol || ' ';
    const status = registry.get(statusSymbol);
    return status.type;
  }
}

export class StatusNameGrouper extends Grouper {
  getGroupKey(task: Task): string {
    const registry = StatusRegistry.getInstance();
    const statusSymbol = task.statusSymbol || ' ';
    const status = registry.get(statusSymbol);
    return status.name;
  }
}
