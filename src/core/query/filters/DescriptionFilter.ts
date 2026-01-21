import { Filter } from './FilterBase';
import type { Task } from '@/core/models/Task';

export class DescriptionFilter extends Filter {
  constructor(
    private operator: 'includes' | 'does not include' | 'regex',
    private pattern: string,
    private negate = false
  ) {
    super();
  }

  matches(task: Task): boolean {
    // Search in both name and description
    const taskName = task.name || '';
    const taskDescription = task.description || '';
    const combinedText = `${taskName} ${taskDescription}`.trim();
    
    let result: boolean;
    
    if (this.operator === 'regex') {
      try {
        const regex = new RegExp(this.pattern, 'i');
        result = regex.test(combinedText);
      } catch {
        result = false;
      }
    } else {
      result = combinedText.toLowerCase().includes(this.pattern.toLowerCase());
    }
    
    // Handle negation properly: 'does not include' XOR negate
    return (this.operator === 'does not include') !== this.negate ? !result : result;
  }
}
