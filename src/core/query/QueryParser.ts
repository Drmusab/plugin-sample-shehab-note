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
  explain?: boolean;
  
  // NEW: Override directives
  overrideGlobalFilter?: boolean;
  useProfile?: string;
}

export interface FilterNode {
  type: 'status' | 'date' | 'priority' | 'urgency' | 'tag' | 'path' | 'dependency' | 'recurrence' | 'boolean' | 'done' | 'description' | 'heading';
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
  private referenceDate: Date = new Date();

  /**
   * Parse query string to AST
   * @param queryString The query string to parse
   * @param referenceDate Reference date for relative date parsing (defaults to now)
   * @throws QuerySyntaxError with helpful error message
   */
  parse(queryString: string, referenceDate: Date = new Date()): QueryAST {
    // Extract directives first
    let text = queryString.trim();
    const directives: { overrideGlobalFilter?: boolean; useProfile?: string } = {};
    
    // Extract directives (special prefix syntax)
    const lines = text.split('\n');
    const filteredLines: string[] = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // @ignoreGlobalFilter directive
      if (trimmed === '@ignoreGlobalFilter') {
        directives.overrideGlobalFilter = true;
        continue;
      }
      
      // @profile <name> directive
      const profileMatch = trimmed.match(/^@profile\s+(.+)$/);
      if (profileMatch) {
        directives.useProfile = profileMatch[1].trim();
        continue;
      }
      
      filteredLines.push(line);
    }
    
    // Continue with existing parsing logic on filtered text
    this.input = filteredLines.join('\n').trim();
    this.position = 0;
    this.line = 1;
    this.column = 1;
    this.referenceDate = referenceDate;

    const ast: QueryAST = {
      filters: [],
    };

    // Parse line by line
    const astLines = this.input.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    for (let i = 0; i < astLines.length; i++) {
      this.line = i + 1;
      this.column = 1;
      const line = astLines[i];

      if (line.startsWith('sort by ')) {
        ast.sort = this.parseSortInstruction(line);
      } else if (line.startsWith('group by ')) {
        ast.group = this.parseGroupInstruction(line);
      } else if (line.startsWith('limit ') || line.startsWith('limit to ')) {
        ast.limit = this.parseLimitInstruction(line);
      } else if (/^explain$/i.test(line)) {
        ast.explain = true;
      } else {
        // It's a filter instruction
        const filter = this.parseFilterInstruction(line);
        if (filter) {
          ast.filters.push(filter);
        }
      }
    }

    // Merge directives into the AST
    return { ...ast, ...directives };
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
    // Handle simple keywords first (before checking for boolean operators)
    if (line === 'done') {
      return { type: 'done', operator: 'is', value: true };
    }
    if (line === 'not done') {
      return { type: 'done', operator: 'is', value: false };
    }
    
    // Check for "between" date filters first (before boolean operators)
    // to avoid "and" in "between X and Y" being parsed as boolean AND
    const betweenMatch = line.match(/^(due|scheduled|start|created|done|cancelled)\s+between\s+/i);
    if (betweenMatch) {
      const dateFilter = this.parseDateFilter(line);
      if (dateFilter) {
        return dateFilter;
      }
    }
    
    // Check for boolean operators (after simple keywords and between)
    // Use regex for more robust case-insensitive matching
    if (/\s+(and|AND)\s+/i.test(line)) {
      return this.parseAndFilter(line);
    }
    if (/\s+(or|OR)\s+/i.test(line)) {
      return this.parseOrFilter(line);
    }
    if (/^(not|NOT)\s+/i.test(line)) {
      return this.parseNotFilter(line);
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

    // Urgency filters
    if (line.startsWith('urgency is ')) {
      const value = line.substring('urgency is '.length).trim();
      return { type: 'urgency', operator: 'is', value: this.parseNumericValue(value, 'urgency') };
    }
    if (line.startsWith('urgency above ')) {
      const value = line.substring('urgency above '.length).trim();
      return { type: 'urgency', operator: 'above', value: this.parseNumericValue(value, 'urgency') };
    }
    if (line.startsWith('urgency below ')) {
      const value = line.substring('urgency below '.length).trim();
      return { type: 'urgency', operator: 'below', value: this.parseNumericValue(value, 'urgency') };
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

    // Description filters
    if (line.startsWith('description includes ')) {
      const pattern = line.substring('description includes '.length).trim();
      return { type: 'description', operator: 'includes', value: this.unquote(pattern) };
    }
    if (line.startsWith('description does not include ')) {
      const pattern = line.substring('description does not include '.length).trim();
      return { type: 'description', operator: 'does not include', value: this.unquote(pattern) };
    }
    if (line.startsWith('description regex ')) {
      const pattern = line.substring('description regex '.length).trim();
      return { type: 'description', operator: 'regex', value: this.unquote(pattern) };
    }

    // Heading filters
    if (line.startsWith('heading includes ')) {
      const pattern = line.substring('heading includes '.length).trim();
      return { type: 'heading', operator: 'includes', value: this.unquote(pattern) };
    }
    if (line.startsWith('heading does not include ')) {
      const pattern = line.substring('heading does not include '.length).trim();
      return { type: 'heading', operator: 'does not include', value: this.unquote(pattern) };
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

      // "X between DATE1 and DATE2" pattern
      const betweenMatch = line.match(new RegExp(`^${field}\\s+between\\s+(.+?)\\s+and\\s+(.+)$`, 'i'));
      if (betweenMatch) {
        const startDateStr = betweenMatch[1].trim();
        const endDateStr = betweenMatch[2].trim();
        
        const parsedStart = DateParser.parse(startDateStr, this.referenceDate);
        const parsedEnd = DateParser.parse(endDateStr, this.referenceDate);
        
        if (!parsedStart.isValid || !parsedStart.date) {
          throw new QuerySyntaxError(
            `Invalid start date: "${startDateStr}"`,
            this.line,
            this.column,
            'Use formats like: today, tomorrow, YYYY-MM-DD, "in 3 days", "next Monday"'
          );
        }
        
        if (!parsedEnd.isValid || !parsedEnd.date) {
          throw new QuerySyntaxError(
            `Invalid end date: "${endDateStr}"`,
            this.line,
            this.column,
            'Use formats like: today, tomorrow, YYYY-MM-DD, "in 3 days", "next Monday"'
          );
        }
        
        return {
          type: 'date',
          operator: 'between',
          value: { field, date: parsedStart.date, endDate: parsedEnd.date }
        };
      }

      // "X before/after/on VALUE" patterns
      const comparators: DateComparator[] = ['before', 'after', 'on', 'on or before', 'on or after'];
      
      for (const comparator of comparators) {
        const prefix = `${field} ${comparator} `;
        if (line.startsWith(prefix)) {
          const dateStr = line.substring(prefix.length).trim();
          const parsedDate = DateParser.parse(dateStr, this.referenceDate);
          
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

  private parseNumericValue(value: string, field: string): number {
    const parsed = Number(value);
    if (Number.isNaN(parsed)) {
      throw new QuerySyntaxError(
        `Invalid ${field} value: "${value}"`,
        this.line,
        this.column,
        `Use a numeric ${field} value (e.g., "${field} above 75")`
      );
    }
    return parsed;
  }

  private unquote(str: string): string {
    if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
      return str.slice(1, -1);
    }
    return str;
  }

  private parseAndFilter(line: string): FilterNode {
    // Split by case-insensitive AND
    const parts = line.split(/\s+(and|AND)\s+/i).filter((_, i) => i % 2 === 0); // Remove the captured "and" parts
    const filters = parts.map(p => this.parseFilterInstruction(p.trim())).filter(f => f !== null) as FilterNode[];
    
    if (filters.length === 0) {
      throw new QuerySyntaxError(
        'Empty AND expression',
        this.line,
        this.column,
        'AND must have filters on both sides'
      );
    }
    
    if (filters.length === 1) {
      return filters[0];
    }
    
    // Build left-associative tree: (a AND b) AND c
    let result = filters[0];
    for (let i = 1; i < filters.length; i++) {
      result = {
        type: 'boolean',
        operator: 'AND',
        value: null,
        left: result,
        right: filters[i],
      };
    }
    
    return result;
  }

  private parseOrFilter(line: string): FilterNode {
    // Split by case-insensitive OR
    const parts = line.split(/\s+(or|OR)\s+/i).filter((_, i) => i % 2 === 0); // Remove the captured "or" parts
    const filters = parts.map(p => this.parseFilterInstruction(p.trim())).filter(f => f !== null) as FilterNode[];
    
    if (filters.length === 0) {
      throw new QuerySyntaxError(
        'Empty OR expression',
        this.line,
        this.column,
        'OR must have filters on both sides'
      );
    }
    
    if (filters.length === 1) {
      return filters[0];
    }
    
    // Build left-associative tree: (a OR b) OR c
    let result = filters[0];
    for (let i = 1; i < filters.length; i++) {
      result = {
        type: 'boolean',
        operator: 'OR',
        value: null,
        left: result,
        right: filters[i],
      };
    }
    
    return result;
  }

  private parseNotFilter(line: string): FilterNode {
    // Remove NOT or not prefix
    const cleanLine = line.replace(/^NOT\s+/i, '').trim();
    
    if (!cleanLine) {
      throw new QuerySyntaxError(
        'Empty NOT expression',
        this.line,
        this.column,
        'NOT must have a filter after it'
      );
    }
    
    const inner = this.parseFilterInstruction(cleanLine);
    
    if (!inner) {
      throw new QuerySyntaxError(
        'Invalid filter after NOT',
        this.line,
        this.column,
        'NOT must be followed by a valid filter'
      );
    }
    
    return {
      type: 'boolean',
      operator: 'NOT',
      value: null,
      inner,
    };
  }
}
