/**
 * Bulk Selection Store
 * Manages multi-select mode and selected tasks for bulk operations
 */

import { writable, derived, get } from 'svelte/store';
import type { Task } from '@/core/models/Task';

interface BulkSelectionState {
  enabled: boolean;
  selectedIds: Set<string>;
  lastClickedId: string | null;
}

const DEFAULT_STATE: BulkSelectionState = {
  enabled: false,
  selectedIds: new Set(),
  lastClickedId: null
};

function createBulkSelectionStore() {
  const { subscribe, set, update } = writable<BulkSelectionState>(DEFAULT_STATE);

  return {
    subscribe,
    
    enableBulkMode: () => update(s => ({ ...s, enabled: true })),
    
    disableBulkMode: () => set(DEFAULT_STATE),
    
    toggleTask: (id: string) => update(s => {
      const newIds = new Set(s.selectedIds);
      if (newIds.has(id)) {
        newIds.delete(id);
      } else {
        newIds.add(id);
      }
      return { ...s, selectedIds: newIds, lastClickedId: id };
    }),
    
    rangeSelect: (startId: string, endId: string, allTasks: Task[]) => {
      const startIndex = allTasks.findIndex(t => t.id === startId);
      const endIndex = allTasks.findIndex(t => t.id === endId);
      
      if (startIndex === -1 || endIndex === -1) return;
      
      const [start, end] = startIndex < endIndex 
        ? [startIndex, endIndex] 
        : [endIndex, startIndex];
      
      update(s => {
        const newIds = new Set(s.selectedIds);
        for (let i = start; i <= end; i++) {
          newIds.add(allTasks[i].id);
        }
        return { ...s, selectedIds: newIds, lastClickedId: endId };
      });
    },
    
    selectAll: (taskIds: string[]) => update(s => ({
      ...s,
      selectedIds: new Set(taskIds)
    })),
    
    clear: () => update(s => ({ ...s, selectedIds: new Set(), lastClickedId: null })),
    
    isSelected: (id: string): boolean => {
      const state = get({ subscribe });
      return state.selectedIds.has(id);
    }
  };
}

export const bulkSelectionStore = createBulkSelectionStore();

export const selectedCount = derived(
  bulkSelectionStore, 
  $s => $s.selectedIds.size
);

export const hasSelection = derived(
  selectedCount,
  $count => $count > 0
);
