# Shehab-Note Recurring Task Manager

A powerful recurring task management plugin for Shehab-Note (SiYuan fork) with advanced scheduling, multi-channel notifications, and visual timeline planning.

## Features

### 🔁 Advanced Recurrence Rules
- **Daily, Weekly, Monthly scheduling** with customizable intervals
- **Fixed-time scheduling** (e.g., every day at 09:00)
- **Weekday-specific rules** for weekly tasks
- **Intelligent rescheduling** after task completion

### 📋 Task Management
- **Today & Overdue View** - Quick access to tasks requiring attention
- **All Tasks View** - Comprehensive task management with enable/disable toggles
- **Timeline View** - Visual calendar showing upcoming tasks for the next 30 days

### 🔔 Multi-Channel Notifications
- **n8n** - Webhook integration for workflow automation
- **Telegram** - Direct messaging via Telegram Bot API
- **Gmail** - Email notifications via Gmail API
- Send custom payloads including notes, media URLs, and links

### 🎯 Task Actions
- **✅ Done** - Mark task complete and automatically schedule next occurrence
- **🕒 Delay** - Postpone task to tomorrow without affecting recurrence pattern
- **✏️ Edit** - Modify task details, frequency, and notification settings
- **🗑️ Delete** - Remove tasks permanently

## Installation

1. Download the latest release from the [releases page](https://github.com/Drmusab/plugin-sample-shehab-note/releases)
2. Extract the `package.zip` to your Shehab-Note plugins directory
3. Restart Shehab-Note or reload plugins
4. Open the "Recurring Tasks" dock panel from the right sidebar

## Development

### Prerequisites
- Node.js 16+ and npm
- Shehab-Note or SiYuan installation

### Setup

```bash
# Install dependencies
npm install

# Build the plugin
npm run build

# Development mode with auto-rebuild
npm run dev

# Create symbolic link to your workspace (optional)
npm run make-link -- --workspace=/path/to/shehab-note/workspace
```

### Project Structure

```
src/
├── index.ts                      # Main plugin entry point
├── index.scss                    # Global plugin styles
├── core/                         # Core business logic
│   ├── models/                   # Data models (Task, Frequency)
│   ├── engine/                   # Recurrence & scheduling logic
│   └── storage/                  # Data persistence
├── services/                     # External integrations
│   ├── NotificationService.ts    # Notification orchestrator
│   └── senders/                  # Channel-specific senders
├── components/                   # Svelte UI components
│   ├── Dashboard.svelte          # Main dashboard
│   ├── tabs/                     # Tab components
│   ├── cards/                    # Task cards & forms
│   └── settings/                 # Settings panel
└── utils/                        # Utility functions
```

## Usage

### Creating a Task

#### Method 1: From Block Menu (NEW)

1. Right-click on any block icon in your document
2. Select "Create Recurring Task" from the context menu
3. The task form opens with pre-filled details from the block:
   - Task name extracted from first line of block
   - Time extracted if present (e.g., "09:00", "2:30 PM")
   - Block automatically linked for quick access
4. Complete the task details and click "Save Task"

**Quick Actions for Linked Blocks:**
- If a block already has a task, the menu shows:
  - ✅ Complete Task - Mark task done and reschedule
  - 🕒 Snooze Task - Delay task (15 min, 1 hour, or tomorrow)

#### Method 2: From Dashboard

1. Open the "Recurring Tasks" dock panel
2. Navigate to the "All Tasks" tab
3. Click "Create New Task"
4. Fill in task details:
   - Task name
   - Due date & time
   - Frequency (daily/weekly/monthly)
   - Interval (e.g., every 2 weeks)
   - Optional: Link to a block, add tags, set priority
5. Click "Save Task"

### Configuring Notifications

1. Click the ⚙️ Settings button in the dashboard header
2. Enable desired notification channels
3. Configure each channel:
   - **n8n**: Enter your webhook URL
   - **Telegram**: Enter bot token and chat ID
   - **Gmail**: Configure OAuth credentials and recipient email
4. Test each channel before saving
5. Click "Save Settings"

### Managing Tasks

- **Today & Overdue Tab**: View and complete tasks due today or earlier
- **All Tasks Tab**: View all recurring tasks, edit, delete, or toggle enabled/disabled
- **Timeline Tab**: Visual calendar view of upcoming tasks
- **Block Context Menu**: Right-click any block with a linked task for quick actions

### Missed Task Recovery (NEW)

The plugin now automatically recovers missed tasks after being offline:

- When the plugin restarts, it checks for tasks that were due while offline
- All missed occurrences are detected and notifications are sent
- Overdue tasks are automatically advanced to their next future occurrence
- No manual intervention needed - recovery happens automatically

**Example:** If your plugin was offline for 3 days and a daily task was due at 9 AM each day:
- You'll receive notifications for all 3 missed days
- The task will be rescheduled to tomorrow at 9 AM

## Configuration

### n8n Webhook

Get your webhook URL from your n8n workflow and paste it in the settings.

### Telegram Bot

1. Create a bot via [@BotFather](https://t.me/botfather)
2. Get your bot token
3. Get your chat ID by messaging [@userinfobot](https://t.me/userinfobot)
4. Enter both in the settings

### Gmail API

1. Create a project in [Google Cloud Console](https://console.cloud.google.com)
2. Enable Gmail API
3. Create OAuth 2.0 credentials
4. Get your client ID, client secret, and refresh token
5. Enter in the settings along with recipient email

## API

The plugin exposes the following main classes:

- `TaskStorage` - Manages task persistence
- `Scheduler` - Handles task scheduling and notifications
- `RecurrenceEngine` - Calculates next occurrence dates
- `NotificationService` - Orchestrates multi-channel notifications

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see LICENSE file for details

## Support

For issues, questions, or feature requests, please [open an issue](https://github.com/Drmusab/plugin-sample-shehab-note/issues) on GitHub.
