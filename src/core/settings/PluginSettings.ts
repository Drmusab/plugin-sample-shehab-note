/**
 * Plugin settings for Phase 2+ features
 */
import type { GlobalFilterProfile } from '@/core/filtering/FilterRule';

import type { FilenameDateConfig } from './FilenameDate';
import type { GlobalFilterConfig, GlobalFilterProfile } from '@/core/filtering/FilterRule';
import type { GlobalQueryConfig } from '@/core/query/GlobalQuery';
import { DEFAULT_GLOBAL_FILTER_CONFIG } from '@/core/filtering/FilterRule';
import { DEFAULT_GLOBAL_QUERY_CONFIG } from '@/core/query/GlobalQuery';
import { DEFAULT_URGENCY_SETTINGS, type UrgencySettings } from '@/core/urgency/UrgencySettings';

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

export interface DependencyGraphSettings {
  enabled: boolean;
  defaultDepth: number;
  hideCompletedByDefault: boolean;
  cycleHandlingMode: 'strict' | 'warn';
}

export interface EscalationThreshold {
  minDays: number;
  maxDays?: number;
}

export interface EscalationSettings {
  enabled: boolean;
  includeScheduled: boolean;
  thresholds: {
    warning: EscalationThreshold;
    critical: EscalationThreshold;
    severe: EscalationThreshold;
  };
  badgeVisibility: {
    dashboard: boolean;
    taskList: boolean;
    timeline: boolean;
  };
  colorTheme: 'auto' | 'high-contrast';
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

  /** Dependency graph configuration (Phase 6) */
  dependencyGraph: DependencyGraphSettings;
  
  /** Filename-based date extraction (Phase 5) */
  filenameDate: FilenameDateConfig;
  
  /** Global task filter (Phase 5) */
  globalFilter: GlobalFilterConfig;

  /** Global query defaults */
  globalQuery: GlobalQueryConfig;

  /** Urgency scoring configuration */
  urgency: UrgencySettings;

  /** Escalation dashboard configuration */
  escalation: EscalationSettings;
  
  /** Display timezone for date rendering */
  displayTimezone?: string;

  // Phase 3: Advanced Features
  
  /** Smart recurrence configuration */
  smartRecurrence: SmartRecurrenceSettings;
  
  /** Natural language input configuration */
  naturalLanguage: NaturalLanguageSettings;
  
  /** Cross-note dependencies configuration */
  crossNoteDependencies: CrossNoteDependenciesSettings;

  /** Smart suggestions configuration */
  smartSuggestions: SmartSuggestionsSettings;

  /** Predictive scheduling configuration */
  predictiveScheduling: PredictiveSchedulingSettings;

  /** Keyboard navigation configuration */
  keyboardNavigation: KeyboardNavigationSettings;
  
  /** Inline task auto-creation configuration (Phase 3) */
  inlineTasks: InlineTaskSettings;

  /** Block-linked smart actions configuration */
  blockActions: BlockActionSettings;
}

/**
 * Smart recurrence settings (Phase 3)
 */
export interface SmartRecurrenceSettings {
  enabled: boolean;
  autoAdjust: boolean;
  minCompletionsForLearning: number;
  confidenceThreshold: number;
  sensitivity: 'conservative' | 'balanced' | 'aggressive';
  minSampleSize: number;
  minConfidence: number;
}

/**
 * Natural language settings (Phase 3)
 */
export interface NaturalLanguageSettings {
  enabled: boolean;
  showConfidenceScore: boolean;
  provideExamples: boolean;
}

/**
 * Cross-note dependencies settings (Phase 3)
 */
export interface CrossNoteDependenciesSettings {
  enabled: boolean;
  checkInterval: number; // minutes
  notifyWhenMet: boolean;
}

/**
 * Smart suggestions settings
 */
export interface SmartSuggestionsSettings {
  enabled: boolean;
  minConfidence: number; // 0-1
  showDismissed: boolean;
  autoApplyHighConfidence: boolean;
}

/**
 * Predictive scheduling settings
 */
export interface PredictiveSchedulingSettings {
  enabled: boolean;
  showHeatmap: boolean;
  minDataPoints: number;
  workingHours: { start: number; end: number };
  preferredDays: number[];
}

/**
 * Keyboard navigation settings
 */
export interface KeyboardNavigationSettings {
  enabled: boolean;
  useVimKeybindings: boolean;
  customKeybindings: Record<string, string>;
  showModeIndicator: boolean;
  showQuickHints: boolean;
  enableCommandPalette: boolean;
}

/**
 * Inline task settings (Phase 3)
 */
export interface InlineTaskSettings {
  /** Core toggle */
  enableInlineCreation: boolean;
  
  /** Auto-creation mode */
  autoCreateOnEnter: boolean;
  autoCreateOnBlur: boolean;
  
  /** Normalization */
  normalizeOnSave: boolean;
  
  /** Strict mode */
  strictParsing: boolean;
  
  /** UI */
  showInlineHints: boolean;
  highlightManagedTasks: boolean;
  
  /** Phase 4: Inline checkbox toggle handling */
  enableInlineToggle: boolean;
  updateBlockOnToggle: boolean;
  showToggleNotifications: boolean;
}

/**
 * Block-linked smart action settings
 */
export interface BlockActionSettings {
  enabled: boolean;
  debounceMs: number;
}

/**
 * Default settings
 */
export const DEFAULT_ESCALATION_SETTINGS: EscalationSettings = {
  enabled: true,
  includeScheduled: true,
  thresholds: {
    warning: { minDays: 1, maxDays: 2 },
    critical: { minDays: 3, maxDays: 7 },
    severe: { minDays: 8 },
  },
  badgeVisibility: {
    dashboard: true,
    taskList: true,
    timeline: false,
  },
  colorTheme: 'auto',
};

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
  dependencyGraph: {
    enabled: true,
    defaultDepth: 3,
    hideCompletedByDefault: true,
    cycleHandlingMode: 'strict',
  },
  filenameDate: {
    enabled: false,
    patterns: ['YYYY-MM-DD', 'YYYYMMDD'],
    folders: ['daily/', 'journal/'],
    targetField: 'scheduled',
  },
  globalFilter: DEFAULT_GLOBAL_FILTER_CONFIG,
  globalQuery: DEFAULT_GLOBAL_QUERY_CONFIG,
  urgency: DEFAULT_URGENCY_SETTINGS,
  escalation: DEFAULT_ESCALATION_SETTINGS,
  smartRecurrence: {
    enabled: false,
    autoAdjust: false,
    minCompletionsForLearning: 10,
    confidenceThreshold: 0.7,
    sensitivity: 'conservative',
    minSampleSize: 6,
    minConfidence: 0.75,
  },
  naturalLanguage: {
    enabled: true,
    showConfidenceScore: true,
    provideExamples: true,
  },
  crossNoteDependencies: {
    enabled: true,
    checkInterval: 5,
    notifyWhenMet: true,
  },
  smartSuggestions: {
    enabled: true,
    minConfidence: 0.65,
    showDismissed: false,
    autoApplyHighConfidence: false,
  },
  predictiveScheduling: {
    enabled: true,
    showHeatmap: true,
    minDataPoints: 5,
    workingHours: { start: 6, end: 22 },
    preferredDays: [1, 2, 3, 4, 5], // Monday-Friday
  },
  keyboardNavigation: {
    enabled: false, // Opt-in feature
    useVimKeybindings: true,
    customKeybindings: {},
    showModeIndicator: true,
    showQuickHints: true,
    enableCommandPalette: true,
  },
  inlineTasks: {
    enableInlineCreation: true,
    autoCreateOnEnter: false,
    autoCreateOnBlur: false,
    normalizeOnSave: true,
    strictParsing: false,
    showInlineHints: true,
    highlightManagedTasks: true,
    enableInlineToggle: true,
    updateBlockOnToggle: true,
    showToggleNotifications: false,
  },
  blockActions: {
    enabled: true,
    debounceMs: 250,
  },
};

/**
 * Merge user settings with defaults
 */
export function mergeSettings(userSettings: Partial<PluginSettings>): PluginSettings {
  // ========== NEW: Migrate old globalFilter format to profiles ==========
  if (userSettings.globalFilter && !(userSettings.globalFilter as any).profiles) {
    const legacyConfig = userSettings.globalFilter as any;

    const migratedProfile: GlobalFilterProfile = {
      id: 'migrated-default',
      name: 'Migrated Settings',
      description: 'Automatically migrated from previous version',
      includePaths: [],
      excludePaths: [
        ...(legacyConfig.excludeFolders || []),
        ...(legacyConfig.excludeFilePatterns || []),
      ],
      includeTags: [],
      excludeTags: legacyConfig.excludeTags || [],
      includeRegex: undefined,
      excludeRegex: undefined,
      regexTargets: ['taskText'],
      excludeStatusTypes: legacyConfig.excludeStatusTypes || [],
    };

    userSettings.globalFilter = {
      enabled: legacyConfig.enabled ?? false,
      mode: legacyConfig.mode ?? 'all',
      activeProfileId: 'migrated-default',
      profiles: [migratedProfile],
    };
  }
  // ========== END MIGRATION ==========

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
    dependencyGraph: {
      ...DEFAULT_SETTINGS.dependencyGraph,
      ...userSettings.dependencyGraph,
    },
    filenameDate: {
      ...DEFAULT_SETTINGS.filenameDate,
      ...userSettings.filenameDate,
    },
    globalFilter: {
      ...DEFAULT_SETTINGS.globalFilter,
      ...userSettings.globalFilter,
      profiles: userSettings.globalFilter?.profiles ?? DEFAULT_SETTINGS.globalFilter.profiles,
    },
    globalQuery: {
      ...DEFAULT_SETTINGS.globalQuery,
      ...userSettings.globalQuery,
    },
    urgency: {
      ...DEFAULT_SETTINGS.urgency,
      ...userSettings.urgency,
    },
    escalation: {
      ...DEFAULT_SETTINGS.escalation,
      ...userSettings.escalation,
      thresholds: {
        warning: {
          ...DEFAULT_SETTINGS.escalation.thresholds.warning,
          ...userSettings.escalation?.thresholds?.warning,
        },
        critical: {
          ...DEFAULT_SETTINGS.escalation.thresholds.critical,
          ...userSettings.escalation?.thresholds?.critical,
        },
        severe: {
          ...DEFAULT_SETTINGS.escalation.thresholds.severe,
          ...userSettings.escalation?.thresholds?.severe,
        },
      },
      badgeVisibility: {
        ...DEFAULT_SETTINGS.escalation.badgeVisibility,
        ...userSettings.escalation?.badgeVisibility,
      },
    },
    smartRecurrence: {
      ...DEFAULT_SETTINGS.smartRecurrence,
      ...userSettings.smartRecurrence,
    },
    naturalLanguage: {
      ...DEFAULT_SETTINGS.naturalLanguage,
      ...userSettings.naturalLanguage,
    },
    crossNoteDependencies: {
      ...DEFAULT_SETTINGS.crossNoteDependencies,
      ...userSettings.crossNoteDependencies,
    },
    smartSuggestions: {
      ...DEFAULT_SETTINGS.smartSuggestions,
      ...userSettings.smartSuggestions,
    },
    predictiveScheduling: {
      ...DEFAULT_SETTINGS.predictiveScheduling,
      ...userSettings.predictiveScheduling,
      preferredDays: userSettings.predictiveScheduling?.preferredDays ?? DEFAULT_SETTINGS.predictiveScheduling.preferredDays,
      workingHours: userSettings.predictiveScheduling?.workingHours ?? DEFAULT_SETTINGS.predictiveScheduling.workingHours,
    },
    keyboardNavigation: {
      ...DEFAULT_SETTINGS.keyboardNavigation,
      ...userSettings.keyboardNavigation,
      customKeybindings: userSettings.keyboardNavigation?.customKeybindings ?? DEFAULT_SETTINGS.keyboardNavigation.customKeybindings,
    },
    inlineTasks: {
      ...DEFAULT_SETTINGS.inlineTasks,
      ...userSettings.inlineTasks,
    },
    blockActions: {
      ...DEFAULT_SETTINGS.blockActions,
      ...userSettings.blockActions,
    },
  };
}
