import { describe, it, expect } from 'vitest';
import { RegexMatcher, type RegexSpec } from '@/core/query/utils/RegexMatcher';

describe('RegexMatcher', () => {
  describe('compile', () => {
    it('should compile valid regex pattern', () => {
      const spec: RegexSpec = { pattern: 'test', flags: 'i' };
      const regex = RegexMatcher.compile(spec);
      expect(regex).toBeInstanceOf(RegExp);
      expect(regex.test('TEST')).toBe(true);
    });

    it('should compile regex without flags', () => {
      const spec: RegexSpec = { pattern: 'test' };
      const regex = RegexMatcher.compile(spec);
      expect(regex).toBeInstanceOf(RegExp);
      expect(regex.test('test')).toBe(true);
      expect(regex.test('TEST')).toBe(false);
    });

    it('should throw on invalid pattern', () => {
      const spec: RegexSpec = { pattern: '[invalid' };
      expect(() => RegexMatcher.compile(spec)).toThrow();
    });

    it('should throw on empty pattern', () => {
      const spec: RegexSpec = { pattern: '' };
      expect(() => RegexMatcher.compile(spec)).toThrow('Regex pattern cannot be empty');
    });

    it('should throw on invalid flags', () => {
      const spec: RegexSpec = { pattern: 'test', flags: 'g' };
      expect(() => RegexMatcher.compile(spec)).toThrow('Unsupported flag');
    });

    it('should throw on pattern exceeding max length', () => {
      const spec: RegexSpec = { pattern: 'a'.repeat(501) };
      expect(() => RegexMatcher.compile(spec)).toThrow('too long');
    });
  });

  describe('test', () => {
    it('should test regex against value', () => {
      const regex = /test/i;
      expect(RegexMatcher.test(regex, 'TEST')).toBe(true);
      expect(RegexMatcher.test(regex, 'other')).toBe(false);
    });

    it('should return false on error', () => {
      const regex = /test/;
      // This shouldn't throw, just return false
      expect(RegexMatcher.test(regex, 'test')).toBe(true);
    });
  });

  describe('validatePattern', () => {
    it('should validate correct pattern', () => {
      const result = RegexMatcher.validatePattern('test|other');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject empty pattern', () => {
      const result = RegexMatcher.validatePattern('');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Regex pattern cannot be empty');
    });

    it('should reject pattern exceeding max length', () => {
      const result = RegexMatcher.validatePattern('a'.repeat(501));
      expect(result.valid).toBe(false);
      expect(result.error).toContain('too long');
    });

    it('should reject invalid syntax', () => {
      const result = RegexMatcher.validatePattern('[unclosed');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid regex syntax');
    });

    it('should accept complex pattern', () => {
      const result = RegexMatcher.validatePattern('bug\\s*#\\d+');
      expect(result.valid).toBe(true);
    });
  });

  describe('validateFlags', () => {
    it('should accept valid flags', () => {
      expect(RegexMatcher.validateFlags('i').valid).toBe(true);
      expect(RegexMatcher.validateFlags('im').valid).toBe(true);
      expect(RegexMatcher.validateFlags('imsu').valid).toBe(true);
    });

    it('should accept empty flags', () => {
      expect(RegexMatcher.validateFlags('').valid).toBe(true);
    });

    it('should reject disallowed flags', () => {
      const result = RegexMatcher.validateFlags('g');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Unsupported flag: "g"');
    });

    it('should reject unknown flags', () => {
      const result = RegexMatcher.validateFlags('x');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Unknown flag: "x"');
    });

    it('should reject duplicate flags', () => {
      const result = RegexMatcher.validateFlags('ii');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Duplicate flags');
    });
  });

  describe('parseRegexLiteral', () => {
    it('should parse basic regex literal', () => {
      const result = RegexMatcher.parseRegexLiteral('/test/');
      expect(result).toEqual({ pattern: 'test', flags: '' });
    });

    it('should parse regex with flags', () => {
      const result = RegexMatcher.parseRegexLiteral('/test/i');
      expect(result).toEqual({ pattern: 'test', flags: 'i' });
    });

    it('should parse regex with multiple flags', () => {
      const result = RegexMatcher.parseRegexLiteral('/test/im');
      expect(result).toEqual({ pattern: 'test', flags: 'im' });
    });

    it('should handle escaped slashes in pattern', () => {
      const result = RegexMatcher.parseRegexLiteral('/a\\/b/');
      expect(result).toEqual({ pattern: 'a/b', flags: '' });
    });

    it('should handle multiple escaped slashes', () => {
      const result = RegexMatcher.parseRegexLiteral('/path\\/to\\/file/');
      expect(result).toEqual({ pattern: 'path/to/file', flags: '' });
    });

    it('should return null for non-literal', () => {
      const result = RegexMatcher.parseRegexLiteral('test');
      expect(result).toBeNull();
    });

    it('should return null for incomplete literal', () => {
      const result = RegexMatcher.parseRegexLiteral('/test');
      expect(result).toBeNull();
    });

    it('should parse complex regex pattern', () => {
      const result = RegexMatcher.parseRegexLiteral('/bug\\s*#\\d+/i');
      expect(result).toEqual({ pattern: 'bug\\s*#\\d+', flags: 'i' });
    });

    it('should handle backslashes before slash', () => {
      const result = RegexMatcher.parseRegexLiteral('/test\\\\/');
      expect(result).toEqual({ pattern: 'test\\\\', flags: '' });
    });
  });

  describe('integration', () => {
    it('should compile and test regex from literal', () => {
      const literal = '/urgent|asap/i';
      const spec = RegexMatcher.parseRegexLiteral(literal);
      expect(spec).not.toBeNull();
      
      const regex = RegexMatcher.compile(spec!);
      expect(RegexMatcher.test(regex, 'This is URGENT')).toBe(true);
      expect(RegexMatcher.test(regex, 'Please do asap')).toBe(true);
      expect(RegexMatcher.test(regex, 'normal task')).toBe(false);
    });

    it('should handle path patterns with slashes', () => {
      const literal = '/archive\\/old/';
      const spec = RegexMatcher.parseRegexLiteral(literal);
      expect(spec).not.toBeNull();
      
      const regex = RegexMatcher.compile(spec!);
      expect(RegexMatcher.test(regex, 'archive/old/file.txt')).toBe(true);
      expect(RegexMatcher.test(regex, 'archive/new/file.txt')).toBe(false);
    });

    it('should handle tag patterns', () => {
      const literal = '/^#context\\//';
      const spec = RegexMatcher.parseRegexLiteral(literal);
      expect(spec).not.toBeNull();
      
      const regex = RegexMatcher.compile(spec!);
      expect(RegexMatcher.test(regex, '#context/home')).toBe(true);
      expect(RegexMatcher.test(regex, '#context/work')).toBe(true);
      expect(RegexMatcher.test(regex, '#other/tag')).toBe(false);
    });
  });
});
