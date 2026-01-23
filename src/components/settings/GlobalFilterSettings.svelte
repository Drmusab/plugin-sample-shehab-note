<script lang="ts">
  import type { SettingsService } from '@/core/settings/SettingsService';
  import type { TaskRepositoryProvider } from '@/core/repository/TaskRepository';
  import { GlobalFilter } from '@/core/filtering/GlobalFilter';
  import { 
    DEFAULT_GLOBAL_FILTER_CONFIG, 
    validateProfile, 
    type GlobalFilterConfig, 
    type GlobalFilterProfile 
  } from '@/core/filtering/FilterRule';
  import { pluginEventBus } from '@/core/events/PluginEventBus';
  import { toast } from '@/utils/notifications';
  import type { Task } from '@/core/models/Task';

  interface Props {
    settingsService: SettingsService;
    repository: TaskRepositoryProvider;
  }

  let { settingsService, repository }: Props = $props();

  const globalFilter = GlobalFilter.getInstance();

  let filterConfig = $state<GlobalFilterConfig>(
    settingsService.get().globalFilter ??  DEFAULT_GLOBAL_FILTER_CONFIG
  );
  
  let selectedProfile = $derived(
    filterConfig.profiles.find(p => p.id === filterConfig.activeProfileId)
  );
  
  let preview = $state<{ included: number; excluded: number; samples: Task[] }>({ 
    included: 0, 
    excluded: 0, 
    samples: [] 
  });
  
  let validationErrors = $state<string[]>([]);
  let showExplainMode = $state(false);
  
  // Form fields for current profile
  let includePathsText = $state('');
  let excludePathsText = $state('');
  let includeTagsText = $state('');
  let excludeTagsText = $state('');
  
  // Sync form fields when profile changes
  $effect(() => {
    if (selectedProfile) {
      includePathsText = selectedProfile. includePaths.join('\n');
      excludePathsText = selectedProfile.excludePaths.join('\n');
      includeTagsText = selectedProfile. includeTags.join(', ');
      excludeTagsText = selectedProfile.excludeTags.join(', ');
    }
  });

  function switchProfile(profileId: string) {
    filterConfig.activeProfileId = profileId;
    globalFilter.setActiveProfile(profileId);
    saveConfig();
  }

  function addProfile() {
    const newProfile: GlobalFilterProfile = {
      id: `profile_${Date.now()}`,
      name: 'New Profile',
      description: '',
      includePaths:  [],
      excludePaths: [],
      includeTags: [],
      excludeTags: [],
      includeRegex: undefined,
      excludeRegex:  undefined,
      regexTargets: ['taskText'],
      excludeStatusTypes: [],
    };
    filterConfig.profiles = [...filterConfig.profiles, newProfile];
    filterConfig.activeProfileId = newProfile.id;
    saveConfig();
    toast.success('Profile created');
  }

  function duplicateProfile() {
    if (! selectedProfile) return;
    
    const newProfile: GlobalFilterProfile = {
      ...selectedProfile,
      id: `profile_${Date.now()}`,
      name: `${selectedProfile.name} (Copy)`,
    };
    
    filterConfig.profiles = [...filterConfig.profiles, newProfile];
    filterConfig.activeProfileId = newProfile.id;
    saveConfig();
    toast.success('Profile duplicated');
  }

  function deleteProfile(id: string) {
    if (filterConfig.profiles.length <= 1) {
      toast.error('Cannot delete the last profile');
      return;
    }
    
    filterConfig.profiles = filterConfig.profiles.filter(p => p.id !== id);
    if (filterConfig.activeProfileId === id) {
      filterConfig. activeProfileId = filterConfig.profiles[0].id;
    }
    saveConfig();
    toast.success('Profile deleted');
  }
  
  function updateCurrentProfile() {
    if (!selectedProfile) return;
    
    // Parse text inputs
    selectedProfile.includePaths = includePathsText
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean);
    selectedProfile.excludePaths = excludePathsText
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean);
    selectedProfile.includeTags = includeTagsText
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    selectedProfile.excludeTags = excludeTagsText
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    
    // Validate
    const validation = validateProfile(selectedProfile);
    validationErrors = validation.errors;
    
    if (validation.valid) {
      saveConfig();
      toast.success('Profile saved');
    } else {
      toast.error('Validation failed - check errors below');
    }
  }

  async function saveConfig() {
    globalFilter.updateConfig(filterConfig);
    await settingsService.update({ globalFilter:  filterConfig });
    pluginEventBus.emit('task: settings', { source: 'global-filter' });
    updatePreview();
  }

  function updatePreview() {
    if (! repository) {
      preview = { included: 0, excluded: 0, samples: [] };
      return;
    }
    
    const tasks = repository. getAllTasks();
    const globalFilter = GlobalFilter.getInstance();
    
    const excluded = tasks.filter(t => ! globalFilter.shouldIncludeTask(t));
    preview = {
      included: tasks. length - excluded.length,
      excluded: excluded.length,
      samples: excluded.slice(0, 20),
    };
  }

  function explainTask(task: Task): string {
    const decision = globalFilter.explainTask(task);
    let result = decision.reason;
    if (decision.matchedRule) {
      result += ` (${decision.matchedRule.type}:  ${decision.matchedRule.pattern}`;
      if (decision.matchedRule.target) {
        result += ` on ${decision.matchedRule.target}`;
      }
      result += ')';
    }
    return result;
  }
  
  async function resetGlobalFilter() {
    if (! confirm('Reset all profiles to defaults?  This cannot be undone.')) {
      return;
    }
    filterConfig = { ... DEFAULT_GLOBAL_FILTER_CONFIG };
    await saveConfig();
    toast.success('Reset to defaults');
  }
  
  function exportProfile() {
    if (!selectedProfile) return;
    
    const json = JSON.stringify(selectedProfile, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document. createElement('a');
    a.href = url;
    a. download = `${selectedProfile.name. replace(/\s+/g, '-').toLowerCase()}-profile.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Profile exported');
  }
  
  async function importProfile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '. json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (! file) return;
      
      try {
        const text = await file.text();
        const imported = JSON.parse(text) as GlobalFilterProfile;
        
        // Validate structure
        if (!imported.id || !imported.name || !Array.isArray(imported.includePaths)) {
          throw new Error('Invalid profile format');
        }
        
        // Generate new ID to avoid conflicts
        imported.id = `profile_${Date.now()}`;
        
        filterConfig.profiles = [...filterConfig.profiles, imported];
        filterConfig.activeProfileId = imported.id;
        await saveConfig();
        toast.success(`Profile "${imported.name}" imported`);
      } catch (err) {
        toast.error(`Import failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    };
    input.click();
  }

  $effect(() => {
    updatePreview();
  });
</script>

<div class="global-filter-settings">
  <div class="header">
    <div class="header-content">
      <h2>Global Filter Profiles</h2>
      <p class="subtitle">
        Control which tasks are included in your plugin universe. 
        Tasks that fail the filter won't appear in queries, dashboards, or notifications.
      </p>
    </div>
    
    <label class="enable-toggle">
      <input 
        type="checkbox" 
        bind:checked={filterConfig.enabled} 
        onchange={() => saveConfig()} 
      />
      <span>Enable Global Filter</span>
    </label>
  </div>

  {#if filterConfig.enabled}
    <!-- Profile Toolbar -->
    <div class="profile-toolbar">
      <div class="profile-selector">
        <label for="profile-select">Active Profile:</label>
        <select 
          id="profile-select"
          bind:value={filterConfig. activeProfileId} 
          onchange={() => switchProfile(filterConfig.activeProfileId)}
        >
          {#each filterConfig.profiles as profile}
            <option value={profile. id}>{profile.name}</option>
          {/each}
        </select>
      </div>
      
      <div class="profile-actions">
        <button type="button" onclick={addProfile} title="Create new profile">
          + New
        </button>
        <button type="button" onclick={duplicateProfile} title="Duplicate current profile">
          📋 Duplicate
        </button>
        <button 
          type="button"
          onclick={() => deleteProfile(filterConfig.activeProfileId)} 
          disabled={filterConfig.profiles.length <= 1}
          title="Delete current profile"
        >
          🗑️ Delete
        </button>
        <button type="button" onclick={exportProfile} title="Export profile to JSON">
          ⬇️ Export
        </button>
        <button type="button" onclick={importProfile} title="Import profile from JSON">
          ⬆️ Import
        </button>
      </div>
    </div>

    {#if selectedProfile}
      <div class="profile-editor">
        <div class="profile-header">
          <input 
            type="text" 
            bind:value={selectedProfile.name} 
            placeholder="Profile name"
            class="profile-name-input"
            onchange={() => updateCurrentProfile()}
          />
          <input 
            type="text" 
            bind:value={selectedProfile.description} 
            placeholder="Description (optional)"
            class="profile-description-input"
            onchange={() => updateCurrentProfile()}
          />
        </div>

        <!-- Path Scoping -->
        <section class="filter-section">
          <h3>📁 Path Scoping</h3>
          <p class="help-text">
            Use glob patterns like <code>daily/**</code>, <code>projects/**</code>
            <br/>
            <strong>Tip:</strong> <code>**</code> matches any depth, <code>*</code> matches within a folder
          </p>
          
          <div class="dual-input">
            <label>
              <span class="label-with-badge">
                Include Paths 
                <span class="badge optional">Optional</span>
              </span>
              <textarea 
                bind:value={includePathsText}
                placeholder="daily/**&#10;projects/**&#10;&#10;Leave empty to include all paths"
                rows="4"
              ></textarea>
              <span class="hint">If set, only tasks in these paths are included</span>
            </label>
            
            <label>
              <span class="label-with-badge">
                Exclude Paths 
                <span class="badge wins">Wins</span>
              </span>
              <textarea 
                bind:value={excludePathsText}
                placeholder="archive/**&#10;templates/**&#10;trash/**"
                rows="4"
              ></textarea>
              <span class="hint">Always excluded, even if in include list</span>
            </label>
          </div>
        </section>

        <!-- Tag Scoping -->
        <section class="filter-section">
          <h3>🏷️ Tag Scoping</h3>
          <p class="help-text">
            Tags are boundary-safe:  <code>#work</code> ≠ <code>#workshop</code>
            <br/>
            <strong>Case-insensitive: </strong> <code>#Work</code> = <code>#work</code>
          </p>
          
          <div class="dual-input">
            <label>
              <span class="label-with-badge">
                Include Tags
                <span class="badge optional">Optional</span>
              </span>
              <input 
                type="text" 
                bind:value={includeTagsText}
                placeholder="#task, #work, #active"
              />
              <span class="hint">Task must have at least one of these tags</span>
            </label>
            
            <label>
              <span class="label-with-badge">
                Exclude Tags
                <span class="badge wins">Wins</span>
              </span>
              <input 
                type="text" 
                bind:value={excludeTagsText}
                placeholder="#archive, #template, #ignore"
              />
              <span class="hint">Tasks with these tags are always excluded</span>
            </label>
          </div>
        </section>

        <!-- Regex Scoping -->
        <section class="filter-section">
          <h3>🔍 Regex Scoping (Advanced)</h3>
          <p class="help-text">
            Pattern matching for complex filtering. Invalid regex will be disabled automatically.
            <br/>
            <strong>Examples:</strong> <code>TODO|FIXME</code>, <code>wip|draft</code>, <code>^\[.*\]</code>
          </p>
          
          <div class="dual-input">
            <label>
              <span class="label-with-badge">
                Include Regex
                <span class="badge optional">Optional</span>
              </span>
              <input 
                type="text" 
                bind:value={selectedProfile.includeRegex}
                placeholder="TODO|FIXME|IMPORTANT"
              />
              <span class="hint">Task must match this pattern</span>
            </label>
            
            <label>
              <span class="label-with-badge">
                Exclude Regex
                <span class="badge wins">Wins</span>
              </span>
              <input 
                type="text" 
                bind:value={selectedProfile.excludeRegex}
                placeholder="wip|draft|skip"
              />
              <span class="hint">Tasks matching this are excluded</span>
            </label>
          </div>
          
          <div class="regex-targets">
            <span class="targets-label">Match against:</span>
            <label class="checkbox-label">
              <input 
                type="checkbox" 
                checked={selectedProfile.regexTargets.includes('taskText')}
                onchange={(e) => {
                  if (e.currentTarget.checked) {
                    if (! selectedProfile.regexTargets. includes('taskText')) {
                      selectedProfile.regexTargets = [...selectedProfile.regexTargets, 'taskText'];
                    }
                  } else {
                    selectedProfile.regexTargets = selectedProfile.regexTargets.filter(t => t !== 'taskText');
                  }
                }}
              />
              <span>Task Text</span>
            </label>
            <label class="checkbox-label">
              <input 
                type="checkbox" 
                checked={selectedProfile.regexTargets.includes('path')}
                onchange={(e) => {
                  if (e.currentTarget.checked) {
                    if (!selectedProfile. regexTargets.includes('path')) {
                      selectedProfile. regexTargets = [...selectedProfile.regexTargets, 'path'];
                    }
                  } else {
                    selectedProfile.regexTargets = selectedProfile.regexTargets.filter(t => t !== 'path');
                  }
                }}
              />
              <span>Path</span>
            </label>
            <label class="checkbox-label">
              <input 
                type="checkbox" 
                checked={selectedProfile.regexTargets.includes('fileName')}
                onchange={(e) => {
                  if (e.currentTarget.checked) {
                    if (!selectedProfile. regexTargets.includes('fileName')) {
                      selectedProfile. regexTargets = [...selectedProfile.regexTargets, 'fileName'];
                    }
                  } else {
                    selectedProfile.regexTargets = selectedProfile.regexTargets.filter(t => t !== 'fileName');
                  }
                }}
              />
              <span>File Name</span>
            </label>
          </div>
        </section>

        {#if validationErrors. length > 0}
          <div class="validation-errors">
            <h4>⚠️ Validation Errors: </h4>
            <ul>
              {#each validationErrors as error}
                <li>{error}</li>
              {/each}
            </ul>
          </div>
        {/if}

        <div class="profile-save-actions">
          <button type="button" onclick={updateCurrentProfile} class="primary">
            💾 Save Profile
          </button>
          <button type="button" onclick={resetGlobalFilter} class="secondary">
            🔄 Reset All to Defaults
          </button>
        </div>
      </div>
    {/if}

    <!-- Live Preview -->
    <div class="preview">
      <div class="preview-header">
        <h3>📊 Live Preview</h3>
        <label class="checkbox-label">
          <input type="checkbox" bind:checked={showExplainMode} />
          <span>Show Explain Mode</span>
        </label>
      </div>
      
      <div class="preview-stats">
        <div class="stat stat-included">
          <span class="stat-icon">✓</span>
          <div class="stat-content">
            <span class="stat-value">{preview.included}</span>
            <span class="stat-label">Included</span>
          </div>
        </div>
        
        <div class="stat stat-excluded">
          <span class="stat-icon">✗</span>
          <div class="stat-content">
            <span class="stat-value">{preview. excluded}</span>
            <span class="stat-label">Excluded</span>
          </div>
        </div>
        
        <div class="stat stat-total">
          <span class="stat-icon">Σ</span>
          <div class="stat-content">
            <span class="stat-value">{preview.included + preview.excluded}</span>
            <span class="stat-label">Total</span>
          </div>
        </div>
      </div>

      {#if preview.samples.length > 0}
        <details open>
          <summary>Sample Excluded Tasks (first 20):</summary>
          <ul class="excluded-samples">
            {#each preview. samples as task}
              <li>
                <div class="task-info">
                  <span class="task-name">{task.name}</span>
                  {#if task.path}
                    <span class="task-path">{task.path}</span>
                  {/if}
                  {#if task.tags && task.tags.length > 0}
                    <span class="task-tags">{task.tags.join(' ')}</span>
                  {/if}
                </div>
                {#if showExplainMode}
                  <span class="explanation">{explainTask(task)}</span>
                {/if}
              </li>
            {/each}
          </ul>
        </details>
      {:else if filterConfig.enabled}
        <div class="no-excluded">
          ✓ All tasks pass the current filter
        </div>
      {/if}
    </div>
    
    <!-- Quick Tips -->
    <div class="quick-tips">
      <h3>💡 Quick Tips</h3>
      <ul>
        <li><strong>Precedence:</strong> Exclude always wins over include</li>
        <li><strong>Performance:</strong> Filters are compiled and optimized for 10k+ tasks</li>
        <li><strong>Profiles:</strong> Create multiple profiles for different contexts (Work, Personal, etc.)</li>
        <li><strong>Query Overrides:</strong> Use <code>@ignoreGlobalFilter</code> or <code>@profile Work</code> in queries</li>
        <li><strong>Debugging:</strong> Enable "Show Explain Mode" to see why tasks are excluded</li>
      </ul>
    </div>
  {:else}
    <div class="disabled-state">
      <p>Global Filter is disabled. All tasks will be included.</p>
      <p class="hint">Enable to start filtering tasks by path, tags, or regex patterns.</p>
    </div>
  {/if}
</div>

<style>
  .global-filter-settings {
    padding: 1. 5rem;
    max-width: 1200px;
    margin: 0 auto;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 2rem;
    padding-bottom: 1rem;
    border-bottom: 2px solid var(--background-modifier-border);
  }

  .header-content h2 {
    margin: 0 0 0.5rem 0;
    font-size: 1.75rem;
  }

  .subtitle {
    color: var(--text-muted);
    margin: 0;
    font-size: 0.95rem;
    max-width: 600px;
  }

  .enable-toggle {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    padding: 0.75rem 1rem;
    background: var(--background-secondary);
    border-radius: 6px;
    transition: background 0.2s;
  }

  .enable-toggle:hover {
    background: var(--background-modifier-hover);
  }

  .enable-toggle span {
    font-weight: 500;
  }

  .profile-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
    padding:  1rem;
    background: var(--background-secondary);
    border-radius: 8px;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .profile-selector {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .profile-selector label {
    font-weight: 500;
    margin:  0;
  }

  .profile-selector select {
    min-width: 200px;
    padding: 0.5rem;
    border-radius: 4px;
  }

  .profile-actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .profile-editor {
    background: var(--background-secondary);
    border-radius: 8px;
    padding: 1.5rem;
    margin-bottom: 1.5rem;
  }

  .profile-header {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-bottom: 1.5rem;
  }

  .profile-name-input {
    font-size: 1.3rem;
    font-weight: 600;
    padding: 0.5rem;
    border: 2px solid var(--background-modifier-border);
    border-radius: 4px;
  }

  .profile-description-input {
    padding: 0.5rem;
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
  }

  .filter-section {
    margin-bottom: 2rem;
    padding-bottom: 2rem;
    border-bottom:  1px solid var(--background-modifier-border);
  }

  .filter-section:last-of-type {
    border-bottom: none;
  }

  .filter-section h3 {
    margin:  0 0 0.75rem 0;
    font-size: 1.1rem;
  }

  .help-text {
    font-size: 0.9rem;
    color: var(--text-muted);
    margin:  0 0 1rem 0;
    line-height: 1.5;
  }

  .help-text code {
    background: var(--background-primary);
    padding: 0.2rem 0.4rem;
    border-radius: 3px;
    font-family: var(--font-monospace);
    font-size: 0.85rem;
  }

  .dual-input {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .label-with-badge {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 500;
  }

  .badge {
    font-size: 0.7rem;
    padding: 0.15rem 0.4rem;
    border-radius:  3px;
    font-weight: 600;
    text-transform: uppercase;
  }

  .badge.optional {
    background: var(--interactive-accent);
    color: white;
  }

  .badge.wins {
    background: var(--text-error);
    color: white;
  }

  .hint {
    font-size: 0.8rem;
    color: var(--text-muted);
    font-style: italic;
  }

  textarea {
    resize: vertical;
    font-family: var(--font-monospace);
    padding: 0.6rem;
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    font-size: 0.9rem;
  }

  input[type="text"] {
    padding: 0.6rem;
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
  }

  .regex-targets {
    display: flex;
    gap: 1. 5rem;
    align-items: center;
    margin-top: 1rem;
    padding:  0.75rem;
    background: var(--background-primary);
    border-radius: 4px;
  }

  .targets-label {
    font-weight: 500;
    font-size: 0.9rem;
  }

  .checkbox-label {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 0.4rem;
    margin:  0;
    cursor: pointer;
  }

  .checkbox-label input[type="checkbox"] {
    cursor: pointer;
  }

  .validation-errors {
    background: var(--background-modifier-error);
    padding: 1rem;
    border-radius:  6px;
    margin-bottom: 1rem;
    border-left: 4px solid var(--text-error);
  }

  .validation-errors h4 {
    margin: 0 0 0.5rem 0;
    color: var(--text-error);
  }

  .validation-errors ul {
    margin: 0 0 0 1.5rem;
    padding:  0;
  }

  .validation-errors li {
    margin-bottom: 0.25rem;
  }

  .profile-save-actions {
    display: flex;
    gap: 1rem;
    margin-top: 1.5rem;
  }

  .preview {
    background: var(--background-secondary);
    border-radius: 8px;
    padding: 1.5rem;
    margin-bottom: 1.5rem;
  }

  .preview-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .preview-header h3 {
    margin:  0;
  }

  .preview-stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
    margin-bottom:  1.5rem;
  }

  .stat {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    background: var(--background-primary);
    border-radius: 6px;
  }

  .stat-icon {
    font-size: 2rem;
    width: 3rem;
    height: 3rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
  }

  .stat-included .stat-icon {
    background:  var(--text-success);
    color: white;
  }

  .stat-excluded .stat-icon {
    background: var(--text-error);
    color: white;
  }

  .stat-total .stat-icon {
    background:  var(--interactive-accent);
    color: white;
  }

  .stat-content {
    display: flex;
    flex-direction: column;
  }

  .stat-value {
    font-size: 1.75rem;
    font-weight:  700;
  }

  .stat-label {
    font-size: 0.85rem;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  details {
    margin-top: 1rem;
  }

  summary {
    cursor: pointer;
    font-weight: 500;
    padding: 0.5rem;
    border-radius: 4px;
    transition: background 0.2s;
  }

  summary:hover {
    background: var(--background-modifier-hover);
  }

  .excluded-samples {
    list-style: none;
    padding: 0;
    margin: 1rem 0 0 0;
  }

  .excluded-samples li {
    padding: 0.75rem;
    margin-bottom: 0.5rem;
    background: var(--background-primary);
    border-radius: 4px;
    border-left: 3px solid var(--text-error);
  }

  .task-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    margin-bottom: 0.5rem;
  }

  .task-name {
    font-weight: 500;
  }

  .task-path {
    font-size: 0.8rem;
    color: var(--text-muted);
    font-family: var(--font-monospace);
  }

  .task-tags {
    font-size: 0.85rem;
    color: var(--interactive-accent);
  }

  .explanation {
    font-size: 0.85rem;
    color: var(--text-muted);
    font-family: var(--font-monospace);
    display: block;
    padding: 0.5rem;
    background: var(--background-secondary);
    border-radius: 3px;
    margin-top: 0.5rem;
  }

  .no-excluded {
    text-align: center;
    padding:  2rem;
    color:  var(--text-success);
    font-weight: 500;
    font-size: 1.1rem;
  }

  .quick-tips {
    background: var(--background-secondary);
    border-radius: 8px;
    padding: 1.5rem;
    border-left: 4px solid var(--interactive-accent);
  }

  .quick-tips h3 {
    margin:  0 0 1rem 0;
  }

  .quick-tips ul {
    margin: 0;
    padding-left: 1.5rem;
  }

  .quick-tips li {
    margin-bottom: 0.5rem;
    line-height: 1.6;
  }

  .quick-tips code {
    background: var(--background-primary);
    padding: 0.2rem 0.4rem;
    border-radius: 3px;
    font-family: var(--font-monospace);
    font-size: 0.85rem;
  }

  .disabled-state {
    text-align: center;
    padding: 3rem 1rem;
    color: var(--text-muted);
  }

  .disabled-state p {
    margin:  0.5rem 0;
  }

  button {
    padding: 0.6rem 1.2rem;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 500;
    transition:  all 0.2s;
    border: none;
    background: var(--interactive-normal);
    color: var(--text-normal);
  }

  button:hover {
    background: var(--interactive-hover);
  }

  button.primary {
    background: var(--interactive-accent);
    color: white;
  }

  button.primary:hover {
    background: var(--interactive-accent-hover);
  }

  button.secondary {
    background: var(--background-modifier-border);
  }

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  button:disabled:hover {
    background: var(--interactive-normal);
  }

  @media (max-width: 768px) {
    .dual-input {
      grid-template-columns: 1fr;
    }

    .preview-stats {
      grid-template-columns: 1fr;
    }

    .profile-toolbar {
      flex-direction: column;
      align-items: stretch;
    }

    .profile-selector {
      flex-direction: column;
      align-items: stretch;
    }

    .profile-selector select {
      width: 100%;
    }
  }
</style>
