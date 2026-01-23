import { describe, it, expect, beforeEach } from 'vitest';
import { OnCompletionHandler } from '@/core/engine/OnCompletion';
import type { Task, OnCompletionAction } from '@/core/models/Task';
import type { Frequency } from '@/core/models/Frequency';

// Helper to create a minimal task
function createTestTask(overrides: Partial<Task> = {}): Task {
  const defaultFrequency: Frequency = {
    type: 'daily',
    interval: 1,
    rrule: 'FREQ=DAILY;INTERVAL=1'
  };

  return {
    id: 'test-task-1',
    name: 'Test Task',
    dueAt: new Date().toISOString(),
    frequency: defaultFrequency,
    enabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'todo',
    ...overrides
  };
}

describe('OnCompletionHandler - Custom Actions', () => {
  let handler: OnCompletionHandler;

  beforeEach(() => {
    handler = new OnCompletionHandler();
  });

  describe('Backward compatibility', () => {
    it('should handle legacy "keep" string action', async () => {
      const task = createTestTask();
      const result = await handler.execute(task, 'keep');
      
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should handle legacy "delete" string action without linkedBlockId', async () => {
      const task = createTestTask({ linkedBlockId: undefined });
      const result = await handler.execute(task, 'delete');
      
      expect(result.success).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings?.[0]).toContain('no linked block');
    });
  });

  describe('Keep action', () => {
    it('should execute keep action with object format', async () => {
      const task = createTestTask();
      const action: OnCompletionAction = { action: 'keep' };
      
      const result = await handler.execute(task, action);
      
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe('Archive action', () => {
    it('should fallback to keep when archive storage not configured', async () => {
      const task = createTestTask();
      const action: OnCompletionAction = { action: 'archive' };
      
      const result = await handler.execute(task, action);
      
      expect(result.success).toBe(true);
    });

    it('should archive task when archive storage is configured', async () => {
      const archiveStorage = {
        archive: async (task: Task) => {
          // Mock archive
        }
      };
      const handlerWithArchive = new OnCompletionHandler(undefined, archiveStorage);
      const task = createTestTask();
      const action: OnCompletionAction = { action: 'archive' };
      
      const result = await handlerWithArchive.execute(task, action);
      
      expect(result.success).toBe(true);
    });
  });

  describe('Custom transition action', () => {
    it('should transition task to custom status', async () => {
      const task = createTestTask({ status: 'todo' });
      const action: OnCompletionAction = {
        action: 'customTransition',
        nextStatus: 'cancelled'
      };
      
      const result = await handler.execute(task, action);
      
      expect(result.success).toBe(true);
      expect(result.updatedTask).toBeDefined();
      expect(result.updatedTask?.status).toBe('cancelled');
    });

    it('should fail when nextStatus is not specified', async () => {
      const task = createTestTask();
      const action: OnCompletionAction = {
        action: 'customTransition'
      };
      
      const result = await handler.execute(task, action);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('nextStatus');
    });

    it('should support custom status values', async () => {
      const task = createTestTask({ status: 'todo' });
      const action: OnCompletionAction = {
        action: 'customTransition',
        nextStatus: 'in-review'
      };
      
      const result = await handler.execute(task, action);
      
      expect(result.success).toBe(true);
      expect(result.updatedTask?.status).toBe('in-review');
    });

    it('should update task timestamp when transitioning', async () => {
      const task = createTestTask();
      const oldUpdatedAt = task.updatedAt;
      
      // Wait a bit to ensure timestamp changes
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const action: OnCompletionAction = {
        action: 'customTransition',
        nextStatus: 'done'
      };
      
      const result = await handler.execute(task, action);
      
      expect(result.success).toBe(true);
      expect(result.updatedTask?.updatedAt).not.toBe(oldUpdatedAt);
    });

    it('should preserve custom handler field for future extensibility', async () => {
      const task = createTestTask();
      const action: OnCompletionAction = {
        action: 'customTransition',
        nextStatus: 'done',
        customHandler: 'my-custom-handler'
      };
      
      const result = await handler.execute(task, action);
      
      expect(result.success).toBe(true);
    });
  });

  describe('Error handling', () => {
    it('should return error for unknown action', async () => {
      const task = createTestTask();
      const action: any = { action: 'invalid-action' };
      
      const result = await handler.execute(task, action);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown');
    });
  });
});
