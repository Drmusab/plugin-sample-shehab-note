import { Filter } from './FilterBase';
import type { Task } from '@/core/models/Task';

export class RecurrenceFilter extends Filter {
  constructor(private negate = false) {
    super();
  }

  matches(task: Task): boolean {
    // A task is recurring if it has a frequency defined
    const isRecurring = task.frequency && task.frequency.type !== 'once';
    return this.negate ? !isRecurring : !!isRecurring;
  }
}
