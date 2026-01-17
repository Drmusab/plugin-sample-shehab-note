import { Filter } from './FilterBase';
import type { Task } from '@/core/models/Task';

export class PathFilter extends Filter {
  constructor(private pattern: string, private negate = false) {
    super();
  }

  matches(task: Task): boolean {
    const path = task.path || '';
    const result = path.toLowerCase().includes(this.pattern.toLowerCase());
    return this.negate ? !result : result;
  }
}
