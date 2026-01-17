import { Filter } from './FilterBase';
import type { Task } from '@/core/models/Task';

export class PathFilter extends Filter {
  constructor(private pattern: string, private negate = false) {
    super();
  }

  matches(task: Task): boolean {
    // @ts-ignore - path field may not exist yet in Task interface
    const path = task.path || '';
    const result = path.toLowerCase().includes(this.pattern.toLowerCase());
    return this.negate ? !result : result;
  }
}
