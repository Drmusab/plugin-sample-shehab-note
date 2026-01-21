import { Filter } from './FilterBase';
import type { Task } from '@/core/models/Task';

// Type for priorities as defined in Task model
export type Priority = 'low' | 'normal' | 'high' | 'urgent';

// Type for spec-defined priority levels (for query language)
export type PriorityLevel = 'lowest' | 'low' | 'none' | 'normal' | 'medium' | 'high' | 'highest' | 'urgent';

// Priority weight mapping
const PRIORITY_WEIGHTS: Record<PriorityLevel, number> = {
  'lowest': 0,
  'low': 1,
  'none': 2,
  'normal': 2,
  'medium': 2,
  'high': 3,
  'highest': 4,
  'urgent': 4,
};

// Map Task priority to PriorityLevel
function mapToPriorityLevel(p: Priority | undefined): PriorityLevel {
  switch (p) {
    case 'low':
      return 'low';
    case 'normal':
      return 'normal';
    case 'high':
      return 'high';
    case 'urgent':
      return 'urgent';
    default:
      return 'normal';
  }
}

export class PriorityFilter extends Filter {
  constructor(
    private operator: 'is' | 'above' | 'below',
    private level: PriorityLevel
  ) {
    super();
  }

  matches(task: Task): boolean {
    const taskPriority = mapToPriorityLevel(task.priority);
    const taskWeight = PRIORITY_WEIGHTS[taskPriority];
    const targetWeight = PRIORITY_WEIGHTS[this.level];

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
}
