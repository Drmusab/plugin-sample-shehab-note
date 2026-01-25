import { Grouper } from './GrouperBase';
import type { Task } from '@/core/models/Task';

export class PriorityGrouper extends Grouper {
  getGroupKey(task: Task): string {
    return (task.priority || 'normal').toLowerCase();
  }
}
