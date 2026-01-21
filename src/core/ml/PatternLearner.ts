import type { Task, CompletionHistoryEntry } from '@/core/models/Task';
import type { Frequency } from '@/core/models/Frequency';

/**
 * Completion pattern data for analysis
 */
export interface CompletionPattern {
  taskId: string;
  scheduledTime: Date;
  actualCompletionTime: Date;
  dayOfWeek: number;
  hourOfDay: number;
  delayMinutes: number;
  contextTags: string[];
}

/**
 * Insights derived from completion patterns
 */
export interface CompletionInsight {
  averageCompletionDelay: number;  // minutes
  preferredTimeOfDay: number;       // hour (0-23)
  preferredDayOfWeek: number[];     // [0-6] Sunday=0
  completionConsistency: number;    // 0-1 score
  missedTaskFrequency: number;      // percentage
  suggestedAdjustment: string;      // human-readable suggestion
  confidence: number;                // 0-1 confidence in suggestions
}

/**
 * Schedule optimization suggestion
 */
export interface ScheduleSuggestion {
  currentSchedule: {
    frequency: Frequency;
    time?: string;
  };
  suggestedSchedule: {
    frequency: Frequency;
    time?: string;
  };
  reason: string;
  confidence: number;
  expectedImprovement: string;
}

/**
 * Detected anomaly in task completion
 */
export interface Anomaly {
  type: 'consistently_skipped' | 'completion_drift' | 'irregular_completion';
  severity: 'low' | 'medium' | 'high';
  description: string;
  affectedPeriod: {
    start: string;
    end: string;
  };
  suggestion: string;
}

/**
 * Time preference for a specific context
 */
export interface TimePreference {
  hour: number;
  confidence: number;
  sampleSize: number;
}

/**
 * Smart Recurrence Engine - ML-based pattern learning for task scheduling
 */
export class SmartRecurrenceEngine {
  /**
   * Analyze historical completion data and generate insights
   */
  analyzeCompletionPatterns(task: Task): CompletionInsight {
    if (!task.completionHistory || task.completionHistory.length === 0) {
      return this.getDefaultInsight();
    }

    const history = task.completionHistory;
    const analyzer = new PatternAnalyzer();

    // Calculate average delay
    const averageDelay = this.calculateAverageDelay(history);

    // Find preferred time of day
    const preferredTime = analyzer.calculateOptimalTime(history);

    // Find preferred weekdays
    const weekdayPatterns = analyzer.findWeekdayPatterns(history);
    const preferredDays = Array.from(weekdayPatterns.keys())
      .filter(day => {
        const pref = weekdayPatterns.get(day);
        return pref && pref.confidence > 0.5;
      });

    // Calculate consistency score
    const consistencyScore = this.calculateConsistencyScore(history);

    // Calculate miss frequency
    const totalExpected = (task.completionCount || 0) + (task.missCount || 0);
    const missedFrequency = totalExpected > 0 
      ? ((task.missCount || 0) / totalExpected) * 100 
      : 0;

    // Generate suggestion
    const suggestion = this.generateSuggestion(
      averageDelay,
      preferredTime,
      preferredDays,
      consistencyScore
    );

    // Calculate overall confidence
    const confidence = this.calculateConfidence(
      history.length,
      consistencyScore,
      preferredTime.confidence
    );

    return {
      averageCompletionDelay: averageDelay,
      preferredTimeOfDay: preferredTime.hour,
      preferredDayOfWeek: preferredDays,
      completionConsistency: consistencyScore,
      missedTaskFrequency: missedFrequency,
      suggestedAdjustment: suggestion,
      confidence
    };
  }

  /**
   * Suggest optimal schedule adjustments based on patterns
   */
  suggestScheduleOptimization(task: Task): ScheduleSuggestion | null {
    const insights = this.analyzeCompletionPatterns(task);
    
    if (insights.confidence < 0.5 || !task.completionHistory || task.completionHistory.length < 10) {
      return null;
    }

    const currentFreq = task.frequency;
    const suggestedFreq = { ...currentFreq };
    let reason = '';
    let expectedImprovement = '';

    // Suggest time adjustment if consistently completing at different time
    if (Math.abs(insights.averageCompletionDelay) > 60) {
      const suggestedHour = insights.preferredTimeOfDay;
      reason = `You typically complete this task around ${suggestedHour}:00, `;
      reason += insights.averageCompletionDelay > 0 
        ? `${Math.round(insights.averageCompletionDelay / 60)} hours later than scheduled.`
        : `${Math.round(Math.abs(insights.averageCompletionDelay) / 60)} hours earlier than scheduled.`;
      expectedImprovement = 'Better alignment with your natural completion patterns';
    }

    // Suggest weekday adjustment for weekly tasks
    if (currentFreq.type === 'weekly' && insights.preferredDayOfWeek.length > 0) {
      const currentDays = currentFreq.weekdays || [];
      const preferredDays = insights.preferredDayOfWeek;
      
      if (JSON.stringify(currentDays.sort()) !== JSON.stringify(preferredDays.sort())) {
        suggestedFreq.weekdays = preferredDays;
        reason += ` Consider scheduling for ${this.formatWeekdays(preferredDays)} based on completion patterns.`;
        expectedImprovement = 'Higher completion rate on preferred days';
      }
    }

    // If no meaningful suggestions, return null
    if (!reason) {
      return null;
    }

    return {
      currentSchedule: {
        frequency: currentFreq,
        time: this.extractTimeFromDueAt(task.dueAt)
      },
      suggestedSchedule: {
        frequency: suggestedFreq,
        time: insights.preferredTimeOfDay !== undefined 
          ? `${insights.preferredTimeOfDay.toString().padStart(2, '0')}:00`
          : undefined
      },
      reason,
      confidence: insights.confidence,
      expectedImprovement
    };
  }

  /**
   * Auto-adjust schedule based on patterns (with user confirmation)
   */
  autoAdjustSchedule(task: Task, threshold: number = 0.7): boolean {
    if (!task.smartRecurrence?.autoAdjust) {
      return false;
    }

    const suggestion = this.suggestScheduleOptimization(task);
    
    if (!suggestion || suggestion.confidence < threshold) {
      return false;
    }

    // Apply the suggestion
    task.frequency = suggestion.suggestedSchedule.frequency;
    
    if (suggestion.suggestedSchedule.time) {
      const dueDate = new Date(task.dueAt);
      const [hours, minutes] = suggestion.suggestedSchedule.time.split(':').map(Number);
      dueDate.setHours(hours, minutes || 0, 0, 0);
      task.dueAt = dueDate.toISOString();
    }

    // Update learning metrics
    if (!task.learningMetrics) {
      task.learningMetrics = {
        averageDelayMinutes: 0,
        optimalHour: 0,
        consistencyScore: 0,
        lastLearningUpdate: new Date().toISOString()
      };
    }

    const insights = this.analyzeCompletionPatterns(task);
    task.learningMetrics.averageDelayMinutes = insights.averageCompletionDelay;
    task.learningMetrics.optimalHour = insights.preferredTimeOfDay;
    task.learningMetrics.consistencyScore = insights.completionConsistency;
    task.learningMetrics.lastLearningUpdate = new Date().toISOString();

    return true;
  }

  /**
   * Detect anomalies in task completion patterns
   */
  detectAnomalies(task: Task): Anomaly[] {
    const anomalies: Anomaly[] = [];
    
    if (!task.completionHistory || task.completionHistory.length < 5) {
      return anomalies;
    }

    const analyzer = new PatternAnalyzer();
    const skipPattern = analyzer.detectSkipPatterns(task);
    
    if (skipPattern.isAnomalous) {
      anomalies.push({
        type: 'consistently_skipped',
        severity: 'high',
        description: skipPattern.reason,
        affectedPeriod: {
          start: task.createdAt,
          end: new Date().toISOString()
        },
        suggestion: 'Consider adjusting the recurrence frequency or disabling this task'
      });
    }

    // Check for completion drift
    const drift = this.detectCompletionDrift(task.completionHistory);
    if (drift.isDrifting) {
      anomalies.push({
        type: 'completion_drift',
        severity: drift.severity,
        description: `Completion times are drifting ${drift.direction} by an average of ${drift.averageDriftMinutes} minutes`,
        affectedPeriod: {
          start: task.completionHistory[0].completedAt,
          end: task.completionHistory[task.completionHistory.length - 1].completedAt
        },
        suggestion: 'Consider adjusting the scheduled time to match your natural completion pattern'
      });
    }

    return anomalies;
  }

  // Private helper methods

  private getDefaultInsight(): CompletionInsight {
    return {
      averageCompletionDelay: 0,
      preferredTimeOfDay: 9,
      preferredDayOfWeek: [],
      completionConsistency: 0,
      missedTaskFrequency: 0,
      suggestedAdjustment: 'Not enough data to generate insights (need at least 10 completions)',
      confidence: 0
    };
  }

  private calculateAverageDelay(history: CompletionHistoryEntry[]): number {
    if (history.length === 0) return 0;
    
    const totalDelay = history.reduce((sum, entry) => sum + entry.delayMinutes, 0);
    return Math.round(totalDelay / history.length);
  }

  private calculateConsistencyScore(history: CompletionHistoryEntry[]): number {
    if (history.length < 2) return 0;

    // Calculate standard deviation of delays
    const avgDelay = this.calculateAverageDelay(history);
    const variance = history.reduce((sum, entry) => {
      const diff = entry.delayMinutes - avgDelay;
      return sum + (diff * diff);
    }, 0) / history.length;
    
    const stdDev = Math.sqrt(variance);
    
    // Convert to 0-1 score (lower stdDev = higher consistency)
    // Assume stdDev > 240 minutes (4 hours) is very inconsistent
    const consistencyScore = Math.max(0, 1 - (stdDev / 240));
    
    return Math.round(consistencyScore * 100) / 100;
  }

  private generateSuggestion(
    avgDelay: number,
    preferredTime: TimePreference,
    preferredDays: number[],
    consistency: number
  ): string {
    if (consistency < 0.3) {
      return 'Completion patterns are inconsistent. Try to complete tasks at similar times.';
    }

    const suggestions: string[] = [];

    if (Math.abs(avgDelay) > 60) {
      const hours = Math.round(Math.abs(avgDelay) / 60);
      if (avgDelay > 0) {
        suggestions.push(`Consider scheduling ${hours} hour(s) later (around ${preferredTime.hour}:00)`);
      } else {
        suggestions.push(`Consider scheduling ${hours} hour(s) earlier (around ${preferredTime.hour}:00)`);
      }
    }

    if (preferredDays.length > 0 && preferredTime.confidence > 0.6) {
      suggestions.push(`Best completion rate on ${this.formatWeekdays(preferredDays)}`);
    }

    return suggestions.length > 0 
      ? suggestions.join('. ')
      : 'Maintaining good completion consistency!';
  }

  private calculateConfidence(
    sampleSize: number,
    consistencyScore: number,
    timeConfidence: number
  ): number {
    // Need at least 10 samples for reasonable confidence
    const sizeConfidence = Math.min(1, sampleSize / 30);
    
    // Weighted average
    const confidence = (
      sizeConfidence * 0.4 +
      consistencyScore * 0.3 +
      timeConfidence * 0.3
    );
    
    return Math.round(confidence * 100) / 100;
  }

  private extractTimeFromDueAt(dueAt: string): string {
    const date = new Date(dueAt);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  }

  private formatWeekdays(days: number[]): string {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days.map(d => dayNames[d]).join(', ');
  }

  private detectCompletionDrift(history: CompletionHistoryEntry[]): {
    isDrifting: boolean;
    direction: 'later' | 'earlier';
    averageDriftMinutes: number;
    severity: 'low' | 'medium' | 'high';
  } {
    if (history.length < 10) {
      return { isDrifting: false, direction: 'later', averageDriftMinutes: 0, severity: 'low' };
    }

    // Check if delays are trending in one direction
    const recentHistory = history.slice(-10);
    const delays = recentHistory.map(h => h.delayMinutes);
    
    // Simple linear regression to detect trend
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    const n = delays.length;
    
    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += delays[i];
      sumXY += i * delays[i];
      sumX2 += i * i;
    }
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const avgDrift = Math.abs(slope);
    
    // If slope > 5 minutes per completion, consider it drifting
    if (avgDrift > 5) {
      const severity: 'low' | 'medium' | 'high' = 
        avgDrift > 30 ? 'high' : 
        avgDrift > 15 ? 'medium' : 
        'low';
      
      return {
        isDrifting: true,
        direction: slope > 0 ? 'later' : 'earlier',
        averageDriftMinutes: Math.round(avgDrift),
        severity
      };
    }
    
    return { isDrifting: false, direction: 'later', averageDriftMinutes: 0, severity: 'low' };
  }
}

/**
 * Pattern Analyzer - Statistical analysis of completion patterns
 */
export class PatternAnalyzer {
  /**
   * Calculate preferred completion time using weighted average
   */
  calculateOptimalTime(history: CompletionHistoryEntry[]): TimePreference {
    if (history.length === 0) {
      return { hour: 9, confidence: 0, sampleSize: 0 };
    }

    // Group completions by hour
    const hourCounts = new Map<number, number>();
    
    for (const entry of history) {
      const hour = new Date(entry.completedAt).getHours();
      hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
    }

    // Find most common hour
    let maxHour = 9;
    let maxCount = 0;
    
    for (const [hour, count] of hourCounts.entries()) {
      if (count > maxCount) {
        maxCount = count;
        maxHour = hour;
      }
    }

    // Calculate confidence based on concentration
    const confidence = maxCount / history.length;
    
    return {
      hour: maxHour,
      confidence: Math.round(confidence * 100) / 100,
      sampleSize: history.length
    };
  }

  /**
   * Detect patterns using basic clustering by weekday
   */
  findWeekdayPatterns(history: CompletionHistoryEntry[]): Map<number, TimePreference> {
    const patterns = new Map<number, TimePreference>();
    
    // Group by day of week
    const dayGroups = new Map<number, CompletionHistoryEntry[]>();
    
    for (const entry of history) {
      const day = entry.dayOfWeek;
      if (!dayGroups.has(day)) {
        dayGroups.set(day, []);
      }
      dayGroups.get(day)!.push(entry);
    }

    // Analyze each day
    for (const [day, entries] of dayGroups.entries()) {
      const timePreference = this.calculateOptimalTime(entries);
      
      // Only include days with reasonable sample size
      if (entries.length >= 2) {
        patterns.set(day, timePreference);
      }
    }

    return patterns;
  }

  /**
   * Anomaly detection using standard deviation
   */
  detectSkipPatterns(task: Task): { isAnomalous: boolean; reason: string } {
    const totalExpected = (task.completionCount || 0) + (task.missCount || 0);
    const missRate = totalExpected > 0 ? (task.missCount || 0) / totalExpected : 0;

    // If missing more than 50% of tasks, flag as anomalous
    if (missRate > 0.5 && totalExpected >= 10) {
      return {
        isAnomalous: true,
        reason: `Task is skipped ${Math.round(missRate * 100)}% of the time (${task.missCount} out of ${totalExpected})`
      };
    }

    // Check for recent streak of misses
    if ((task.missCount || 0) >= 5 && task.currentStreak === 0) {
      return {
        isAnomalous: true,
        reason: 'Task has been skipped multiple times recently'
      };
    }

    return {
      isAnomalous: false,
      reason: ''
    };
  }
}
