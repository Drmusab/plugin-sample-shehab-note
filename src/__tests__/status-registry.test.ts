import { describe, it, expect, beforeEach } from 'vitest';
import { StatusRegistry } from '@/core/models/StatusRegistry';
import { Status, StatusType } from '@/core/models/Status';

describe('StatusRegistry', () => {
  let registry: StatusRegistry;

  beforeEach(() => {
    registry = StatusRegistry.getInstance();
    registry.reset(); // Reset to defaults for each test
  });

  describe('singleton pattern', () => {
    it('should return same instance', () => {
      const registry1 = StatusRegistry.getInstance();
      const registry2 = StatusRegistry.getInstance();
      expect(registry1).toBe(registry2);
    });
  });

  describe('default statuses', () => {
    it('should have TODO status', () => {
      const status = registry.get(' ');
      expect(status.symbol).toBe(' ');
      expect(status.type).toBe(StatusType.TODO);
    });

    it('should have DONE status', () => {
      const status = registry.get('x');
      expect(status.symbol).toBe('x');
      expect(status.type).toBe(StatusType.DONE);
    });

    it('should have IN_PROGRESS status', () => {
      const status = registry.get('/');
      expect(status.symbol).toBe('/');
      expect(status.type).toBe(StatusType.IN_PROGRESS);
    });

    it('should have CANCELLED status', () => {
      const status = registry.get('-');
      expect(status.symbol).toBe('-');
      expect(status.type).toBe(StatusType.CANCELLED);
    });
  });

  describe('add and get', () => {
    it('should add custom status', () => {
      const customStatus = new Status({
        symbol: '>',
        name: 'Forwarded',
        nextStatusSymbol: 'x',
        type: StatusType.TODO,
      });

      registry.add(customStatus);
      const retrieved = registry.get('>');
      expect(retrieved.symbol).toBe('>');
      expect(retrieved.name).toBe('Forwarded');
    });

    it('should override existing status', () => {
      const customTodo = new Status({
        symbol: ' ',
        name: 'Custom Todo',
        nextStatusSymbol: '/',
        type: StatusType.TODO,
      });

      registry.add(customTodo);
      const retrieved = registry.get(' ');
      expect(retrieved.name).toBe('Custom Todo');
      expect(retrieved.nextStatusSymbol).toBe('/');
    });
  });

  describe('get with unknown symbol', () => {
    it('should return unknown status for unregistered symbol', () => {
      const status = registry.get('?');
      expect(status.symbol).toBe('?');
      expect(status.name).toBe('Unknown');
      expect(status.type).toBe(StatusType.TODO); // Default for unknown
    });

    it('should infer DONE type for X', () => {
      const status = registry.get('X');
      expect(status.type).toBe(StatusType.DONE);
    });

    it('should infer IN_PROGRESS type for /', () => {
      const status = registry.get('/');
      expect(status.type).toBe(StatusType.IN_PROGRESS);
    });
  });

  describe('getNextStatus', () => {
    it('should toggle TODO to DONE', () => {
      const todo = registry.get(' ');
      const next = registry.getNextStatus(todo);
      expect(next.symbol).toBe('x');
      expect(next.type).toBe(StatusType.DONE);
    });

    it('should toggle DONE to TODO', () => {
      const done = registry.get('x');
      const next = registry.getNextStatus(done);
      expect(next.symbol).toBe(' ');
      expect(next.type).toBe(StatusType.TODO);
    });

    it('should toggle IN_PROGRESS to DONE', () => {
      const inProgress = registry.get('/');
      const next = registry.getNextStatus(inProgress);
      expect(next.symbol).toBe('x');
      expect(next.type).toBe(StatusType.DONE);
    });

    it('should support custom toggle cycle', () => {
      const customStatus = new Status({
        symbol: '>',
        name: 'Forwarded',
        nextStatusSymbol: '/',
        type: StatusType.TODO,
      });

      registry.add(customStatus);
      const next = registry.getNextStatus(customStatus);
      expect(next.symbol).toBe('/');
      expect(next.type).toBe(StatusType.IN_PROGRESS);
    });
  });

  describe('getAllStatuses', () => {
    it('should return all registered statuses', () => {
      const statuses = registry.getAllStatuses();
      expect(statuses.length).toBe(4); // TODO, IN_PROGRESS, DONE, CANCELLED

      const symbols = statuses.map(s => s.symbol);
      expect(symbols).toContain(' ');
      expect(symbols).toContain('x');
      expect(symbols).toContain('/');
      expect(symbols).toContain('-');
    });

    it('should include custom statuses', () => {
      const customStatus = new Status({
        symbol: '>',
        name: 'Forwarded',
        nextStatusSymbol: 'x',
        type: StatusType.TODO,
      });

      registry.add(customStatus);
      const statuses = registry.getAllStatuses();
      expect(statuses.length).toBe(5);
      expect(statuses.some(s => s.symbol === '>')).toBe(true);
    });
  });

  describe('reset', () => {
    it('should reset to default statuses', () => {
      const customStatus = new Status({
        symbol: '>',
        name: 'Forwarded',
        nextStatusSymbol: 'x',
        type: StatusType.TODO,
      });

      registry.add(customStatus);
      expect(registry.getAllStatuses().length).toBe(5);

      registry.reset();
      expect(registry.getAllStatuses().length).toBe(4);
      expect(registry.getAllStatuses().some(s => s.symbol === '>')).toBe(false);
    });
  });
});
