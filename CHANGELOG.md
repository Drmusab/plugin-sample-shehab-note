# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- Extracted task storage and recurring task operations into TaskService and RecurringTaskService to keep the dashboard UI focused on rendering and event handling.
- Consolidated task lifecycle ownership under a singleton TaskManager and introduced a typed plugin-local event bus to replace global window events.
- Hardened null handling in task due-index bookkeeping to reduce unsafe assertions.

## [0.0.1] - 2026-01-11

### Added
- Initial release of Shehab-Note Recurring Task Manager plugin
- Core task management features:
  - Create, edit, and delete recurring tasks
  - Support for daily, weekly, and monthly recurrence patterns
  - Custom interval settings (e.g., every 2 weeks)
  - Fixed-time scheduling (e.g., every day at 09:00)
  - Weekday-specific rules for weekly tasks
- User interface:
  - Dashboard with three tabs (Today & Overdue, All Tasks, Timeline)
  - Task cards with Done and Delay actions
  - Task creation/editing form
  - Visual timeline view for upcoming tasks
- Notification system:
  - Multi-channel support (n8n, Telegram, Gmail)
  - Configurable notification settings
  - Test functionality for each channel
  - Custom alert payloads (note, media, link)
- Task scheduling:
  - Automatic task rescheduling after completion
  - Intelligent delay to tomorrow without affecting recurrence
  - Background scheduler checking every minute
- Data persistence:
  - Tasks stored using SiYuan storage API
  - Settings persistence
  - No data loss across restarts
- Internationalization:
  - English (en_US) translation
  - Chinese (zh_CN) translation
- Developer features:
  - TypeScript support
  - Svelte 5 with runes syntax
  - Comprehensive API documentation
  - Development guide
  - Build system with Vite

### Technical Details
- Built with TypeScript 5.5.3
- UI framework: Svelte 5.1.9
- Build tool: Vite 5.3.3
- Compatible with SiYuan 1.1.7+
- Plugin size: ~29KB (compressed)

### Known Limitations
- Requires manual configuration for each notification channel
- Gmail integration requires OAuth setup
- Timeline view limited to 30 days by default
- Scheduler granularity is 1 minute

[0.0.1]: https://github.com/Drmusab/plugin-sample-shehab-note/releases/tag/v0.0.1
