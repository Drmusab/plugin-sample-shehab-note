import { describe, it, expect, beforeEach } from 'vitest';
import { DescriptionFilter } from '@/core/query/filters/DescriptionFilter';
import { PriorityFilter } from '@/core/query/filters/PriorityFilter';
import type { Task } from '@/core/models/Task';

// Helper to create a basic task
function createTestTask(name: string, overrides?: Partial<Task>): Task {
  const now = new Date().toISOString();
  return {
    id: 'test-' + Math.random(),
    name,
    dueAt: now,
    frequency: { type: 'daily', interval: 1 },
    enabled: true,
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

describe('DescriptionFilter', () => {
  it('should match tasks with description containing pattern', () => {
    const filter = new DescriptionFilter('includes', 'meeting');
    const task = createTestTask('Team meeting notes');
    expect(filter.matches(task)).toBe(true);
  });

  it('should not match tasks without pattern', () => {
    const filter = new DescriptionFilter('includes', 'meeting');
    const task = createTestTask('Buy groceries');
    expect(filter.matches(task)).toBe(false);
  });

  it('should be case insensitive', () => {
    const filter = new DescriptionFilter('includes', 'MEETING');
    const task = createTestTask('team meeting notes');
    expect(filter.matches(task)).toBe(true);
  });

  it('should handle regex patterns', () => {
    const filter = new DescriptionFilter('regex', 'urgent|asap');
    const task1 = createTestTask('URGENT: Fix bug');
    const task2 = createTestTask('Please do this ASAP');
    const task3 = createTestTask('Normal task');
    
    expect(filter.matches(task1)).toBe(true);
    expect(filter.matches(task2)).toBe(true);
    expect(filter.matches(task3)).toBe(false);
  });

  it('should handle invalid regex gracefully', () => {
    const filter = new DescriptionFilter('regex', '[invalid(regex');
    const task = createTestTask('Test task');
    expect(filter.matches(task)).toBe(false);
  });

  it('should support "does not include" operator', () => {
    const filter = new DescriptionFilter('does not include', 'meeting');
    const task1 = createTestTask('Team meeting');
    const task2 = createTestTask('Buy groceries');
    
    expect(filter.matches(task1)).toBe(false);
    expect(filter.matches(task2)).toBe(true);
  });

  it('should search in description field if present', () => {
    const filter = new DescriptionFilter('includes', 'important');
    const task = createTestTask('Short title', { 
      description: 'This is an important task with details' 
    });
    expect(filter.matches(task)).toBe(true);
  });

  it('should handle tasks with no description', () => {
    const filter = new DescriptionFilter('includes', 'test');
    const task = createTestTask('', { description: undefined });
    expect(filter.matches(task)).toBe(false);
  });
});

describe('PriorityFilter', () => {
  it('should filter by exact priority', () => {
    const filter = new PriorityFilter('is', 'high');
    const highTask = createTestTask('Test', { priority: 'high' });
    const lowTask = createTestTask('Test', { priority: 'low' });
    
    expect(filter.matches(highTask)).toBe(true);
    expect(filter.matches(lowTask)).toBe(false);
  });

  it('should filter priorities above threshold', () => {
    const filter = new PriorityFilter('above', 'normal');
    const highTask = createTestTask('Test', { priority: 'high' });
    const normalTask = createTestTask('Test', { priority: 'normal' });
    const lowTask = createTestTask('Test', { priority: 'low' });
    
    expect(filter.matches(highTask)).toBe(true);
    expect(filter.matches(normalTask)).toBe(false);
    expect(filter.matches(lowTask)).toBe(false);
  });

  it('should filter priorities below threshold', () => {
    const filter = new PriorityFilter('below', 'normal');
    const highTask = createTestTask('Test', { priority: 'high' });
    const normalTask = createTestTask('Test', { priority: 'normal' });
    const lowTask = createTestTask('Test', { priority: 'low' });
    
    expect(filter.matches(highTask)).toBe(false);
    expect(filter.matches(normalTask)).toBe(false);
    expect(filter.matches(lowTask)).toBe(true);
  });

  it('should handle all priority levels correctly', () => {
    const lowestFilter = new PriorityFilter('is', 'lowest');
    const lowFilter = new PriorityFilter('is', 'low');
    const normalFilter = new PriorityFilter('is', 'normal');
    const mediumFilter = new PriorityFilter('is', 'medium');
    const highFilter = new PriorityFilter('is', 'high');
    const highestFilter = new PriorityFilter('is', 'highest');
    
    const lowestTask = createTestTask('Test', { priority: 'lowest' });
    const lowTask = createTestTask('Test', { priority: 'low' });
    const normalTask = createTestTask('Test', { priority: 'normal' });
    const mediumTask = createTestTask('Test', { priority: 'medium' });
    const highTask = createTestTask('Test', { priority: 'high' });
    const highestTask = createTestTask('Test', { priority: 'highest' });
    
    expect(lowestFilter.matches(lowestTask)).toBe(true);
    expect(lowFilter.matches(lowTask)).toBe(true);
    expect(normalFilter.matches(normalTask)).toBe(true);
    expect(mediumFilter.matches(mediumTask)).toBe(true);
    expect(highFilter.matches(highTask)).toBe(true);
    expect(highestFilter.matches(highestTask)).toBe(true);
  });

  it('should handle tasks with no priority (defaults to normal)', () => {
    const filter = new PriorityFilter('is', 'normal');
    const task = createTestTask('Test', { priority: undefined });
    expect(filter.matches(task)).toBe(true);
  });

  it('should correctly compare highest above high', () => {
    const filter = new PriorityFilter('above', 'high');
    const highestTask = createTestTask('Test', { priority: 'highest' });
    expect(filter.matches(highestTask)).toBe(true);
  });
});
