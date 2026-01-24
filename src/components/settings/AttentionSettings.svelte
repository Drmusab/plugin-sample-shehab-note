<script lang="ts">
  import type { AttentionSettings } from "@/core/settings/PluginSettings";
  import type { SettingsService } from "@/core/settings/SettingsService";
  import { toast } from "@/utils/notifications";

  interface Props {
    settingsService: SettingsService;
  }

  let { settingsService }: Props = $props();

  let attentionSettings = $state<AttentionSettings>(settingsService.get().attention);

  $effect(() => {
    attentionSettings = settingsService.get().attention;
  });

  function validateSettings(settings: AttentionSettings): string | null {
    if (settings.lanes.watchlistThreshold >= settings.lanes.doNowThreshold) {
      return "Watchlist threshold must be lower than Do Now threshold.";
    }
    if (settings.scoring.weights.escalation < 0 || settings.scoring.weights.priority < 0 || settings.scoring.weights.blocking < 0) {
      return "Scoring weights must be zero or higher.";
    }
    if (settings.blockersPreviewCount < 1) {
      return "Blocker preview count must be at least 1.";
    }
    return null;
  }

  async function saveAttentionSettings() {
    const validationError = validateSettings(attentionSettings);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    try {
      await settingsService.update({ attention: attentionSettings });
      toast.success("Attention settings saved!");
    } catch (err) {
      toast.error("Failed to save attention settings: " + err);
    }
  }
</script>

<section class="settings__section">
  <div class="settings__section-header">
    <h3 class="settings__section-title">Attention Engine</h3>
    <label class="settings__toggle">
      <input type="checkbox" bind:checked={attentionSettings.enabled} />
      <span>Enabled</span>
    </label>
  </div>

  <p class="settings__description">
    The Attention Engine ranks tasks using escalation, priority, and dependency impact to surface what matters now.
  </p>

  <label class="settings__checkbox">
    <input type="checkbox" bind:checked={attentionSettings.hideCompleted} />
    <div>
      <div class="settings__checkbox-label">Hide completed tasks</div>
      <div class="settings__checkbox-description">Exclude done or cancelled tasks from the attention dashboard.</div>
    </div>
  </label>

  <label class="settings__checkbox">
    <input type="checkbox" bind:checked={attentionSettings.treatScheduledAsWatchlist} />
    <div>
      <div class="settings__checkbox-label">Treat scheduled-only tasks as watchlist</div>
      <div class="settings__checkbox-description">Show scheduled tasks without a due date in the Watchlist lane.</div>
    </div>
  </label>

  <div class="settings__field">
    <label class="settings__label" for="attention-blocker-count">Blockers shown on cards</label>
    <input
      id="attention-blocker-count"
      class="settings__input"
      type="number"
      min="1"
      step="1"
      bind:value={attentionSettings.blockersPreviewCount}
    />
  </div>

  <div class="settings__field-group">
    <div class="settings__field-group-title">Scoring weights</div>
    <div class="settings__field-grid">
      <label class="settings__field">
        <span class="settings__label">Escalation weight</span>
        <input
          class="settings__input"
          type="number"
          min="0"
          step="0.1"
          bind:value={attentionSettings.scoring.weights.escalation}
        />
      </label>
      <label class="settings__field">
        <span class="settings__label">Priority weight</span>
        <input
          class="settings__input"
          type="number"
          min="0"
          step="0.1"
          bind:value={attentionSettings.scoring.weights.priority}
        />
      </label>
      <label class="settings__field">
        <span class="settings__label">Blocking weight</span>
        <input
          class="settings__input"
          type="number"
          min="0"
          step="0.1"
          bind:value={attentionSettings.scoring.weights.blocking}
        />
      </label>
    </div>
  </div>

  <div class="settings__field-group">
    <div class="settings__field-group-title">Escalation boost</div>
    <div class="settings__field-grid">
      <label class="settings__field">
        <span class="settings__label">Overdue per day</span>
        <input
          class="settings__input"
          type="number"
          min="0"
          step="1"
          bind:value={attentionSettings.scoring.overduePerDay}
        />
      </label>
      <label class="settings__field">
        <span class="settings__label">Overdue max boost</span>
        <input
          class="settings__input"
          type="number"
          min="0"
          step="1"
          bind:value={attentionSettings.scoring.overdueMaxBoost}
        />
      </label>
    </div>
  </div>

  <div class="settings__field-group">
    <div class="settings__field-group-title">Blocking impact</div>
    <div class="settings__field-grid">
      <label class="settings__field">
        <span class="settings__label">Points per blocked task</span>
        <input
          class="settings__input"
          type="number"
          min="0"
          step="1"
          bind:value={attentionSettings.scoring.blockingPerTask}
        />
      </label>
      <label class="settings__field">
        <span class="settings__label">Maximum blocking points</span>
        <input
          class="settings__input"
          type="number"
          min="0"
          step="1"
          bind:value={attentionSettings.scoring.blockingMax}
        />
      </label>
    </div>
  </div>

  <div class="settings__field-group">
    <div class="settings__field-group-title">Lane thresholds</div>
    <div class="settings__field-grid">
      <label class="settings__field">
        <span class="settings__label">Do Now cutoff</span>
        <input
          class="settings__input"
          type="number"
          min="0"
          max="100"
          step="1"
          bind:value={attentionSettings.lanes.doNowThreshold}
        />
      </label>
      <label class="settings__field">
        <span class="settings__label">Watchlist cutoff</span>
        <input
          class="settings__input"
          type="number"
          min="0"
          max="100"
          step="1"
          bind:value={attentionSettings.lanes.watchlistThreshold}
        />
      </label>
      <label class="settings__field">
        <span class="settings__label">Unblock count threshold</span>
        <input
          class="settings__input"
          type="number"
          min="1"
          step="1"
          bind:value={attentionSettings.lanes.unblockCountThreshold}
        />
      </label>
    </div>
  </div>

  <button class="settings__save-btn" onclick={saveAttentionSettings}>
    Save attention settings
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
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 12px;
  }
</style>
