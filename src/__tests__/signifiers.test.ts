import { describe, it, expect } from 'vitest';
import { getPriorityEmoji, getPriorityFromEmoji, PRIORITY_ORDER, EMOJI_SIGNIFIERS, TEXT_SIGNIFIERS } from '@/utils/signifiers';

describe('signifiers', () => {
  describe('EMOJI_SIGNIFIERS', () => {
    it('should have all required emoji signifiers', () => {
      expect(EMOJI_SIGNIFIERS.due).toBe('📅');
      expect(EMOJI_SIGNIFIERS.scheduled).toBe('⏳');
      expect(EMOJI_SIGNIFIERS.start).toBe('🛫');
      expect(EMOJI_SIGNIFIERS.created).toBe('➕');
      expect(EMOJI_SIGNIFIERS.done).toBe('✅');
      expect(EMOJI_SIGNIFIERS.cancelled).toBe('❌');
      expect(EMOJI_SIGNIFIERS.recurrence).toBe('🔁');
      expect(EMOJI_SIGNIFIERS.onCompletion).toBe('🏁');
      expect(EMOJI_SIGNIFIERS.id).toBe('🆔');
      expect(EMOJI_SIGNIFIERS.dependsOn).toBe('⛔');
    });

    it('should have priority emojis', () => {
      expect(EMOJI_SIGNIFIERS.priority.highest).toBe('🔺');
      expect(EMOJI_SIGNIFIERS.priority.high).toBe('⏫');
      expect(EMOJI_SIGNIFIERS.priority.medium).toBe('🔼');
      expect(EMOJI_SIGNIFIERS.priority.low).toBe('🔽');
      expect(EMOJI_SIGNIFIERS.priority.lowest).toBe('⏬');
    });
  });

  describe('TEXT_SIGNIFIERS', () => {
    it('should have all required text signifiers', () => {
      expect(TEXT_SIGNIFIERS.due).toBe('[due::');
      expect(TEXT_SIGNIFIERS.scheduled).toBe('[scheduled::');
      expect(TEXT_SIGNIFIERS.start).toBe('[start::');
      expect(TEXT_SIGNIFIERS.created).toBe('[created::');
      expect(TEXT_SIGNIFIERS.done).toBe('[done::');
      expect(TEXT_SIGNIFIERS.cancelled).toBe('[cancelled::');
      expect(TEXT_SIGNIFIERS.recurrence).toBe('[repeat::');
      expect(TEXT_SIGNIFIERS.onCompletion).toBe('[onCompletion::');
      expect(TEXT_SIGNIFIERS.id).toBe('[id::');
      expect(TEXT_SIGNIFIERS.dependsOn).toBe('[dependsOn::');
      expect(TEXT_SIGNIFIERS.priority).toBe('[priority::');
    });
  });

  describe('PRIORITY_ORDER', () => {
    it('should have correct priority order', () => {
      expect(PRIORITY_ORDER.highest).toBe(1);
      expect(PRIORITY_ORDER.high).toBe(2);
      expect(PRIORITY_ORDER.medium).toBe(3);
      expect(PRIORITY_ORDER.normal).toBe(4);
      expect(PRIORITY_ORDER.low).toBe(5);
      expect(PRIORITY_ORDER.lowest).toBe(6);
    });

    it('should order priorities correctly', () => {
      expect(PRIORITY_ORDER.highest).toBeLessThan(PRIORITY_ORDER.high);
      expect(PRIORITY_ORDER.high).toBeLessThan(PRIORITY_ORDER.medium);
      expect(PRIORITY_ORDER.medium).toBeLessThan(PRIORITY_ORDER.normal);
      expect(PRIORITY_ORDER.normal).toBeLessThan(PRIORITY_ORDER.low);
      expect(PRIORITY_ORDER.low).toBeLessThan(PRIORITY_ORDER.lowest);
    });
  });

  describe('getPriorityEmoji', () => {
    it('should return correct emoji for each priority', () => {
      expect(getPriorityEmoji('highest')).toBe('🔺');
      expect(getPriorityEmoji('high')).toBe('⏫');
      expect(getPriorityEmoji('medium')).toBe('🔼');
      expect(getPriorityEmoji('low')).toBe('🔽');
      expect(getPriorityEmoji('lowest')).toBe('⏬');
    });

    it('should return undefined for unknown priority', () => {
      expect(getPriorityEmoji('unknown')).toBeUndefined();
      expect(getPriorityEmoji('normal')).toBeUndefined();
    });
  });

  describe('getPriorityFromEmoji', () => {
    it('should return correct priority for each emoji', () => {
      expect(getPriorityFromEmoji('🔺')).toBe('highest');
      expect(getPriorityFromEmoji('⏫')).toBe('high');
      expect(getPriorityFromEmoji('🔼')).toBe('medium');
      expect(getPriorityFromEmoji('🔽')).toBe('low');
      expect(getPriorityFromEmoji('⏬')).toBe('lowest');
    });

    it('should return undefined for unknown emoji', () => {
      expect(getPriorityFromEmoji('❓')).toBeUndefined();
      expect(getPriorityFromEmoji('📅')).toBeUndefined();
    });
  });

  describe('getPriorityEmoji and getPriorityFromEmoji roundtrip', () => {
    it('should roundtrip correctly', () => {
      const priorities = ['highest', 'high', 'medium', 'low', 'lowest'];
      
      for (const priority of priorities) {
        const emoji = getPriorityEmoji(priority);
        expect(emoji).toBeDefined();
        const reversePriority = getPriorityFromEmoji(emoji!);
        expect(reversePriority).toBe(priority);
      }
    });
  });
});
