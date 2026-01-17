import { QuerySyntaxError } from './QueryError';
import { StatusType } from '@/core/models/Status';
import type { DateField, DateComparator } from './filters/DateFilter';
import type { PriorityLevel } from './filters/PriorityFilter';
import { DateParser } from '@/core/parsers/DateParser';

/**
 * Parse query string to Abstract Syntax Tree (AST)
 */
export interface QueryAST {
  filters: FilterNode[];
  sort?: SortNode;
  group?: GroupNode;
  limit?: number;
}

export interface FilterNode {
  type: 'status' | 'date' | 'priority' | 'tag' | 'path' | 'dependency' | 'recurrence' | 'boolean' | 'done' | 'description';
  operator: string;
  value: any;
  negate?: boolean;
  left?: FilterNode;
  right?: FilterNode;
  inner?: FilterNode;
}

export interface SortNode {
  field: string;
  reverse?: boolean;
}

export interface GroupNode {
  field: string;
}

export class QueryParser {
  private input: string = '';
  private position: number = 0;
  private line: number = 1;
  private column: number = 1;

  /**
   * Parse query string to AST
   * @throws QuerySyntaxError with helpful error message
   */
  parse(queryString: string): QueryAST {
    this.input = queryString.trim();
    this.position = 0;
    this.line = 1;
    this.column = 1;

    const ast: QueryAST = {
      filters: [],
    };

    // Parse line by line
    const lines = this.input.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    for (let i = 0; i < lines.length; i++) {
      this.line = i + 1;
      this.column = 1;
      const line = lines[i];

      if (line.startsWith('sort by ')) {
        ast.sort = this.parseSortInstruction(line);
      } else if (line.startsWith('group by ')) {
        ast.group = this.parseGroupInstruction(line);
      } else if (line.startsWith('limit ') || line.startsWith('limit to ')) {
        ast.limit = this.parseLimitInstruction(line);
      } else {
        // It's a filter instruction
        const filter = this.parseFilterInstruction(line);
        if (filter) {
          ast.filters.push(filter);
        }
      }
    }

    return ast;
  }

  /**
   * Validate query syntax without full parsing
   */
  validate(queryString: string): { valid: boolean; error?: string } {
    try {
      this.parse(queryString);
      return { valid: true };
    } catch (error) {
      if (error instanceof QuerySyntaxError) {
        return { valid: false, error: error.message };
      }
      return { valid: false, error: String(error) };
    }
  }

  private parseFilterInstruction(line: string): FilterNode | null {
    // Handle simple keywords
    if (line === 'done') {
      return { type: 'done', operator: 'is', value: true };
    }
    if (line === 'not done') {
      return { type: 'done', operator: 'is', value: false };
    }

    // Status filters
    if (line.startsWith('status.type is ')) {
      const typeStr = line.substring('status.type is '.length).trim();
      const statusType = this.parseStatusType(typeStr);
      return { type: 'status', operator: 'type-is', value: statusType };
    }
    if (line.startsWith('status.name includes ')) {
      const name = line.substring('status.name includes '.length).trim();
      return { type: 'status', operator: 'name-includes', value: this.unquote(name) };
    }
    if (line.startsWith('status.symbol is ')) {
      const symbol = line.substring('status.symbol is '.length).trim();
      return { type: 'status', operator: 'symbol-is', value: this.unquote(symbol) };
    }

    // Date filters
    const dateFilterMatch = this.parseDateFilter(line);
    if (dateFilterMatch) {
      return dateFilterMatch;
    }

    // Priority filters
    if (line.startsWith('priority is ')) {
      const level = line.substring('priority is '.length).trim();
      return { type: 'priority', operator: 'is', value: level as PriorityLevel };
    }
    if (line.startsWith('priority above ')) {
      const level = line.substring('priority above '.length).trim();
      return { type: 'priority', operator: 'above', value: level as PriorityLevel };
    }
    if (line.startsWith('priority below ')) {
      const level = line.substring('priority below '.length).trim();
      return { type: 'priority', operator: 'below', value: level as PriorityLevel };
    }

    // Tag filters
    if (line.startsWith('tag includes ')) {
      const tag = line.substring('tag includes '.length).trim();
      return { type: 'tag', operator: 'includes', value: this.unquote(tag) };
    }
    if (line.startsWith('tag does not include ')) {
      const tag = line.substring('tag does not include '.length).trim();
      return { type: 'tag', operator: 'includes', value: this.unquote(tag), negate: true };
    }
    if (line.startsWith('tags include ')) {
      const tag = line.substring('tags include '.length).trim();
      return { type: 'tag', operator: 'includes', value: this.unquote(tag) };
    }
    if (line === 'has tags') {
      return { type: 'tag', operator: 'has', value: true };
    }
    if (line === 'no tags') {
      return { type: 'tag', operator: 'has', value: false };
    }

    // Path filters
    if (line.startsWith('path includes ')) {
      const pattern = line.substring('path includes '.length).trim();
      return { type: 'path', operator: 'includes', value: this.unquote(pattern) };
    }
    if (line.startsWith('path does not include ')) {
      const pattern = line.substring('path does not include '.length).trim();
      return { type: 'path', operator: 'includes', value: this.unquote(pattern), negate: true };
    }

    // Dependency filters
    if (line === 'is blocked') {
      return { type: 'dependency', operator: 'is-blocked', value: true };
    }
    if (line === 'is not blocked') {
      return { type: 'dependency', operator: 'is-blocked', value: false };
    }
    if (line === 'is blocking') {
      return { type: 'dependency', operator: 'is-blocking', value: true };
    }

    // Recurrence filters
    if (line === 'is recurring') {
      return { type: 'recurrence', operator: 'is', value: true };
    }
    if (line === 'is not recurring') {
      return { type: 'recurrence', operator: 'is', value: false };
    }

    // If we can't parse it, throw error
    throw new QuerySyntaxError(
      `Unknown filter instruction: "${line}"`,
      this.line,
      this.column,
      'Check the query syntax documentation for valid filter instructions'
    );
  }

  private parseDateFilter(line: string): FilterNode | null {
    const dateFields: DateField[] = ['due', 'scheduled', 'start', 'created', 'done', 'cancelled'];
    
    for (const field of dateFields) {
      // "has X date" pattern
      if (line === `has ${field} date`) {
        return { type: 'date', operator: 'has', value: { field } };
      }
      
      // "no X date" pattern
      if (line === `no ${field} date`) {
        return { type: 'date', operator: 'has', value: { field }, negate: true };
      }

      // "X before/after/on VALUE" patterns
      const comparators: DateComparator[] = ['before', 'after', 'on', 'on or before', 'on or after'];
      
      for (const comparator of comparators) {
        const prefix = `${field} ${comparator} `;
        if (line.startsWith(prefix)) {
          const dateStr = line.substring(prefix.length).trim();
          const parsedDate = DateParser.parse(dateStr);
          
          if (!parsedDate.isValid || !parsedDate.date) {
            throw new QuerySyntaxError(
              `Invalid date value: "${dateStr}"`,
              this.line,
              this.column,
              'Use formats like: today, tomorrow, YYYY-MM-DD, "in 3 days", "next Monday"'
            );
          }
          
          return {
            type: 'date',
            operator: comparator,
            value: { field, date: parsedDate.date }
          };
        }
      }
    }

    return null;
  }

  private parseSortInstruction(line: string): SortNode {
    const match = line.match(/^sort by ([a-z.]+)(\s+reverse)?$/i);
    if (!match) {
      throw new QuerySyntaxError(
        `Invalid sort instruction: "${line}"`,
        this.line,
        this.column,
        'Use format: "sort by FIELD" or "sort by FIELD reverse"'
      );
    }

    return {
      field: match[1],
      reverse: !!match[2],
    };
  }

  private parseGroupInstruction(line: string): GroupNode {
    const match = line.match(/^group by ([a-z.]+)$/i);
    if (!match) {
      throw new QuerySyntaxError(
        `Invalid group instruction: "${line}"`,
        this.line,
        this.column,
        'Use format: "group by FIELD"'
      );
    }

    return {
      field: match[1],
    };
  }

  private parseLimitInstruction(line: string): number {
    let match = line.match(/^limit (\d+)$/);
    if (match) {
      return parseInt(match[1], 10);
    }

    match = line.match(/^limit to (\d+) tasks?$/);
    if (match) {
      return parseInt(match[1], 10);
    }

    throw new QuerySyntaxError(
      `Invalid limit instruction: "${line}"`,
      this.line,
      this.column,
      'Use format: "limit 10" or "limit to 10 tasks"'
    );
  }

  private parseStatusType(typeStr: string): StatusType {
    const normalized = typeStr.toUpperCase().replace(/\s+/g, '_');
    
    switch (normalized) {
      case 'TODO':
        return StatusType.TODO;
      case 'IN_PROGRESS':
        return StatusType.IN_PROGRESS;
      case 'DONE':
        return StatusType.DONE;
      case 'CANCELLED':
        return StatusType.CANCELLED;
      case 'NON_TASK':
        return StatusType.NON_TASK;
      default:
        throw new QuerySyntaxError(
          `Invalid status type: "${typeStr}"`,
          this.line,
          this.column,
          'Valid types: TODO, IN_PROGRESS, DONE, CANCELLED, NON_TASK'
        );
    }
  }

  private unquote(str: string): string {
    if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
      return str.slice(1, -1);
    }
    return str;
  }
}
