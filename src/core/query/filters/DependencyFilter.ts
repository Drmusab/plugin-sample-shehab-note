import { Filter } from './FilterBase';
import type { Task } from '@/core/models/Task';

/**
 * Simple dependency graph for checking task blocking relationships
 */
export interface DependencyGraph {
  isBlocked(taskId: string): boolean;
  isBlocking(taskId: string): boolean;
}

export class IsBlockedFilter extends Filter {
  constructor(private dependencyGraph: DependencyGraph | null, private negate = false) {
    super();
  }

  matches(task: Task): boolean {
    if (!this.dependencyGraph) {
      // If no dependency graph, check blockedBy field
      const isBlocked = task.blockedBy && task.blockedBy.length > 0;
      return this.negate ? !isBlocked : !!isBlocked;
    }
    
    const result = this.dependencyGraph.isBlocked(task.id);
    return this.negate ? !result : result;
  }
}

export class IsBlockingFilter extends Filter {
  constructor(private dependencyGraph: DependencyGraph | null, private negate = false) {
    super();
  }

  matches(task: Task): boolean {
    if (!this.dependencyGraph) {
      // If no dependency graph, check dependsOn field (tasks that depend on this one)
      // This would require a reverse lookup, so we'll return false for now
      return this.negate;
    }
    
    const result = this.dependencyGraph.isBlocking(task.id);
    return this.negate ? !result : result;
  }
}
