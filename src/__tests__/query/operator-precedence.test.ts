import { describe, it, expect } from 'vitest';
import { QueryParser } from '@/core/query/QueryParser';

describe('QueryParser - Operator Precedence and Grouping', () => {
  describe('Operator Precedence (NOT > AND > OR)', () => {
    it('should parse "priority is high OR priority is medium AND not done" with correct precedence', () => {
      const parser = new QueryParser();
      const ast = parser.parse('priority is high OR priority is medium AND not done');
      
      // With precedence: AND > OR, so this parses as:
      // priority is high OR (priority is medium AND not done)
      expect(ast.filters).toHaveLength(1);
      expect(ast.filters[0].type).toBe('boolean');
      expect(ast.filters[0].operator).toBe('OR');
      
      // Left side: priority is high
      expect(ast.filters[0].left?.type).toBe('priority');
      expect(ast.filters[0].left?.value).toBe('high');
      
      // Right side: priority is medium AND not done
      expect(ast.filters[0].right?.type).toBe('boolean');
      expect(ast.filters[0].right?.operator).toBe('AND');
    });

    it('should parse "NOT done AND priority is high OR tag includes #work" with correct precedence', () => {
      const parser = new QueryParser();
      const ast = parser.parse('NOT done AND priority is high OR tag includes #work');
      
      // Precedence: NOT > AND > OR
      // So this parses as: (NOT done AND priority is high) OR tag includes #work
      expect(ast.filters).toHaveLength(1);
      expect(ast.filters[0].type).toBe('boolean');
      expect(ast.filters[0].operator).toBe('OR');
      
      // Left side should be: NOT done AND priority is high
      expect(ast.filters[0].left?.type).toBe('boolean');
      expect(ast.filters[0].left?.operator).toBe('AND');
      
      // Right side: tag includes #work
      expect(ast.filters[0].right?.type).toBe('tag');
    });

    it('should parse "priority is high AND priority is urgent OR priority is medium" with correct precedence', () => {
      const parser = new QueryParser();
      const ast = parser.parse('priority is high AND priority is urgent OR priority is medium');
      
      // Precedence: AND > OR
      // So this parses as: (priority is high AND priority is urgent) OR priority is medium
      expect(ast.filters).toHaveLength(1);
      expect(ast.filters[0].type).toBe('boolean');
      expect(ast.filters[0].operator).toBe('OR');
    });

    it('should parse "NOT done OR NOT is blocked AND priority is high" with correct precedence', () => {
      const parser = new QueryParser();
      const ast = parser.parse('NOT done OR NOT is blocked AND priority is high');
      
      // Precedence: NOT > AND > OR
      // So this parses as: (NOT done) OR ((NOT is blocked) AND priority is high)
      expect(ast.filters).toHaveLength(1);
      expect(ast.filters[0].type).toBe('boolean');
      expect(ast.filters[0].operator).toBe('OR');
      
      // Left side: NOT done (which is optimized to {type: 'done', value: false})
      expect(ast.filters[0].left?.type).toBe('done');
      expect(ast.filters[0].left?.value).toBe(false);
      
      // Right side: NOT is blocked AND priority is high
      expect(ast.filters[0].right?.type).toBe('boolean');
      expect(ast.filters[0].right?.operator).toBe('AND');
    });
  });

  describe('Parentheses for Explicit Grouping', () => {
    it('should parse "(priority is high OR priority is medium) AND not done" with parentheses', () => {
      const parser = new QueryParser();
      const ast = parser.parse('(priority is high OR priority is medium) AND not done');
      
      // Parentheses override precedence
      // This parses as: (priority is high OR priority is medium) AND not done
      expect(ast.filters).toHaveLength(1);
      expect(ast.filters[0].type).toBe('boolean');
      expect(ast.filters[0].operator).toBe('AND');
      
      // Left side should be OR expression
      expect(ast.filters[0].left?.type).toBe('boolean');
      expect(ast.filters[0].left?.operator).toBe('OR');
      
      // Right side: not done
      expect(ast.filters[0].right?.type).toBe('done');
      expect(ast.filters[0].right?.value).toBe(false);
    });

    it('should parse "priority is high AND (not done OR is blocked)" with parentheses', () => {
      const parser = new QueryParser();
      const ast = parser.parse('priority is high AND (not done OR is blocked)');
      
      expect(ast.filters).toHaveLength(1);
      expect(ast.filters[0].type).toBe('boolean');
      expect(ast.filters[0].operator).toBe('AND');
      
      // Left side: priority is high
      expect(ast.filters[0].left?.type).toBe('priority');
      
      // Right side should be OR expression
      expect(ast.filters[0].right?.type).toBe('boolean');
      expect(ast.filters[0].right?.operator).toBe('OR');
    });

    it('should parse nested parentheses "(priority is high AND not done) OR (is blocked AND tag includes #work)"', () => {
      const parser = new QueryParser();
      const ast = parser.parse('(priority is high AND not done) OR (is blocked AND tag includes #work)');
      
      expect(ast.filters).toHaveLength(1);
      expect(ast.filters[0].type).toBe('boolean');
      expect(ast.filters[0].operator).toBe('OR');
      
      // Both sides should be AND expressions
      expect(ast.filters[0].left?.type).toBe('boolean');
      expect(ast.filters[0].left?.operator).toBe('AND');
      
      expect(ast.filters[0].right?.type).toBe('boolean');
      expect(ast.filters[0].right?.operator).toBe('AND');
    });

    it('should parse "NOT (done OR blocked)" with parentheses after NOT', () => {
      const parser = new QueryParser();
      const ast = parser.parse('NOT (done OR is blocked)');
      
      expect(ast.filters).toHaveLength(1);
      expect(ast.filters[0].type).toBe('boolean');
      expect(ast.filters[0].operator).toBe('NOT');
      
      // Inner expression should be OR
      expect(ast.filters[0].inner?.type).toBe('boolean');
      expect(ast.filters[0].inner?.operator).toBe('OR');
    });

    it('should parse "(priority is high OR priority is medium) AND (not done OR is blocking)" with multiple parentheses', () => {
      const parser = new QueryParser();
      const ast = parser.parse('(priority is high OR priority is medium) AND (not done OR is blocking)');
      
      expect(ast.filters).toHaveLength(1);
      expect(ast.filters[0].type).toBe('boolean');
      expect(ast.filters[0].operator).toBe('AND');
      
      // Both sides should be OR expressions
      expect(ast.filters[0].left?.type).toBe('boolean');
      expect(ast.filters[0].left?.operator).toBe('OR');
      
      expect(ast.filters[0].right?.type).toBe('boolean');
      expect(ast.filters[0].right?.operator).toBe('OR');
    });
  });

  describe('Complex Expressions', () => {
    it('should parse "priority is high AND not done OR tag includes #work AND is blocked" with correct precedence', () => {
      const parser = new QueryParser();
      const ast = parser.parse('priority is high AND not done OR tag includes #work AND is blocked');
      
      // Precedence: AND > OR
      // So this parses as: (priority is high AND not done) OR (tag includes #work AND is blocked)
      expect(ast.filters).toHaveLength(1);
      expect(ast.filters[0].type).toBe('boolean');
      expect(ast.filters[0].operator).toBe('OR');
      
      // Both sides should be AND expressions
      expect(ast.filters[0].left?.type).toBe('boolean');
      expect(ast.filters[0].left?.operator).toBe('AND');
      
      expect(ast.filters[0].right?.type).toBe('boolean');
      expect(ast.filters[0].right?.operator).toBe('AND');
    });

    it('should parse "NOT (priority is high AND done) OR is blocked" with complex NOT expression', () => {
      const parser = new QueryParser();
      const ast = parser.parse('NOT (priority is high AND done) OR is blocked');
      
      // Precedence: NOT > AND > OR
      expect(ast.filters).toHaveLength(1);
      expect(ast.filters[0].type).toBe('boolean');
      expect(ast.filters[0].operator).toBe('OR');
      
      // Left side: NOT (priority is high AND done)
      expect(ast.filters[0].left?.type).toBe('boolean');
      expect(ast.filters[0].left?.operator).toBe('NOT');
      expect(ast.filters[0].left?.inner?.type).toBe('boolean');
      expect(ast.filters[0].left?.inner?.operator).toBe('AND');
      
      // Right side: is blocked
      expect(ast.filters[0].right?.type).toBe('dependency');
    });

    it('should handle deeply nested parentheses', () => {
      const parser = new QueryParser();
      const ast = parser.parse('((priority is high OR priority is medium) AND not done) OR (is blocked AND (tag includes #work OR tag includes #study))');
      
      expect(ast.filters).toHaveLength(1);
      expect(ast.filters[0].type).toBe('boolean');
      expect(ast.filters[0].operator).toBe('OR');
    });
  });

  describe('Backward Compatibility', () => {
    it('should still parse simple AND queries correctly', () => {
      const parser = new QueryParser();
      const ast = parser.parse('priority is high AND not done');
      
      expect(ast.filters).toHaveLength(1);
      expect(ast.filters[0].type).toBe('boolean');
      expect(ast.filters[0].operator).toBe('AND');
    });

    it('should still parse simple OR queries correctly', () => {
      const parser = new QueryParser();
      const ast = parser.parse('priority is high OR priority is urgent');
      
      expect(ast.filters).toHaveLength(1);
      expect(ast.filters[0].type).toBe('boolean');
      expect(ast.filters[0].operator).toBe('OR');
    });

    it('should still parse simple NOT queries correctly', () => {
      const parser = new QueryParser();
      const ast = parser.parse('NOT is blocked');
      
      expect(ast.filters).toHaveLength(1);
      expect(ast.filters[0].type).toBe('boolean');
      expect(ast.filters[0].operator).toBe('NOT');
    });
  });
});
