import type { Task } from '@/core/models/Task';
import { Status, StatusType } from '@/core/models/Status';
import { StatusRegistry } from '@/core/models/StatusRegistry';
import { EMOJI_SIGNIFIERS, getPriorityFromEmoji, type TaskFormat } from '@/utils/signifiers';

export interface ParsedTaskLine {
  task: Partial<Task> | null;
  isValid: boolean;
  isTask: boolean;
  error?: string;
  /** Fields that were not recognized - preserved for lossless serialization */
  unknownFields: string[];
  /** Original line for reference */
  originalLine: string;
  /** Status symbol from checkbox */
  statusSymbol: string;
  /** Description text (without metadata) */
  description: string;
}

export class TaskLineParser {
  private format: TaskFormat;
  private registry: StatusRegistry;

  constructor(format: TaskFormat = 'emoji') {
    this.format = format;
    this.registry = StatusRegistry.getInstance();
  }

  /**
   * Parse a task line into a Task object
   */
  parse(line: string): ParsedTaskLine {
    const originalLine = line;
    const unknownFields: string[] = [];

    // Check if line is a task (checkbox pattern)
    const checkboxMatch = line.match(/^(\s*)-\s*\[(.)\]\s*(.*)$/);
    if (!checkboxMatch) {
      return {
        task: null,
        isValid: false,
        isTask: false,
        unknownFields: [],
        originalLine,
        statusSymbol: '',
        description: '',
      };
    }

    const indent = checkboxMatch[1];
    const statusSymbol = checkboxMatch[2];
    let content = checkboxMatch[3];

    const status = this.registry.get(statusSymbol);
    const task: Partial<Task> = {
      enabled: status.type === StatusType.TODO || status.type === StatusType.IN_PROGRESS,
      status: this.mapStatusType(status.type),
    };

    // Extract metadata based on format
    if (this.format === 'emoji') {
      const result = this.parseEmojiFormat(content);
      Object.assign(task, result.metadata);
      content = result.description;
      unknownFields.push(...result.unknownFields);
    } else {
      const result = this.parseTextFormat(content);
      Object.assign(task, result.metadata);
      content = result.description;
      unknownFields.push(...result.unknownFields);
    }

    task.name = content.trim();

    return {
      task,
      isValid: true,
      isTask: true,
      unknownFields,
      originalLine,
      statusSymbol,
      description: content.trim(),
    };
  }

  private mapStatusType(type: StatusType): 'todo' | 'done' | 'cancelled' | undefined {
    switch (type) {
      case StatusType.TODO:
      case StatusType.IN_PROGRESS:
        return 'todo';
      case StatusType.DONE:
        return 'done';
      case StatusType.CANCELLED:
        return 'cancelled';
      default:
        return undefined;
    }
  }

  private parseEmojiFormat(content: string): { 
    metadata: Partial<Task>; 
    description: string; 
    unknownFields: string[];
  } {
    const metadata: Partial<Task> = {};
    const unknownFields: string[] = [];
    let description = content;

    // Due date: 📅 YYYY-MM-DD
    const dueMatch = content.match(new RegExp(`${EMOJI_SIGNIFIERS.due}\\s*(\\d{4}-\\d{2}-\\d{2})`));
    if (dueMatch) {
      metadata.dueAt = new Date(dueMatch[1]).toISOString();
      description = description.replace(dueMatch[0], '');
    }

    // Scheduled date: ⏳ YYYY-MM-DD
    const scheduledMatch = content.match(new RegExp(`${EMOJI_SIGNIFIERS.scheduled}\\s*(\\d{4}-\\d{2}-\\d{2})`));
    if (scheduledMatch) {
      metadata.scheduledAt = new Date(scheduledMatch[1]).toISOString();
      description = description.replace(scheduledMatch[0], '');
    }

    // Start date: 🛫 YYYY-MM-DD
    const startMatch = content.match(new RegExp(`${EMOJI_SIGNIFIERS.start}\\s*(\\d{4}-\\d{2}-\\d{2})`));
    if (startMatch) {
      metadata.startAt = new Date(startMatch[1]).toISOString();
      description = description.replace(startMatch[0], '');
    }

    // Created date: ➕ YYYY-MM-DD
    const createdMatch = content.match(new RegExp(`${EMOJI_SIGNIFIERS.created}\\s*(\\d{4}-\\d{2}-\\d{2})`));
    if (createdMatch) {
      metadata.createdAt = new Date(createdMatch[1]).toISOString();
      description = description.replace(createdMatch[0], '');
    }

    // Done date: ✅ YYYY-MM-DD
    const doneMatch = content.match(new RegExp(`${EMOJI_SIGNIFIERS.done}\\s*(\\d{4}-\\d{2}-\\d{2})`));
    if (doneMatch) {
      metadata.lastCompletedAt = new Date(doneMatch[1]).toISOString();
      description = description.replace(doneMatch[0], '');
    }

    // Cancelled date: ❌ YYYY-MM-DD
    const cancelledMatch = content.match(new RegExp(`${EMOJI_SIGNIFIERS.cancelled}\\s*(\\d{4}-\\d{2}-\\d{2})`));
    if (cancelledMatch) {
      metadata.cancelledAt = new Date(cancelledMatch[1]).toISOString();
      description = description.replace(cancelledMatch[0], '');
    }

    // Recurrence: 🔁 <rule>
    // Match until we hit another emoji signifier or tag
    const allEmojis = [
      EMOJI_SIGNIFIERS.due,
      EMOJI_SIGNIFIERS.scheduled,
      EMOJI_SIGNIFIERS.start,
      EMOJI_SIGNIFIERS.created,
      EMOJI_SIGNIFIERS.done,
      EMOJI_SIGNIFIERS.cancelled,
      EMOJI_SIGNIFIERS.id,
      EMOJI_SIGNIFIERS.dependsOn,
      EMOJI_SIGNIFIERS.onCompletion,
      ...Object.values(EMOJI_SIGNIFIERS.priority),
    ];
    const emojiPattern = allEmojis.map(e => e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const recurrenceMatch = content.match(new RegExp(`${EMOJI_SIGNIFIERS.recurrence}\\s*([^${emojiPattern}#]+)`));
    if (recurrenceMatch) {
      metadata.recurrenceText = recurrenceMatch[1].trim();
      description = description.replace(recurrenceMatch[0], '');
    }

    // Priority
    for (const [name, emoji] of Object.entries(EMOJI_SIGNIFIERS.priority)) {
      if (content.includes(emoji)) {
        metadata.priority = name as Task['priority'];
        description = description.replace(emoji, '');
        break;
      }
    }

    // ID: 🆔 <id>
    const idMatch = content.match(new RegExp(`${EMOJI_SIGNIFIERS.id}\\s*(\\S+)`));
    if (idMatch) {
      metadata.id = idMatch[1];
      description = description.replace(idMatch[0], '');
    }

    // DependsOn: ⛔ <id1>,<id2>
    const dependsMatch = content.match(new RegExp(`${EMOJI_SIGNIFIERS.dependsOn}\\s*([\\w,_-]+)`));
    if (dependsMatch) {
      metadata.dependsOn = dependsMatch[1].split(',').map(s => s.trim());
      description = description.replace(dependsMatch[0], '');
    }

    // Tags: #tag
    const tagMatches = content.match(/#[\w\/-]+/g);
    if (tagMatches) {
      metadata.tags = tagMatches;
      // Remove tags from description
      for (const tag of tagMatches) {
        description = description.replace(tag, '');
      }
    }

    return { metadata, description: description.trim(), unknownFields };
  }

  private parseTextFormat(content: string): { 
    metadata: Partial<Task>; 
    description: string; 
    unknownFields: string[];
  } {
    // Similar to emoji format but for [field:: value] syntax
    const metadata: Partial<Task> = {};
    const unknownFields: string[] = [];
    let description = content;

    // Extract [key:: value] patterns
    const fieldPattern = /\[(\w+)::\s*([^\]]+)\]/g;
    let match;
    
    while ((match = fieldPattern.exec(content)) !== null) {
      const key = match[1].toLowerCase();
      const value = match[2].trim();
      
      switch (key) {
        case 'due':
          metadata.dueAt = new Date(value).toISOString();
          break;
        case 'scheduled':
          metadata.scheduledAt = new Date(value).toISOString();
          break;
        case 'start':
          metadata.startAt = new Date(value).toISOString();
          break;
        case 'created':
          metadata.createdAt = new Date(value).toISOString();
          break;
        case 'done':
          metadata.lastCompletedAt = new Date(value).toISOString();
          break;
        case 'cancelled':
          metadata.cancelledAt = new Date(value).toISOString();
          break;
        case 'repeat':
          metadata.recurrenceText = value;
          break;
        case 'priority':
          metadata.priority = value as Task['priority'];
          break;
        case 'id':
          metadata.id = value;
          break;
        case 'dependson':
          metadata.dependsOn = value.split(',').map(s => s.trim());
          break;
        default:
          unknownFields.push(match[0]);
      }
      
      description = description.replace(match[0], '');
    }

    // Tags
    const tagMatches = content.match(/#[\w\/-]+/g);
    if (tagMatches) {
      metadata.tags = tagMatches;
      // Remove tags from description
      for (const tag of tagMatches) {
        description = description.replace(tag, '');
      }
    }

    return { metadata, description: description.trim(), unknownFields };
  }
}
