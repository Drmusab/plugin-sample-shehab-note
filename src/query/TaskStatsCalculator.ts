import { Task } from '../commands/types/CommandTypes';
import { TaskStatsResult, TaskStatsData } from '../commands/types/BulkCommandTypes';

/**
 * Task statistics calculator
 */
export class TaskStatsCalculator {
  /**
   * Calculate comprehensive task statistics
   */
  calculate(tasks: Task[], statsData: TaskStatsData): TaskStatsResult {
    // Filter by time range if specified
    let filteredTasks = tasks;
    if (statsData.timeRange) {
      filteredTasks = this.filterByTimeRange(tasks, statsData.timeRange);
    }

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Calculate stats
    const byStatus = this.countByField(filteredTasks, 'status');
    const byPriority = this.countByField(filteredTasks, 'priority');

    const recurringTasks = filteredTasks.filter((t) => t.recurrencePattern !== null);
    const completedTasks = filteredTasks.filter((t) => t.status === 'completed');
    const completedThisWeek = completedTasks.filter(
      (t) => t.completedAt && new Date(t.completedAt) > weekAgo
    );
    const completedThisMonth = completedTasks.filter(
      (t) => t.completedAt && new Date(t.completedAt) > monthAgo
    );

    const overdueTasks = filteredTasks.filter(
      (t) =>
        t.nextDueDate &&
        new Date(t.nextDueDate) < now &&
        t.status !== 'completed' &&
        t.status !== 'archived'
    );

    const upcomingTasks = filteredTasks.filter((t) => {
      if (!t.nextDueDate) return false;
      const due = new Date(t.nextDueDate);
      const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      return due > now && due <= nextWeek;
    });

    const upcomingByDay = this.groupUpcomingByDay(upcomingTasks, now);

    // Tag distribution
    const tagCounts = new Map<string, number>();
    filteredTasks.forEach((task) => {
      task.tags.forEach((tag) => {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      });
    });

    const topTags = Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Build result
    const result: TaskStatsResult = {
      totalTasks: filteredTasks.length,
      byStatus,
      byPriority,
      recurring: {
        total: recurringTasks.length,
        active: recurringTasks.filter((t) => t.status === 'active').length,
        paused: recurringTasks.filter((t) => t.status === 'paused').length,
      },
      completion: {
        total: completedTasks.length,
        thisWeek: completedThisWeek.length,
        thisMonth: completedThisMonth.length,
        averagePerDay:
          statsData.timeRange
            ? this.calculateAveragePerDay(completedTasks, statsData.timeRange)
            : 0,
      },
      overdue: {
        count: overdueTasks.length,
        taskIds: overdueTasks.map((t) => t.taskId),
      },
      upcoming: {
        count: upcomingTasks.length,
        byDay: upcomingByDay,
      },
      topTags,
    };

    // Add time range if specified
    if (statsData.timeRange) {
      result.timeRange = statsData.timeRange;
    }

    // Add trends if requested
    if (statsData.includeTrends) {
      result.trends = this.calculateTrends(filteredTasks);
    }

    return result;
  }

  /**
   * Filter tasks by time range
   */
  private filterByTimeRange(
    tasks: Task[],
    timeRange: { start: string; end: string }
  ): Task[] {
    const start = new Date(timeRange.start);
    const end = new Date(timeRange.end);

    return tasks.filter((task) => {
      const created = new Date(task.createdAt);
      return created >= start && created <= end;
    });
  }

  /**
   * Count tasks by field
   */
  private countByField(tasks: Task[], field: keyof Task): Record<string, number> {
    const counts: Record<string, number> = {};
    tasks.forEach((task) => {
      const value = String(task[field]);
      counts[value] = (counts[value] || 0) + 1;
    });
    return counts;
  }

  /**
   * Group upcoming tasks by day
   */
  private groupUpcomingByDay(tasks: Task[], now: Date): Record<string, number> {
    const byDay: Record<string, number> = {};

    tasks.forEach((task) => {
      if (!task.nextDueDate) return;

      const due = new Date(task.nextDueDate);
      const dayKey = due.toISOString().split('T')[0]; // YYYY-MM-DD

      byDay[dayKey] = (byDay[dayKey] || 0) + 1;
    });

    return byDay;
  }

  /**
   * Calculate average completions per day
   */
  private calculateAveragePerDay(
    completedTasks: Task[],
    timeRange: { start: string; end: string }
  ): number {
    if (completedTasks.length === 0) return 0;

    const start = new Date(timeRange.start);
    const end = new Date(timeRange.end);
    const days = Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));

    return Math.round((completedTasks.length / days) * 100) / 100; // 2 decimal places
  }

  /**
   * Calculate trends
   */
  private calculateTrends(tasks: Task[]): {
    completionRate: number;
    averageCompletionTime: number;
    missedRate: number;
  } {
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((t) => t.status === 'completed');

    const completionRate =
      totalTasks > 0 ? Math.round((completedTasks.length / totalTasks) * 100) / 100 : 0;

    // Average completion time (hours from creation to completion)
    const completionTimes = completedTasks
      .filter((t) => t.completedAt)
      .map((t) => {
        const created = new Date(t.createdAt).getTime();
        const completed = new Date(t.completedAt!).getTime();
        return (completed - created) / (1000 * 60 * 60); // hours
      });

    const averageCompletionTime =
      completionTimes.length > 0
        ? Math.round(
            (completionTimes.reduce((sum, time) => sum + time, 0) / completionTimes.length) * 100
          ) / 100
        : 0;

    // Missed rate (overdue tasks)
    const now = new Date();
    const overdueTasks = tasks.filter(
      (t) =>
        t.nextDueDate &&
        new Date(t.nextDueDate) < now &&
        t.status !== 'completed' &&
        t.status !== 'archived'
    );

    const missedRate =
      totalTasks > 0 ? Math.round((overdueTasks.length / totalTasks) * 100) / 100 : 0;

    return {
      completionRate,
      averageCompletionTime,
      missedRate,
    };
  }
}
