/**
 * Search and Filter Store
 * Manages search query, filter state, and fuzzy search functionality
 */

import { writable, derived, get } from 'svelte/store';
import type { Task } from '@/core/models/Task';
import { isTaskActive, isDueToday, isOverdue } from '@/core/models/Task';

export type SmartFilter = 
  | 'today' 
  | 'overdue' 
  | 'high-priority' 
  | 'recurring' 
  | 'no-due-date' 
  | 'completed';

export type SearchField = 'description' | 'tags' | 'notes';

interface SearchState {
  query: string;
  fields: SearchField[];
  activeFilters: Set<SmartFilter>;
}

const DEFAULT_STATE: SearchState = {
  query: '',
  fields: ['description', 'tags', 'notes'],
  activeFilters: new Set()
};

function createSearchStore() {
  const state = writable<SearchState>(DEFAULT_STATE);
  
  return {
    subscribe: state.subscribe,
    
    setQuery: (q: string) => state.update(s => ({ ...s, query: q })),
    
    toggleFilter: (filter: SmartFilter) => state.update(s => {
      const newFilters = new Set(s.activeFilters);
      if (newFilters.has(filter)) {
        newFilters.delete(filter);
      } else {
        newFilters.add(filter);
      }
      return { ...s, activeFilters: newFilters };
    }),
    
    clearFilters: () => state.update(s => ({ ...s, activeFilters: new Set() })),
    
    clear: () => state.set(DEFAULT_STATE),
    
    setSearchFields: (fields: SearchField[]) => state.update(s => ({ ...s, fields }))
  };
}

export const searchStore = createSearchStore();

/**
 * Apply smart filters to a task list
 */
export function applySmartFilters(tasks: Task[], filters: Set<SmartFilter>): Task[] {
  let results = [...tasks];
  
  filters.forEach(filter => {
    switch (filter) {
      case 'today':
        results = results.filter(t => isDueToday(t));
        break;
      case 'overdue':
        results = results.filter(t => isOverdue(t));
        break;
      case 'high-priority':
        results = results.filter(t => {
          const priority = t.priority?.toString().toLowerCase() || '';
          return priority === 'high' || priority === 'highest' || priority.includes('⏫');
        });
        break;
      case 'recurring':
        results = results.filter(t => t.frequency && t.frequency.type !== 'once');
        break;
      case 'no-due-date':
        results = results.filter(t => !t.dueAt);
        break;
      case 'completed':
        results = results.filter(t => t.status === 'done' || !isTaskActive(t));
        break;
    }
  });
  
  return results;
}

/**
 * Calculate filter counts for a task list
 */
export function calculateFilterCounts(tasks: Task[]): Record<SmartFilter, number> {
  return {
    today: tasks.filter(t => isDueToday(t)).length,
    overdue: tasks.filter(t => isOverdue(t)).length,
    'high-priority': tasks.filter(t => {
      const priority = t.priority?.toString().toLowerCase() || '';
      return priority === 'high' || priority === 'highest' || priority.includes('⏫');
    }).length,
    recurring: tasks.filter(t => t.frequency && t.frequency.type !== 'once').length,
    'no-due-date': tasks.filter(t => !t.dueAt).length,
    completed: tasks.filter(t => t.status === 'done' || !isTaskActive(t)).length
  };
}
