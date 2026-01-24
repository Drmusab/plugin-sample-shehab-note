<script lang="ts">
  import type { AttentionPriorityLevel } from "@/core/attention/AttentionScoring";
  import { PRIORITY_COLORS } from "@/utils/constants";

  interface Props {
    level: AttentionPriorityLevel;
    weight?: number;
    compact?: boolean;
  }

  let { level, weight = 0, compact = false }: Props = $props();

  const labelMap: Record<AttentionPriorityLevel, string> = {
    none: "None",
    low: "Low",
    medium: "Medium",
    high: "High",
    urgent: "Urgent",
  };

  const colorMap: Record<AttentionPriorityLevel, string> = {
    none: "#94a3b8",
    low: PRIORITY_COLORS.low,
    medium: PRIORITY_COLORS.medium,
    high: PRIORITY_COLORS.high,
    urgent: PRIORITY_COLORS.highest,
  };
</script>

<span
  class={`priority-badge ${compact ? "priority-badge--compact" : ""}`}
  style={`--priority-color: ${colorMap[level]}`}
  title={`Priority ${labelMap[level]} (weight ${weight})`}
>
  <span class="priority-badge__dot"></span>
  <span class="priority-badge__label">{labelMap[level]}</span>
</span>

<style>
  .priority-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 600;
    color: var(--b3-theme-on-surface);
    background: color-mix(in srgb, var(--priority-color) 20%, transparent);
    border: 1px solid color-mix(in srgb, var(--priority-color) 55%, transparent);
  }

  .priority-badge__dot {
    width: 8px;
    height: 8px;
    border-radius: 999px;
    background: var(--priority-color);
  }

  .priority-badge--compact {
    padding: 2px 6px;
    font-size: 11px;
  }
</style>
