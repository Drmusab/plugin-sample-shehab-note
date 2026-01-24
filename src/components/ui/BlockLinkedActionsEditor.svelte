<script lang="ts">
  import type {
    BlockActionTaskContext,
    BlockLinkedAction,
    BlockTrigger,
    ConditionExpr,
    TaskAction,
  } from "@/core/block-actions/BlockActionTypes";
  import { BlockActionEvaluator } from "@/core/block-actions/BlockActionEvaluator";
  import { BlockActionExplainer } from "@/core/block-actions/BlockActionExplainer";
  import type { TaskPriority } from "@/core/models/Task";
  import { toast } from "@/utils/notifications";

  interface Props {
    value: BlockLinkedAction[];
    linkedBlockId?: string;
    linkedBlockContent?: string;
    taskContext: BlockActionTaskContext;
    featureEnabled: boolean;
    onChange: (actions: BlockLinkedAction[]) => void;
  }

  let {
    value,
    linkedBlockId,
    linkedBlockContent,
    taskContext,
    featureEnabled,
    onChange,
  }: Props = $props();

  let actions = $state<BlockLinkedAction[]>(value ?? []);
  let simulationResults = $state<string[]>([]);

  $effect(() => {
    actions = value ?? [];
  });

  const triggerOptions: { value: BlockTrigger["type"]; label: string }[] = [
    { value: "contentMatches", label: "Content matches regex" },
    { value: "contentNotMatches", label: "Content no longer matches regex" },
    { value: "blockCompleted", label: "Block checkbox completed" },
    { value: "blockEmpty", label: "Block becomes empty" },
    { value: "contentHasKeyword", label: "Content contains keyword" },
    { value: "contentHasTag", label: "Content contains tag" },
    { value: "blockDeleted", label: "Block deleted" },
    { value: "blockMoved", label: "Block moved" },
    { value: "blockCollapsed", label: "Block collapsed" },
    { value: "blockExpanded", label: "Block expanded" },
  ];

  const actionOptions: { value: TaskAction["type"]; label: string }[] = [
    { value: "setStatus", label: "Set status" },
    { value: "reschedule", label: "Reschedule" },
    { value: "triggerNextRecurrence", label: "Trigger next recurrence" },
    { value: "pauseRecurrence", label: "Pause recurrence" },
    { value: "addTag", label: "Add tag" },
    { value: "removeTag", label: "Remove tag" },
    { value: "changePriority", label: "Change priority" },
    { value: "addCompletionNote", label: "Add completion note" },
    { value: "notify", label: "Notify user" },
    { value: "sendWebhook", label: "Send n8n webhook" },
  ];

  const conditionOptions = [
    { value: "none", label: "No condition" },
    { value: "taskStatus", label: "Task status is" },
    { value: "taskHasTag", label: "Task has tag" },
    { value: "taskPriority", label: "Task priority is" },
  ] as const;

  function makeId(): string {
    return `block-action-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function defaultTrigger(type: BlockTrigger["type"]): BlockTrigger {
    switch (type) {
      case "contentMatches":
      case "contentNotMatches":
        return { type, regex: "" };
      case "contentHasTag":
        return { type, tag: "" };
      case "contentHasKeyword":
        return { type, keyword: "" };
      default:
        return { type } as BlockTrigger;
    }
  }

  function defaultAction(type: TaskAction["type"]): TaskAction {
    switch (type) {
      case "setStatus":
        return { type, status: "done" };
      case "reschedule":
        return { type, mode: "relative", amountMinutes: 60 };
      case "addTag":
        return { type, tag: "" };
      case "removeTag":
        return { type, tag: "" };
      case "changePriority":
        return { type, priority: "normal" };
      case "addCompletionNote":
        return { type, note: "" };
      case "notify":
        return { type, message: "" };
      case "sendWebhook":
        return { type, url: "" };
      default:
        return { type } as TaskAction;
    }
  }

  function updateActions(next: BlockLinkedAction[]) {
    actions = next;
    onChange(next);
  }

  function addAction() {
    const newAction: BlockLinkedAction = {
      id: makeId(),
      trigger: defaultTrigger("contentMatches"),
      action: defaultAction("setStatus"),
      enabled: true,
    };
    updateActions([...actions, newAction]);
  }

  function removeAction(id: string) {
    updateActions(actions.filter((action) => action.id !== id));
  }

  function updateAction(id: string, partial: Partial<BlockLinkedAction>) {
    updateActions(
      actions.map((action) =>
        action.id === id ? { ...action, ...partial } : action
      )
    );
  }

  function updateTrigger(id: string, type: BlockTrigger["type"]) {
    updateActions(
      actions.map((action) => {
        if (action.id !== id) return action;
        const trigger = defaultTrigger(type);
        const nextAction =
          type === "blockDeleted" && action.action.type === "setStatus"
            ? { ...action.action, status: "cancelled" }
            : action.action;
        return { ...action, trigger, action: nextAction };
      })
    );
  }

  function updateTriggerField(id: string, field: string, value: string) {
    updateActions(
      actions.map((action) => {
        if (action.id !== id) return action;
        const trigger = { ...action.trigger, [field]: value } as BlockTrigger;
        return { ...action, trigger };
      })
    );
  }

  function updateActionType(id: string, type: TaskAction["type"]) {
    updateAction(id, { action: defaultAction(type) });
  }

  function updateActionField(
    id: string,
    field: string,
    value: string | number
  ) {
    updateActions(
      actions.map((action) => {
        if (action.id !== id) return action;
        const nextAction = { ...action.action, [field]: value } as TaskAction;
        return { ...action, action: nextAction };
      })
    );
  }

  function getConditionType(condition?: ConditionExpr):
    | "none"
    | "taskStatus"
    | "taskHasTag"
    | "taskPriority" {
    if (!condition) return "none";
    if (condition.type === "taskStatus") return "taskStatus";
    if (condition.type === "taskHasTag") return "taskHasTag";
    if (condition.type === "taskPriority") return "taskPriority";
    return "none";
  }

  function updateCondition(id: string, type: typeof conditionOptions[number]["value"]) {
    if (type === "none") {
      updateAction(id, { condition: undefined });
      return;
    }

    let condition: ConditionExpr;
    switch (type) {
      case "taskStatus":
        condition = { type: "taskStatus", status: "todo" };
        break;
      case "taskHasTag":
        condition = { type: "taskHasTag", tag: "" };
        break;
      case "taskPriority":
        condition = { type: "taskPriority", priority: "normal" };
        break;
      default:
        condition = { type: "taskStatus", status: "todo" };
    }

    updateAction(id, { condition });
  }

  function updateConditionField(
    id: string,
    field: string,
    value: string
  ) {
    updateActions(
      actions.map((action) => {
        if (action.id !== id || !action.condition) return action;
        const condition = { ...action.condition, [field]: value } as ConditionExpr;
        return { ...action, condition };
      })
    );
  }

  function simulateActions() {
    if (!featureEnabled) {
      toast.warning("Block-linked actions are disabled in settings.");
      return;
    }
    if (!linkedBlockId) {
      toast.warning("Link a block to this task to simulate actions.");
      return;
    }
    const blockElement = document.querySelector(
      `[data-node-id="${linkedBlockId}"]`
    ) as HTMLElement | null;
    const content = blockElement?.textContent?.trim() || linkedBlockContent || "";

    if (!content) {
      toast.warning("No block content available to simulate.");
      return;
    }

    const evaluator = new BlockActionEvaluator();
    const explainer = new BlockActionExplainer();
    const event = {
      type: "contentChanged" as const,
      blockId: linkedBlockId,
      content,
      previousContent: linkedBlockContent,
      timestamp: new Date().toISOString(),
      source: "editor",
    };

    const results: string[] = [];
    actions.forEach((action) => {
      if (!action.enabled) return;
      if (!evaluator.matchesTrigger(action.trigger, event)) return;
      if (!evaluator.matchesCondition(action.condition, taskContext)) return;
      const explanation = explainer.explain(
        action.action,
        action.trigger,
        event,
        action.condition
      );
      results.push(`${explanation.summary} — ${explanation.reasons.join(" · ")}`);
    });

    simulationResults = results.length > 0
      ? results
      : ["No actions triggered for current block content."];
  }
</script>

<div class="block-actions">
  <div class="block-actions__header">
    <div>
      <h3>Block-Linked Actions</h3>
      <p>Automate task updates based on linked block changes.</p>
    </div>
    <div class="block-actions__header-actions">
      <button type="button" class="block-actions__button" onclick={addAction}>
        + Add Rule
      </button>
      <button
        type="button"
        class="block-actions__button block-actions__button--ghost"
        onclick={simulateActions}
      >
        Test with current block
      </button>
    </div>
  </div>

  {#if !featureEnabled}
    <div class="block-actions__warning">
      Block-linked actions are disabled in Settings. Enable them to activate these rules.
    </div>
  {/if}

  {#if actions.length === 0}
    <div class="block-actions__empty">No block-linked actions configured.</div>
  {:else}
    {#each actions as action (action.id)}
      <div class="block-actions__rule">
        <div class="block-actions__row">
          <label>
            <span>Trigger</span>
            <select
              bind:value={action.trigger.type}
              onchange={(event) =>
                updateTrigger(action.id, (event.currentTarget as HTMLSelectElement).value as BlockTrigger["type"])
              }
            >
              {#each triggerOptions as option}
                <option value={option.value}>{option.label}</option>
              {/each}
            </select>
          </label>

          <label>
            <span>Condition</span>
            <select
              value={getConditionType(action.condition)}
              onchange={(event) =>
                updateCondition(action.id, (event.currentTarget as HTMLSelectElement).value as typeof conditionOptions[number]["value"])
              }
            >
              {#each conditionOptions as option}
                <option value={option.value}>{option.label}</option>
              {/each}
            </select>
          </label>

          <label>
            <span>Action</span>
            <select
              bind:value={action.action.type}
              onchange={(event) =>
                updateActionType(action.id, (event.currentTarget as HTMLSelectElement).value as TaskAction["type"])
              }
            >
              {#each actionOptions as option}
                <option value={option.value}>{option.label}</option>
              {/each}
            </select>
          </label>

          <label class="block-actions__toggle">
            <input
              type="checkbox"
              bind:checked={action.enabled}
              onchange={() => updateAction(action.id, { enabled: action.enabled })}
            />
            <span>Enabled</span>
          </label>

          <button
            type="button"
            class="block-actions__button block-actions__button--danger"
            onclick={() => removeAction(action.id)}
          >
            Remove
          </button>
        </div>

        {#if action.trigger.type === "contentMatches" || action.trigger.type === "contentNotMatches"}
          <div class="block-actions__row">
            <label>
              <span>Regex</span>
              <input
                type="text"
                value={(action.trigger as { regex: string }).regex}
                placeholder="/TODO DONE/"
                oninput={(event) =>
                  updateTriggerField(action.id, "regex", (event.currentTarget as HTMLInputElement).value)
                }
              />
            </label>
          </div>
        {/if}

        {#if action.trigger.type === "contentHasTag"}
          <div class="block-actions__row">
            <label>
              <span>Tag</span>
              <input
                type="text"
                value={(action.trigger as { tag: string }).tag}
                placeholder="project"
                oninput={(event) =>
                  updateTriggerField(action.id, "tag", (event.currentTarget as HTMLInputElement).value)
                }
              />
            </label>
          </div>
        {/if}

        {#if action.trigger.type === "contentHasKeyword"}
          <div class="block-actions__row">
            <label>
              <span>Keyword</span>
              <input
                type="text"
                value={(action.trigger as { keyword: string }).keyword}
                placeholder="approved"
                oninput={(event) =>
                  updateTriggerField(action.id, "keyword", (event.currentTarget as HTMLInputElement).value)
                }
              />
            </label>
          </div>
        {/if}

        {#if action.action.type === "setStatus"}
          <div class="block-actions__row">
            <label>
              <span>Status</span>
              <select
                value={(action.action as { status: string }).status}
                onchange={(event) =>
                  updateActionField(
                    action.id,
                    "status",
                    (event.currentTarget as HTMLSelectElement).value
                  )
                }
              >
                <option value="done">Done</option>
                <option value="in_progress">In Progress</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </label>
          </div>
        {/if}

        {#if action.action.type === "reschedule"}
          <div class="block-actions__row">
            <label>
              <span>Mode</span>
              <select
                value={(action.action as { mode: string }).mode}
                onchange={(event) =>
                  updateActionField(
                    action.id,
                    "mode",
                    (event.currentTarget as HTMLSelectElement).value
                  )
                }
              >
                <option value="relative">Relative</option>
                <option value="absolute">Absolute</option>
              </select>
            </label>
            {#if (action.action as { mode: string }).mode === "relative"}
              <label>
                <span>Minutes</span>
                <input
                  type="number"
                  value={(action.action as { amountMinutes?: number }).amountMinutes ?? 0}
                  min="0"
                  oninput={(event) =>
                    updateActionField(
                      action.id,
                      "amountMinutes",
                      Number((event.currentTarget as HTMLInputElement).value)
                    )
                  }
                />
              </label>
              <label>
                <span>Days</span>
                <input
                  type="number"
                  value={(action.action as { amountDays?: number }).amountDays ?? 0}
                  min="0"
                  oninput={(event) =>
                    updateActionField(
                      action.id,
                      "amountDays",
                      Number((event.currentTarget as HTMLInputElement).value)
                    )
                  }
                />
              </label>
            {:else}
              <label>
                <span>Datetime</span>
                <input
                  type="datetime-local"
                  value={(action.action as { at?: string }).at ?? ""}
                  oninput={(event) =>
                    updateActionField(
                      action.id,
                      "at",
                      (event.currentTarget as HTMLInputElement).value
                    )
                  }
                />
              </label>
            {/if}
          </div>
        {/if}

        {#if action.action.type === "addTag" || action.action.type === "removeTag"}
          <div class="block-actions__row">
            <label>
              <span>Tag</span>
              <input
                type="text"
                value={(action.action as { tag: string }).tag}
                placeholder="focus"
                oninput={(event) =>
                  updateActionField(
                    action.id,
                    "tag",
                    (event.currentTarget as HTMLInputElement).value
                  )
                }
              />
            </label>
          </div>
        {/if}

        {#if action.action.type === "changePriority"}
          <div class="block-actions__row">
            <label>
              <span>Priority</span>
              <select
                value={(action.action as { priority: TaskPriority }).priority}
                onchange={(event) =>
                  updateActionField(
                    action.id,
                    "priority",
                    (event.currentTarget as HTMLSelectElement).value
                  )
                }
              >
                <option value="lowest">Lowest</option>
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="highest">Highest</option>
              </select>
            </label>
          </div>
        {/if}

        {#if action.action.type === "addCompletionNote"}
          <div class="block-actions__row">
            <label class="block-actions__wide">
              <span>Completion note</span>
              <textarea
                rows="2"
                oninput={(event) =>
                  updateActionField(
                    action.id,
                    "note",
                    (event.currentTarget as HTMLTextAreaElement).value
                  )
                }
              >{(action.action as { note: string }).note}</textarea>
            </label>
          </div>
        {/if}

        {#if action.action.type === "notify"}
          <div class="block-actions__row">
            <label class="block-actions__wide">
              <span>Notification message</span>
              <input
                type="text"
                value={(action.action as { message: string }).message}
                oninput={(event) =>
                  updateActionField(
                    action.id,
                    "message",
                    (event.currentTarget as HTMLInputElement).value)
                }
              />
            </label>
          </div>
        {/if}

        {#if action.action.type === "sendWebhook"}
          <div class="block-actions__row">
            <label class="block-actions__wide">
              <span>Webhook URL</span>
              <input
                type="url"
                value={(action.action as { url: string }).url}
                placeholder="https://n8n.example/webhook"
                oninput={(event) =>
                  updateActionField(
                    action.id,
                    "url",
                    (event.currentTarget as HTMLInputElement).value
                  )
                }
              />
            </label>
          </div>
        {/if}

        {#if action.condition && getConditionType(action.condition) === "taskStatus"}
          <div class="block-actions__row">
            <label>
              <span>Status</span>
              <select
                value={(action.condition as { status: string }).status}
                onchange={(event) =>
                  updateConditionField(
                    action.id,
                    "status",
                    (event.currentTarget as HTMLSelectElement).value
                  )
                }
              >
                <option value="todo">Todo</option>
                <option value="in_progress">In Progress</option>
                <option value="done">Done</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </label>
          </div>
        {/if}

        {#if action.condition && getConditionType(action.condition) === "taskHasTag"}
          <div class="block-actions__row">
            <label>
              <span>Tag</span>
              <input
                type="text"
                value={(action.condition as { tag: string }).tag}
                oninput={(event) =>
                  updateConditionField(
                    action.id,
                    "tag",
                    (event.currentTarget as HTMLInputElement).value)
                }
              />
            </label>
          </div>
        {/if}

        {#if action.condition && getConditionType(action.condition) === "taskPriority"}
          <div class="block-actions__row">
            <label>
              <span>Priority</span>
              <select
                value={(action.condition as { priority: TaskPriority }).priority}
                onchange={(event) =>
                  updateConditionField(
                    action.id,
                    "priority",
                    (event.currentTarget as HTMLSelectElement).value)
                }
              >
                <option value="lowest">Lowest</option>
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="highest">Highest</option>
              </select>
            </label>
          </div>
        {/if}
      </div>
    {/each}
  {/if}

  {#if simulationResults.length > 0}
    <div class="block-actions__simulation">
      <h4>Simulation Results</h4>
      <ul>
        {#each simulationResults as result}
          <li>{result}</li>
        {/each}
      </ul>
    </div>
  {/if}
</div>

<style>
  .block-actions {
    border: 1px solid var(--b3-border-color);
    border-radius: 8px;
    padding: 16px;
    background: var(--b3-theme-surface);
  }

  .block-actions__header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    margin-bottom: 12px;
  }

  .block-actions__header h3 {
    margin: 0 0 4px 0;
    font-size: 15px;
  }

  .block-actions__header p {
    margin: 0;
    font-size: 12px;
    color: var(--b3-theme-on-surface-light);
  }

  .block-actions__header-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .block-actions__button {
    padding: 6px 10px;
    border-radius: 6px;
    border: 1px solid var(--b3-border-color);
    background: var(--b3-theme-surface-lighter);
    cursor: pointer;
    font-size: 12px;
  }

  .block-actions__button--ghost {
    background: transparent;
  }

  .block-actions__button--danger {
    background: var(--b3-theme-error, #ff4d4f);
    border-color: transparent;
    color: #fff;
  }

  .block-actions__warning {
    background: rgba(255, 193, 7, 0.15);
    border: 1px solid rgba(255, 193, 7, 0.4);
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 12px;
    margin-bottom: 12px;
  }

  .block-actions__empty {
    font-size: 12px;
    color: var(--b3-theme-on-surface-light);
  }

  .block-actions__rule {
    border-top: 1px solid var(--b3-border-color);
    padding-top: 12px;
    margin-top: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .block-actions__row {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: flex-end;
  }

  .block-actions__row label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 12px;
    flex: 1;
    min-width: 160px;
  }

  .block-actions__row input,
  .block-actions__row select,
  .block-actions__row textarea {
    padding: 6px 8px;
    border-radius: 6px;
    border: 1px solid var(--b3-border-color);
    background: var(--b3-theme-background);
    color: var(--b3-theme-on-background);
  }

  .block-actions__toggle {
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-width: 110px;
  }

  .block-actions__wide {
    flex: 1 1 100%;
  }

  .block-actions__simulation {
    margin-top: 12px;
    background: var(--b3-theme-surface-lighter);
    padding: 10px;
    border-radius: 6px;
    font-size: 12px;
  }

  .block-actions__simulation ul {
    margin: 6px 0 0 16px;
  }
</style>
