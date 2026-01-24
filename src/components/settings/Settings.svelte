<script lang="ts">
  import type { NotificationConfig } from "@/services/types";
  import type { EventService } from "@/services/EventService";
  import type { SettingsService } from "@/core/settings/SettingsService";
  import type { TaskRepositoryProvider } from "@/core/storage/TaskRepository";
  import type { DependencyGraphSettings, InlineTaskSettings, SmartRecurrenceSettings } from "@/core/settings/PluginSettings";
  import type { PatternLearner } from "@/core/ml/PatternLearner";
  import { DEFAULT_NOTIFICATION_CONFIG } from "@/utils/constants";
  import { toast } from "@/utils/notifications";
  import type { ShortcutManager, ShortcutDisplay } from "@/commands/ShortcutManager";
  import GlobalFilterSettings from './GlobalFilterSettings.svelte';
  import StatusRegistryEditor from './StatusRegistryEditor.svelte';
  import EscalationSettings from './EscalationSettings.svelte';

  interface Props {
    eventService: EventService;
    shortcutManager: ShortcutManager | null;
    settingsService: SettingsService;
    repository: TaskRepositoryProvider;
    patternLearner?: PatternLearner;
    onClose?: () => void;
  }

  let { eventService, shortcutManager, settingsService, repository, patternLearner, onClose }: Props = $props();

  let config = $state<NotificationConfig>(DEFAULT_NOTIFICATION_CONFIG);
  let testingChannel: string | null = $state(null);
  let testResults = $state<{ [key: string]: { success: boolean; message: string } }>({});
  let activeSection = $state<'general' | 'filter' | 'statuses' | 'shortcuts' | 'inlineTasks' | 'blockActions' | 'escalation'>('general');
  let shortcutList = $state<ShortcutDisplay[]>([]);
  let shortcutDrafts = $state<Record<string, string>>({});
  let inlineTaskSettings = $state<InlineTaskSettings>({
    enableInlineCreation: true,
    autoCreateOnEnter: false,
    autoCreateOnBlur: false,
    normalizeOnSave: true,
    strictParsing: false,
    showInlineHints: true,
    highlightManagedTasks: true,
    enableInlineToggle: true,
    updateBlockOnToggle: true,
    showToggleNotifications: false,
  });
  let blockActionSettings = $state({
    enabled: true,
    debounceMs: 250,
  });
  let dependencyGraphSettings = $state<DependencyGraphSettings>({
    enabled: true,
    defaultDepth: 3,
    hideCompletedByDefault: true,
    cycleHandlingMode: 'strict',
  });
  let smartRecurrenceSettings = $state<SmartRecurrenceSettings>({
    enabled: false,
    autoAdjust: false,
    minCompletionsForLearning: 10,
    confidenceThreshold: 0.7,
    sensitivity: 'conservative',
    minSampleSize: 6,
    minConfidence: 0.75,
  });
  const sensitivityOptions = ['conservative', 'balanced', 'aggressive'] as const;
  const sensitivityIndex = $derived(
    Math.max(0, sensitivityOptions.indexOf(smartRecurrenceSettings.sensitivity || 'conservative'))
  );

  function refreshShortcuts() {
    if (!shortcutManager) {
      shortcutList = [];
      shortcutDrafts = {};
      return;
    }
    shortcutList = shortcutManager.getShortcutDisplay();
    shortcutDrafts = shortcutList.reduce<Record<string, string>>((acc, shortcut) => {
      acc[shortcut.id] = shortcut.currentHotkey || "";
      return acc;
    }, {});
  }

  function updateShortcutDraft(id: string, value: string) {
    shortcutDrafts = { ...shortcutDrafts, [id]: value };
  }

  async function saveShortcut(id: string) {
    if (!shortcutManager) return;
    const result = await shortcutManager.updateShortcut(
      id as ShortcutDisplay["id"],
      shortcutDrafts[id] ?? ""
    );
    if (!result.success) {
      toast.error(result.message || "Failed to update shortcut.");
      return;
    }
    toast.success("Shortcut updated.");
    refreshShortcuts();
  }

  async function resetShortcut(id: string) {
    if (!shortcutManager) return;
    await shortcutManager.resetShortcut(id as ShortcutDisplay["id"]);
    toast.success("Shortcut reset.");
    refreshShortcuts();
  }

  async function resetAllShortcuts() {
    if (!shortcutManager) return;
    await shortcutManager.resetAllShortcuts();
    toast.success("Shortcuts reset to defaults.");
    refreshShortcuts();
  }

  // Initialize config from service
  $effect(() => {
    config = eventService.getConfig();
  });

  $effect(() => {
    refreshShortcuts();
  });
  
  // Load inline task settings
  $effect(() => {
    const settings = settingsService.get();
    if (settings.inlineTasks) {
      inlineTaskSettings = { ...settings.inlineTasks };
    }
    if (settings.blockActions) {
      blockActionSettings = { ...settings.blockActions };
    }
    if (settings.dependencyGraph) {
      dependencyGraphSettings = { ...settings.dependencyGraph };
    }
    if (settings.smartRecurrence) {
      smartRecurrenceSettings = { ...settings.smartRecurrence };
    }
  });

  async function handleSave() {
    try {
      await eventService.saveConfig(config);
      toast.success("Settings saved successfully!");
      if (onClose) onClose();
    } catch (err) {
      toast.error("Failed to save settings: " + err);
    }
  }
  
  async function saveInlineTaskSettings() {
    try {
      await settingsService.update({ inlineTasks: inlineTaskSettings });
      toast.success("Auto-creation settings saved!");
    } catch (err) {
      toast.error("Failed to save settings: " + err);
    }
  }

  async function saveBlockActionSettings() {
    try {
      await settingsService.update({ blockActions: blockActionSettings });
      toast.success("Block action settings saved!");
    } catch (err) {
      toast.error("Failed to save block action settings: " + err);
    }
  }

  async function saveDependencyGraphSettings() {
    try {
      await settingsService.update({ dependencyGraph: dependencyGraphSettings });
      toast.success("Dependency graph settings saved!");
    } catch (err) {
      toast.error("Failed to save dependency graph settings: " + err);
    }
  }

  async function saveSmartRecurrenceSettings() {
    try {
      await settingsService.update({ smartRecurrence: smartRecurrenceSettings });
      toast.success("Smart recurrence settings saved!");
    } catch (err) {
      toast.error("Failed to save smart recurrence settings: " + err);
    }
  }

  function updateSensitivity(value: string) {
    const index = Number(value);
    smartRecurrenceSettings = {
      ...smartRecurrenceSettings,
      sensitivity: sensitivityOptions[index] ?? 'conservative',
    };
  }

  async function clearSmartRecurrenceHistory() {
    if (!patternLearner) {
      toast.error("Pattern learner unavailable.");
      return;
    }
    try {
      await patternLearner.clearHistory();
      toast.success("Smart recurrence history cleared.");
    } catch (err) {
      toast.error("Failed to clear smart recurrence history: " + err);
    }
  }

  async function testConnection() {
    testingChannel = "n8n";
    testResults.n8n = { success: false, message: "Testing..." };

    try {
      const result = await eventService.testConnection();
      testResults.n8n = {
        success: result.success,
        message: result.success ? "Test successful!" : result.message || "Test failed. Check configuration.",
      };
    } catch (err) {
      testResults.n8n = {
        success: false,
        message: "Error: " + (err instanceof Error ? err.message : String(err)),
      };
    } finally {
      testingChannel = null;
    }
  }
</script>

<div class="settings">
  <div class="settings__header">
    <h2 class="settings__title">Settings</h2>
    {#if onClose}
      <button class="settings__close-btn" onclick={onClose}>✕</button>
    {/if}
  </div>

  <div class="settings__layout">
    <nav class="settings__nav">
      <button 
        class="settings__nav-btn {activeSection === 'general' ? 'active' : ''}"
        onclick={() => activeSection = 'general'}
      >
        General
      </button>
      <button 
        class="settings__nav-btn {activeSection === 'filter' ? 'active' : ''}"
        onclick={() => activeSection = 'filter'}
      >
        Global Filtering & Query
      </button>
      <button 
        class="settings__nav-btn {activeSection === 'escalation' ? 'active' : ''}"
        onclick={() => activeSection = 'escalation'}
      >
        Escalation
      </button>
      <button 
        class="settings__nav-btn {activeSection === 'statuses' ? 'active' : ''}"
        onclick={() => activeSection = 'statuses'}
      >
        Custom Statuses
      </button>
      <button 
        class="settings__nav-btn {activeSection === 'shortcuts' ? 'active' : ''}"
        onclick={() => activeSection = 'shortcuts'}
      >
        Shortcuts
      </button>
      <button 
        class="settings__nav-btn {activeSection === 'inlineTasks' ? 'active' : ''}"
        onclick={() => activeSection = 'inlineTasks'}
      >
        Auto-Creation
      </button>
      <button 
        class="settings__nav-btn {activeSection === 'blockActions' ? 'active' : ''}"
        onclick={() => activeSection = 'blockActions'}
      >
        Block Actions
      </button>
    </nav>

    <div class="settings__content">
      {#if activeSection === 'general'}
        <!-- n8n Settings -->
        <section class="settings__section">
          <div class="settings__section-header">
            <h3 class="settings__section-title">n8n Webhook</h3>
            <label class="settings__toggle">
              <input type="checkbox" bind:checked={config.n8n.enabled} />
              <span>Enabled</span>
            </label>
          </div>

          <div class="settings__field">
            <label class="settings__label" for="n8n-webhook">Webhook URL</label>
            <input
              id="n8n-webhook"
              class="settings__input"
              type="url"
              bind:value={config.n8n.webhookUrl}
              placeholder="https://your-n8n-instance.com/webhook/..."
              disabled={!config.n8n.enabled}
            />
          </div>

          <div class="settings__field">
            <label class="settings__label" for="n8n-secret">Shared Secret</label>
            <input
              id="n8n-secret"
              class="settings__input"
              type="password"
              bind:value={config.n8n.sharedSecret}
              placeholder="Optional shared secret"
              disabled={!config.n8n.enabled}
            />
          </div>

          <button
            class="settings__test-btn"
            onclick={testConnection}
            disabled={!config.n8n.enabled || testingChannel === "n8n"}
          >
            {testingChannel === "n8n" ? "Testing..." : "Test Connection"}
          </button>
          {#if testResults.n8n}
            <div class="settings__test-result {testResults.n8n.success ? 'success' : 'error'}">
              {testResults.n8n.message}
            </div>
          {/if}
        </section>

        <section class="settings__section">
          <div class="settings__section-header">
            <h3 class="settings__section-title">Dependency Graph</h3>
            <label class="settings__toggle">
              <input type="checkbox" bind:checked={dependencyGraphSettings.enabled} />
              <span>Enabled</span>
            </label>
          </div>

          <div class="settings__field">
            <label class="settings__label" for="dependency-depth">Default graph depth</label>
            <input
              id="dependency-depth"
              class="settings__input"
              type="number"
              min="1"
              max="10"
              bind:value={dependencyGraphSettings.defaultDepth}
            />
          </div>

          <div class="settings__field">
            <label class="settings__label" for="dependency-cycle-mode">Cycle handling mode</label>
            <select
              id="dependency-cycle-mode"
              class="settings__input"
              bind:value={dependencyGraphSettings.cycleHandlingMode}
            >
              <option value="strict">Strict (block save)</option>
              <option value="warn">Warn (allow save)</option>
            </select>
          </div>

          <label class="settings__checkbox">
            <input type="checkbox" bind:checked={dependencyGraphSettings.hideCompletedByDefault} />
            <div>
              <div class="settings__checkbox-label">Hide completed tasks by default</div>
              <div class="settings__checkbox-description">
                Keep the dependency graph focused on active work.
              </div>
            </div>
          </label>

          <button class="settings__save-btn" onclick={saveDependencyGraphSettings}>
            Save dependency graph settings
          </button>
        </section>

        <section class="settings__section">
          <div class="settings__section-header">
            <h3 class="settings__section-title">Smart Recurrence Suggestions</h3>
            <label class="settings__toggle">
              <input type="checkbox" bind:checked={smartRecurrenceSettings.enabled} />
              <span>Enable suggestions</span>
            </label>
          </div>

          <p class="settings__description">
            Smart recurrence suggestions run locally and only analyze completion timestamps, titles, and tags.
            Suggestions are opt-in and never auto-apply.
          </p>

          <div class="settings__field">
            <label class="settings__label" for="smart-recurrence-sensitivity">Sensitivity</label>
            <input
              id="smart-recurrence-sensitivity"
              class="settings__input settings__input--range"
              type="range"
              min="0"
              max="2"
              step="1"
              value={sensitivityIndex}
              oninput={(event) => updateSensitivity((event.currentTarget as HTMLInputElement).value)}
              disabled={!smartRecurrenceSettings.enabled}
              list="smart-recurrence-sensitivity-labels"
            />
            <datalist id="smart-recurrence-sensitivity-labels">
              <option value="0" label="Conservative"></option>
              <option value="1" label="Balanced"></option>
              <option value="2" label="Aggressive"></option>
            </datalist>
            <div class="settings__hint">
              Current: {smartRecurrenceSettings.sensitivity}
            </div>
          </div>

          <div class="settings__field">
            <label class="settings__label" for="smart-recurrence-min-samples">Minimum sample size</label>
            <input
              id="smart-recurrence-min-samples"
              class="settings__input"
              type="number"
              min="3"
              max="30"
              bind:value={smartRecurrenceSettings.minSampleSize}
              disabled={!smartRecurrenceSettings.enabled}
            />
          </div>

          <div class="settings__field">
            <label class="settings__label" for="smart-recurrence-confidence">Minimum confidence</label>
            <input
              id="smart-recurrence-confidence"
              class="settings__input"
              type="number"
              min="0.5"
              max="0.95"
              step="0.05"
              bind:value={smartRecurrenceSettings.minConfidence}
              disabled={!smartRecurrenceSettings.enabled}
            />
            <div class="settings__hint">
              Suggestions will only appear when confidence meets or exceeds this threshold.
            </div>
          </div>

          <div class="settings__field">
            <button
              class="settings__save-btn settings__save-btn--secondary"
              type="button"
              onclick={clearSmartRecurrenceHistory}
              disabled={!smartRecurrenceSettings.enabled}
            >
              Clear learned history
            </button>
          </div>

          <button class="settings__save-btn" onclick={saveSmartRecurrenceSettings}>
            Save smart recurrence settings
          </button>
        </section>
      {:else if activeSection === 'filter'}
        <GlobalFilterSettings {settingsService} {repository} />
      {:else if activeSection === 'escalation'}
        <EscalationSettings {settingsService} />
      {:else if activeSection === 'statuses'}
        <StatusRegistryEditor />
      {:else if activeSection === 'shortcuts'}
        <section class="settings__section">
          <div class="settings__section-header">
            <h3 class="settings__section-title">Keyboard Shortcuts</h3>
          </div>
          <div class="settings__shortcuts">
            {#each shortcutList as shortcut}
              <div class="settings__shortcut">
                <div class="settings__shortcut-main">
                  <div class="settings__shortcut-label">{shortcut.label}</div>
                  <div class="settings__shortcut-description">{shortcut.description}</div>
                  {#if shortcut.context}
                    <div class="settings__shortcut-context">{shortcut.context}</div>
                  {/if}
                </div>
                <div class="settings__shortcut-keys">
                  <input
                    class="settings__shortcut-input"
                    type="text"
                    value={shortcutDrafts[shortcut.id] ?? ""}
                    placeholder="Unassigned"
                    oninput={(event) =>
                      updateShortcutDraft(shortcut.id, (event.currentTarget as HTMLInputElement).value)
                    }
                  />
                  <div class="settings__shortcut-actions">
                    <button
                      class="settings__shortcut-btn"
                      type="button"
                      onclick={() => saveShortcut(shortcut.id)}
                    >
                      Save
                    </button>
                    <button
                      class="settings__shortcut-btn settings__shortcut-btn--ghost"
                      type="button"
                      onclick={() => resetShortcut(shortcut.id)}
                    >
                      Reset
                    </button>
                  </div>
                  <div class="settings__shortcut-default">
                    Default: {shortcut.defaultHotkey || "Unassigned"}
                  </div>
                </div>
              </div>
            {/each}
          </div>
          <button class="settings__shortcut-reset-all" type="button" onclick={resetAllShortcuts}>
            Reset all shortcuts
          </button>
          <p class="settings__shortcut-note">
            Tip: You can also customize these in SiYuan's native shortcut settings.
          </p>
        </section>
      {:else if activeSection === 'inlineTasks'}
        <section class="settings__section">
          <div class="settings__section-header">
            <h3 class="settings__section-title">Auto-Creation Settings</h3>
            <label class="settings__toggle">
              <input type="checkbox" bind:checked={inlineTaskSettings.enableInlineCreation} />
              <span>Enable Inline Creation</span>
            </label>
          </div>
          
          <p class="settings__description">
            Automatically create tasks from markdown checklists as you type.
          </p>

          <!-- Auto-creation Triggers -->
          <div class="settings__subsection">
            <h4 class="settings__subsection-title">Auto-Creation Triggers</h4>
            
            <label class="settings__checkbox">
              <input 
                type="checkbox" 
                bind:checked={inlineTaskSettings.autoCreateOnEnter}
                disabled={!inlineTaskSettings.enableInlineCreation}
              />
              <div>
                <div class="settings__checkbox-label">Create on Enter</div>
                <div class="settings__checkbox-description">
                  Automatically create task when you press Enter after typing a checklist
                </div>
              </div>
            </label>

            <label class="settings__checkbox">
              <input 
                type="checkbox" 
                bind:checked={inlineTaskSettings.autoCreateOnBlur}
                disabled={!inlineTaskSettings.enableInlineCreation}
              />
              <div>
                <div class="settings__checkbox-label">Create on Blur</div>
                <div class="settings__checkbox-description">
                  Automatically create task when you click away from a checklist (debounced)
                </div>
              </div>
            </label>
          </div>

          <!-- Normalization -->
          <div class="settings__subsection">
            <h4 class="settings__subsection-title">Normalization</h4>
            
            <label class="settings__checkbox">
              <input 
                type="checkbox" 
                bind:checked={inlineTaskSettings.normalizeOnSave}
                disabled={!inlineTaskSettings.enableInlineCreation}
              />
              <div>
                <div class="settings__checkbox-label">Normalize on Save</div>
                <div class="settings__checkbox-description">
                  Reformat checklist text to standard format after task creation
                </div>
              </div>
            </label>
          </div>

          <!-- Parsing Mode -->
          <div class="settings__subsection">
            <h4 class="settings__subsection-title">Parsing Mode</h4>
            
            <label class="settings__checkbox">
              <input 
                type="checkbox" 
                bind:checked={inlineTaskSettings.strictParsing}
                disabled={!inlineTaskSettings.enableInlineCreation}
              />
              <div>
                <div class="settings__checkbox-label">Strict Parsing</div>
                <div class="settings__checkbox-description">
                  Reject tasks with invalid syntax (warning: may be frustrating)
                </div>
              </div>
            </label>
            
            {#if inlineTaskSettings.strictParsing}
              <div class="settings__warning">
                ⚠️ Strict mode enabled - tasks with any parsing errors will be rejected
              </div>
            {/if}
          </div>

          <!-- Visual Indicators -->
          <div class="settings__subsection">
            <h4 class="settings__subsection-title">Visual Indicators</h4>
            
            <label class="settings__checkbox">
              <input 
                type="checkbox" 
                bind:checked={inlineTaskSettings.showInlineHints}
                disabled={!inlineTaskSettings.enableInlineCreation}
              />
              <div>
                <div class="settings__checkbox-label">Show Error Hints</div>
                <div class="settings__checkbox-description">
                  Display inline error messages when task parsing fails
                </div>
              </div>
            </label>

            <label class="settings__checkbox">
              <input 
                type="checkbox" 
                bind:checked={inlineTaskSettings.highlightManagedTasks}
                disabled={!inlineTaskSettings.enableInlineCreation}
              />
              <div>
                <div class="settings__checkbox-label">Highlight Managed Tasks</div>
                <div class="settings__checkbox-description">
                  Add visual indicator to checklists that have linked tasks
                </div>
              </div>
            </label>
          </div>

          <button class="settings__save-btn" onclick={saveInlineTaskSettings}>
            Save Auto-Creation Settings
          </button>
        </section>
      {:else if activeSection === 'blockActions'}
        <section class="settings__section">
          <div class="settings__section-header">
            <h3 class="settings__section-title">Block-Linked Smart Actions</h3>
          </div>

          <div class="settings__field">
            <label class="settings__label">
              <input type="checkbox" bind:checked={blockActionSettings.enabled} />
              Enable block-linked automation
            </label>
            <div class="settings__hint">
              When enabled, linked block edits can update task status, schedule, and metadata.
            </div>
          </div>

          <div class="settings__field">
            <label class="settings__label" for="block-action-debounce">Debounce (ms)</label>
            <input
              id="block-action-debounce"
              class="settings__input"
              type="number"
              min="0"
              step="50"
              bind:value={blockActionSettings.debounceMs}
            />
            <div class="settings__hint">Delay before reacting to rapid block edits.</div>
          </div>

          <button class="settings__save-btn" onclick={saveBlockActionSettings}>
            Save Block Action Settings
          </button>
        </section>
      {/if}
    </div>
  </div>

  {#if activeSection === 'general'}
    <div class="settings__footer">
      <button class="settings__save-btn" onclick={handleSave}>
        Save Settings
      </button>
    </div>
  {/if}
</div>

<style>
  .settings {
    background: var(--b3-theme-background);
    border-radius: 8px;
    max-width: 900px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    max-height: 90vh;
  }

  .settings__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px 24px;
    border-bottom: 1px solid var(--b3-border-color);
    flex-shrink: 0;
  }

  .settings__title {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
    color: var(--b3-theme-on-surface);
  }

  .settings__close-btn {
    background: none;
    border: none;
    font-size: 20px;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 4px;
    color: var(--b3-theme-on-surface-light);
  }

  .settings__close-btn:hover {
    background: var(--b3-theme-surface-lighter);
  }

  .settings__layout {
    display: flex;
    flex: 1;
    overflow: hidden;
  }

  .settings__nav {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 16px;
    border-right: 1px solid var(--b3-border-color);
    background: var(--b3-theme-surface-lighter);
    min-width: 180px;
  }

  .settings__nav-btn {
    padding: 10px 16px;
    text-align: left;
    background: transparent;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    color: var(--b3-theme-on-surface);
    transition: all 0.2s;
  }

  .settings__nav-btn:hover {
    background: var(--b3-theme-surface);
  }

  .settings__nav-btn.active {
    background: var(--b3-theme-primary);
    color: white;
    font-weight: 500;
  }

  .settings__content {
    flex: 1;
    padding: 24px;
    overflow-y: auto;
  }

  .settings__section {
    margin-bottom: 32px;
    padding-bottom: 32px;
    border-bottom: 1px solid var(--b3-border-color);
  }

  .settings__section:last-child {
    border-bottom: none;
    margin-bottom: 0;
    padding-bottom: 0;
  }

  .settings__section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }

  .settings__section-title {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--b3-theme-on-surface);
  }

  .settings__toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
  }

  .settings__toggle input {
    cursor: pointer;
  }

  .settings__field {
    margin-bottom: 16px;
  }

  .settings__label {
    display: block;
    margin-bottom: 6px;
    font-size: 14px;
    font-weight: 500;
    color: var(--b3-theme-on-surface);
  }

  .settings__input {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid var(--b3-border-color);
    border-radius: 6px;
    font-size: 14px;
    background: var(--b3-theme-surface);
    color: var(--b3-theme-on-surface);
    box-sizing: border-box;
  }

  .settings__input:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .settings__input:focus {
    outline: none;
    border-color: var(--b3-theme-primary);
  }

  .settings__input--range {
    padding: 0;
    height: 28px;
  }

  .settings__test-btn {
    padding: 8px 16px;
    background: var(--b3-theme-surface-lighter);
    color: var(--b3-theme-on-surface);
    border: 1px solid var(--b3-border-color);
    border-radius: 6px;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .settings__test-btn:hover:not(:disabled) {
    background: var(--b3-theme-surface-light);
  }

  .settings__test-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .settings__test-result {
    margin-top: 8px;
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 13px;
  }

  .settings__test-result.success {
    background: #d4edda;
    color: #155724;
  }

  .settings__test-result.error {
    background: #f8d7da;
    color: #721c24;
  }

  .settings__footer {
    padding: 16px 24px;
    border-top: 1px solid var(--b3-border-color);
    text-align: right;
    flex-shrink: 0;
  }

  .settings__shortcuts {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .settings__shortcut {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    padding: 12px 14px;
    border: 1px solid var(--b3-border-color);
    border-radius: 8px;
    background: var(--b3-theme-surface);
  }

  .settings__shortcut-main {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .settings__shortcut-label {
    font-size: 14px;
    font-weight: 600;
    color: var(--b3-theme-on-surface);
  }

  .settings__shortcut-description {
    font-size: 13px;
    color: var(--b3-theme-on-surface-light);
  }

  .settings__shortcut-context {
    font-size: 12px;
    color: var(--b3-theme-on-surface-light);
  }

  .settings__shortcut-keys {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 220px;
  }

  .settings__shortcut-input {
    width: 100%;
    padding: 8px 10px;
    border-radius: 6px;
    border: 1px solid var(--b3-border-color);
    background: var(--b3-theme-surface);
    color: var(--b3-theme-on-surface);
    font-size: 13px;
    font-family: "SF Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  }

  .settings__shortcut-actions {
    display: flex;
    gap: 8px;
  }

  .settings__shortcut-btn {
    border: 1px solid var(--b3-border-color);
    background: var(--b3-theme-surface-lighter);
    padding: 6px 10px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 12px;
  }

  .settings__shortcut-btn--ghost {
    background: transparent;
  }

  .settings__shortcut-default {
    font-size: 12px;
    color: var(--b3-theme-on-surface-light);
  }

  .settings__shortcut-reset-all {
    margin-top: 16px;
    border: 1px solid var(--b3-border-color);
    background: var(--b3-theme-surface-lighter);
    padding: 8px 12px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
  }

  .settings__shortcut-note {
    margin-top: 8px;
    color: var(--b3-theme-on-surface-light);
    font-size: 12px;
  }

  .settings__save-btn {
    padding: 10px 24px;
    background: var(--b3-theme-primary);
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
  }

  .settings__save-btn:hover {
    background: var(--b3-theme-primary-light);
  }

  .settings__save-btn--secondary {
    background: var(--b3-theme-surface-lighter);
    color: var(--b3-theme-on-surface);
    border: 1px solid var(--b3-border-color);
  }

  .settings__save-btn--secondary:hover {
    background: var(--b3-theme-surface-light);
  }
  
  /* Auto-Creation Settings Styles */
  .settings__description {
    color: var(--b3-theme-on-surface-light);
    font-size: 14px;
    margin-bottom: 24px;
    line-height: 1.6;
  }
  
  .settings__subsection {
    margin-bottom: 32px;
  }
  
  .settings__subsection-title {
    font-size: 15px;
    font-weight: 600;
    color: var(--b3-theme-on-surface);
    margin-bottom: 16px;
  }
  
  .settings__checkbox {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    margin-bottom: 16px;
    cursor: pointer;
  }
  
  .settings__checkbox input[type="checkbox"] {
    margin-top: 2px;
    cursor: pointer;
    flex-shrink: 0;
  }
  
  .settings__checkbox input[type="checkbox"]:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .settings__checkbox-label {
    font-size: 14px;
    font-weight: 500;
    color: var(--b3-theme-on-surface);
    margin-bottom: 4px;
  }
  
  .settings__checkbox-description {
    font-size: 13px;
    color: var(--b3-theme-on-surface-light);
    line-height: 1.5;
  }
  
  .settings__warning {
    background: var(--b3-theme-error-lighter, rgba(244, 67, 54, 0.1));
    border: 1px solid var(--b3-theme-error);
    border-radius: 6px;
    padding: 12px;
    margin-top: 12px;
    font-size: 13px;
    color: var(--b3-theme-on-surface);
  }

  @media (max-width: 768px) {
    .settings__layout {
      flex-direction: column;
    }

    .settings__nav {
      flex-direction: row;
      overflow-x: auto;
      border-right: none;
      border-bottom: 1px solid var(--b3-border-color);
      min-width: unset;
    }

    .settings__nav-btn {
      white-space: nowrap;
    }
  }
</style>
