# API Documentation

## Core Classes

### Task

Represents a recurring task with all its properties.

```typescript
interface Task {
  id: string;                      // Unique identifier
  name: string;                    // Task name/title
  lastCompletedAt?: string;        // Last completion timestamp (ISO)
  dueAt: string;                   // Current due date (ISO)
  frequency: Frequency;            // Recurrence rule
  enabled: boolean;                // Active state
  linkedBlockId?: string;          // Linked SiYuan block ID (NEW)
  linkedBlockContent?: string;     // Cached block content (NEW)
  priority?: "low" | "normal" | "high" | "urgent";
  tags?: string[];
  notificationChannels?: string[];
  timezone?: string;
  category?: string;
  description?: string;
  // Analytics
  completionCount?: number;
  missCount?: number;
  currentStreak?: number;
  bestStreak?: number;
  recentCompletions?: string[];
  snoozeCount?: number;
  maxSnoozes?: number;
  // Timestamps
  createdAt: string;
  updatedAt: string;
}
```

#### Methods

**createTask(name, frequency, dueAt?): Task**

Creates a new task with default values.

```typescript
import { createTask } from "@/core/models/Task";
import { createDefaultFrequency } from "@/core/models/Frequency";

const task = createTask("My Task", createDefaultFrequency());
```

**isTask(obj): boolean**

Type guard to check if an object is a valid Task.

---

### Frequency

Defines how a task recurs.

```typescript
interface Frequency {
  type: "daily" | "weekly" | "monthly";  // Recurrence type
  interval: number;                       // Every N periods
  time?: string;                          // Fixed time (HH:mm)
  weekdays?: number[];                    // For weekly (0-6)
}
```

#### Methods

**createDefaultFrequency(): Frequency**

Creates a default daily frequency at 09:00.

**isValidFrequency(frequency): boolean**

Validates a frequency object.

---

### RecurrenceEngine

Calculates next occurrence dates based on frequency rules.

```typescript
class RecurrenceEngine {
  calculateNext(currentDue: Date, frequency: Frequency): Date;
  getOccurrencesInRange(
    startDate: Date,
    endDate: Date,
    frequency: Frequency,
    firstOccurrence: Date
  ): Date[];
  getMissedOccurrences(
    lastCheckedAt: Date,
    now: Date,
    frequency: Frequency,
    firstOccurrence: Date
  ): Date[];  // NEW
}
```

#### Methods

**calculateNext(currentDue, frequency): Date**

Calculates the next occurrence after the current due date.

```typescript
const engine = new RecurrenceEngine();
const nextDue = engine.calculateNext(
  new Date("2024-01-15"),
  { type: "daily", interval: 1, time: "09:00" }
);
// Returns: 2024-01-16 09:00:00
```

**getOccurrencesInRange(startDate, endDate, frequency, firstOccurrence): Date[]**

Gets all occurrences within a date range.

```typescript
const occurrences = engine.getOccurrencesInRange(
  new Date("2024-01-01"),
  new Date("2024-01-31"),
  { type: "weekly", interval: 1, weekdays: [1, 3, 5] },
  new Date("2024-01-01")
);
// Returns array of dates on Mondays, Wednesdays, and Fridays
```

**getMissedOccurrences(lastCheckedAt, now, frequency, firstOccurrence): Date[] (NEW)**

Gets all missed occurrences between two timestamps. Used for recovering missed tasks after plugin restart.

```typescript
const missed = engine.getMissedOccurrences(
  new Date("2024-01-01T09:00:00Z"),  // Last check time
  new Date("2024-01-05T09:00:00Z"),  // Now
  { type: "daily", interval: 1, time: "09:00" },
  new Date("2023-12-31T09:00:00Z")   // First occurrence
);
// Returns array of dates that were missed: Jan 2, 3, 4
```

---

### TaskStorage

Manages task persistence using SiYuan storage API. Enhanced with block index for fast lookups.

```typescript
class TaskStorage {
  async init(): Promise<void>;
  async save(): Promise<void>;
  getAllTasks(): Task[];
  getTask(id: string): Task | undefined;
  getTaskByBlockId(blockId: string): Task | undefined;  // NEW
  async saveTask(task: Task): Promise<void>;
  async deleteTask(id: string): Promise<void>;
  getEnabledTasks(): Task[];
  getTodayAndOverdueTasks(): Task[];
  getTasksInRange(startDate: Date, endDate: Date): Task[];
}
```

#### Methods

**init(): Promise<void>**

Loads tasks from disk and rebuilds the block index. Must be called before other operations.

**saveTask(task): Promise<void>**

Saves or updates a task. If the task has a `linkedBlockId`, it will be indexed for fast lookups and synced to block attributes.

```typescript
const task = createTask("My Task", frequency);
task.linkedBlockId = "block-123";  // Link to SiYuan block
await storage.saveTask(task);
```

**getTaskByBlockId(blockId): Task | undefined (NEW)**

Fast lookup of tasks by their linked SiYuan block ID.

```typescript
const task = storage.getTaskByBlockId("block-123");
if (task) {
  console.log(`Found task: ${task.name}`);
}
```

**getAllTasks(): Task[]**

Returns all tasks.

**getTodayAndOverdueTasks(): Task[]**

Returns tasks due today or earlier.

**getTasksInRange(startDate, endDate): Task[]**

Returns tasks due within a date range.

---

### Scheduler

Manages task timing and triggers notifications. Enhanced with missed task recovery.

```typescript
class Scheduler {
  start(onTaskDue: (task: Task) => void, onTaskMissed?: (task: Task) => void): void;
  stop(): void;
  async recoverMissedTasks(): Promise<void>;  // NEW
  async markTaskDone(taskId: string): Promise<void>;
  async delayTask(taskId: string, delayMinutes: number): Promise<void>;
  async delayToTomorrow(taskId: string): Promise<void>;
  async skipOccurrence(taskId: string): Promise<void>;
  getRecurrenceEngine(): RecurrenceEngine;
}
```

#### Methods

**start(onTaskDue, onTaskMissed?): void**

Starts the scheduler with callbacks for due and missed tasks.

```typescript
scheduler.start(
  async (task) => {
    await eventService.emitTaskEvent("task.due", task);
  },
  async (task) => {
    await eventService.emitTaskEvent("task.missed", task);
  }
);
```

**recoverMissedTasks(): Promise<void> (NEW)**

Recovers missed tasks from previous plugin session. This method:
- Compares current time with last run timestamp
- Finds all task occurrences that were missed
- Triggers missed task notifications
- Advances overdue tasks to next future occurrence

```typescript
// Called automatically on plugin startup
await scheduler.recoverMissedTasks();
```

**stop(): void**

Stops the scheduler.

**markTaskDone(taskId): Promise<void>**

Marks a task as done and reschedules it to the next occurrence.

```typescript
await scheduler.markTaskDone(task.id);
```

**delayTask(taskId, delayMinutes): Promise<void>**

Delays a task by specified minutes (snooze).

```typescript
await scheduler.delayTask(task.id, 60);  // Delay by 1 hour
```

**delayToTomorrow(taskId): Promise<void>**

Delays a task to tomorrow at the same time.

```typescript
await scheduler.delayToTomorrow(task.id);
```

**skipOccurrence(taskId): Promise<void>**

Skips current occurrence and advances to next recurrence interval.

```typescript
await scheduler.skipOccurrence(task.id);  // Skip and reschedule
```

---

### EventService

Emits structured task events to n8n and manages retry queue. Enhanced with startup flush and detailed connection testing.

```typescript
class EventService {
  async init(): Promise<void>;
  async flushQueueOnStartup(): Promise<void>;  // NEW
  async testConnection(): Promise<{ success: boolean; message: string }>;  // Enhanced
  async emitTaskEvent(event: TaskEventType, task: Task, escalationLevel?: number): Promise<void>;
  async flushQueue(): Promise<void>;
  getConfig(): NotificationConfig;
  async saveConfig(config: NotificationConfig): Promise<void>;
}
```

#### Methods

**init(): Promise<void>**

Initializes the service, loads queue, and flushes pending events from previous session.

**flushQueueOnStartup(): Promise<void> (NEW)**

Attempts to flush any pending events from the previous session. Called automatically during init.

```typescript
// Automatically called in init()
await eventService.flushQueueOnStartup();
```

**testConnection(): Promise<{ success: boolean; message: string }> (Enhanced)**

Tests the n8n webhook connection with detailed feedback.

```typescript
const result = await eventService.testConnection();
if (result.success) {
  console.log("Connected!");
} else {
  console.error(`Connection failed: ${result.message}`);
}
```

**emitTaskEvent(event, task, escalationLevel?): Promise<void>**

Emits a task event to n8n. Events are deduplicated and queued for retry on failure.

```typescript
await eventService.emitTaskEvent("task.due", task, 0);
await eventService.emitTaskEvent("task.missed", task, 1);
await eventService.emitTaskEvent("task.completed", task, 0);
```

---

### TaskManager (NEW)

Singleton manager that manages the lifecycle of all task-related services.

```typescript
class TaskManager {
  static getInstance(plugin?: Plugin): TaskManager;
  async initialize(): Promise<void>;
  async start(onTaskDue: (task: Task) => void, onTaskMissed?: (task: Task) => void): Promise<void>;
  async destroy(): Promise<void>;
  getStorage(): TaskStorage;
  getScheduler(): Scheduler;
  getEventService(): EventService;
  getNotificationState(): NotificationState;
  isReady(): boolean;
}
```

#### Methods

**getInstance(plugin?): TaskManager**

Gets the singleton instance. Plugin is required on first call.

```typescript
const manager = TaskManager.getInstance(plugin);
```

**initialize(): Promise<void>**

Initializes all core services (storage, scheduler, event service, notification state).

```typescript
await manager.initialize();
```

**start(onTaskDue, onTaskMissed?): Promise<void>**

Starts the scheduler and triggers missed task recovery.

```typescript
await manager.start(
  async (task) => { /* task due */ },
  async (task) => { /* task missed */ }
);
```

**destroy(): Promise<void>**

Cleans up all services and resets singleton.

---

### SettingUtils<T> (NEW)

Type-safe settings management with automatic persistence.

```typescript
class SettingUtils<T> {
  constructor(plugin: Plugin, storageKey: string, defaults: T);
  async load(): Promise<T>;
  async save(settings?: T): Promise<void>;
  get(): T;
  async set<K extends keyof T>(key: K, value: T[K]): Promise<void>;
  async reset(): Promise<void>;
  has<K extends keyof T>(key: K): boolean;
  getValue<K extends keyof T>(key: K): T[K];
}
```

#### Example

```typescript
interface MySettings {
  theme: "light" | "dark";
  autoSave: boolean;
  interval: number;
}

const settings = new SettingUtils<MySettings>(
  plugin,
  "my-settings",
  { theme: "light", autoSave: true, interval: 60 }
);

await settings.load();
await settings.set("theme", "dark");
const theme = settings.getValue("theme");
```

---

## Block Menu Integration (NEW)

The plugin now integrates with SiYuan's block context menu for seamless task creation.

### Features

- **Create Recurring Task**: Right-click any block and create a task linked to it
- **Quick Actions**: For blocks with existing tasks, quick complete and snooze options
- **Auto-extraction**: Automatically extracts task name and time from block content

### Usage

1. Right-click on any block icon
2. Select "Create Recurring Task" from the menu
3. The task form opens with pre-filled details from the block
4. For blocks with existing tasks, use "Complete Task" or "Snooze Task" options

### Block Linking

Tasks can be linked to SiYuan blocks:

```typescript
const task = createTask("Review Notes", frequency);
task.linkedBlockId = "20240115-123456-abc123";  // SiYuan block ID
task.linkedBlockContent = "Review project notes";
await storage.saveTask(task);

// Fast lookup by block ID
const linkedTask = storage.getTaskByBlockId("20240115-123456-abc123");
```

---

## Missed Task Recovery (NEW)

The scheduler now automatically recovers missed tasks after plugin restart.

### How It Works

1. On plugin shutdown, the scheduler saves the current timestamp
2. On plugin startup, it loads the last run timestamp
3. It calculates all missed occurrences between last run and now
4. It triggers missed task notifications
5. It advances overdue tasks to their next future occurrence

### Example

If the plugin was offline for 3 days and a task was due every day at 9 AM:
- All 3 missed occurrences will be detected
- Missed task notifications will be sent for each
- The task will be advanced to tomorrow at 9 AM (next future occurrence)

### Configuration

No configuration needed - recovery happens automatically. To disable, remove the recovery call from plugin initialization.

---

## Constants (NEW)

New constants added in `src/utils/constants.ts`:

```typescript
// Last run timestamp for recovery
LAST_RUN_TIMESTAMP_KEY = "last-run-timestamp"

// Block attribute keys for task sync
BLOCK_ATTR_TASK_ID = "custom-recurring-task-id"
BLOCK_ATTR_TASK_DUE = "custom-recurring-task-due"
BLOCK_ATTR_TASK_ENABLED = "custom-recurring-task-enabled"
```

---

## NotificationService

Orchestrates multi-channel notification delivery.

```typescript
class NotificationService {
  async init(): Promise<void>;
  async saveConfig(config: NotificationConfig): Promise<void>;
  async notifyTask(task: Task): Promise<void>;
  getConfig(): NotificationConfig;
  async testChannel(channel: "n8n" | "telegram" | "gmail"): Promise<boolean>;
}
```

#### Methods

**init(): Promise<void>**

Initializes the service and loads configuration.

**notifyTask(task): Promise<void>**

Sends notifications for a task through all configured channels.

```typescript
await notificationService.notifyTask(task);
```

**saveConfig(config): Promise<void>**

Saves notification configuration.

```typescript
await notificationService.saveConfig({
  n8n: { webhookUrl: "https://...", enabled: true },
  telegram: { botToken: "...", chatId: "...", enabled: true },
  gmail: { ... }
});
```

**testChannel(channel): Promise<boolean>**

Tests a specific notification channel.

---

## Notification Types

### NotificationMessage

Message sent to notification channels.

```typescript
interface NotificationMessage {
  taskName: string;
  dueAt: string;
  payload: {
    note?: string;
    media?: string;
    link?: string;
  };
}
```

### NotificationSender

Interface for notification channel implementations.

```typescript
interface NotificationSender {
  send(message: NotificationMessage): Promise<boolean>;
  isConfigured(): boolean;
}
```

### Channel Configurations

**N8nConfig**
```typescript
interface N8nConfig {
  webhookUrl: string;
  enabled: boolean;
}
```

**TelegramConfig**
```typescript
interface TelegramConfig {
  botToken: string;
  chatId: string;
  enabled: boolean;
}
```

**GmailConfig**
```typescript
interface GmailConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  recipientEmail: string;
  enabled: boolean;
}
```

---

## Utility Functions

### Date Utilities

Located in `src/utils/date.ts`:

- `parseTime(timeStr: string): { hours: number; minutes: number }`
- `formatTime(date: Date): string`
- `formatDate(date: Date): string`
- `formatDateTime(date: Date): string`
- `isToday(date: Date): boolean`
- `isPast(date: Date): boolean`
- `isOverdue(date: Date): boolean`
- `addDays(date: Date, days: number): Date`
- `addWeeks(date: Date, weeks: number): Date`
- `addMonths(date: Date, months: number): Date`
- `setTime(date: Date, hours: number, minutes: number): Date`
- `startOfDay(date: Date): Date`
- `endOfDay(date: Date): Date`
- `daysBetween(date1: Date, date2: Date): number`
- `getDateRange(startDate: Date, days: number): Date[]`

### Constants

Located in `src/utils/constants.ts`:

- `PLUGIN_NAME` - Plugin identifier
- `STORAGE_KEY` - Storage key for tasks
- `SETTINGS_KEY` - Storage key for settings
- `DOCK_TYPE` - Dock panel type identifier
- `DEFAULT_NOTIFICATION_CONFIG` - Default notification configuration
- `SCHEDULER_INTERVAL_MS` - Scheduler check interval (60000ms)
- `TIMELINE_DAYS` - Default timeline range (30 days)

---

## Plugin Lifecycle

### Initialization

```typescript
class RecurringTasksPlugin extends Plugin {
  async onload() {
    // 1. Initialize storage
    this.storage = new TaskStorage(this);
    await this.storage.init();
    
    // 2. Initialize notification service
    this.notificationService = new NotificationService(this);
    await this.notificationService.init();
    
    // 3. Start scheduler
    this.scheduler = new Scheduler(this.storage);
    this.scheduler.start(async (task) => {
      await this.notificationService.notifyTask(task);
    });
    
    // 4. Add dock panel
    this.addDock({ ... });
  }
  
  async onunload() {
    // 1. Stop scheduler
    this.scheduler.stop();
    
    // 2. Destroy UI
    this.destroyDashboard();
  }
}
```

---

## Examples

### Creating a Daily Task

```typescript
import { createTask } from "@/core/models/Task";

const task = createTask("Daily Review", {
  type: "daily",
  interval: 1,
  time: "09:00"
}, new Date());

task.alertPayload = {
  note: "Review your tasks for today"
};

await storage.saveTask(task);
```

### Creating a Weekly Task

```typescript
const weeklyTask = createTask("Weekly Planning", {
  type: "weekly",
  interval: 1,
  weekdays: [1], // Monday
  time: "10:00"
});

await storage.saveTask(weeklyTask);
```

### Getting Upcoming Tasks

```typescript
const today = new Date();
const nextWeek = new Date(today);
nextWeek.setDate(nextWeek.getDate() + 7);

const upcomingTasks = storage.getTasksInRange(today, nextWeek);
```

### Sending a Test Notification

```typescript
const success = await notificationService.testChannel("telegram");
if (success) {
  console.log("Test notification sent!");
}
```
