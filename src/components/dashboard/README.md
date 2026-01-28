# Dashboard Split-View Components

This directory contains the new split-view dashboard components for Phase 2 implementation.

## Components

### DashboardSplitView.svelte
**Purpose:** Root container component with responsive grid layout.

**Features:**
- Grid layout: 40% task list / 60% editor (desktop)
- Stacked layout on mobile (< 768px)
- Integrates with `selectedTaskStore` for task selection state
- Handles task save and new task creation

**Props:**
```typescript
{
  tasks: Task[];
  statusOptions: Status[];
  initialTaskId?: string;
  onTaskSaved?: (task: Task) => Promise<void>;
  onNewTask?: () => void;
  onClose?: () => void;
}
```

### TaskListPane.svelte
**Purpose:** Filterable, keyboard-navigable task list.

**Features:**
- Filter dropdown: All / Today / Upcoming / Recurring / Overdue
- Task count badges per filter
- Keyboard navigation (↑↓ Enter Esc)
- "New Task" button

**Props:**
```typescript
{
  tasks: Task[];
  selectedTaskId?: string;
  onTaskSelect: (task: Task) => void;
  onNewTask: () => void;
}
```

### TaskRow.svelte
**Purpose:** Selectable task item with visual feedback.

**Features:**
- Click to select
- Keyboard accessible (button element)
- Selected state (blue border)
- Hover state
- Due date indicator with overdue highlighting
- Priority icon
- Recurrence indicator

**Props:**
```typescript
{
  task: Task;
  selected: boolean;
}
```

### TaskEditorPane.svelte
**Purpose:** Wrapper for EditTaskCore with embedded mode.

**Features:**
- Renders EditTaskCore with mode="embedded"
- Handles save events
- Shows EmptyState when no task selected
- Error handling with user feedback

**Props:**
```typescript
{
  task: Task | null;
  allTasks: Task[];
  statusOptions: Status[];
  onSave: (updatedTasks: Task[]) => Promise<void>;
  onNewTask: () => void;
}
```

### EmptyState.svelte
**Purpose:** Placeholder when no task selected.

**Features:**
- Centered icon + text
- Call-to-action: "Select a task to edit or create a new one"
- "Create New Task" button

**Events:**
- `newTask` - Emitted when user clicks create button

## State Management

The components integrate with the `selectedTaskStore` from Phase 1:

```typescript
import { selectedTaskStore, selectTask, clearSelection } from '@/stores/selectedTask';

// Select a task
selectTask(task);

// Clear selection
clearSelection();

// Subscribe to changes
$: currentTask = $selectedTaskStore;
```

## Keyboard Navigation

The TaskListPane supports keyboard navigation:

- `↑` / `↓` - Navigate task list
- `Enter` - Select focused task
- `Esc` - Clear selection

## Responsive Breakpoints

- **Desktop (> 1024px):** 40% list / 60% editor
- **Tablet (769px - 1024px):** 35% list / 65% editor
- **Mobile (< 768px):** Stacked layout (300px list height)
- **Large Desktop (> 1400px):** 45% list / 55% editor

## Auto-Save Integration

The components integrate with EditTaskCore's auto-save feature:

- Changes auto-save after 500ms of inactivity
- Visual indicator shows "Unsaved changes (auto-saving...)"
- No "Apply" button needed in embedded mode
- Toast notifications on successful save

## Usage Example

```svelte
<script>
  import DashboardSplitView from '@/components/dashboard/DashboardSplitView.svelte';
  import { StatusRegistry } from '@/vendor/obsidian-tasks/types/Status';
  
  let tasks = [...]; // Your tasks array
  let statusOptions = StatusRegistry.getInstance().registeredStatuses;
  
  async function handleTaskSaved(task) {
    await taskRepository.save(task);
  }
  
  function handleNewTask() {
    // Create new task logic
  }
</script>

<DashboardSplitView 
  {tasks}
  {statusOptions}
  {onTaskSaved}
  {onNewTask}
/>
```

## Integration with Existing Dashboard

See `src/dashboard/integration/SplitViewIntegration.ts` for an example of how to integrate these components with the existing `RecurringDashboardView`.

The integration can be controlled with a feature flag:

```typescript
if (settings.useSplitViewDashboard) {
  mountSplitView(container, props, initialTask);
} else {
  dashboard.mount(initialTask);
}
```

## Styling

Styles are defined inline in each component using Svelte's `<style>` blocks. Additional global styles can be found in:

- `src/styles/dashboard-split-view.scss` - Responsive grid layout styles
- `src/dashboard/styles/dashboard.scss` - Existing dashboard styles

## Testing

The components are designed to be testable:

1. **Unit tests:** Test individual component behavior
2. **Integration tests:** Test full split-view flow
3. **Manual testing:** Test keyboard navigation and responsive layout

Example test structure:

```typescript
describe('DashboardSplitView', () => {
  it('should render task list and editor panes', () => {
    const { getByText } = render(DashboardSplitView, {
      props: { tasks, statusOptions }
    });
    expect(getByText('All Tasks')).toBeInTheDocument();
  });
  
  it('should select task on row click', async () => {
    // Test task selection
  });
});
```

## Performance Optimizations

- Task counts are computed reactively using Svelte's `$:` syntax
- Filter logic is debounced to prevent excessive re-renders
- Virtual scrolling can be added for large task lists (> 100 tasks)

## Accessibility

- All interactive elements are keyboard accessible
- Proper ARIA labels on buttons and interactive elements
- Focus management for keyboard navigation
- High contrast mode support
- Reduced motion preferences respected

## Browser Support

The components use modern CSS features:

- CSS Grid for layout
- CSS Custom Properties for theming
- CSS Media Queries for responsive design
- Flexbox for component internals

All features are supported in modern browsers (Chrome, Firefox, Safari, Edge).
