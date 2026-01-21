import type { Task, TaskPriority } from "@/core/models/Task";
import { isTaskActive, normalizePriority } from "@/core/models/Task";
import { DEFAULT_URGENCY_SETTINGS, type UrgencySettings } from "@/core/urgency/UrgencySettings";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface UrgencyScoreOptions {
  now?: Date;
  settings?: UrgencySettings;
}

export interface UrgencyCalculation {
  score: number;
  breakdown: {
    priorityContribution: number;
    dueDateContribution: number;
    overdueContribution: number;
  };
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const startOfDay = (date: Date): Date =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const getDayDelta = (from: Date, to: Date): number => {
  const fromStart = startOfDay(from);
  const toStart = startOfDay(to);
  return Math.round((toStart.getTime() - fromStart.getTime()) / MS_PER_DAY);
};

const getPriorityMultiplier = (
  priority: TaskPriority,
  settings: UrgencySettings
): number => settings.priorityMultipliers[priority] ?? 1;

/**
 * Calculate task urgency score.
 *
 * Formula:
 *   urgencyScore = (baseDueScore + overduePenalty) × priorityMultiplier
 *
 * baseDueScore:
 *   - No due date: noDueDateScore
 *   - Due today or sooner: dueSoonScoreMax
 *   - Otherwise: clamp(dueSoonScoreMax - daysUntilDue × dueDateWeight, dueSoonScoreMin, dueSoonScoreMax)
 *
 * overduePenalty:
 *   - 0 when not overdue
 *   - overdueBaseScore + (daysOverdue × overduePenaltyWeight) when overdue
 *
 * priorityMultiplier:
 *   - Settings-provided multipliers per priority level
 */
export function calculateUrgencyScore(task: Task, options: UrgencyScoreOptions = {}): number {
  const calculation = calculateUrgencyWithBreakdown(task, options);
  return calculation.score;
}

/**
 * Calculate task urgency score with detailed breakdown
 */
export function calculateUrgencyWithBreakdown(task: Task, options: UrgencyScoreOptions = {}): UrgencyCalculation {
  const now = options.now ?? new Date();
  const settings = options.settings ?? DEFAULT_URGENCY_SETTINGS;

  if (!isTaskActive(task)) {
    return {
      score: 0,
      breakdown: {
        priorityContribution: 0,
        dueDateContribution: 0,
        overdueContribution: 0
      }
    };
  }

  const normalizedPriority = normalizePriority(task.priority) ?? "normal";
  const priorityMultiplier = getPriorityMultiplier(normalizedPriority, settings);

  if (!task.dueAt) {
    const baseScore = settings.noDueDateScore;
    const totalScore = baseScore * priorityMultiplier;
    return {
      score: applyUrgencyCaps(totalScore, settings),
      breakdown: {
        priorityContribution: totalScore - baseScore,  // Difference from base
        dueDateContribution: baseScore,
        overdueContribution: 0
      }
    };
  }

  const dueDate = new Date(task.dueAt);
  if (Number.isNaN(dueDate.getTime())) {
    const baseScore = settings.noDueDateScore;
    const totalScore = baseScore * priorityMultiplier;
    return {
      score: applyUrgencyCaps(totalScore, settings),
      breakdown: {
        priorityContribution: totalScore - baseScore,  // Difference from base
        dueDateContribution: baseScore,
        overdueContribution: 0
      }
    };
  }

  const isOverdue = dueDate.getTime() < now.getTime();
  const daysUntilDue = getDayDelta(now, dueDate);
  const daysOverdue = isOverdue
    ? Math.max(1, Math.ceil((now.getTime() - dueDate.getTime()) / MS_PER_DAY))
    : 0;

  const baseDueScore = isOverdue
    ? 0
    : clamp(
        settings.dueSoonScoreMax - daysUntilDue * settings.dueDateWeight,
        settings.dueSoonScoreMin,
        settings.dueSoonScoreMax
      );

  const overduePenalty = isOverdue
    ? settings.overdueBaseScore + daysOverdue * settings.overduePenaltyWeight
    : 0;

  const baseScore = baseDueScore + overduePenalty;
  const totalScore = baseScore * priorityMultiplier;
  
  return {
    score: applyUrgencyCaps(totalScore, settings),
    breakdown: {
      priorityContribution: totalScore - baseScore,  // Difference from base
      dueDateContribution: baseDueScore,
      overdueContribution: overduePenalty
    }
  };
}

function applyUrgencyCaps(score: number, settings: UrgencySettings): number {
  const capped =
    settings.maxUrgency !== undefined
      ? Math.min(settings.maxUrgency, score)
      : score;
  return Math.round(Math.max(settings.minUrgency, capped));
}
