<script lang="ts">
  import TaskRow from './TaskRow.svelte';
  import type { Task } from '@/vendor/obsidian-tasks/types/Task';
  
  export let task: Task;
  export let selected: boolean = false;
  export let bulkSelected: boolean = false;
  export let onBulkToggle: (() => void) | undefined = undefined;
  export let isDragging: boolean = false;
  export let onDragStart: ((task: Task) => void) | undefined = undefined;
  export let onDragEnd: (() => void) | undefined = undefined;
  export let onDrop: ((task: Task) => void) | undefined = undefined;
  
  let dragOver = false;
  
  function handleDragStart(e: DragEvent) {
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', task.id);
    }
    if (onDragStart) {
      onDragStart(task);
    }
  }
  
  function handleDragEnd() {
    if (onDragEnd) {
      onDragEnd();
    }
  }
  
  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    dragOver = true;
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move';
    }
  }
  
  function handleDragLeave() {
    dragOver = false;
  }
  
  function handleDrop(e: DragEvent) {
    e.preventDefault();
    dragOver = false;
    if (onDrop) {
      onDrop(task);
    }
  }
</script>

<div
  class="draggable-task-row"
  class:dragging={isDragging}
  class:drag-over={dragOver}
  draggable="true"
  on:dragstart={handleDragStart}
  on:dragend={handleDragEnd}
  on:dragover={handleDragOver}
  on:dragleave={handleDragLeave}
  on:drop={handleDrop}
  role="button"
  tabindex="0"
>
  <span class="drag-handle" aria-label="Drag to reorder">⋮⋮</span>
  <div class="task-row-wrapper">
    <TaskRow {task} {selected} {bulkSelected} {onBulkToggle} />
  </div>
</div>

<style>
  .draggable-task-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    transition: opacity 0.2s ease, transform 0.2s ease;
    position: relative;
  }
  
  .draggable-task-row.dragging {
    opacity: 0.5;
  }
  
  .draggable-task-row.drag-over {
    border-top: 2px solid var(--interactive-accent);
    padding-top: 2px;
  }
  
  .drag-handle {
    cursor: grab;
    color: var(--text-muted);
    font-size: 1rem;
    padding: 0.5rem 0.25rem;
    opacity: 0;
    transition: opacity 0.15s ease;
    user-select: none;
  }
  
  .draggable-task-row:hover .drag-handle {
    opacity: 1;
  }
  
  .draggable-task-row.dragging .drag-handle {
    cursor: grabbing;
  }
  
  .task-row-wrapper {
    flex: 1;
    min-width: 0;
  }
</style>
