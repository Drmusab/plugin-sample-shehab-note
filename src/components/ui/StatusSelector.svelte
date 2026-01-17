<script lang="ts">
  type Status = "todo" | "done" | "cancelled";

  interface Props {
    value: Status;
    onchange: (value: Status) => void;
  }

  let { value = $bindable("todo"), onchange }: Props = $props();

  const statuses: Array<{ value: Status; label: string; icon: string; color: string }> = [
    { value: "todo", label: "Todo", icon: "○", color: "var(--b3-theme-on-surface)" },
    { value: "done", label: "Done", icon: "✓", color: "#44cc44" },
    { value: "cancelled", label: "Cancelled", icon: "✕", color: "#999" },
  ];

  function handleChange(newValue: Status) {
    value = newValue;
    onchange(newValue);
  }
</script>

<div class="status-selector">
  {#each statuses as status}
    <label
      class="status-selector__option"
      class:active={value === status.value}
      style="--status-color: {status.color}"
    >
      <input
        type="radio"
        name="status"
        value={status.value}
        checked={value === status.value}
        onchange={() => handleChange(status.value)}
      />
      <span class="status-selector__icon">{status.icon}</span>
      <span class="status-selector__label">{status.label}</span>
    </label>
  {/each}
</div>

<style>
  .status-selector {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .status-selector__option {
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

  .status-selector__option:hover {
    background: var(--b3-theme-surface-lighter);
    border-color: var(--status-color);
  }

  .status-selector__option.active {
    background: var(--b3-theme-surface-lighter);
    border-color: var(--status-color);
  }

  .status-selector__option input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }

  .status-selector__icon {
    font-size: 18px;
    line-height: 1;
    color: var(--status-color);
  }

  .status-selector__label {
    font-size: 14px;
    font-weight: 500;
    color: var(--b3-theme-on-surface);
  }

  .status-selector__option.active .status-selector__label {
    font-weight: 600;
  }
</style>
