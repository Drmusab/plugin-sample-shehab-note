export const TASK_FORMATS = {
  tasksPluginEmoji: {
    taskSerializer: {
      symbols: {
        startDateSymbol: '🛫',
        scheduledDateSymbol: '⏳',
        dueDateSymbol: '📅',
        cancelledDateSymbol: '❌',
        createdDateSymbol: '➕',
        doneDateSymbol: '✅',
        recurrenceSymbol: '🔁',
        prioritySymbols: {
          Highest: '⏫',
          High: '🔺',
          Medium: '🔼',
          None: '',
          Low: '🔽',
          Lowest: '⏬',
        },
      },
    },
  },
};

export function getSettings() {
  return {
    provideAccessKeys: true,
    isShownInEditModal: {
      description: true,
      priority: true,
      recurrence: true,
      due: true,
      scheduled: true,
      start: true,
      status: true,
      created: true,
      done: true,
      cancelled: true,
      before_this: true,
      after_this: true,
    },
  };
}

export function updateSettings(settings: any): void {
  // Stub - settings updates handled elsewhere
}

export const defaultEditModalShowSettings = {
  description: true,
  priority: true,
  recurrence: true,
  due: true,
  scheduled: true,
  start: true,
  status: true,
  created: true,
  done: true,
  cancelled: true,
  before_this: true,
  after_this: true,
};
