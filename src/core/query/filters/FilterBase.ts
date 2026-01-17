import type { Task } from '@/core/models/Task';

/**
 * Base class for all filters
 */
export abstract class Filter {
  abstract matches(task: Task): boolean;
}
