import { describe, it, expect } from 'vitest';
import { calculateUrgencyScore, calculateUrgencyWithBreakdown } from '@/core/urgency/UrgencyScoreCalculator';
import type { Task } from '@/core/models/Task';
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

describe('UrgencyScoreCalculator - Enhanced Formula', () => {
  const now = new Date('2024-01-15T10:00:00Z');

  describe('Scheduled date contribution', () => {
    it('should add 7.5 points when scheduled today', () => {
      const task = createTestTask({
        dueAt: new Date('2024-01-20T10:00:00Z').toISOString(),
        scheduledAt: new Date('2024-01-15T10:00:00Z').toISOString(),
        priority: 'normal'
      });

      const result = calculateUrgencyWithBreakdown(task, { now });
      expect(result.breakdown.scheduledContribution).toBe(7.5);
    });

    it('should add 7.5 points when scheduled in the past', () => {
      const task = createTestTask({
        dueAt: new Date('2024-01-20T10:00:00Z').toISOString(),
        scheduledAt: new Date('2024-01-10T10:00:00Z').toISOString(),
        priority: 'normal'
      });

      const result = calculateUrgencyWithBreakdown(task, { now });
      expect(result.breakdown.scheduledContribution).toBe(7.5);
    });

    it('should decrease points as scheduled date gets further away', () => {
      const task1 = createTestTask({
        dueAt: new Date('2024-01-20T10:00:00Z').toISOString(),
        scheduledAt: new Date('2024-01-16T10:00:00Z').toISOString(), // 1 day away
        priority: 'normal'
      });

      const task2 = createTestTask({
        dueAt: new Date('2024-01-20T10:00:00Z').toISOString(),
        scheduledAt: new Date('2024-01-18T10:00:00Z').toISOString(), // 3 days away
        priority: 'normal'
      });

      const result1 = calculateUrgencyWithBreakdown(task1, { now });
      const result2 = calculateUrgencyWithBreakdown(task2, { now });

      expect(result1.breakdown.scheduledContribution).toBeGreaterThan(result2.breakdown.scheduledContribution);
    });

    it('should add 0 points when scheduled more than 7 days away', () => {
      const task = createTestTask({
        dueAt: new Date('2024-01-30T10:00:00Z').toISOString(),
        scheduledAt: new Date('2024-01-25T10:00:00Z').toISOString(), // 10 days away
        priority: 'normal'
      });

      const result = calculateUrgencyWithBreakdown(task, { now });
      expect(result.breakdown.scheduledContribution).toBe(0);
    });

    it('should add 0 points when no scheduled date', () => {
      const task = createTestTask({
        dueAt: new Date('2024-01-20T10:00:00Z').toISOString(),
        priority: 'normal'
      });

      const result = calculateUrgencyWithBreakdown(task, { now });
      expect(result.breakdown.scheduledContribution).toBe(0);
    });
  });

  describe('Start date contribution', () => {
    it('should add 5 points when can start now', () => {
      const task = createTestTask({
        dueAt: new Date('2024-01-20T10:00:00Z').toISOString(),
        startAt: new Date('2024-01-15T10:00:00Z').toISOString(),
        priority: 'normal'
      });

      const result = calculateUrgencyWithBreakdown(task, { now });
      expect(result.breakdown.startContribution).toBe(5);
    });

    it('should add 5 points when start date is in the past', () => {
      const task = createTestTask({
        dueAt: new Date('2024-01-20T10:00:00Z').toISOString(),
        startAt: new Date('2024-01-10T10:00:00Z').toISOString(),
        priority: 'normal'
      });

      const result = calculateUrgencyWithBreakdown(task, { now });
      expect(result.breakdown.startContribution).toBe(5);
    });

    it('should add 0 points when start date is in the future', () => {
      const task = createTestTask({
        dueAt: new Date('2024-01-25T10:00:00Z').toISOString(),
        startAt: new Date('2024-01-20T10:00:00Z').toISOString(),
        priority: 'normal'
      });

      const result = calculateUrgencyWithBreakdown(task, { now });
      expect(result.breakdown.startContribution).toBe(0);
    });

    it('should add 0 points when no start date', () => {
      const task = createTestTask({
        dueAt: new Date('2024-01-20T10:00:00Z').toISOString(),
        priority: 'normal'
      });

      const result = calculateUrgencyWithBreakdown(task, { now });
      expect(result.breakdown.startContribution).toBe(0);
    });
  });

  describe('Combined scoring', () => {
    it('should combine priority, due, scheduled, and start contributions', () => {
      const task = createTestTask({
        dueAt: new Date('2024-01-16T10:00:00Z').toISOString(), // 1 day away
        scheduledAt: new Date('2024-01-15T10:00:00Z').toISOString(), // today
        startAt: new Date('2024-01-15T10:00:00Z').toISOString(), // can start now
        priority: 'high'
      });

      const result = calculateUrgencyWithBreakdown(task, { now });
      
      // Should have contributions from all sources
      expect(result.breakdown.priorityContribution).toBeGreaterThan(0);
      expect(result.breakdown.dueDateContribution).toBeGreaterThan(0);
      expect(result.breakdown.scheduledContribution).toBe(7.5);
      expect(result.breakdown.startContribution).toBe(5);
      
      // Total score should be capped by maxUrgency (200 by default)
      const uncappedTotal = 
        result.breakdown.priorityContribution +
        result.breakdown.dueDateContribution +
        result.breakdown.overdueContribution +
        result.breakdown.scheduledContribution +
        result.breakdown.startContribution;
      
      // Score should either be the total or capped at maxUrgency
      expect(result.score).toBeLessThanOrEqual(200); // maxUrgency default
      expect(result.score).toBeGreaterThan(0);
    });

    it('should handle task with only scheduled date (no due date)', () => {
      const task = createTestTask({
        dueAt: undefined as any,
        scheduledAt: new Date('2024-01-15T10:00:00Z').toISOString(),
        priority: 'normal'
      });

      const result = calculateUrgencyWithBreakdown(task, { now });
      expect(result.breakdown.scheduledContribution).toBe(7.5);
    });

    it('should prioritize overdue tasks with high urgency', () => {
      const overdueTask = createTestTask({
        dueAt: new Date('2024-01-10T10:00:00Z').toISOString(), // 5 days overdue
        scheduledAt: new Date('2024-01-10T10:00:00Z').toISOString(),
        startAt: new Date('2024-01-10T10:00:00Z').toISOString(),
        priority: 'high'
      });

      const notOverdueTask = createTestTask({
        dueAt: new Date('2024-01-20T10:00:00Z').toISOString(), // 5 days away
        scheduledAt: new Date('2024-01-15T10:00:00Z').toISOString(),
        startAt: new Date('2024-01-15T10:00:00Z').toISOString(),
        priority: 'high'
      });

      const overdueResult = calculateUrgencyScore(overdueTask, { now });
      const notOverdueResult = calculateUrgencyScore(notOverdueTask, { now });

      expect(overdueResult).toBeGreaterThan(notOverdueResult);
    });
  });

  describe('Inactive tasks', () => {
    it('should return 0 urgency for done tasks', () => {
      const task = createTestTask({
        status: 'done',
        dueAt: new Date('2024-01-16T10:00:00Z').toISOString(),
        scheduledAt: new Date('2024-01-15T10:00:00Z').toISOString(),
        startAt: new Date('2024-01-15T10:00:00Z').toISOString(),
        priority: 'highest'
      });

      const result = calculateUrgencyWithBreakdown(task, { now });
      expect(result.score).toBe(0);
      expect(result.breakdown.scheduledContribution).toBe(0);
      expect(result.breakdown.startContribution).toBe(0);
    });

    it('should return 0 urgency for cancelled tasks', () => {
      const task = createTestTask({
        status: 'cancelled',
        dueAt: new Date('2024-01-16T10:00:00Z').toISOString(),
        priority: 'highest'
      });

      const result = calculateUrgencyScore(task, { now });
      expect(result).toBe(0);
    });
  });
});
