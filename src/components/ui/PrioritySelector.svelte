<script lang="ts">
  type Priority = "lowest" | "low" | "normal" | "medium" | "high" | "highest";

  interface Props {
    value: Priority;
    onchange: (value: Priority) => void;
  }

  let { value = $bindable("normal"), onchange }: Props = $props();

  const priorities: Array<{ value: Priority; label: string; emoji: string; color: string }> = [
    { value: "highest", label: "Highest", emoji: "🔺", color: "var(--b3-theme-error, #ef4444)" },
    { value: "high", label: "High", emoji: "⏫", color: "#f97316" },
    { value: "medium", label: "Medium", emoji: "🔼", color: "#f59e0b" },
    { value: "normal", label: "Normal", emoji: "🟡", color: "#eab308" },
    { value: "low", label: "Low", emoji: "🔽", color: "#22c55e" },
    { value: "lowest", label: "Lowest", emoji: "⏬", color: "#64748b" },
  ];

  function handleChange(newValue: Priority) {
    value = newValue;
    onchange(newValue);
  }
</script>

<div class="priority-selector">
  {#each priorities as priority}
    <label
      class="priority-selector__option"
      class:active={value === priority.value}
      style="--priority-color: {priority.color}"
    >
      <input
        type="radio"
        name="priority"
        value={priority.value}
        checked={value === priority.value}
        onchange={() => handleChange(priority.value)}
      />
      <span class="priority-selector__emoji">{priority.emoji}</span>
      <span class="priority-selector__label">{priority.label}</span>
    </label>
  {/each}
</div>

<style>
  .priority-selector {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .priority-selector__option {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border: 1px solid var(--b3-border-color);
    border-radius: 6px;
    background: var(--b3-theme-surface);
    cursor: pointer;
    transition: all 0.2s;
    user-select: none;
  }

  .priority-selector__option:hover {
    background: var(--b3-theme-surface-lighter);
    border-color: var(--priority-color);
  }

  .priority-selector__option.active {
    background: var(--priority-color);
    border-color: var(--priority-color);
    color: white;
  }

  .priority-selector__option input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }

  .priority-selector__emoji {
    font-size: 16px;
    line-height: 1;
  }

  .priority-selector__label {
    font-size: 14px;
    font-weight: 500;
  }

  .priority-selector__option.active .priority-selector__label {
    color: white;
  }
</style>
