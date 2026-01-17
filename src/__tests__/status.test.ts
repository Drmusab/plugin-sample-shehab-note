import { describe, it, expect } from 'vitest';
import { Status, StatusType } from '@/core/models/Status';

describe('Status', () => {
  describe('StatusType enum', () => {
    it('should have all required status types', () => {
      expect(StatusType.TODO).toBe('TODO');
      expect(StatusType.IN_PROGRESS).toBe('IN_PROGRESS');
      expect(StatusType.DONE).toBe('DONE');
      expect(StatusType.CANCELLED).toBe('CANCELLED');
      expect(StatusType.NON_TASK).toBe('NON_TASK');
      expect(StatusType.EMPTY).toBe('EMPTY');
    });
  });

  describe('Static instances', () => {
    it('should have TODO status', () => {
      expect(Status.TODO.symbol).toBe(' ');
      expect(Status.TODO.name).toBe('Todo');
      expect(Status.TODO.nextStatusSymbol).toBe('x');
      expect(Status.TODO.type).toBe(StatusType.TODO);
    });

    it('should have DONE status', () => {
      expect(Status.DONE.symbol).toBe('x');
      expect(Status.DONE.name).toBe('Done');
      expect(Status.DONE.nextStatusSymbol).toBe(' ');
      expect(Status.DONE.type).toBe(StatusType.DONE);
    });

    it('should have IN_PROGRESS status', () => {
      expect(Status.IN_PROGRESS.symbol).toBe('/');
      expect(Status.IN_PROGRESS.name).toBe('In Progress');
      expect(Status.IN_PROGRESS.nextStatusSymbol).toBe('x');
      expect(Status.IN_PROGRESS.type).toBe(StatusType.IN_PROGRESS);
    });

    it('should have CANCELLED status', () => {
      expect(Status.CANCELLED.symbol).toBe('-');
      expect(Status.CANCELLED.name).toBe('Cancelled');
      expect(Status.CANCELLED.nextStatusSymbol).toBe(' ');
      expect(Status.CANCELLED.type).toBe(StatusType.CANCELLED);
    });
  });

  describe('getTypeForUnknownSymbol', () => {
    it('should return DONE for x', () => {
      expect(Status.getTypeForUnknownSymbol('x')).toBe(StatusType.DONE);
    });

    it('should return DONE for X', () => {
      expect(Status.getTypeForUnknownSymbol('X')).toBe(StatusType.DONE);
    });

    it('should return IN_PROGRESS for /', () => {
      expect(Status.getTypeForUnknownSymbol('/')).toBe(StatusType.IN_PROGRESS);
    });

    it('should return CANCELLED for -', () => {
      expect(Status.getTypeForUnknownSymbol('-')).toBe(StatusType.CANCELLED);
    });

    it('should return TODO for space', () => {
      expect(Status.getTypeForUnknownSymbol(' ')).toBe(StatusType.TODO);
    });

    it('should return TODO for unknown symbols', () => {
      expect(Status.getTypeForUnknownSymbol('?')).toBe(StatusType.TODO);
      expect(Status.getTypeForUnknownSymbol('*')).toBe(StatusType.TODO);
      expect(Status.getTypeForUnknownSymbol('>')).toBe(StatusType.TODO);
    });
  });

  describe('isCompleted', () => {
    it('should return true for DONE status', () => {
      expect(Status.DONE.isCompleted()).toBe(true);
    });

    it('should return true for CANCELLED status', () => {
      expect(Status.CANCELLED.isCompleted()).toBe(true);
    });

    it('should return false for TODO status', () => {
      expect(Status.TODO.isCompleted()).toBe(false);
    });

    it('should return false for IN_PROGRESS status', () => {
      expect(Status.IN_PROGRESS.isCompleted()).toBe(false);
    });
  });

  describe('constructor', () => {
    it('should create custom status', () => {
      const customStatus = new Status({
        symbol: '>',
        name: 'Forwarded',
        nextStatusSymbol: 'x',
        type: StatusType.TODO,
      });

      expect(customStatus.symbol).toBe('>');
      expect(customStatus.name).toBe('Forwarded');
      expect(customStatus.nextStatusSymbol).toBe('x');
      expect(customStatus.type).toBe(StatusType.TODO);
    });
  });
});
