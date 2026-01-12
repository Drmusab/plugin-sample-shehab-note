<script lang="ts">
  import type { Task } from "@/core/models/Task";
  import { calculateTaskHealth } from "@/core/models/Task";

  interface Props {
    tasks: Task[];
  }

  let { tasks }: Props = $props();

  // Calculate overall stats
  const overallStats = $derived(() => {
    let totalCompletions = 0;
    let totalMisses = 0;

    for (const task of tasks) {
      totalCompletions += task.completionCount || 0;
      totalMisses += task.missCount || 0;
    }

    const total = totalCompletions + totalMisses;
    const completionRate = total > 0 ? (totalCompletions / total) * 100 : 100;

    return {
      totalCompletions,
      totalMisses,
      completionRate: Math.round(completionRate),
    };
  });

  // Get tasks sorted by streak
  const streakLeaderboard = $derived(() => {
    return [...tasks]
      .filter((task) => (task.currentStreak || 0) > 0)
      .sort((a, b) => (b.currentStreak || 0) - (a.currentStreak || 0))
      .slice(0, 10);
  });

  // Get tasks sorted by health score
  const healthScores = $derived(() => {
    return [...tasks]
      .map((task) => ({
        task,
        health: calculateTaskHealth(task),
      }))
      .sort((a, b) => a.health - b.health);
  });

  // Get best performing tasks
  const bestTasks = $derived(() => {
    return healthScores().slice(-5).reverse();
  });

  // Get worst performing tasks
  const worstTasks = $derived(() => {
    return healthScores().slice(0, 5);
  });

  // Recent activity (last 10 completions)
  const recentActivity = $derived(() => {
    const activities: Array<{
      task: Task;
      completedAt: string;
    }> = [];

    for (const task of tasks) {
      if (task.recentCompletions && task.recentCompletions.length > 0) {
        for (const completedAt of task.recentCompletions) {
          activities.push({ task, completedAt });
        }
      }
    }

    return activities
      .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
      .slice(0, 10);
  });

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function getHealthColor(health: number): string {
    if (health >= 80) return "#10b981"; // green
    if (health >= 60) return "#3b82f6"; // blue
    if (health >= 40) return "#f59e0b"; // orange
    return "#ef4444"; // red
  }
</script>

<div class="analytics-tab">
  <div class="analytics-tab__header">
    <h2 class="analytics-tab__title">Task Analytics</h2>
    <p class="analytics-tab__subtitle">Performance insights and statistics</p>
  </div>

  <div class="analytics-tab__content">
    <!-- Overall Stats -->
    <div class="analytics-section">
      <h3 class="analytics-section__title">Overall Performance</h3>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-card__value">{overallStats().totalCompletions}</div>
          <div class="stat-card__label">Total Completions</div>
        </div>
        <div class="stat-card">
          <div class="stat-card__value">{overallStats().totalMisses}</div>
          <div class="stat-card__label">Total Misses</div>
        </div>
        <div class="stat-card stat-card--highlight">
          <div class="stat-card__value">{overallStats().completionRate}%</div>
          <div class="stat-card__label">Completion Rate</div>
        </div>
      </div>
    </div>

    <!-- Streak Leaderboard -->
    {#if streakLeaderboard().length > 0}
      <div class="analytics-section">
        <h3 class="analytics-section__title">🔥 Current Streaks</h3>
        <div class="leaderboard">
          {#each streakLeaderboard() as task, index}
            <div class="leaderboard-item">
              <div class="leaderboard-item__rank">#{index + 1}</div>
              <div class="leaderboard-item__name">{task.name}</div>
              <div class="leaderboard-item__value">
                {task.currentStreak} day{task.currentStreak !== 1 ? 's' : ''}
                {#if task.bestStreak && task.currentStreak === task.bestStreak}
                  <span class="leaderboard-item__badge">🏆 Best</span>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Task Health Scores -->
    <div class="analytics-section">
      <h3 class="analytics-section__title">Task Health Scores</h3>
      
      {#if bestTasks().length > 0}
        <h4 class="subsection-title">✅ Best Performing</h4>
        <div class="health-list">
          {#each bestTasks() as { task, health }}
            <div class="health-item">
              <div class="health-item__name">{task.name}</div>
              <div class="health-item__bar-container">
                <div
                  class="health-item__bar"
                  style="width: {health}%; background-color: {getHealthColor(health)}"
                ></div>
                <div class="health-item__score">{health}/100</div>
              </div>
            </div>
          {/each}
        </div>
      {/if}

      {#if worstTasks().length > 0 && worstTasks()[0].health < 80}
        <h4 class="subsection-title">⚠️ Needs Attention</h4>
        <div class="health-list">
          {#each worstTasks() as { task, health }}
            <div class="health-item">
              <div class="health-item__name">{task.name}</div>
              <div class="health-item__bar-container">
                <div
                  class="health-item__bar"
                  style="width: {health}%; background-color: {getHealthColor(health)}"
                ></div>
                <div class="health-item__score">{health}/100</div>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Recent Activity -->
    {#if recentActivity().length > 0}
      <div class="analytics-section">
        <h3 class="analytics-section__title">Recent Activity</h3>
        <div class="activity-list">
          {#each recentActivity() as { task, completedAt }}
            <div class="activity-item">
              <div class="activity-item__icon">✅</div>
              <div class="activity-item__details">
                <div class="activity-item__name">{task.name}</div>
                <div class="activity-item__time">{formatDate(completedAt)}</div>
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .analytics-tab {
    padding: 16px;
  }

  .analytics-tab__header {
    margin-bottom: 24px;
  }

  .analytics-tab__title {
    margin: 0 0 8px 0;
    font-size: 20px;
    font-weight: 600;
    color: var(--b3-theme-on-surface);
  }

  .analytics-tab__subtitle {
    margin: 0;
    font-size: 14px;
    color: var(--b3-theme-on-surface-light);
  }

  .analytics-tab__content {
    max-width: 800px;
  }

  .analytics-section {
    margin-bottom: 32px;
    padding: 20px;
    background: var(--b3-theme-surface);
    border: 1px solid var(--b3-border-color);
    border-radius: 8px;
  }

  .analytics-section__title {
    margin: 0 0 16px 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--b3-theme-on-surface);
  }

  .subsection-title {
    margin: 20px 0 12px 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--b3-theme-on-surface);
  }

  .subsection-title:first-child {
    margin-top: 0;
  }

  /* Stats Grid */
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 16px;
  }

  .stat-card {
    padding: 20px;
    background: var(--b3-theme-surface-lighter);
    border-radius: 8px;
    text-align: center;
  }

  .stat-card--highlight {
    background: var(--b3-theme-primary);
    color: white;
  }

  .stat-card__value {
    font-size: 32px;
    font-weight: 700;
    margin-bottom: 8px;
  }

  .stat-card__label {
    font-size: 14px;
    opacity: 0.8;
  }

  /* Leaderboard */
  .leaderboard {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .leaderboard-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    background: var(--b3-theme-surface-lighter);
    border-radius: 6px;
  }

  .leaderboard-item__rank {
    font-size: 16px;
    font-weight: 700;
    color: var(--b3-theme-primary);
    min-width: 40px;
  }

  .leaderboard-item__name {
    flex: 1;
    font-size: 14px;
    color: var(--b3-theme-on-surface);
  }

  .leaderboard-item__value {
    font-size: 14px;
    font-weight: 600;
    color: var(--b3-theme-on-surface);
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .leaderboard-item__badge {
    font-size: 12px;
    padding: 2px 6px;
    background: var(--b3-theme-primary);
    color: white;
    border-radius: 4px;
  }

  /* Health List */
  .health-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .health-item {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .health-item__name {
    font-size: 14px;
    font-weight: 500;
    color: var(--b3-theme-on-surface);
  }

  .health-item__bar-container {
    position: relative;
    display: flex;
    align-items: center;
    background: var(--b3-theme-surface-lighter);
    border-radius: 4px;
    height: 24px;
    overflow: hidden;
  }

  .health-item__bar {
    height: 100%;
    transition: width 0.3s ease;
  }

  .health-item__score {
    position: absolute;
    right: 8px;
    font-size: 12px;
    font-weight: 600;
    color: var(--b3-theme-on-surface);
  }

  /* Activity List */
  .activity-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .activity-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    background: var(--b3-theme-surface-lighter);
    border-radius: 6px;
  }

  .activity-item__icon {
    font-size: 20px;
  }

  .activity-item__details {
    flex: 1;
  }

  .activity-item__name {
    font-size: 14px;
    font-weight: 500;
    color: var(--b3-theme-on-surface);
    margin-bottom: 2px;
  }

  .activity-item__time {
    font-size: 12px;
    color: var(--b3-theme-on-surface-light);
  }
</style>
