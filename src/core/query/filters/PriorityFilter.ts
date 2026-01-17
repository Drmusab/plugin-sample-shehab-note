import { Filter } from './FilterBase';
import type { Task } from '@/core/models/Task';

// Type for priorities as defined in Task model
export type Priority = 'low' | 'normal' | 'high' | 'urgent';

// Type for spec-defined priority levels (for query language)
export type PriorityLevel = 'lowest' | 'low' | 'normal' | 'medium' | 'high' | 'highest';

export class PriorityFilter extends Filter {
  constructor(
    private operator: 'is' | 'above' | 'below',
    private level: PriorityLevel
  ) {
    super();
  }

  matches(task: Task): boolean {
    const taskPriority = task.priority || 'normal';
    const taskWeight = this.getPriorityWeight(this.mapToPriority(taskPriority));
    const targetWeight = this.getPriorityWeight(this.level);

    switch (this.operator) {
      case 'is':
        return taskWeight === targetWeight;
      case 'above':
        return taskWeight > targetWeight;
      case 'below':
        return taskWeight < targetWeight;
      default:
        return false;
    }
  }

  private mapToPriority(p: Priority): PriorityLevel {
    // Map Task priority to PriorityLevel
    switch (p) {
      case 'low':
        return 'low';
      case 'normal':
        return 'normal';
      case 'high':
        return 'high';
      case 'urgent':
        return 'highest';
      default:
        return 'normal';
    }
  }

  private getPriorityWeight(priority: PriorityLevel): number {
    switch (priority) {
      case 'lowest':
        return 0;
      case 'low':
        return 1;
      case 'medium':
      case 'normal':
        return 2;
      case 'high':
        return 3;
      case 'highest':
        return 4;
      default:
        return 2;
    }
  }
}
