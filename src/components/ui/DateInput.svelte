<script lang="ts">
  import { DateParser, type DateSuggestion } from '@/core/parsers/DateParser';
  import Icon from '@/components/ui/Icon.svelte';
  
  interface Props {
    value?: string;
    placeholder?: string;
    showTime?: boolean;
    required?: boolean;
    label?: string;
    error?: string;
    disabled?: boolean;
  }

  let { 
    value = $bindable(''),
    placeholder = 'e.g., tomorrow at 9am',
    showTime = true,
    required = false,
    label = '',
    error = '',
    disabled = false
  }: Props = $props();

  let inputValue = $state('');
  let suggestions = $state<DateSuggestion[]>([]);
  let showSuggestions = $state(false);
  let selectedIndex = $state(-1);
  let parsedDate = $state<Date | null>(null);
  let showDatePicker = $state(false);
  let inputElement: HTMLInputElement | undefined = $state();
  let timeoutId: number | undefined;

  // Initialize from value prop
  $effect(() => {
    if (value) {
      // If value is already an ISO string, try to parse it
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        inputValue = value;
        parsedDate = date;
      } else {
        inputValue = value;
        handleInputChange();
      }
    }
  });

  function handleInputChange() {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    // Debounce by 150ms
    timeoutId = setTimeout(() => {
      const trimmed = inputValue.trim();
      
      if (!trimmed) {
        suggestions = [];
        showSuggestions = false;
        parsedDate = null;
        value = '';
        return;
      }

      // Try to parse the date
      parsedDate = DateParser.parseNaturalLanguageDate(trimmed);
      
      if (parsedDate) {
        value = parsedDate.toISOString();
      } else {
        value = trimmed;
      }

      // Get suggestions
      suggestions = DateParser.getDateSuggestions(trimmed);
      showSuggestions = suggestions.length > 0;
      selectedIndex = -1;
    }, 150);
  }

  function selectSuggestion(suggestion: DateSuggestion) {
    inputValue = suggestion.text;
    parsedDate = new Date(suggestion.value);
    value = suggestion.value;
    showSuggestions = false;
    suggestions = [];
    selectedIndex = -1;
  }

  function handleKeydown(event: KeyboardEvent) {
    if (!showSuggestions || suggestions.length === 0) {
      // Handle keyboard shortcuts when dropdown is closed
      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey) {
        if (event.key === 't') {
          event.preventDefault();
          inputValue = 'today';
          handleInputChange();
          return;
        } else if (event.key === 'm') {
          event.preventDefault();
          inputValue = 'tomorrow';
          handleInputChange();
          return;
        } else if (event.key === 'w') {
          event.preventDefault();
          inputValue = 'next week';
          handleInputChange();
          return;
        }
      }
      
      if (event.key === 'Escape') {
        if (inputValue) {
          inputValue = '';
          handleInputChange();
        }
      }
      return;
    }

    // Handle dropdown navigation
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, suggestions.length - 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, -1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
        selectSuggestion(suggestions[selectedIndex]);
      } else if (suggestions.length > 0) {
        selectSuggestion(suggestions[0]);
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      showSuggestions = false;
      selectedIndex = -1;
    }
  }

  function handleBlur(event: FocusEvent) {
    // Delay to allow click on suggestion
    setTimeout(() => {
      const relatedTarget = event.relatedTarget as HTMLElement;
      if (!relatedTarget || !relatedTarget.closest('.date-input__suggestions')) {
        showSuggestions = false;
        selectedIndex = -1;
      }
    }, 200);
  }

  function clearInput() {
    inputValue = '';
    parsedDate = null;
    value = '';
    showSuggestions = false;
    suggestions = [];
    inputElement?.focus();
  }

  function toggleDatePicker() {
    showDatePicker = !showDatePicker;
  }

  function handleDatePickerChange(event: Event) {
    const target = event.target as HTMLInputElement;
    const dateValue = target.value;
    
    if (dateValue) {
      const date = new Date(dateValue);
      parsedDate = date;
      value = date.toISOString();
      inputValue = DateParser.formatDateForDisplay(date, showTime);
    }
    
    showDatePicker = false;
  }

  const isValid = $derived(parsedDate !== null);
  const previewText = $derived(() => {
    if (!parsedDate) return '';
    
    const now = new Date();
    const diffMs = parsedDate.getTime() - now.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    let relative = '';
    if (diffDays === 0) {
      relative = 'today';
    } else if (diffDays === 1) {
      relative = 'tomorrow';
    } else if (diffDays === -1) {
      relative = 'yesterday';
    } else if (diffDays > 1 && diffDays < 7) {
      relative = `in ${diffDays} days`;
    } else if (diffDays < -1 && diffDays > -7) {
      relative = `${Math.abs(diffDays)} days ago`;
    }
    
    const formatted = DateParser.formatDateForDisplay(parsedDate, showTime);
    return relative ? `${formatted} (${relative})` : formatted;
  });
</script>

<div class="date-input">
  {#if label}
    <label class="date-input__label" for="date-input-field">
      {label}
      {#if required}
        <span class="date-input__required">*</span>
      {/if}
    </label>
  {/if}

  <div class="date-input__wrapper">
    <input
      bind:this={inputElement}
      id="date-input-field"
      class="date-input__field"
      class:date-input__field--valid={isValid && !error}
      class:date-input__field--error={error}
      type="text"
      bind:value={inputValue}
      {placeholder}
      {disabled}
      {required}
      oninput={handleInputChange}
      onkeydown={handleKeydown}
      onblur={handleBlur}
      onfocus={() => {
        if (inputValue.trim() && suggestions.length > 0) {
          showSuggestions = true;
        }
      }}
      aria-invalid={!!error}
      aria-describedby={error ? 'date-input-error' : undefined}
      autocomplete="off"
    />

    <div class="date-input__icons">
      {#if inputValue && !disabled}
        <button
          type="button"
          class="date-input__icon date-input__clear"
          onclick={clearInput}
          aria-label="Clear input"
          title="Clear"
        >
          <Icon category="actions" name="close" size={16} alt="Clear" />
        </button>
      {/if}

      {#if isValid && !error}
        <span class="date-input__icon date-input__valid" title="Valid date">
          <Icon category="actions" name="check" size={16} alt="Valid" />
        </span>
      {:else if error}
        <span class="date-input__icon date-input__error-icon" title={error}>
          <Icon category="status" name="warning" size={16} alt="Warning" />
        </span>
      {/if}

      <button
        type="button"
        class="date-input__icon date-input__calendar"
        onclick={toggleDatePicker}
        aria-label="Open date picker"
        title="Open date picker"
        {disabled}
      >
        <Icon category="navigation" name="calendar" size={16} alt="Calendar" />
      </button>
    </div>

    {#if showSuggestions && suggestions.length > 0}
      <div class="date-input__suggestions" role="listbox">
        {#each suggestions as suggestion, index}
          <button
            type="button"
            class="date-input__suggestion"
            class:date-input__suggestion--selected={index === selectedIndex}
            onclick={() => selectSuggestion(suggestion)}
            role="option"
            aria-selected={index === selectedIndex}
          >
            {#if suggestion.icon}
              <span class="date-input__suggestion-icon">{suggestion.icon}</span>
            {/if}
            <div class="date-input__suggestion-content">
              <div class="date-input__suggestion-text">{suggestion.text}</div>
              <div class="date-input__suggestion-description">{suggestion.description}</div>
            </div>
            <span class="date-input__suggestion-category">{suggestion.category}</span>
          </button>
        {/each}
      </div>
    {/if}

    {#if showDatePicker}
      <div class="date-input__picker">
        <input
          type={showTime ? 'datetime-local' : 'date'}
          class="date-input__picker-input"
          value={parsedDate ? parsedDate.toISOString().slice(0, showTime ? 16 : 10) : ''}
          onchange={handleDatePickerChange}
          aria-label="Date picker"
        />
      </div>
    {/if}
  </div>

  {#if parsedDate && !error}
    <div class="date-input__preview">{previewText}</div>
  {/if}

  {#if error}
    <div class="date-input__error-message" id="date-input-error">
      {error}
    </div>
  {/if}
</div>

<style>
  .date-input {
    position: relative;
    margin-bottom: 16px;
  }

  .date-input__label {
    display: block;
    margin-bottom: 6px;
    font-size: 14px;
    font-weight: 500;
    color: var(--b3-theme-on-surface);
  }

  .date-input__required {
    color: var(--b3-theme-error);
  }

  .date-input__wrapper {
    position: relative;
  }

  .date-input__field {
    width: 100%;
    padding: 8px 100px 8px 12px;
    border: 1px solid var(--b3-border-color);
    border-radius: 6px;
    font-size: 14px;
    background: var(--b3-theme-background);
    color: var(--b3-theme-on-background);
    box-sizing: border-box;
    transition: all 0.2s ease;
  }

  .date-input__field:focus {
    outline: none;
    border-color: var(--b3-theme-primary);
    box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.1);
  }

  .date-input__field--valid {
    border-color: var(--b3-theme-primary);
  }

  .date-input__field--error {
    border-color: var(--b3-theme-error);
  }

  .date-input__field:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    background: var(--b3-theme-surface-lighter);
  }

  .date-input__icons {
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    gap: 4px;
    align-items: center;
  }

  .date-input__icon {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 16px;
    padding: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: background 0.2s ease;
  }

  .date-input__icon:hover:not(:disabled) {
    background: var(--b3-theme-surface-lighter);
  }

  .date-input__clear {
    color: var(--b3-theme-on-surface-light);
  }

  .date-input__valid {
    color: var(--b3-theme-primary);
    cursor: default;
  }

  .date-input__error-icon {
    color: var(--b3-theme-error);
    cursor: default;
  }

  .date-input__calendar {
    color: var(--b3-theme-on-surface);
  }

  .date-input__suggestions {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    margin-top: 4px;
    background: var(--b3-theme-surface);
    border: 1px solid var(--b3-border-color);
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    max-height: 300px;
    overflow-y: auto;
    z-index: 1000;
    animation: slideDown 0.2s ease;
  }

  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .date-input__suggestion {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    border: none;
    background: none;
    cursor: pointer;
    text-align: left;
    transition: background 0.15s ease;
    border-bottom: 1px solid var(--b3-border-color);
  }

  .date-input__suggestion:last-child {
    border-bottom: none;
  }

  .date-input__suggestion:hover,
  .date-input__suggestion--selected {
    background: var(--b3-theme-surface-lighter);
  }

  .date-input__suggestion-icon {
    font-size: 18px;
    flex-shrink: 0;
  }

  .date-input__suggestion-content {
    flex: 1;
    min-width: 0;
  }

  .date-input__suggestion-text {
    font-size: 14px;
    font-weight: 500;
    color: var(--b3-theme-on-surface);
    margin-bottom: 2px;
  }

  .date-input__suggestion-description {
    font-size: 12px;
    color: var(--b3-theme-on-surface-light);
  }

  .date-input__suggestion-category {
    font-size: 10px;
    padding: 2px 6px;
    border-radius: 3px;
    background: var(--b3-theme-surface-lighter);
    color: var(--b3-theme-on-surface-light);
    text-transform: uppercase;
    font-weight: 600;
    letter-spacing: 0.5px;
  }

  .date-input__picker {
    position: absolute;
    top: 100%;
    right: 0;
    margin-top: 4px;
    background: var(--b3-theme-surface);
    border: 1px solid var(--b3-border-color);
    border-radius: 6px;
    padding: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 1000;
    animation: slideDown 0.2s ease;
  }

  .date-input__picker-input {
    border: 1px solid var(--b3-border-color);
    border-radius: 4px;
    padding: 6px 8px;
    font-size: 14px;
    background: var(--b3-theme-background);
    color: var(--b3-theme-on-background);
  }

  .date-input__preview {
    margin-top: 6px;
    font-size: 13px;
    color: var(--b3-theme-on-surface-light);
    font-style: italic;
  }

  .date-input__error-message {
    margin-top: 6px;
    font-size: 12px;
    color: var(--b3-theme-error);
  }
</style>
