/**
 * Query Engine Module
 * 
 * Provides a powerful query language for filtering, sorting, and grouping tasks.
 */

export { QueryEngine, type QueryResult, type TaskIndex } from './QueryEngine';
export { QueryParser, type QueryAST, type FilterNode, type SortNode, type GroupNode } from './QueryParser';
export { QuerySyntaxError, QueryExecutionError } from './QueryError';

// Filters
export { Filter } from './filters/FilterBase';
export { 
  StatusTypeFilter, 
  StatusNameFilter, 
  StatusSymbolFilter,
  DoneFilter,
  NotDoneFilter
} from './filters/StatusFilter';
export { DateComparisonFilter, HasDateFilter, type DateField, type DateComparator } from './filters/DateFilter';
export { PriorityFilter, type Priority, type PriorityLevel } from './filters/PriorityFilter';
export { TagIncludesFilter, HasTagsFilter } from './filters/TagFilter';
export { PathFilter } from './filters/PathFilter';
export { IsBlockedFilter, IsBlockingFilter, type DependencyGraph } from './filters/DependencyFilter';
export { RecurrenceFilter } from './filters/RecurrenceFilter';
export { AndFilter, OrFilter, NotFilter } from './filters/BooleanFilter';
export { DescriptionFilter } from './filters/DescriptionFilter';
export { DescriptionRegexFilter } from './filters/DescriptionRegexFilter';
export { PathRegexFilter } from './filters/PathRegexFilter';
export { TagRegexFilter } from './filters/TagRegexFilter';
export { EscalationFilter } from './filters/EscalationFilter';
export { AttentionScoreFilter, AttentionLaneFilter } from './filters/AttentionFilter';

// Utils
export { RegexMatcher, type RegexSpec } from './utils/RegexMatcher';

// Groupers
export { Grouper } from './groupers/GrouperBase';
export { DueDateGrouper, ScheduledDateGrouper } from './groupers/DateGrouper';
export { StatusTypeGrouper, StatusNameGrouper } from './groupers/StatusGrouper';
export { PriorityGrouper } from './groupers/PriorityGrouper';
export { FolderGrouper, PathGrouper, TagGrouper } from './groupers/PathGrouper';
