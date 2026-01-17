import { describe, it, expect, beforeEach } from 'vitest';
import { TaskLineParser } from '@/core/parsers/TaskLineParser';
import { StatusRegistry } from '@/core/models/StatusRegistry';

describe('TaskLineParser', () => {
  let parser: TaskLineParser;

  beforeEach(() => {
    StatusRegistry.getInstance().reset();
  });

  describe('non-task lines', () => {
    it('should return isTask=false for regular text', () => {
      parser = new TaskLineParser('emoji');
      const result = parser.parse('This is just a regular line');
      expect(result.isTask).toBe(false);
      expect(result.isValid).toBe(false);
      expect(result.task).toBeNull();
    });

    it('should return isTask=false for headings', () => {
      parser = new TaskLineParser('emoji');
      const result = parser.parse('# Heading');
      expect(result.isTask).toBe(false);
    });

    it('should return isTask=false for incomplete checkbox', () => {
      parser = new TaskLineParser('emoji');
      const result = parser.parse('- [ incomplete');
      expect(result.isTask).toBe(false);
    });
  });

  describe('basic task parsing - emoji format', () => {
    beforeEach(() => {
      parser = new TaskLineParser('emoji');
    });

    it('should parse simple TODO task', () => {
      const result = parser.parse('- [ ] Buy milk');
      expect(result.isTask).toBe(true);
      expect(result.isValid).toBe(true);
      expect(result.task?.name).toBe('Buy milk');
      expect(result.task?.enabled).toBe(true);
      expect(result.task?.status).toBe('todo');
      expect(result.statusSymbol).toBe(' ');
    });

    it('should parse DONE task', () => {
      const result = parser.parse('- [x] Buy milk');
      expect(result.isTask).toBe(true);
      expect(result.task?.name).toBe('Buy milk');
      expect(result.task?.enabled).toBe(false);
      expect(result.task?.status).toBe('done');
      expect(result.statusSymbol).toBe('x');
    });

    it('should parse IN_PROGRESS task', () => {
      const result = parser.parse('- [/] Working on task');
      expect(result.isTask).toBe(true);
      expect(result.task?.name).toBe('Working on task');
      expect(result.task?.enabled).toBe(true);
      expect(result.task?.status).toBe('todo');
      expect(result.statusSymbol).toBe('/');
    });

    it('should parse CANCELLED task', () => {
      const result = parser.parse('- [-] Cancelled task');
      expect(result.isTask).toBe(true);
      expect(result.task?.name).toBe('Cancelled task');
      expect(result.task?.enabled).toBe(false);
      expect(result.task?.status).toBe('cancelled');
      expect(result.statusSymbol).toBe('-');
    });

    it('should handle indented tasks', () => {
      const result = parser.parse('  - [ ] Indented task');
      expect(result.isTask).toBe(true);
      expect(result.task?.name).toBe('Indented task');
    });
  });

  describe('date field parsing - emoji format', () => {
    beforeEach(() => {
      parser = new TaskLineParser('emoji');
    });

    it('should parse due date', () => {
      const result = parser.parse('- [ ] Task 📅 2024-01-15');
      expect(result.task?.name).toBe('Task');
      expect(result.task?.dueAt).toBeDefined();
      expect(new Date(result.task!.dueAt!).toISOString().split('T')[0]).toBe('2024-01-15');
    });

    it('should parse scheduled date', () => {
      const result = parser.parse('- [ ] Task ⏳ 2024-01-20');
      expect(result.task?.name).toBe('Task');
      expect(result.task?.scheduledAt).toBeDefined();
      expect(new Date(result.task!.scheduledAt!).toISOString().split('T')[0]).toBe('2024-01-20');
    });

    it('should parse start date', () => {
      const result = parser.parse('- [ ] Task 🛫 2024-01-10');
      expect(result.task?.name).toBe('Task');
      expect(result.task?.startAt).toBeDefined();
      expect(new Date(result.task!.startAt!).toISOString().split('T')[0]).toBe('2024-01-10');
    });

    it('should parse created date', () => {
      const result = parser.parse('- [ ] Task ➕ 2024-01-01');
      expect(result.task?.name).toBe('Task');
      expect(result.task?.createdAt).toBeDefined();
      expect(new Date(result.task!.createdAt!).toISOString().split('T')[0]).toBe('2024-01-01');
    });

    it('should parse done date', () => {
      const result = parser.parse('- [x] Task ✅ 2024-01-15');
      expect(result.task?.name).toBe('Task');
      expect(result.task?.lastCompletedAt).toBeDefined();
      expect(new Date(result.task!.lastCompletedAt!).toISOString().split('T')[0]).toBe('2024-01-15');
    });

    it('should parse cancelled date', () => {
      const result = parser.parse('- [-] Task ❌ 2024-01-15');
      expect(result.task?.name).toBe('Task');
      expect(result.task?.cancelledAt).toBeDefined();
      expect(new Date(result.task!.cancelledAt!).toISOString().split('T')[0]).toBe('2024-01-15');
    });

    it('should parse multiple dates', () => {
      const result = parser.parse('- [ ] Task 🛫 2024-01-10 📅 2024-01-15 ⏳ 2024-01-12');
      expect(result.task?.name).toBe('Task');
      expect(result.task?.startAt).toBeDefined();
      expect(result.task?.dueAt).toBeDefined();
      expect(result.task?.scheduledAt).toBeDefined();
    });
  });

  describe('priority parsing - emoji format', () => {
    beforeEach(() => {
      parser = new TaskLineParser('emoji');
    });

    it('should parse highest priority', () => {
      const result = parser.parse('- [ ] Task 🔺');
      expect(result.task?.priority).toBe('highest');
    });

    it('should parse high priority', () => {
      const result = parser.parse('- [ ] Task ⏫');
      expect(result.task?.priority).toBe('high');
    });

    it('should parse medium priority', () => {
      const result = parser.parse('- [ ] Task 🔼');
      expect(result.task?.priority).toBe('medium');
    });

    it('should parse low priority', () => {
      const result = parser.parse('- [ ] Task 🔽');
      expect(result.task?.priority).toBe('low');
    });

    it('should parse lowest priority', () => {
      const result = parser.parse('- [ ] Task ⏬');
      expect(result.task?.priority).toBe('lowest');
    });
  });

  describe('recurrence parsing - emoji format', () => {
    beforeEach(() => {
      parser = new TaskLineParser('emoji');
    });

    it('should parse recurrence rule', () => {
      const result = parser.parse('- [ ] Task 🔁 every day');
      expect(result.task?.recurrenceText).toBe('every day');
    });

    it('should parse recurrence with other metadata', () => {
      const result = parser.parse('- [ ] Task 🔁 every week 📅 2024-01-15');
      expect(result.task?.recurrenceText).toBe('every week');
      expect(result.task?.dueAt).toBeDefined();
    });
  });

  describe('ID and dependencies parsing - emoji format', () => {
    beforeEach(() => {
      parser = new TaskLineParser('emoji');
    });

    it('should parse task ID', () => {
      const result = parser.parse('- [ ] Task 🆔 task-123');
      expect(result.task?.id).toBe('task-123');
    });

    it('should parse dependsOn with single ID', () => {
      const result = parser.parse('- [ ] Task ⛔ task-1');
      expect(result.task?.dependsOn).toEqual(['task-1']);
    });

    it('should parse dependsOn with multiple IDs', () => {
      const result = parser.parse('- [ ] Task ⛔ task-1,task-2,task-3');
      expect(result.task?.dependsOn).toEqual(['task-1', 'task-2', 'task-3']);
    });
  });

  describe('tags parsing - emoji format', () => {
    beforeEach(() => {
      parser = new TaskLineParser('emoji');
    });

    it('should parse single tag', () => {
      const result = parser.parse('- [ ] Task #work');
      expect(result.task?.tags).toContain('#work');
    });

    it('should parse multiple tags', () => {
      const result = parser.parse('- [ ] Task #work #urgent #review');
      expect(result.task?.tags).toHaveLength(3);
      expect(result.task?.tags).toContain('#work');
      expect(result.task?.tags).toContain('#urgent');
      expect(result.task?.tags).toContain('#review');
    });

    it('should parse tags with slashes', () => {
      const result = parser.parse('- [ ] Task #work/project');
      expect(result.task?.tags).toContain('#work/project');
    });
  });

  describe('text format parsing', () => {
    beforeEach(() => {
      parser = new TaskLineParser('text');
    });

    it('should parse basic task', () => {
      const result = parser.parse('- [ ] Buy milk');
      expect(result.isTask).toBe(true);
      expect(result.task?.name).toBe('Buy milk');
    });

    it('should parse due date', () => {
      const result = parser.parse('- [ ] Task [due:: 2024-01-15]');
      expect(result.task?.dueAt).toBeDefined();
      expect(new Date(result.task!.dueAt!).toISOString().split('T')[0]).toBe('2024-01-15');
    });

    it('should parse scheduled date', () => {
      const result = parser.parse('- [ ] Task [scheduled:: 2024-01-20]');
      expect(result.task?.scheduledAt).toBeDefined();
    });

    it('should parse start date', () => {
      const result = parser.parse('- [ ] Task [start:: 2024-01-10]');
      expect(result.task?.startAt).toBeDefined();
    });

    it('should parse priority', () => {
      const result = parser.parse('- [ ] Task [priority:: high]');
      expect(result.task?.priority).toBe('high');
    });

    it('should parse recurrence', () => {
      const result = parser.parse('- [ ] Task [repeat:: every day]');
      expect(result.task?.recurrenceText).toBe('every day');
    });

    it('should parse ID', () => {
      const result = parser.parse('- [ ] Task [id:: task-123]');
      expect(result.task?.id).toBe('task-123');
    });

    it('should parse dependsOn', () => {
      const result = parser.parse('- [ ] Task [dependsOn:: task-1,task-2]');
      expect(result.task?.dependsOn).toEqual(['task-1', 'task-2']);
    });

    it('should parse multiple fields', () => {
      const result = parser.parse('- [ ] Task [priority:: high] [due:: 2024-01-15] [repeat:: every week]');
      expect(result.task?.priority).toBe('high');
      expect(result.task?.dueAt).toBeDefined();
      expect(result.task?.recurrenceText).toBe('every week');
    });
  });

  describe('unknown fields preservation', () => {
    beforeEach(() => {
      parser = new TaskLineParser('text');
    });

    it('should preserve unknown text fields', () => {
      const result = parser.parse('- [ ] Task [custom:: value] [unknown:: data]');
      expect(result.unknownFields).toHaveLength(2);
      expect(result.unknownFields).toContain('[custom:: value]');
      expect(result.unknownFields).toContain('[unknown:: data]');
    });

    it('should parse known fields and preserve unknown ones', () => {
      const result = parser.parse('- [ ] Task [priority:: high] [custom:: value]');
      expect(result.task?.priority).toBe('high');
      expect(result.unknownFields).toContain('[custom:: value]');
    });
  });

  describe('complex task parsing', () => {
    beforeEach(() => {
      parser = new TaskLineParser('emoji');
    });

    it('should parse task with all metadata', () => {
      const line = '- [ ] Complete project report 🔺 🔁 every week 🆔 task-456 ⛔ task-123 📅 2024-01-15 #work #urgent';
      const result = parser.parse(line);
      
      expect(result.isTask).toBe(true);
      expect(result.task?.name).toBe('Complete project report');
      expect(result.task?.priority).toBe('highest');
      expect(result.task?.recurrenceText).toBe('every week');
      expect(result.task?.id).toBe('task-456');
      expect(result.task?.dependsOn).toEqual(['task-123']);
      expect(result.task?.dueAt).toBeDefined();
      expect(result.task?.tags).toContain('#work');
      expect(result.task?.tags).toContain('#urgent');
    });
  });

  describe('edge cases', () => {
    beforeEach(() => {
      parser = new TaskLineParser('emoji');
    });

    it('should handle tasks with extra whitespace', () => {
      const result = parser.parse('- [x]   Task with spaces   ');
      expect(result.task?.name).toBe('Task with spaces');
    });

    it('should handle empty task description', () => {
      const result = parser.parse('- [ ] ');
      expect(result.isTask).toBe(true);
      expect(result.task?.name).toBe('');
    });

    it('should preserve original line', () => {
      const line = '- [ ] Original task';
      const result = parser.parse(line);
      expect(result.originalLine).toBe(line);
    });
  });
});
