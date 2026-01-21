import type { Task } from '@/core/models/Task';
import { normalizePriority } from '@/core/models/Task';
import type { QueryAST, FilterNode, SortNode, GroupNode } from './QueryParser';
import { QueryParser } from './QueryParser';
import { QueryExecutionError } from './QueryError';
import { Filter } from './filters/FilterBase';
import { 
  StatusTypeFilter, 
  StatusNameFilter, 
  StatusSymbolFilter,
  DoneFilter,
  NotDoneFilter
} from './filters/StatusFilter';
import { DateComparisonFilter, HasDateFilter, type DateField, type DateComparator } from './filters/DateFilter';
import { PriorityFilter, type PriorityLevel } from './filters/PriorityFilter';
import { TagIncludesFilter, HasTagsFilter } from './filters/TagFilter';
import { PathFilter } from './filters/PathFilter';
import { IsBlockedFilter, IsBlockingFilter, type DependencyGraph } from './filters/DependencyFilter';
import { RecurrenceFilter } from './filters/RecurrenceFilter';
import { AndFilter, OrFilter, NotFilter } from './filters/BooleanFilter';
import { DescriptionFilter } from './filters/DescriptionFilter';
import { Grouper } from './groupers/GrouperBase';
import { DueDateGrouper, ScheduledDateGrouper } from './groupers/DateGrouper';
import { StatusTypeGrouper, StatusNameGrouper } from './groupers/StatusGrouper';
import { PriorityGrouper } from './groupers/PriorityGrouper';
import { FolderGrouper, PathGrouper, TagGrouper } from './groupers/PathGrouper';

/**
 * Execute queries against task index
 */
export interface QueryResult {
  tasks: Task[];
  groups?: Map<string, Task[]>;
  totalCount: number;
  executionTimeMs: number;
}

export interface TaskIndex {
  getAllTasks(): Task[];
  getTasksByStatus?(statusType: string): Task[];
  getTasksByDateRange?(field: string, start: Date, end: Date): Task[];
}

export class QueryEngine {
  private dependencyGraph: DependencyGraph | null = null;

  constructor(private taskIndex: TaskIndex) {}

  /**
   * Set dependency graph for dependency filters
   */
  setDependencyGraph(graph: DependencyGraph | null): void {
    this.dependencyGraph = graph;
  }

  /**
   * Execute query and return results
   */
  execute(query: QueryAST): QueryResult {
    const startTime = performance.now();

    try {
      // Start with all tasks
      let tasks = this.taskIndex.getAllTasks();
      const totalCount = tasks.length;

      // Apply filters
      if (query.filters.length > 0) {
        tasks = this.applyFilters(tasks, query.filters);
      }

      // Apply sorting
      if (query.sort) {
        tasks = this.applySort(tasks, query.sort);
      }

      // Apply limit
      if (query.limit !== undefined && query.limit > 0) {
        tasks = tasks.slice(0, query.limit);
      }

      // Apply grouping
      let groups: Map<string, Task[]> | undefined;
      if (query.group) {
        groups = this.applyGrouping(tasks, query.group);
      }

      const endTime = performance.now();
      const executionTimeMs = endTime - startTime;

      return {
        tasks,
        groups,
        totalCount,
        executionTimeMs,
      };
    } catch (error) {
      throw new QueryExecutionError(
        `Failed to execute query: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Execute query from string (convenience method)
   */
  executeString(queryString: string): QueryResult {
    const parser = new QueryParser();
    const ast = parser.parse(queryString);
    return this.execute(ast);
  }

  /**
   * Validate query without executing
   */
  validateQuery(queryString: string): { valid: boolean; error?: string; parsedFilters?: string[] } {
    try {
      const parser = new QueryParser();
      const ast = parser.parse(queryString);
      return {
        valid: true,
        parsedFilters: ast.filters.map(f => `${f.type}:${f.operator}`)
      };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Apply filters to task list (chainable)
   */
  private applyFilters(tasks: Task[], filters: FilterNode[]): Task[] {
    let result = tasks;

    for (const filterNode of filters) {
      const filter = this.createFilter(filterNode);
      result = result.filter(task => filter.matches(task));
    }

    return result;
  }

  /**
   * Create a filter from a filter node
   */
  private createFilter(node: FilterNode): Filter {
    switch (node.type) {
      case 'done':
        return node.value ? new DoneFilter() : new NotDoneFilter();

      case 'status':
        if (node.operator === 'type-is') {
          return new StatusTypeFilter(node.value, node.negate);
        } else if (node.operator === 'name-includes') {
          return new StatusNameFilter(node.value, node.negate);
        } else if (node.operator === 'symbol-is') {
          return new StatusSymbolFilter(node.value, node.negate);
        }
        throw new QueryExecutionError(`Unknown status operator: ${node.operator}`);

      case 'date':
        if (node.operator === 'has') {
          return new HasDateFilter(node.value.field, node.negate);
        } else {
          return new DateComparisonFilter(
            node.value.field as DateField,
            node.operator as DateComparator,
            node.value.date
          );
        }

      case 'priority':
        return new PriorityFilter(
          node.operator as 'is' | 'above' | 'below',
          node.value as PriorityLevel
        );

      case 'tag':
        if (node.operator === 'has') {
          return new HasTagsFilter(!node.value);
        } else {
          return new TagIncludesFilter(node.value, node.negate);
        }

      case 'path':
        return new PathFilter(node.value, node.negate);

      case 'dependency':
        if (node.operator === 'is-blocked') {
          return new IsBlockedFilter(this.dependencyGraph, !node.value);
        } else if (node.operator === 'is-blocking') {
          return new IsBlockingFilter(this.dependencyGraph, !node.value);
        }
        throw new QueryExecutionError(`Unknown dependency operator: ${node.operator}`);

      case 'recurrence':
        return new RecurrenceFilter(!node.value);

      case 'description':
        return new DescriptionFilter(
          node.operator as 'includes' | 'does not include' | 'regex',
          node.value,
          node.negate
        );

      case 'boolean':
        if (node.operator === 'AND' && node.left && node.right) {
          return new AndFilter(this.createFilter(node.left), this.createFilter(node.right));
        } else if (node.operator === 'OR' && node.left && node.right) {
          return new OrFilter(this.createFilter(node.left), this.createFilter(node.right));
        } else if (node.operator === 'NOT' && node.inner) {
          return new NotFilter(this.createFilter(node.inner));
        }
        throw new QueryExecutionError(`Invalid boolean operator: ${node.operator}`);

      default:
        throw new QueryExecutionError(`Unknown filter type: ${node.type}`);
    }
  }

  /**
   * Apply sorting
   */
  private applySort(tasks: Task[], sort: SortNode): Task[] {
    const sorted = [...tasks];

    sorted.sort((a, b) => {
      let comparison = 0;

      switch (sort.field) {
        case 'due':
          comparison = this.compareDates(a.dueAt, b.dueAt);
          break;
        case 'scheduled':
          comparison = this.compareDates(a.scheduledAt, b.scheduledAt);
          break;
        case 'start':
          comparison = this.compareDates(a.startAt, b.startAt);
          break;
        case 'created':
          comparison = this.compareDates(a.createdAt, b.createdAt);
          break;
        case 'done':
          comparison = this.compareDates(a.doneAt, b.doneAt);
          break;
        case 'priority':
          comparison = this.comparePriorities(a.priority, b.priority);
          break;
        case 'status.type':
          comparison = this.compareStatusTypes(a, b);
          break;
        case 'description':
          comparison = (a.description || '').localeCompare(b.description || '');
          break;
        case 'path':
          comparison = (a.path || '').localeCompare(b.path || '');
          break;
        default:
          // Default to sorting by name
          comparison = a.name.localeCompare(b.name);
      }

      return sort.reverse ? -comparison : comparison;
    });

    return sorted;
  }

  private compareDates(a: string | undefined, b: string | undefined): number {
    if (!a && !b) return 0;
    if (!a) return 1; // Put tasks without dates at the end
    if (!b) return -1;
    return new Date(a).getTime() - new Date(b).getTime();
  }

  private comparePriorities(a: string | undefined, b: string | undefined): number {
    const weights: Record<string, number> = {
      lowest: 0,
      low: 1,
      normal: 2,
      medium: 3,
      high: 4,
      highest: 5,
    };
    const weightA = weights[normalizePriority(a) || 'normal'] || 2;
    const weightB = weights[normalizePriority(b) || 'normal'] || 2;
    return weightA - weightB;
  }

  private compareStatusTypes(a: Task, b: Task): number {
    const getStatusWeight = (task: Task): number => {
      const symbol = task.statusSymbol || ' ';
      // Simple weight based on symbol
      if (symbol === ' ') return 0; // TODO
      if (symbol === '/') return 1; // IN_PROGRESS
      if (symbol === 'x') return 2; // DONE
      if (symbol === '-') return 3; // CANCELLED
      return 0;
    };

    return getStatusWeight(a) - getStatusWeight(b);
  }

  /**
   * Apply grouping
   */
  private applyGrouping(tasks: Task[], group: GroupNode): Map<string, Task[]> {
    const grouper = this.createGrouper(group.field);
    return grouper.group(tasks);
  }

  private createGrouper(field: string): Grouper {
    switch (field) {
      case 'due':
        return new DueDateGrouper();
      case 'scheduled':
        return new ScheduledDateGrouper();
      case 'status.type':
        return new StatusTypeGrouper();
      case 'status.name':
        return new StatusNameGrouper();
      case 'priority':
        return new PriorityGrouper();
      case 'path':
        return new PathGrouper();
      case 'folder':
        return new FolderGrouper();
      case 'tags':
        return new TagGrouper();
      default:
        throw new QueryExecutionError(`Unknown grouping field: ${field}`);
    }
  }
}
