import { describe, it, expect } from 'vitest';
import { QueryParser } from '@/core/query/QueryParser';

describe('QueryParser - Operator Aliases', () => {
  describe('&& alias for AND', () => {
    it('should parse priority high && not done', () => {
      const parser = new QueryParser();
      const ast = parser.parse('priority is high && not done');
      
      expect(ast.filters).toHaveLength(1);
      expect(ast.filters[0].type).toBe('boolean');
      expect(ast.filters[0].operator).toBe('AND');
      expect(ast.filters[0].left?.type).toBe('priority');
      expect(ast.filters[0].right?.type).toBe('done');
    });

    it('should parse tag includes #work && priority is high', () => {
      const parser = new QueryParser();
      const ast = parser.parse('tag includes #work && priority is high');
      
      expect(ast.filters).toHaveLength(1);
      expect(ast.filters[0].type).toBe('boolean');
      expect(ast.filters[0].operator).toBe('AND');
    });
  });

  describe('|| alias for OR', () => {
    it('should parse priority is high || priority is urgent', () => {
      const parser = new QueryParser();
      const ast = parser.parse('priority is high || priority is urgent');
      
      expect(ast.filters).toHaveLength(1);
      expect(ast.filters[0].type).toBe('boolean');
      expect(ast.filters[0].operator).toBe('OR');
      expect(ast.filters[0].left?.type).toBe('priority');
      expect(ast.filters[0].right?.type).toBe('priority');
    });

    it('should parse tag includes #work || tag includes #study', () => {
      const parser = new QueryParser();
      const ast = parser.parse('tag includes #work || tag includes #study');
      
      expect(ast.filters).toHaveLength(1);
      expect(ast.filters[0].type).toBe('boolean');
      expect(ast.filters[0].operator).toBe('OR');
    });
  });

  describe('! alias for NOT', () => {
    it('should parse !done', () => {
      const parser = new QueryParser();
      const ast = parser.parse('!done');
      
      expect(ast.filters).toHaveLength(1);
      expect(ast.filters[0].type).toBe('done');
      expect(ast.filters[0].value).toBe(false);
    });

    it('should parse priority is high && !done', () => {
      const parser = new QueryParser();
      const ast = parser.parse('priority is high && !done');
      
      expect(ast.filters).toHaveLength(1);
      expect(ast.filters[0].type).toBe('boolean');
      expect(ast.filters[0].operator).toBe('AND');
      expect(ast.filters[0].left?.type).toBe('priority');
      expect(ast.filters[0].right?.type).toBe('done');
      expect(ast.filters[0].right?.value).toBe(false);
    });
  });

  describe('- prefix for negation', () => {
    it('should parse -done', () => {
      const parser = new QueryParser();
      const ast = parser.parse('-done');
      
      expect(ast.filters).toHaveLength(1);
      expect(ast.filters[0].type).toBe('done');
      expect(ast.filters[0].value).toBe(false);
    });

    it('should parse priority is high && -done', () => {
      const parser = new QueryParser();
      const ast = parser.parse('priority is high && -done');
      
      expect(ast.filters).toHaveLength(1);
      expect(ast.filters[0].type).toBe('boolean');
      expect(ast.filters[0].operator).toBe('AND');
      expect(ast.filters[0].right?.type).toBe('done');
      expect(ast.filters[0].right?.value).toBe(false);
    });
  });

  describe('except alias for AND NOT', () => {
    it('should parse priority is high except done', () => {
      const parser = new QueryParser();
      const ast = parser.parse('priority is high except done');
      
      // "except" expands to "AND NOT", so this becomes: priority is high AND NOT done
      // "NOT done" is optimized to {type: 'done', value: false}
      expect(ast.filters).toHaveLength(1);
      expect(ast.filters[0].type).toBe('boolean');
      expect(ast.filters[0].operator).toBe('AND');
      expect(ast.filters[0].left?.type).toBe('priority');
      expect(ast.filters[0].right?.type).toBe('done');
      expect(ast.filters[0].right?.value).toBe(false);
    });

    it('should parse tag includes #urgent except tag includes #personal', () => {
      const parser = new QueryParser();
      const ast = parser.parse('tag includes #urgent except tag includes #personal');
      
      expect(ast.filters).toHaveLength(1);
      expect(ast.filters[0].type).toBe('boolean');
      expect(ast.filters[0].operator).toBe('AND');
      expect(ast.filters[0].left?.type).toBe('tag');
      expect(ast.filters[0].right?.type).toBe('boolean');
      expect(ast.filters[0].right?.operator).toBe('NOT');
    });
  });

  describe('Mixed aliases', () => {
    it('should parse priority is high && !done || priority is urgent', () => {
      const parser = new QueryParser();
      const ast = parser.parse('priority is high && !done || priority is urgent');
      
      // With proper precedence: AND has higher precedence than OR
      // So this parses as: (priority is high AND NOT done) OR priority is urgent
      expect(ast.filters).toHaveLength(1);
      expect(ast.filters[0].type).toBe('boolean');
      expect(ast.filters[0].operator).toBe('OR');
    });

    it('should parse -done && priority is high || tag includes #urgent', () => {
      const parser = new QueryParser();
      const ast = parser.parse('-done && priority is high || tag includes #urgent');
      
      // With proper precedence: AND has higher precedence than OR
      // So this parses as: (NOT done AND priority is high) OR tag includes #urgent
      expect(ast.filters).toHaveLength(1);
      expect(ast.filters[0].type).toBe('boolean');
      expect(ast.filters[0].operator).toBe('OR');
    });

    it('should parse priority is high except done && tag includes #work', () => {
      const parser = new QueryParser();
      const ast = parser.parse('priority is high except done && tag includes #work');
      
      // 'except' expands to 'AND NOT', so this becomes:
      // priority is high AND NOT done AND tag includes #work
      expect(ast.filters).toHaveLength(1);
      expect(ast.filters[0].type).toBe('boolean');
    });
  });

  describe('Backward compatibility', () => {
    it('should still parse canonical AND operator', () => {
      const parser = new QueryParser();
      const ast = parser.parse('priority is high AND not done');
      
      expect(ast.filters).toHaveLength(1);
      expect(ast.filters[0].type).toBe('boolean');
      expect(ast.filters[0].operator).toBe('AND');
    });

    it('should still parse canonical OR operator', () => {
      const parser = new QueryParser();
      const ast = parser.parse('priority is high OR priority is urgent');
      
      expect(ast.filters).toHaveLength(1);
      expect(ast.filters[0].type).toBe('boolean');
      expect(ast.filters[0].operator).toBe('OR');
    });

    it('should still parse canonical NOT operator', () => {
      const parser = new QueryParser();
      const ast = parser.parse('not done');
      
      expect(ast.filters).toHaveLength(1);
      expect(ast.filters[0].type).toBe('done');
      expect(ast.filters[0].value).toBe(false);
    });
  });
});
