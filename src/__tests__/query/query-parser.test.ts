import { describe, it, expect } from 'vitest';
import { QueryParser } from '@/core/query/QueryParser';
import { QuerySyntaxError } from '@/core/query/QueryError';
import { StatusType } from '@/core/models/Status';

describe('QueryParser', () => {
  describe('Simple filters', () => {
    it('should parse "done" query', () => {
      const parser = new QueryParser();
      const ast = parser.parse('done');
      
      expect(ast.filters).toHaveLength(1);
      expect(ast.filters[0].type).toBe('done');
      expect(ast.filters[0].value).toBe(true);
    });

    it('should parse "not done" query', () => {
      const parser = new QueryParser();
      const ast = parser.parse('not done');
      
      expect(ast.filters).toHaveLength(1);
      expect(ast.filters[0].type).toBe('done');
      expect(ast.filters[0].value).toBe(false);
    });
  });

  describe('Status filters', () => {
    it('should parse status.type is TODO', () => {
      const parser = new QueryParser();
      const ast = parser.parse('status.type is TODO');
      
      expect(ast.filters).toHaveLength(1);
      expect(ast.filters[0].type).toBe('status');
      expect(ast.filters[0].operator).toBe('type-is');
      expect(ast.filters[0].value).toBe(StatusType.TODO);
    });

    it('should parse status.type is IN_PROGRESS', () => {
      const parser = new QueryParser();
      const ast = parser.parse('status.type is IN_PROGRESS');
      
      expect(ast.filters).toHaveLength(1);
      expect(ast.filters[0].value).toBe(StatusType.IN_PROGRESS);
    });

    it('should parse status.name includes waiting', () => {
      const parser = new QueryParser();
      const ast = parser.parse('status.name includes waiting');
      
      expect(ast.filters).toHaveLength(1);
      expect(ast.filters[0].type).toBe('status');
      expect(ast.filters[0].operator).toBe('name-includes');
      expect(ast.filters[0].value).toBe('waiting');
    });

    it('should parse status.symbol is x', () => {
      const parser = new QueryParser();
      const ast = parser.parse('status.symbol is x');
      
      expect(ast.filters).toHaveLength(1);
      expect(ast.filters[0].type).toBe('status');
      expect(ast.filters[0].operator).toBe('symbol-is');
      expect(ast.filters[0].value).toBe('x');
    });
  });

  describe('Date filters', () => {
    it('should parse "due before today"', () => {
      const parser = new QueryParser();
      const ast = parser.parse('due before today');
      
      expect(ast.filters).toHaveLength(1);
      expect(ast.filters[0].type).toBe('date');
      expect(ast.filters[0].operator).toBe('before');
      expect(ast.filters[0].value.field).toBe('due');
      expect(ast.filters[0].value.date).toBeInstanceOf(Date);
    });

    it('should parse "scheduled after tomorrow"', () => {
      const parser = new QueryParser();
      const ast = parser.parse('scheduled after tomorrow');
      
      expect(ast.filters).toHaveLength(1);
      expect(ast.filters[0].type).toBe('date');
      expect(ast.filters[0].operator).toBe('after');
      expect(ast.filters[0].value.field).toBe('scheduled');
    });

    it('should parse "due on 2025-01-20"', () => {
      const parser = new QueryParser();
      const ast = parser.parse('due on 2025-01-20');
      
      expect(ast.filters).toHaveLength(1);
      expect(ast.filters[0].type).toBe('date');
      expect(ast.filters[0].operator).toBe('on');
      expect(ast.filters[0].value.field).toBe('due');
    });

    it('should parse "has due date"', () => {
      const parser = new QueryParser();
      const ast = parser.parse('has due date');
      
      expect(ast.filters).toHaveLength(1);
      expect(ast.filters[0].type).toBe('date');
      expect(ast.filters[0].operator).toBe('has');
      expect(ast.filters[0].value.field).toBe('due');
      expect(ast.filters[0].negate).toBeUndefined();
    });

    it('should parse "no due date"', () => {
      const parser = new QueryParser();
      const ast = parser.parse('no due date');
      
      expect(ast.filters).toHaveLength(1);
      expect(ast.filters[0].type).toBe('date');
      expect(ast.filters[0].operator).toBe('has');
      expect(ast.filters[0].value.field).toBe('due');
      expect(ast.filters[0].negate).toBe(true);
    });

    it('should parse natural language dates', () => {
      const parser = new QueryParser();
      const ast = parser.parse('due before tomorrow');
      
      expect(ast.filters[0].value.date).toBeInstanceOf(Date);
    });

    it('should parse "between" operator with natural language dates', () => {
      const parser = new QueryParser();
      const ast = parser.parse('due between today and next Friday');
      
      expect(ast.filters).toHaveLength(1);
      expect(ast.filters[0].type).toBe('date');
      expect(ast.filters[0].operator).toBe('between');
      expect(ast.filters[0].value.field).toBe('due');
      expect(ast.filters[0].value.date).toBeInstanceOf(Date);
      expect(ast.filters[0].value.endDate).toBeInstanceOf(Date);
    });

    it('should parse "between" operator with ISO dates', () => {
      const parser = new QueryParser();
      const ast = parser.parse('scheduled between 2026-01-20 and 2026-01-30');
      
      expect(ast.filters).toHaveLength(1);
      expect(ast.filters[0].type).toBe('date');
      expect(ast.filters[0].operator).toBe('between');
      expect(ast.filters[0].value.field).toBe('scheduled');
      expect(ast.filters[0].value.date).toBeInstanceOf(Date);
      expect(ast.filters[0].value.endDate).toBeInstanceOf(Date);
    });

    it('should parse "in the next 7 days" using natural language', () => {
      const parser = new QueryParser();
      const ast = parser.parse('due before in 7 days');
      
      expect(ast.filters[0].value.date).toBeInstanceOf(Date);
    });

    it('should throw error for invalid date', () => {
      const parser = new QueryParser();
      
      expect(() => parser.parse('due before invalid-date')).toThrow(QuerySyntaxError);
    });
  });

  describe('Priority filters', () => {
    it('should parse "priority is high"', () => {
      const parser = new QueryParser();
      const ast = parser.parse('priority is high');
      
      expect(ast.filters).toHaveLength(1);
      expect(ast.filters[0].type).toBe('priority');
      expect(ast.filters[0].operator).toBe('is');
      expect(ast.filters[0].value).toBe('high');
    });

    it('should parse "priority above medium"', () => {
      const parser = new QueryParser();
      const ast = parser.parse('priority above medium');
      
      expect(ast.filters).toHaveLength(1);
      expect(ast.filters[0].operator).toBe('above');
      expect(ast.filters[0].value).toBe('medium');
    });

    it('should parse "priority below high"', () => {
      const parser = new QueryParser();
      const ast = parser.parse('priority below high');
      
      expect(ast.filters).toHaveLength(1);
      expect(ast.filters[0].operator).toBe('below');
      expect(ast.filters[0].value).toBe('high');
    });
  });

  describe('Tag filters', () => {
    it('should parse "tag includes #work"', () => {
      const parser = new QueryParser();
      const ast = parser.parse('tag includes #work');
      
      expect(ast.filters).toHaveLength(1);
      expect(ast.filters[0].type).toBe('tag');
      expect(ast.filters[0].operator).toBe('includes');
      expect(ast.filters[0].value).toBe('#work');
    });

    it('should parse "tag does not include #someday"', () => {
      const parser = new QueryParser();
      const ast = parser.parse('tag does not include #someday');
      
      expect(ast.filters).toHaveLength(1);
      expect(ast.filters[0].type).toBe('tag');
      expect(ast.filters[0].operator).toBe('includes');
      expect(ast.filters[0].value).toBe('#someday');
      expect(ast.filters[0].negate).toBe(true);
    });

    it('should parse "has tags"', () => {
      const parser = new QueryParser();
      const ast = parser.parse('has tags');
      
      expect(ast.filters).toHaveLength(1);
      expect(ast.filters[0].type).toBe('tag');
      expect(ast.filters[0].operator).toBe('has');
      expect(ast.filters[0].value).toBe(true);
    });

    it('should parse "no tags"', () => {
      const parser = new QueryParser();
      const ast = parser.parse('no tags');
      
      expect(ast.filters).toHaveLength(1);
      expect(ast.filters[0].type).toBe('tag');
      expect(ast.filters[0].operator).toBe('has');
      expect(ast.filters[0].value).toBe(false);
    });
  });

  describe('Path filters', () => {
    it('should parse "path includes daily/"', () => {
      const parser = new QueryParser();
      const ast = parser.parse('path includes daily/');
      
      expect(ast.filters).toHaveLength(1);
      expect(ast.filters[0].type).toBe('path');
      expect(ast.filters[0].operator).toBe('includes');
      expect(ast.filters[0].value).toBe('daily/');
    });

    it('should parse "path does not include archive/"', () => {
      const parser = new QueryParser();
      const ast = parser.parse('path does not include archive/');
      
      expect(ast.filters).toHaveLength(1);
      expect(ast.filters[0].negate).toBe(true);
    });
  });

  describe('Dependency filters', () => {
    it('should parse "is blocked"', () => {
      const parser = new QueryParser();
      const ast = parser.parse('is blocked');
      
      expect(ast.filters).toHaveLength(1);
      expect(ast.filters[0].type).toBe('dependency');
      expect(ast.filters[0].operator).toBe('is-blocked');
      expect(ast.filters[0].value).toBe(true);
    });

    it('should parse "is not blocked"', () => {
      const parser = new QueryParser();
      const ast = parser.parse('is not blocked');
      
      expect(ast.filters).toHaveLength(1);
      expect(ast.filters[0].value).toBe(false);
    });

    it('should parse "is blocking"', () => {
      const parser = new QueryParser();
      const ast = parser.parse('is blocking');
      
      expect(ast.filters).toHaveLength(1);
      expect(ast.filters[0].operator).toBe('is-blocking');
    });
  });

  describe('Recurrence filters', () => {
    it('should parse "is recurring"', () => {
      const parser = new QueryParser();
      const ast = parser.parse('is recurring');
      
      expect(ast.filters).toHaveLength(1);
      expect(ast.filters[0].type).toBe('recurrence');
      expect(ast.filters[0].value).toBe(true);
    });

    it('should parse "is not recurring"', () => {
      const parser = new QueryParser();
      const ast = parser.parse('is not recurring');
      
      expect(ast.filters).toHaveLength(1);
      expect(ast.filters[0].value).toBe(false);
    });
  });

  describe('Sort instructions', () => {
    it('should parse "sort by due"', () => {
      const parser = new QueryParser();
      const ast = parser.parse('sort by due');
      
      expect(ast.sort).toBeDefined();
      expect(ast.sort?.field).toBe('due');
      expect(ast.sort?.reverse).toBeFalsy();
    });

    it('should parse "sort by priority reverse"', () => {
      const parser = new QueryParser();
      const ast = parser.parse('sort by priority reverse');
      
      expect(ast.sort).toBeDefined();
      expect(ast.sort?.field).toBe('priority');
      expect(ast.sort?.reverse).toBe(true);
    });

    it('should throw error for invalid sort syntax', () => {
      const parser = new QueryParser();
      
      expect(() => parser.parse('sort by')).toThrow(QuerySyntaxError);
    });
  });

  describe('Group instructions', () => {
    it('should parse "group by status.type"', () => {
      const parser = new QueryParser();
      const ast = parser.parse('group by status.type');
      
      expect(ast.group).toBeDefined();
      expect(ast.group?.field).toBe('status.type');
    });

    it('should parse "group by due"', () => {
      const parser = new QueryParser();
      const ast = parser.parse('group by due');
      
      expect(ast.group?.field).toBe('due');
    });

    it('should throw error for invalid group syntax', () => {
      const parser = new QueryParser();
      
      expect(() => parser.parse('group by')).toThrow(QuerySyntaxError);
    });
  });

  describe('Limit instructions', () => {
    it('should parse "limit 10"', () => {
      const parser = new QueryParser();
      const ast = parser.parse('limit 10');
      
      expect(ast.limit).toBe(10);
    });

    it('should parse "limit to 25 tasks"', () => {
      const parser = new QueryParser();
      const ast = parser.parse('limit to 25 tasks');
      
      expect(ast.limit).toBe(25);
    });

    it('should throw error for invalid limit syntax', () => {
      const parser = new QueryParser();
      
      expect(() => parser.parse('limit abc')).toThrow(QuerySyntaxError);
    });
  });

  describe('Multi-line queries', () => {
    it('should parse multi-line query with filters, sort, and limit', () => {
      const parser = new QueryParser();
      const query = `not done
status.type is TODO
tag includes #urgent
sort by due
limit 10`;
      
      const ast = parser.parse(query);
      
      expect(ast.filters).toHaveLength(3);
      expect(ast.sort).toBeDefined();
      expect(ast.limit).toBe(10);
    });

    it('should parse complex query', () => {
      const parser = new QueryParser();
      const query = `not done
status.type is TODO
due before today
priority is high
sort by due reverse
group by priority
limit 20`;
      
      const ast = parser.parse(query);
      
      expect(ast.filters).toHaveLength(4);
      expect(ast.sort?.reverse).toBe(true);
      expect(ast.group).toBeDefined();
      expect(ast.limit).toBe(20);
    });
  });

  describe('Validation', () => {
    it('should validate correct query', () => {
      const parser = new QueryParser();
      const result = parser.validate('not done\nsort by due');
      
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should validate incorrect query', () => {
      const parser = new QueryParser();
      const result = parser.validate('invalid filter');
      
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Error handling', () => {
    it('should throw QuerySyntaxError with line and column info', () => {
      const parser = new QueryParser();
      
      try {
        parser.parse('invalid filter instruction');
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(QuerySyntaxError);
        if (error instanceof QuerySyntaxError) {
          expect(error.line).toBe(1);
          expect(error.column).toBe(1);
        }
      }
    });

    it('should provide helpful suggestions in error', () => {
      const parser = new QueryParser();
      
      try {
        parser.parse('unknown command');
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(QuerySyntaxError);
        if (error instanceof QuerySyntaxError) {
          expect(error.suggestion).toBeDefined();
        }
      }
    });
  });
});
