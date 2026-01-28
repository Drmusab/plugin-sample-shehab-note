# Recurring Task Dashboard

## Overview

The Recurring Task Dashboard provides a persistent interface for creating and editing recurring tasks using the vendored **Obsidian-Tasks** UI components. This integration allows the plugin to leverage a battle-tested task editor while maintaining clean separation between UI and business logic.

## Architecture

### Component Stack

```
┌─────────────────────────────────────────────────────────────┐
│                    Dashboard Container                       │
│            (RecurringDashboardView.ts)                       │
│  - Lifecycle management                                      │
│  - Event handling                                            │
│  - Error boundaries                                          │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ Mounts
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Obsidian-Tasks UI Layer                         │
│         (src/vendor/obsidian-tasks/ui/)                      │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │           EditTask.svelte                               │ │
│  │  - Task name/description editor                         │ │
│  │  - Date pickers (due, scheduled, start)                 │ │
│  │  - Priority selector                                    │ │
│  │  - Status picker                                        │ │
│  │  - Recurrence rule editor                               │ │
│  │  - Dependency picker (blockedBy, blocking)              │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  State: EditableTask                                         │
│  (Mutable task representation)                               │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ Submit event
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                  Adapter Layer                               │
│         (src/adapters/TaskDraftAdapter.ts)                   │
│                                                              │
│  toEditableTask()     : RecurringTask → EditableTask        │
│  fromEditableTask()   : EditableTask → RecurringTask        │
│  validate()           : Validate EditableTask               │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ Validated RecurringTask
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                  Business Logic Layer                        │
│                                                              │
│  RecurrenceEngineRRULE  : Validate recurrence rules          │
│  TaskRepository         : Persist tasks                      │
│  PluginEventBus         : Emit task:saved events             │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow

### Creating a New Task

```
1. User clicks "New Task"
     ↓
2. RecurringDashboardView.mount()
   - Creates empty EditableTask
   - Mounts EditTask.svelte
     ↓
3. User fills form and clicks "Apply"
     ↓
4. EditTask.svelte emits submit event
     ↓
5. RecurringDashboardView.handleSubmit()
   - Converts EditableTask → RecurringTask via TaskDraftAdapter
   - Validates recurrence with RecurrenceEngineRRULE
   - Saves to TaskRepository
   - Emits 'task:saved' event
     ↓
6. UI refreshes
```

### Editing Existing Task

```
1. User selects task from list
     ↓
2. RecurringDashboardView.loadTask(task)
   - Converts RecurringTask → EditableTask via TaskDraftAdapter
   - Mounts EditTask.svelte with task data
     ↓
3. User edits form and clicks "Apply"
     ↓
4. Same as steps 4-6 above
```

## Field Mapping

The **TaskDraftAdapter** handles bidirectional conversion between:

### EditableTask (UI) ↔ RecurringTask (Business)

| EditableTask Field | Adapter Method | RecurringTask Field | Notes |
|-------------------|----------------|---------------------|-------|
| `description` | Direct | `name` | Task title |
| `priority` | `mapPriorityToRecurring()` | `priority` | Enum mapping |
| `status` | `mapStatusToRecurring()` | `status`, `enabled` | Type-safe conversion |
| `dueDate` | `parseDate()` | `dueAt` | ISO 8601 |
| `scheduledDate` | `parseDate()` | `scheduledAt` | ISO 8601 |
| `startDate` | `parseDate()` | `startAt` | ISO 8601 |
| `recurrenceRule` | `rRuleToFrequency()` | `frequency` | Text → Frequency object |
| `blockedBy` | `mapDependenciesToIds()` | `blockedBy` | Task[] → ID[] |
| `blocking` | `mapDependenciesToIds()` | `blocks` | Task[] → ID[] |

See `/docs/integration/field-mapping.md` for complete field reference.

## Files in This Directory

### Active Components

- **RecurringDashboardView.ts** - Dashboard container and lifecycle manager
- **styles/dashboard.scss** - Dashboard-specific styles

### Deprecated Files (Legacy)

These files are kept for backward compatibility but are no longer used:

- **adapters/TaskDraftAdapter.ts** - ⚠️ DEPRECATED - Use `src/adapters/TaskDraftAdapter.ts`
- **models/TaskDraft.ts** - ⚠️ DEPRECATED - Use `EditableTask` from Obsidian-Tasks

## Integration Points

### 1. TaskDraftAdapter (`src/adapters/TaskDraftAdapter.ts`)

The **main adapter** that isolates UI from business logic:

```typescript
// Convert for display
const editableTask = TaskDraftAdapter.toEditableTask(
  recurringTask, 
  allTasks
);

// Convert for storage
const recurringTask = TaskDraftAdapter.fromEditableTask(
  editableTask,
  originalTask
);

// Validate before conversion
TaskDraftAdapter.validate(editableTask);
```

### 2. EditTask Component (`src/vendor/obsidian-tasks/ui/EditTask.svelte`)

Vendored Obsidian-Tasks UI component:

- Uses **EditableTask** for state management
- Provides rich editing experience
- Handles dependency selection
- Supports all Obsidian-Tasks features

### 3. RecurrenceEngineRRULE

Validates recurrence rules before saving:

```typescript
const nextOccurrence = recurrenceEngine.calculateNext(
  new Date(task.dueAt),
  task.frequency
);

if (!nextOccurrence) {
  throw new Error('Invalid recurrence rule');
}
```

## Error Handling

The dashboard implements error boundaries at multiple levels:

1. **Component Mounting**: Try-catch around Svelte mount
2. **Validation**: TaskDraftAdapter.validate() throws descriptive errors
3. **Recurrence Validation**: RecurrenceEngine validates rules
4. **Save Operations**: Repository errors are caught and displayed

Example:

```typescript
try {
  TaskDraftAdapter.validate(editableTask);
  const task = TaskDraftAdapter.fromEditableTask(editableTask);
  await repository.saveTask(task);
  toast.success('Task saved');
} catch (error) {
  toast.error(`Failed: ${error.message}`);
}
```

## Styling

Dashboard styles are in `styles/dashboard.scss`:

- Responsive breakpoints for narrow sidebars
- Smooth transitions for state changes
- Proper adaptation of modal styles for dashboard context

## Testing

Tests are located at:

- `tests/adapters/TaskDraftAdapter.test.ts` - Unit tests for adapter
- `tests/adapters/TaskDraftAdapter.integration.test.ts` - Integration tests

## Clean Architecture Principles

### ✅ What the Dashboard Does

- Mount/unmount UI components
- Handle user events (submit, close)
- Call adapters for data conversion
- Display success/error messages

### ❌ What the Dashboard Does NOT Do

- Direct business logic
- Direct storage access (uses TaskRepository)
- Recurrence calculation (uses RecurrenceEngine)
- Manual field mapping (uses TaskDraftAdapter)

## Migration Notes

If you're migrating from the old TaskEditorModal to this system:

1. Replace TaskDraft with EditableTask
2. Use TaskDraftAdapter from `src/adapters/` (not `src/dashboard/adapters/`)
3. Update imports to use Obsidian-Tasks components
4. Remove manual field mapping code (adapter handles it)

## Future Enhancements

Potential improvements:

1. **Advanced Loading States**: Skeleton screens for smoother perceived performance
2. **Optimistic Updates**: Update UI before server response
3. **Offline Support**: Queue operations when offline
4. **Undo/Redo**: Add command history
5. **Keyboard Shortcuts**: Add hotkeys for common actions
