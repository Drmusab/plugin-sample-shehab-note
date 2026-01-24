<script lang="ts">
  import type { EscalationSettings } from "@/core/settings/PluginSettings";
  import type { SettingsService } from "@/core/settings/SettingsService";
  import { toast } from "@/utils/notifications";

  interface Props {
    settingsService: SettingsService;
  }

  let { settingsService }: Props = $props();

  let escalationSettings = $state<EscalationSettings>(settingsService.get().escalation);

  $effect(() => {
    escalationSettings = settingsService.get().escalation;
  });

  function validateThresholds(settings: EscalationSettings): string | null {
    const { warning, critical, severe } = settings.thresholds;
    if (warning.minDays < 1) {
      return "Warning minimum must be at least 1 day overdue.";
    }
    if (warning.maxDays !== undefined && warning.maxDays < warning.minDays) {
      return "Warning maximum must be greater than or equal to its minimum.";
    }
    if (critical.minDays <= (warning.maxDays ?? warning.minDays)) {
      return "Critical minimum must be greater than the warning range.";
    }
    if (critical.maxDays !== undefined && critical.maxDays < critical.minDays) {
      return "Critical maximum must be greater than or equal to its minimum.";
    }
    if (severe.minDays <= (critical.maxDays ?? critical.minDays)) {
      return "Severe minimum must be greater than the critical range.";
    }
    return null;
  }

  async function saveEscalationSettings() {
    const validationError = validateThresholds(escalationSettings);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    try {
      await settingsService.update({ escalation: escalationSettings });
      toast.success("Escalation settings saved!");
    } catch (err) {
      toast.error("Failed to save escalation settings: " + err);
    }
  }
</script>

<section class="settings__section">
  <div class="settings__section-header">
    <h3 class="settings__section-title">Escalation Dashboard</h3>
    <label class="settings__toggle">
      <input type="checkbox" bind:checked={escalationSettings.enabled} />
      <span>Enabled</span>
    </label>
  </div>

  <p class="settings__description">
    Escalation highlights overdue tasks by severity without modifying task data.
  </p>

  <label class="settings__checkbox">
    <input type="checkbox" bind:checked={escalationSettings.includeScheduled} />
    <div>
      <div class="settings__checkbox-label">Include scheduled-only tasks</div>
      <div class="settings__checkbox-description">
        Use scheduled dates when no due date is set.
      </div>
    </div>
  </label>

  <div class="settings__field-group">
    <div class="settings__field-group-title">Thresholds (days overdue)</div>
    <div class="settings__field-grid">
      <label class="settings__field">
        <span class="settings__label">Warning min</span>
        <input
          class="settings__input"
          type="number"
          min="1"
          step="1"
          bind:value={escalationSettings.thresholds.warning.minDays}
        />
      </label>
      <label class="settings__field">
        <span class="settings__label">Warning max</span>
        <input
          class="settings__input"
          type="number"
          min="1"
          step="1"
          bind:value={escalationSettings.thresholds.warning.maxDays}
        />
      </label>
      <label class="settings__field">
        <span class="settings__label">Critical min</span>
        <input
          class="settings__input"
          type="number"
          min="2"
          step="1"
          bind:value={escalationSettings.thresholds.critical.minDays}
        />
      </label>
      <label class="settings__field">
        <span class="settings__label">Critical max</span>
        <input
          class="settings__input"
          type="number"
          min="2"
          step="1"
          bind:value={escalationSettings.thresholds.critical.maxDays}
        />
      </label>
      <label class="settings__field">
        <span class="settings__label">Severe min</span>
        <input
          class="settings__input"
          type="number"
          min="3"
          step="1"
          bind:value={escalationSettings.thresholds.severe.minDays}
        />
      </label>
    </div>
  </div>

  <div class="settings__field">
    <label class="settings__label" for="escalation-theme">Color theme</label>
    <select
      id="escalation-theme"
      class="settings__input"
      bind:value={escalationSettings.colorTheme}
    >
      <option value="auto">Auto (light/dark aware)</option>
      <option value="high-contrast">High contrast</option>
    </select>
  </div>

  <div class="settings__field-group">
    <div class="settings__field-group-title">Show escalation badges</div>
    <label class="settings__checkbox">
      <input type="checkbox" bind:checked={escalationSettings.badgeVisibility.dashboard} />
      <div>
        <div class="settings__checkbox-label">Dashboard</div>
        <div class="settings__checkbox-description">Show badges on the escalation dashboard.</div>
      </div>
    </label>
    <label class="settings__checkbox">
      <input type="checkbox" bind:checked={escalationSettings.badgeVisibility.taskList} />
      <div>
        <div class="settings__checkbox-label">Task list</div>
        <div class="settings__checkbox-description">Show badges on task cards.</div>
      </div>
    </label>
    <label class="settings__checkbox">
      <input type="checkbox" bind:checked={escalationSettings.badgeVisibility.timeline} />
      <div>
        <div class="settings__checkbox-label">Timeline</div>
        <div class="settings__checkbox-description">Show badges on the timeline view.</div>
      </div>
    </label>
  </div>

  <button class="settings__save-btn" onclick={saveEscalationSettings}>
    Save escalation settings
  </button>
</section>

<style>
  .settings__field-group {
    margin-bottom: 16px;
  }

  .settings__field-group-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--b3-theme-on-surface);
    margin-bottom: 8px;
  }

  .settings__field-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 12px;
  }
</style>
