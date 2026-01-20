<script lang="ts">
  import type { Task } from "@/core/models/Task";
  import TaskCard from "../cards/TaskCard.svelte";

  interface Props {
    tasks: Task[];
    onEdit?: (task: Task) => void;
    onDone?: (task: Task) => void;
    onDelete?: (task: Task) => void;
  }

  let { tasks, onEdit, onDone, onDelete }: Props = $props();

  // Group tasks by path (folder structure)
  const groupedTasks = $derived(() => {
    const groups = new Map<string, Task[]>();
    
    tasks
      .filter((task) => task.status !== "done" && task.status !== "cancelled")
      .forEach((task) => {
        // Use linkedBlockPath or default to "Uncategorized"
        const path = task.linkedBlockPath || "Uncategorized";
        if (!groups.has(path)) {
          groups.set(path, []);
        }
        groups.get(path)!.push(task);
      });

    // Sort each group by due date
    groups.forEach((taskList) => {
      taskList.sort((a, b) => {
        if (!a.dueAt && !b.dueAt) return 0;
        if (!a.dueAt) return 1;
        if (!b.dueAt) return -1;
        return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
      });
    });

    // Sort groups by path name
    const sortedGroups = new Map(
      [...groups.entries()].sort(([pathA], [pathB]) => pathA.localeCompare(pathB))
    );

    return sortedGroups;
  });

  const totalTasks = $derived(
    [...groupedTasks.values()].reduce((sum, tasks) => sum + tasks.length, 0)
  );

  let expandedPaths = $state<Set<string>>(new Set([...groupedTasks.keys()]));

  function togglePath(path: string) {
    const newExpanded = new Set(expandedPaths);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    expandedPaths = newExpanded;
  }

  function expandAll() {
    expandedPaths = new Set([...groupedTasks.keys()]);
  }

  function collapseAll() {
    expandedPaths = new Set();
  }

  let focusedIndex = $state(0);
  let cardRefs = $state<HTMLDivElement[]>([]);

  // Get flattened list for keyboard navigation
  const flatTasks = $derived(() => {
    const flat: Task[] = [];
    groupedTasks.forEach((tasks, path) => {
      if (expandedPaths.has(path)) {
        flat.push(...tasks);
      }
    });
    return flat;
  });

  $effect(() => {
    if (focusedIndex >= flatTasks.length) {
      focusedIndex = Math.max(0, flatTasks.length - 1);
    }
  });

  function handleCardKeydown(event: KeyboardEvent, taskIndex: number) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusedIndex = Math.min(focusedIndex + 1, flatTasks.length - 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusedIndex = Math.max(focusedIndex - 1, 0);
    } else if (event.key === "Enter" && onEdit) {
      event.preventDefault();
      onEdit(flatTasks[taskIndex]);
    } else if (event.key === " " && onDone) {
      event.preventDefault();
      onDone(flatTasks[taskIndex]);
    }
  }

  function getShortPath(path: string): string {
    const parts = path.split("/");
    return parts[parts.length - 1] || path;
  }
</script>

<div class="projects-tab">
  <div class="projects-tab__header">
    <div class="projects-tab__header-main">
      <h2 class="projects-tab__title">Projects</h2>
      <p class="projects-tab__subtitle">
        {totalTasks} task{totalTasks !== 1 ? "s" : ""} in {groupedTasks.size} project{groupedTasks.size !== 1 ? "s" : ""}
      </p>
    </div>
    <div class="projects-tab__actions">
      <button class="projects-tab__action-btn" onclick={expandAll}>
        Expand All
      </button>
      <button class="projects-tab__action-btn" onclick={collapseAll}>
        Collapse All
      </button>
    </div>
  </div>

  <div class="projects-tab__content" role="region" aria-label="Project task lists">
    {#if groupedTasks.size === 0}
      <div class="projects-tab__empty">
        <p>📁 No active projects</p>
        <p class="projects-tab__empty-subtitle">
          Create tasks to see them organized by project!
        </p>
      </div>
    {:else}
      {#each [...groupedTasks.entries()] as [path, pathTasks]}
        <div class="projects-tab__project">
          <button
            class="projects-tab__project-header"
            onclick={() => togglePath(path)}
          >
            <span class="projects-tab__expand-icon">
              {expandedPaths.has(path) ? "▼" : "▶"}
            </span>
            <span class="projects-tab__project-name" title={path}>
              {getShortPath(path)}
            </span>
            <span class="projects-tab__project-count">
              {pathTasks.length}
            </span>
          </button>

          {#if expandedPaths.has(path)}
            <div
              class="projects-tab__project-tasks"
              role="list"
              aria-label={`Tasks for ${getShortPath(path)}`}
            >
              {#each pathTasks as task, index (task.id)}
                {@const globalIndex = flatTasks.indexOf(task)}
                <div
                  class="projects-tab__card-wrapper"
                  role="listitem"
                  tabindex={globalIndex === focusedIndex ? 0 : -1}
                  bind:this={cardRefs[globalIndex]}
                  onkeydown={(event) => handleCardKeydown(event, globalIndex)}
                  onfocus={() => (focusedIndex = globalIndex)}
                >
                  <TaskCard {task} onEdit={onEdit} onDone={onDone} onDelete={onDelete} />
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/each}
    {/if}
  </div>
</div>

<style>
  .projects-tab {
    padding: 16px;
  }

  .projects-tab__header {
    margin-bottom: 20px;
  }

  .projects-tab__header-main {
    margin-bottom: 12px;
  }

  .projects-tab__title {
    margin: 0 0 8px 0;
    font-size: 20px;
    font-weight: 600;
    color: var(--b3-theme-on-surface);
  }

  .projects-tab__subtitle {
    margin: 0;
    font-size: 14px;
    color: var(--b3-theme-on-surface-light);
  }

  .projects-tab__actions {
    display: flex;
    gap: 8px;
  }

  .projects-tab__action-btn {
    padding: 6px 12px;
    border: 1px solid var(--b3-theme-surface-lighter);
    background: var(--b3-theme-surface);
    color: var(--b3-theme-on-surface);
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
  }

  .projects-tab__action-btn:hover {
    background: var(--b3-theme-surface-light);
  }

  .projects-tab__content {
    max-width: 800px;
  }

  .projects-tab__project {
    margin-bottom: 16px;
    border: 1px solid var(--b3-theme-surface-lighter);
    border-radius: 8px;
    overflow: hidden;
  }

  .projects-tab__project-header {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    background: var(--b3-theme-surface);
    border: none;
    cursor: pointer;
    text-align: left;
    font-size: 14px;
  }

  .projects-tab__project-header:hover {
    background: var(--b3-theme-surface-light);
  }

  .projects-tab__expand-icon {
    flex-shrink: 0;
    width: 16px;
    color: var(--b3-theme-on-surface-light);
  }

  .projects-tab__project-name {
    flex: 1;
    font-weight: 600;
    color: var(--b3-theme-on-surface);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .projects-tab__project-count {
    flex-shrink: 0;
    padding: 2px 8px;
    background: var(--b3-theme-primary-light);
    color: var(--b3-theme-primary);
    border-radius: 12px;
    font-size: 12px;
    font-weight: 600;
  }

  .projects-tab__project-tasks {
    padding: 12px 16px;
    background: var(--b3-theme-background);
  }

  .projects-tab__card-wrapper {
    margin-bottom: 12px;
  }

  .projects-tab__card-wrapper:last-child {
    margin-bottom: 0;
  }

  .projects-tab__card-wrapper:focus {
    outline: 2px solid var(--b3-theme-primary);
    outline-offset: 4px;
    border-radius: 10px;
  }

  .projects-tab__empty {
    text-align: center;
    padding: 60px 20px;
    color: var(--b3-theme-on-surface-light);
  }

  .projects-tab__empty p {
    margin: 0 0 8px 0;
    font-size: 18px;
  }

  .projects-tab__empty-subtitle {
    font-size: 14px;
  }
</style>
