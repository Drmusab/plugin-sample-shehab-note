<script lang="ts">
  import type { Task } from "@/core/models/Task";
  import { QueryEngine, type TaskIndex } from "@/core/query/QueryEngine";
  import { QueryParser } from "@/core/query/QueryParser";
  import { QueryComposer } from "@/core/query/QueryComposer";
  import { GlobalQuery } from "@/core/query/GlobalQuery";
  import { DependencyGraph } from "@/core/dependencies/DependencyGraph";
  import TaskCard from "../cards/TaskCard.svelte";
  import { toast } from "@/utils/notifications";
  import type { UrgencySettings } from "@/core/urgency/UrgencySettings";
  import { getContext } from "svelte";
  import { URGENCY_SETTINGS_CONTEXT_KEY } from "@/core/urgency/UrgencyContext";
  import { ESCALATION_SETTINGS_CONTEXT_KEY } from "@/core/escalation/EscalationContext";
  import type { EscalationSettings } from "@/core/settings/PluginSettings";

  interface Props {
    tasks: Task[];
    onEdit?: (task: Task) => void;
    onDone?: (task: Task) => void;
    onDelete?: (task: Task) => void;
  }

  let { tasks, onEdit, onDone, onDelete }: Props = $props();

  let queryInput = $state("");
  let queryResults = $state<Task[]>([]);
  let queryError = $state("");
  let executionTimeMs = $state(0);
  let queryHistory = $state<string[]>([]);
  let showHistory = $state(false);
  let isExecuting = $state(false);

  // Example queries
  const exampleQueries = [
    "not done",
    "priority is high",
    "due before tomorrow",
    "not done AND priority above medium",
    "is blocked",
    "description includes meeting",
    "tag includes #work",
    "is recurring",
    "priority is high OR priority is medium",
    "NOT is blocked",
    "not done AND priority is high AND description includes priority",
    "sort by priority",
    "sort by urgency",
    "urgency above 80",
    "escalation >= critical",
    "group by priority",
  ];

  // Task index for QueryEngine
  const taskIndex: TaskIndex = {
    getAllTasks: () => tasks,
  };

  const urgencySettings = getContext<UrgencySettings | undefined>(URGENCY_SETTINGS_CONTEXT_KEY);
  const escalationSettings = getContext<EscalationSettings | undefined>(ESCALATION_SETTINGS_CONTEXT_KEY);
  const queryEngine = new QueryEngine(taskIndex, { urgencySettings, escalationSettings });
  const queryComposer = new QueryComposer(new QueryParser());
  const dependencyGraph = new DependencyGraph();

  $effect(() => {
    dependencyGraph.build(tasks);
    queryEngine.setDependencyGraph(dependencyGraph);
  });

  function executeQuery() {
    if (!queryInput.trim()) {
      queryResults = [];
      queryError = "";
      return;
    }

    isExecuting = true;
    queryError = "";

    try {
      const globalQuery = GlobalQuery.getInstance();
      if (globalQuery.isEnabled() && globalQuery.getError()) {
        throw new Error(`Global query error: ${globalQuery.getError()}`);
      }
      const ast = queryComposer.compose(queryInput, globalQuery.getAST()).ast;
      const result = queryEngine.execute(ast);
      
      queryResults = result.tasks;
      executionTimeMs = result.executionTimeMs;
      
      // Add to history (keep last 10)
      if (!queryHistory.includes(queryInput)) {
        queryHistory = [queryInput, ...queryHistory].slice(0, 10);
        // Persist to localStorage
        try {
          localStorage.setItem("query-history", JSON.stringify(queryHistory));
        } catch (e) {
          // Ignore storage errors
        }
      }
    } catch (error) {
      queryError = error instanceof Error ? error.message : String(error);
      queryResults = [];
      toast.error(`Query error: ${queryError}`);
    } finally {
      isExecuting = false;
    }
  }

  function loadQueryHistory() {
    try {
      const stored = localStorage.getItem("query-history");
      if (stored) {
        queryHistory = JSON.parse(stored);
      }
    } catch (e) {
      // Ignore errors
    }
  }

  function useExample(query: string) {
    queryInput = query;
    executeQuery();
  }

  function useHistoryQuery(query: string) {
    queryInput = query;
    showHistory = false;
    executeQuery();
  }

  function clearHistory() {
    queryHistory = [];
    try {
      localStorage.removeItem("query-history");
    } catch (e) {
      // Ignore
    }
    showHistory = false;
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      executeQuery();
    }
  }

  // Load history on mount
  $effect(() => {
    loadQueryHistory();
  });

  let focusedIndex = $state(0);
  let cardRefs = $state<HTMLDivElement[]>([]);

  $effect(() => {
    if (focusedIndex >= queryResults.length) {
      focusedIndex = Math.max(0, queryResults.length - 1);
    }
  });

  function handleCardKeydown(event: KeyboardEvent, index: number) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusedIndex = Math.min(focusedIndex + 1, queryResults.length - 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusedIndex = Math.max(focusedIndex - 1, 0);
    } else if (event.key === "Enter" && onEdit) {
      event.preventDefault();
      onEdit(queryResults[index]);
    } else if (event.key === " " && onDone) {
      event.preventDefault();
      onDone(queryResults[index]);
    }
  }
</script>

<div class="search-tab">
  <div class="search-tab__header">
    <h2 class="search-tab__title">Search</h2>
    <p class="search-tab__subtitle">
      Use query language to filter and search tasks
    </p>
  </div>

  <div class="search-tab__query-section">
    <div class="search-tab__input-wrapper">
      <textarea
        class="search-tab__input"
        placeholder="Enter query (e.g., 'not done AND priority high')..."
        bind:value={queryInput}
        onkeydown={handleKeyDown}
        rows="2"
      ></textarea>
      <div class="search-tab__input-actions">
        <button
          class="search-tab__btn search-tab__btn--primary"
          onclick={executeQuery}
          disabled={isExecuting}
        >
          {isExecuting ? "Searching..." : "Search"}
        </button>
        {#if queryHistory.length > 0}
          <button
            class="search-tab__btn"
            onclick={() => (showHistory = !showHistory)}
          >
            History ({queryHistory.length})
          </button>
        {/if}
      </div>
    </div>

    {#if queryError}
      <div class="search-tab__error">
        ⚠️ {queryError}
      </div>
    {/if}

    {#if executionTimeMs > 0 && !queryError}
      <div class="search-tab__stats">
        Found {queryResults.length} task{queryResults.length !== 1 ? "s" : ""} in {executionTimeMs.toFixed(2)}ms
      </div>
    {/if}
  </div>

  {#if showHistory && queryHistory.length > 0}
    <div class="search-tab__history">
      <div class="search-tab__history-header">
        <h3>Recent Queries</h3>
        <button class="search-tab__btn--small" onclick={clearHistory}>
          Clear
        </button>
      </div>
      <ul class="search-tab__history-list">
        {#each queryHistory as query}
          <li>
            <button
              class="search-tab__history-item"
              onclick={() => useHistoryQuery(query)}
            >
              {query}
            </button>
          </li>
        {/each}
      </ul>
    </div>
  {/if}

  <div class="search-tab__examples">
    <h3 class="search-tab__examples-title">Example Queries</h3>
    <div class="search-tab__examples-grid">
      {#each exampleQueries as example}
        <button
          class="search-tab__example-btn"
          onclick={() => useExample(example)}
        >
          <code>{example}</code>
        </button>
      {/each}
    </div>
  </div>

  <div class="search-tab__results" role="list" aria-label="Search results">
    {#if queryResults.length === 0 && queryInput.trim() && !queryError}
      <div class="search-tab__empty">
        <p>🔍 No tasks match your query</p>
        <p class="search-tab__empty-subtitle">
          Try adjusting your search criteria
        </p>
      </div>
    {:else if queryResults.length > 0}
      {#each queryResults as task, index (task.id)}
        <div
          class="search-tab__card-wrapper"
          role="listitem"
          tabindex={index === focusedIndex ? 0 : -1}
          bind:this={cardRefs[index]}
          onkeydown={(event) => handleCardKeydown(event, index)}
          onfocus={() => (focusedIndex = index)}
        >
          <TaskCard {task} onEdit={onEdit} onDone={onDone} onDelete={onDelete} />
        </div>
      {/each}
    {/if}
  </div>
</div>

<style>
  .search-tab {
    padding: 16px;
  }

  .search-tab__header {
    margin-bottom: 20px;
  }

  .search-tab__title {
    margin: 0 0 8px 0;
    font-size: 20px;
    font-weight: 600;
    color: var(--b3-theme-on-surface);
  }

  .search-tab__subtitle {
    margin: 0;
    font-size: 14px;
    color: var(--b3-theme-on-surface-light);
  }

  .search-tab__query-section {
    margin-bottom: 24px;
  }

  .search-tab__input-wrapper {
    margin-bottom: 12px;
  }

  .search-tab__input {
    width: 100%;
    padding: 12px;
    border: 1px solid var(--b3-theme-surface-lighter);
    border-radius: 4px;
    background: var(--b3-theme-surface);
    color: var(--b3-theme-on-surface);
    font-family: monospace;
    font-size: 14px;
    resize: vertical;
    margin-bottom: 8px;
  }

  .search-tab__input:focus {
    outline: 2px solid var(--b3-theme-primary);
    outline-offset: 2px;
  }

  .search-tab__input-actions {
    display: flex;
    gap: 8px;
  }

  .search-tab__btn {
    padding: 8px 16px;
    border: 1px solid var(--b3-theme-surface-lighter);
    background: var(--b3-theme-surface);
    color: var(--b3-theme-on-surface);
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
  }

  .search-tab__btn--primary {
    background: var(--b3-theme-primary);
    color: white;
    border-color: var(--b3-theme-primary);
  }

  .search-tab__btn:hover:not(:disabled) {
    opacity: 0.9;
  }

  .search-tab__btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .search-tab__btn--small {
    padding: 4px 8px;
    font-size: 12px;
  }

  .search-tab__error {
    padding: 12px;
    background: var(--b3-theme-error-lighter);
    color: var(--b3-theme-error);
    border-radius: 4px;
    font-size: 14px;
  }

  .search-tab__stats {
    font-size: 12px;
    color: var(--b3-theme-on-surface-light);
  }

  .search-tab__history {
    margin-bottom: 24px;
    padding: 16px;
    background: var(--b3-theme-surface);
    border-radius: 8px;
  }

  .search-tab__history-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }

  .search-tab__history-header h3 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
  }

  .search-tab__history-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .search-tab__history-item {
    width: 100%;
    text-align: left;
    padding: 8px 12px;
    background: transparent;
    border: none;
    color: var(--b3-theme-on-surface);
    cursor: pointer;
    font-family: monospace;
    font-size: 13px;
    border-radius: 4px;
  }

  .search-tab__history-item:hover {
    background: var(--b3-theme-surface-light);
  }

  .search-tab__examples {
    margin-bottom: 24px;
  }

  .search-tab__examples-title {
    margin: 0 0 12px 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--b3-theme-on-surface);
  }

  .search-tab__examples-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .search-tab__example-btn {
    padding: 6px 12px;
    border: 1px solid var(--b3-theme-surface-lighter);
    background: var(--b3-theme-surface);
    color: var(--b3-theme-on-surface);
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
  }

  .search-tab__example-btn:hover {
    background: var(--b3-theme-surface-light);
  }

  .search-tab__example-btn code {
    font-family: monospace;
  }

  .search-tab__results {
    max-width: 800px;
  }

  .search-tab__card-wrapper {
    margin-bottom: 12px;
  }

  .search-tab__card-wrapper:focus {
    outline: 2px solid var(--b3-theme-primary);
    outline-offset: 4px;
    border-radius: 10px;
  }

  .search-tab__empty {
    text-align: center;
    padding: 60px 20px;
    color: var(--b3-theme-on-surface-light);
  }

  .search-tab__empty p {
    margin: 0 0 8px 0;
    font-size: 18px;
  }

  .search-tab__empty-subtitle {
    font-size: 14px;
  }
</style>
