<script lang="ts">
  import EditTaskCore from '@/ui/EditTaskCore.svelte';
  import EmptyState from './EmptyState.svelte';
  import type { Task } from '@/vendor/obsidian-tasks/types/Task';
  import type { Status } from '@/vendor/obsidian-tasks/types/Status';
  import { toast } from '@/utils/notifications';
  
  export let task: Task | null;
  export let allTasks: Task[];
  export let statusOptions: Status[];
  export let onSave: (updatedTasks: Task[]) => Promise<void>;
  export let onNewTask: () => void;
  
  async function handleSave(event: CustomEvent<Task[]>) {
    try {
      await onSave(event.detail);
      // Toast notification handled by parent onSave callback
    } catch (error) {
      console.error('Failed to save task:', error);
      toast.error('Failed to save task');
    }
  }
  
  function handleNewTask() {
    onNewTask();
  }
</script>

<div class="task-editor-pane">
  {#if task}
    <EditTaskCore
      {task}
      {allTasks}
      {statusOptions}
      mode="embedded"
      on:save={handleSave}
    />
  {:else}
    <EmptyState on:newTask={handleNewTask} />
  {/if}
</div>

<style>
  .task-editor-pane {
    padding: 1rem;
    overflow-y: auto;
    height: 100%;
  }
</style>
