import type { Task } from '@/core/models/Task';
import { EMOJI_SIGNIFIERS, getPriorityEmoji, type TaskFormat } from '@/utils/signifiers';
import { DateParser } from './DateParser';

export interface SerializeOptions {
  format: TaskFormat;
  /** Include created date automatically */
  includeCreated?: boolean;
  /** Unknown fields to preserve */
  unknownFields?: string[];
}

export class TaskLineSerializer {
  /**
   * Serialize a Task to a markdown line
   */
  static serialize(task: Task, statusSymbol: string, options: SerializeOptions): string {
    const parts: string[] = [];
    
    // Description
    parts.push(task.name);

    if (options.format === 'emoji') {
      // Priority
      if (task.priority && task.priority !== 'normal') {
        const emoji = getPriorityEmoji(task.priority);
        if (emoji) parts.push(emoji);
      }

      // Recurrence
      if (task.recurrenceText) {
        parts.push(`${EMOJI_SIGNIFIERS.recurrence} ${task.recurrenceText}`);
      }

      // ID
      if (task.id) {
        parts.push(`${EMOJI_SIGNIFIERS.id} ${task.id}`);
      }

      // DependsOn
      if (task.dependsOn && task.dependsOn.length > 0) {
        parts.push(`${EMOJI_SIGNIFIERS.dependsOn} ${task.dependsOn.join(',')}`);
      }

      // Created
      if (task.createdAt && options.includeCreated) {
        parts.push(`${EMOJI_SIGNIFIERS.created} ${DateParser.toISODateString(new Date(task.createdAt))}`);
      }

      // Start
      if (task.startAt) {
        parts.push(`${EMOJI_SIGNIFIERS.start} ${DateParser.toISODateString(new Date(task.startAt))}`);
      }

      // Scheduled
      if (task.scheduledAt) {
        parts.push(`${EMOJI_SIGNIFIERS.scheduled} ${DateParser.toISODateString(new Date(task.scheduledAt))}`);
      }

      // Due
      if (task.dueAt) {
        parts.push(`${EMOJI_SIGNIFIERS.due} ${DateParser.toISODateString(new Date(task.dueAt))}`);
      }

      // Done
      if (task.lastCompletedAt && task.status === 'done') {
        parts.push(`${EMOJI_SIGNIFIERS.done} ${DateParser.toISODateString(new Date(task.lastCompletedAt))}`);
      }

      // Cancelled
      if (task.cancelledAt && task.status === 'cancelled') {
        parts.push(`${EMOJI_SIGNIFIERS.cancelled} ${DateParser.toISODateString(new Date(task.cancelledAt))}`);
      }
    } else {
      // Text format [field:: value]
      if (task.priority && task.priority !== 'normal') {
        parts.push(`[priority:: ${task.priority}]`);
      }
      if (task.recurrenceText) {
        parts.push(`[repeat:: ${task.recurrenceText}]`);
      }
      if (task.id) {
        parts.push(`[id:: ${task.id}]`);
      }
      if (task.dependsOn && task.dependsOn.length > 0) {
        parts.push(`[dependsOn:: ${task.dependsOn.join(',')}]`);
      }
      if (task.createdAt && options.includeCreated) {
        parts.push(`[created:: ${DateParser.toISODateString(new Date(task.createdAt))}]`);
      }
      if (task.startAt) {
        parts.push(`[start:: ${DateParser.toISODateString(new Date(task.startAt))}]`);
      }
      if (task.scheduledAt) {
        parts.push(`[scheduled:: ${DateParser.toISODateString(new Date(task.scheduledAt))}]`);
      }
      if (task.dueAt) {
        parts.push(`[due:: ${DateParser.toISODateString(new Date(task.dueAt))}]`);
      }
      if (task.lastCompletedAt && task.status === 'done') {
        parts.push(`[done:: ${DateParser.toISODateString(new Date(task.lastCompletedAt))}]`);
      }
      if (task.cancelledAt && task.status === 'cancelled') {
        parts.push(`[cancelled:: ${DateParser.toISODateString(new Date(task.cancelledAt))}]`);
      }
    }

    // Preserve unknown fields
    if (options.unknownFields) {
      parts.push(...options.unknownFields);
    }

    return `- [${statusSymbol}] ${parts.join(' ')}`;
  }
}
