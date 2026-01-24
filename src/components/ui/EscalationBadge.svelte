<script lang="ts">
  import type { EscalationResult } from "@/core/escalation/EscalationEvaluator";

  interface Props {
    result: EscalationResult;
    explanation: string;
    compact?: boolean;
  }

  let { result, explanation, compact = false }: Props = $props();

  const levelMeta: Record<number, { icon: string; className: string }> = {
    1: { icon: "🟡", className: "escalation-badge--warning" },
    2: { icon: "🟠", className: "escalation-badge--critical" },
    3: { icon: "🔴", className: "escalation-badge--severe" },
  };
</script>

<span
  class={`escalation-badge ${levelMeta[result.level]?.className ?? ""} ${compact ? "escalation-badge--compact" : ""}`}
  title={explanation}
  aria-label={explanation}
>
  <span class="escalation-badge__icon">{levelMeta[result.level]?.icon ?? "⚪"}</span>
  <span class="escalation-badge__label">{result.label}</span>
  {#if !compact}
    <span class="escalation-badge__days">{result.daysOverdue}d overdue</span>
  {/if}
</span>

<style>
  .escalation-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 600;
    border: 1px solid var(--b3-border-color);
    background: var(--rt-escalation-on-time-bg, var(--b3-theme-surface-lighter));
    color: var(--rt-escalation-on-time-text, var(--b3-theme-on-surface-light));
    white-space: nowrap;
  }

  .escalation-badge__icon {
    font-size: 12px;
  }

  .escalation-badge__days {
    font-weight: 500;
  }

  .escalation-badge--warning {
    background: var(--rt-escalation-warning-bg, rgba(251, 191, 36, 0.16));
    border-color: var(--rt-escalation-warning-border, rgba(251, 191, 36, 0.45));
    color: var(--rt-escalation-warning-text, var(--b3-theme-on-surface));
  }

  .escalation-badge--critical {
    background: var(--rt-escalation-critical-bg, rgba(249, 115, 22, 0.18));
    border-color: var(--rt-escalation-critical-border, rgba(249, 115, 22, 0.5));
    color: var(--rt-escalation-critical-text, var(--b3-theme-on-surface));
  }

  .escalation-badge--severe {
    background: var(--rt-escalation-severe-bg, rgba(239, 68, 68, 0.18));
    border-color: var(--rt-escalation-severe-border, rgba(239, 68, 68, 0.55));
    color: var(--rt-escalation-severe-text, var(--b3-theme-on-surface));
  }

  .escalation-badge--compact {
    padding: 3px 8px;
    font-size: 10px;
  }

  .escalation-badge--compact .escalation-badge__icon {
    font-size: 11px;
  }
</style>
