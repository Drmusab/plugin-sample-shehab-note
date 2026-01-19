/**
 * Plugin settings for Phase 2+ features
 */

import type { FilenameDateConfig } from './FilenameDate';
import type { GlobalFilterConfig } from './GlobalFilter';

/**
 * Date tracking settings
 */
export interface DateTrackingSettings {
  /** Automatically add created date when creating tasks */
  autoAddCreated: boolean;
  
  /** Automatically add done date when completing tasks */
  autoAddDone: boolean;
  
  /** Automatically add cancelled date when cancelling tasks */
  autoAddCancelled: boolean;
}

/**
 * Recurrence settings
 */
export interface RecurrenceSettings {
  /** Where to place the new recurring instance */
  newTaskPosition: 'above' | 'below' | 'end';
  
  /** Remove scheduled date when generating next instance */
  removeScheduledOnRecurrence: boolean;
  
  /** Preserve original time when calculating next occurrence */
  preserveOriginalTime: boolean;
}

/**
 * Dependency settings (Phase 5)
 */
export interface DependencySettings {
  /** Warn when circular dependencies detected */
  warnOnCycles: boolean;
  
  /** Validate dependencies on save */
  autoValidate: boolean;
}

/**
 * Complete plugin settings
 */
export interface PluginSettings {
  /** Date tracking configuration */
  dates: DateTrackingSettings;
  
  /** Recurrence configuration */
  recurrence: RecurrenceSettings;
  
  /** Dependency configuration (Phase 5) */
  dependencies: DependencySettings;
  
  /** Filename-based date extraction (Phase 5) */
  filenameDate: FilenameDateConfig;
  
  /** Global task filter (Phase 5) */
  globalFilter: GlobalFilterConfig;
}

/**
 * Default settings
 */
export const DEFAULT_SETTINGS: PluginSettings = {
  dates: {
    autoAddCreated: false,
    autoAddDone: true,
    autoAddCancelled: true,
  },
  recurrence: {
    newTaskPosition: 'below',
    removeScheduledOnRecurrence: false,
    preserveOriginalTime: true,
  },
  dependencies: {
    warnOnCycles: true,
    autoValidate: true,
  },
  filenameDate: {
    enabled: false,
    patterns: ['YYYY-MM-DD', 'YYYYMMDD'],
    folders: ['daily/', 'journal/'],
    targetField: 'scheduled',
  },
  globalFilter: {
    enabled: false,
    mode: 'include',
    tagPattern: undefined,
    pathPattern: undefined,
    regex: undefined,
  },
};

/**
 * Merge user settings with defaults
 */
export function mergeSettings(userSettings: Partial<PluginSettings>): PluginSettings {
  return {
    dates: {
      ...DEFAULT_SETTINGS.dates,
      ...userSettings.dates,
    },
    recurrence: {
      ...DEFAULT_SETTINGS.recurrence,
      ...userSettings.recurrence,
    },
    dependencies: {
      ...DEFAULT_SETTINGS.dependencies,
      ...userSettings.dependencies,
    },
    filenameDate: {
      ...DEFAULT_SETTINGS.filenameDate,
      ...userSettings.filenameDate,
    },
    globalFilter: {
      ...DEFAULT_SETTINGS.globalFilter,
      ...userSettings.globalFilter,
    },
  };
}
