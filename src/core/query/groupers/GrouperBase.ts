import type { Task } from '@/core/models/Task';

export abstract class Grouper {
  abstract group(tasks: Task[]): Map<string, Task[]>;
  abstract getGroupKey(task: Task): string;
}
