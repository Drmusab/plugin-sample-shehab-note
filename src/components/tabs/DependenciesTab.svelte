<script lang="ts">
  import type { App } from "siyuan";
  import { openTab } from "siyuan";
  import type { Task } from "@/core/models/Task";
  import { DependencyGraph } from "@/core/dependencies/DependencyGraph";
  import { GlobalFilter } from "@/core/filtering/GlobalFilter";
  import type { SettingsService } from "@/core/settings/SettingsService";
  import { toast } from "@/utils/notifications";

  interface Props {
    tasks: Task[];
    app: App;
    settingsService: SettingsService;
    onEdit?: (task: Task) => void;
  }

  let { tasks, app, settingsService, onEdit }: Props = $props();

  const dependencyGraph = new DependencyGraph();
  const globalFilter = GlobalFilter.getInstance();

  let graphSettings = $state(settingsService.get().dependencyGraph);
  let includeCompleted = $state(!graphSettings.hideCompletedByDefault);
  let depthLimit = $state(graphSettings.defaultDepth ?? 3);
  let onlyBlocked = $state(false);
  let onlyActive = $state(false);
  let collapseCompleted = $state(false);
  let noteFilter = $state<string>("");
  let focusTaskId = $state<string>("");

  const filteredTasks = $derived(() =>
    tasks.filter((task) => globalFilter.shouldIncludeTask(task))
  );

  $effect(() => {
    graphSettings = settingsService.get().dependencyGraph;
    includeCompleted = !graphSettings.hideCompletedByDefault;
    depthLimit = graphSettings.defaultDepth ?? 3;
  });

  $effect(() => {
    dependencyGraph.build(filteredTasks);
  });

  const availableNotes = $derived(() => {
    const notes = new Map<string, string>();
    for (const task of filteredTasks) {
      if (!task.path) continue;
      notes.set(task.path, task.path.split("/").pop() || task.path);
    }
    return Array.from(notes.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  });

  const focusOptions = $derived(() =>
    [...filteredTasks]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((task) => ({ id: task.id, label: task.name }))
  );

  const graphData = $derived(() =>
    dependencyGraph.getGraphData({
      includeCompleted,
      onlyBlocked,
      onlyActive,
      noteFilter: noteFilter || undefined,
      focusTaskId: focusTaskId || undefined,
      depthLimit,
      collapseCompleted,
    })
  );

  const columns = $derived(() => {
    const columnMap = new Map<number, string[]>();
    for (const node of graphData.nodes) {
      const level = graphData.levels.get(node.id) ?? 0;
      const list = columnMap.get(level) ?? [];
      list.push(node.id);
      columnMap.set(level, list);
    }
    for (const ids of columnMap.values()) {
      ids.sort((a, b) => {
        const aNode = graphData.nodes.find((node) => node.id === a);
        const bNode = graphData.nodes.find((node) => node.id === b);
        return (aNode?.title ?? "").localeCompare(bNode?.title ?? "");
      });
    }
    return Array.from(columnMap.entries()).sort((a, b) => a[0] - b[0]);
  });

  const NODE_WIDTH = 240;
  const NODE_HEIGHT = 84;
  const COLUMN_GAP = 80;
  const ROW_GAP = 32;
  const PADDING = 24;

  const layout = $derived(() => {
    const positions = new Map<string, { x: number; y: number }>();
    let maxRows = 0;

    columns.forEach(([level, nodeIds]) => {
      maxRows = Math.max(maxRows, nodeIds.length);
      nodeIds.forEach((nodeId, index) => {
        const x = PADDING + level * (NODE_WIDTH + COLUMN_GAP);
        const y = PADDING + index * (NODE_HEIGHT + ROW_GAP);
        positions.set(nodeId, { x, y });
      });
    });

    const width = Math.max(
      PADDING * 2 + columns.length * (NODE_WIDTH + COLUMN_GAP) - COLUMN_GAP,
      640
    );
    const height = Math.max(
      PADDING * 2 + maxRows * (NODE_HEIGHT + ROW_GAP) - ROW_GAP,
      360
    );

    return { positions, width, height };
  });

  const edgePaths = $derived(() => {
    return graphData.edges
      .map((edge) => {
        const from = layout.positions.get(edge.from);
        const to = layout.positions.get(edge.to);
        if (!from || !to) return null;
        const startX = from.x + NODE_WIDTH;
        const startY = from.y + NODE_HEIGHT / 2;
        const endX = to.x;
        const endY = to.y + NODE_HEIGHT / 2;
        const midX = (startX + endX) / 2;
        return {
          id: `${edge.from}-${edge.to}`,
          d: `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`,
        };
      })
      .filter(Boolean) as Array<{ id: string; d: string }>;
  });

  function formatNoteLabel(path?: string): string {
    if (!path) return "Unknown note";
    return path.split("/").pop() || path;
  }

  function formatTooltip(nodeId: string): string {
    const explanation = dependencyGraph.explainBlocked(nodeId, depthLimit);
    const blockers = dependencyGraph.getIndex().getBlockers(nodeId);
    const blocked = dependencyGraph.getIndex().getBlocked(nodeId);

    const formatLabel = (id: string) =>
      dependencyGraph.getIndex().getTask(id)?.name ?? id;

    const lines = [
      `Blockers: ${blockers.length ? blockers.map(formatLabel).join(", ") : "None"}`,
      `Blocked tasks: ${blocked.length ? blocked.map(formatLabel).join(", ") : "None"}`,
    ];

    if (explanation.chains.length > 0) {
      lines.push("Chains:");
      for (const chain of explanation.chains) {
        lines.push(`- ${chain.map(formatLabel).join(" → ")}`);
      }
    }

    return lines.join("\n");
  }

  function openTask(taskId: string) {
    const task = filteredTasks.find((candidate) => candidate.id === taskId);
    if (!task) return;

    if (task.linkedBlockId) {
      openTab({
        app,
        doc: {
          id: task.linkedBlockId,
        },
      });
      return;
    }

    if (onEdit) {
      onEdit(task);
      return;
    }

    toast.info("No linked block found for this task.");
  }
</script>

<div class="dependencies-tab">
  <div class="dependencies-tab__header">
    <div>
      <h2 class="dependencies-tab__title">Dependencies</h2>
      <p class="dependencies-tab__subtitle">
        Visualize cross-note blockers and dependency chains across your workspace.
      </p>
    </div>
    <div class="dependencies-tab__stats">
      <span>{graphData.nodes.length} nodes</span>
      <span>{graphData.edges.length} edges</span>
    </div>
  </div>

  {#if !graphSettings.enabled}
    <div class="dependencies-tab__empty">
      <p>The dependency graph is disabled in settings.</p>
    </div>
  {:else}
    <div class="dependencies-tab__controls">
      <label class="dependencies-tab__control">
        <span>Note filter</span>
        <select bind:value={noteFilter}>
          <option value="">All notes</option>
          {#each availableNotes as [path, label]}
            <option value={path}>{label}</option>
          {/each}
        </select>
      </label>

      <label class="dependencies-tab__control">
        <span>Focus task</span>
        <select bind:value={focusTaskId}>
          <option value="">All tasks</option>
          {#each focusOptions as option}
            <option value={option.id}>{option.label}</option>
          {/each}
        </select>
      </label>

      <label class="dependencies-tab__control">
        <span>Depth</span>
        <input type="number" min="1" max="10" bind:value={depthLimit} />
      </label>

      <label class="dependencies-tab__toggle">
        <input type="checkbox" bind:checked={includeCompleted} />
        <span>Show completed</span>
      </label>

      <label class="dependencies-tab__toggle">
        <input type="checkbox" bind:checked={collapseCompleted} />
        <span>Collapse completed subgraphs</span>
      </label>

      <label class="dependencies-tab__toggle">
        <input type="checkbox" bind:checked={onlyBlocked} />
        <span>Only blocked</span>
      </label>

      <label class="dependencies-tab__toggle">
        <input type="checkbox" bind:checked={onlyActive} />
        <span>Only active</span>
      </label>
    </div>

    {#if graphData.nodes.length === 0}
      <div class="dependencies-tab__empty">
        <p>No dependencies to display with the current filters.</p>
      </div>
    {:else}
      <div class="dependencies-tab__graph" style={`height: ${layout.height}px`}>
        <svg
          class="dependencies-tab__edges"
          width={layout.width}
          height={layout.height}
          viewBox={`0 0 ${layout.width} ${layout.height}`}
        >
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 10 3.5, 0 7" />
            </marker>
          </defs>
          {#each edgePaths as edge}
            <path class="dependencies-tab__edge" d={edge.d} marker-end="url(#arrowhead)" />
          {/each}
        </svg>

        {#each graphData.nodes as node}
          <div
            class={`dependencies-tab__node status-${node.status ?? "todo"} ${
              node.isCompleted ? "is-complete" : ""
            }`}
            style={`left: ${layout.positions.get(node.id)?.x ?? 0}px; top: ${
              layout.positions.get(node.id)?.y ?? 0
            }px; width: ${NODE_WIDTH}px; height: ${NODE_HEIGHT}px;`}
            role="button"
            tabindex="0"
            title={formatTooltip(node.id)}
            onclick={() => openTask(node.id)}
          >
            <div class="dependencies-tab__node-title">{node.title}</div>
            <div class="dependencies-tab__node-subtitle">{formatNoteLabel(node.notePath)}</div>
            <div class="dependencies-tab__node-icons">
              {#if node.isBlocked}
                <span title="Blocked">⛔</span>
              {/if}
              {#if node.hasDependencies}
                <span title="Has dependencies">🔗</span>
              {/if}
              {#if node.isCompleted}
                <span title="Done">✅</span>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    {/if}
  {/if}
</div>

<style>
  .dependencies-tab {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .dependencies-tab__header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
  }

  .dependencies-tab__title {
    margin: 0;
    font-size: 20px;
  }

  .dependencies-tab__subtitle {
    margin: 4px 0 0;
    color: var(--b3-theme-on-surface-variant, #9aa4b2);
  }

  .dependencies-tab__stats {
    display: flex;
    gap: 12px;
    font-size: 12px;
    color: var(--b3-theme-on-surface-variant, #9aa4b2);
  }

  .dependencies-tab__controls {
    display: flex;
    flex-wrap: wrap;
    gap: 12px 16px;
    align-items: flex-end;
    background: var(--b3-theme-surface, rgba(255, 255, 255, 0.03));
    padding: 12px;
    border-radius: 12px;
  }

  .dependencies-tab__control {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 12px;
    color: var(--b3-theme-on-surface-variant, #9aa4b2);
  }

  .dependencies-tab__control select,
  .dependencies-tab__control input {
    min-width: 160px;
    padding: 6px 8px;
    border-radius: 8px;
    border: 1px solid var(--b3-border-color, rgba(255, 255, 255, 0.1));
    background: var(--b3-theme-surface, rgba(255, 255, 255, 0.02));
    color: var(--b3-theme-on-surface, #e6edf3);
  }

  .dependencies-tab__toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--b3-theme-on-surface-variant, #9aa4b2);
  }

  .dependencies-tab__graph {
    position: relative;
    overflow: auto;
    border-radius: 16px;
    border: 1px solid var(--b3-border-color, rgba(255, 255, 255, 0.08));
    background: var(--b3-theme-surface, rgba(255, 255, 255, 0.02));
  }

  .dependencies-tab__edges {
    position: absolute;
    top: 0;
    left: 0;
    pointer-events: none;
  }

  .dependencies-tab__edge {
    fill: none;
    stroke: rgba(120, 156, 255, 0.5);
    stroke-width: 2;
  }

  .dependencies-tab__edge polygon {
    fill: rgba(120, 156, 255, 0.8);
  }

  .dependencies-tab__node {
    position: absolute;
    padding: 10px 12px;
    border-radius: 12px;
    border: 1px solid rgba(120, 156, 255, 0.25);
    background: rgba(30, 41, 59, 0.6);
    color: var(--b3-theme-on-surface, #e6edf3);
    display: flex;
    flex-direction: column;
    gap: 6px;
    cursor: pointer;
    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.25);
  }

  .dependencies-tab__node:hover {
    border-color: rgba(120, 156, 255, 0.6);
    background: rgba(30, 41, 59, 0.75);
  }

  .dependencies-tab__node-title {
    font-size: 14px;
    font-weight: 600;
  }

  .dependencies-tab__node-subtitle {
    font-size: 12px;
    color: rgba(230, 237, 243, 0.7);
  }

  .dependencies-tab__node-icons {
    display: flex;
    gap: 6px;
    font-size: 14px;
  }

  .dependencies-tab__node.status-done,
  .dependencies-tab__node.status-cancelled {
    border-color: rgba(94, 234, 212, 0.4);
    background: rgba(15, 52, 67, 0.6);
  }

  .dependencies-tab__node.status-todo {
    border-color: rgba(245, 158, 11, 0.4);
  }

  .dependencies-tab__empty {
    padding: 24px;
    text-align: center;
    color: var(--b3-theme-on-surface-variant, #9aa4b2);
  }
</style>
