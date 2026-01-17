<script lang="ts">
  import { RecurrenceParser } from "@/core/parsers/RecurrenceParser";
  import type { Frequency } from "@/core/models/Frequency";

  interface Props {
    value: string;
    onchange: (text: string, frequency: Frequency | null, isValid: boolean) => void;
    showPreview?: boolean;
  }

  let { value = $bindable(""), onchange, showPreview = true }: Props = $props();

  // Parse the recurrence text
  const parsed = $derived(RecurrenceParser.parse(value));
  const isValid = $derived(parsed.isValid);
  const error = $derived(parsed.error);

  // Generate next occurrences for preview (simplified)
  function getNextOccurrences(frequency: Frequency, count: number = 3): string[] {
    const dates: string[] = [];
    const now = new Date();
    
    for (let i = 0; i < count; i++) {
      const date = new Date(now);
      
      switch (frequency.type) {
        case "daily":
          date.setDate(now.getDate() + (i * frequency.interval));
          break;
        case "weekly":
          date.setDate(now.getDate() + (i * frequency.interval * 7));
          break;
        case "monthly":
          date.setMonth(now.getMonth() + (i * frequency.interval));
          break;
        case "yearly":
          date.setFullYear(now.getFullYear() + (i * frequency.interval));
          break;
      }
      
      dates.push(date.toLocaleDateString());
    }
    
    return dates;
  }

  const nextOccurrences = $derived(
    isValid && showPreview ? getNextOccurrences(parsed.frequency) : []
  );

  function handleInput(event: Event) {
    const target = event.target as HTMLInputElement;
    const newValue = target.value;
    value = newValue;
    
    const parsedResult = RecurrenceParser.parse(newValue);
    onchange(
      newValue,
      parsedResult.isValid ? parsedResult.frequency : null,
      parsedResult.isValid
    );
  }
</script>

<div class="recurrence-input">
  <input
    type="text"
    class="recurrence-input__field"
    class:valid={isValid}
    class:invalid={!isValid && value.length > 0}
    bind:value
    oninput={handleInput}
    placeholder="e.g., every week on Monday"
    aria-invalid={!isValid && value.length > 0}
  />
  
  {#if value.length > 0}
    <div class="recurrence-input__feedback">
      {#if isValid}
        <div class="recurrence-input__valid">
          ✓ Valid recurrence pattern
        </div>
      {:else}
        <div class="recurrence-input__error">
          ⚠ {error || "Invalid recurrence pattern"}
        </div>
      {/if}
    </div>
  {/if}

  {#if isValid && showPreview && nextOccurrences.length > 0}
    <div class="recurrence-input__preview">
      <div class="recurrence-input__preview-title">Next occurrences:</div>
      <ul class="recurrence-input__preview-list">
        {#each nextOccurrences as date}
          <li>{date}</li>
        {/each}
      </ul>
    </div>
  {/if}
</div>

<style>
  .recurrence-input {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .recurrence-input__field {
    width: 100%;
    padding: 8px 12px;
    border-radius: 6px;
    border: 1px solid var(--b3-border-color);
    background: var(--b3-theme-background);
    color: var(--b3-theme-on-background);
    font-size: 14px;
  }

  .recurrence-input__field:focus {
    outline: none;
    border-color: var(--b3-theme-primary);
  }

  .recurrence-input__field.valid {
    border-color: #44cc44;
  }

  .recurrence-input__field.invalid {
    border-color: var(--b3-theme-error, #ff4444);
  }

  .recurrence-input__feedback {
    font-size: 12px;
  }

  .recurrence-input__valid {
    color: #44cc44;
  }

  .recurrence-input__error {
    color: var(--b3-theme-error, #ff4444);
  }

  .recurrence-input__preview {
    padding: 10px;
    background: var(--b3-theme-surface-lighter);
    border-radius: 6px;
    font-size: 12px;
  }

  .recurrence-input__preview-title {
    font-weight: 600;
    margin-bottom: 6px;
    color: var(--b3-theme-on-surface);
  }

  .recurrence-input__preview-list {
    margin: 0;
    padding-left: 20px;
    color: var(--b3-theme-on-surface-light);
  }

  .recurrence-input__preview-list li {
    margin-bottom: 2px;
  }
</style>
