import { describe, expect, it, vi } from "vitest";
import { InlineQueryController } from "@/core/inline-query/InlineQueryController";
import { createTask } from "@/core/models/Task";
import { DEFAULT_SETTINGS } from "@/core/settings/PluginSettings";
import { pluginEventBus } from "@/core/events/PluginEventBus";

describe("Inline query toggle integration", () => {
  it("toggles a task and refreshes inline results", async () => {
    const root = document.createElement("div");
    root.className = "protyle-wysiwyg";
    const block = document.createElement("div");
    block.setAttribute("data-node-id", "block-1");
    block.setAttribute("data-type", "NodeCodeBlock");
    block.setAttribute("data-subtype", "tasks");
    const code = document.createElement("code");
    code.textContent = "not done";
    block.appendChild(code);
    root.appendChild(block);
    document.body.appendChild(root);

    const task = createTask("Inline Task", { type: "daily", interval: 1, time: "09:00" });
    task.status = "todo";

    const repository = {
      getAllTasks: () => [task],
      getTask: (id: string) => (id === task.id ? task : undefined),
    } as any;

    const settingsService = {
      get: () => DEFAULT_SETTINGS,
    } as any;

    const eventBusHandlers = new Map<string, Set<() => void>>();
    const plugin = {
      eventBus: {
        on: (event: string, handler: () => void) => {
          if (!eventBusHandlers.has(event)) {
            eventBusHandlers.set(event, new Set());
          }
          eventBusHandlers.get(event)!.add(handler);
          return () => eventBusHandlers.get(event)?.delete(handler);
        },
      },
    } as any;

    const toggleSpy = vi.fn((taskId: string) => {
      if (taskId === task.id) {
        task.status = "done";
      }
      pluginEventBus.emit("task:refresh", undefined);
    });

    const controller = new InlineQueryController({
      plugin,
      repository,
      settingsService,
      onEditTask: vi.fn(),
      onToggleTask: toggleSpy,
      debounceMs: 0,
      pageSize: 10,
    });

    controller.mount();

    const checkbox = document.querySelector<HTMLButtonElement>(".rt-inline-query__checkbox");
    expect(checkbox).not.toBeNull();
    checkbox?.click();

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(toggleSpy).toHaveBeenCalledWith(task.id);
    const stateMessage = document.querySelector(".rt-inline-query__state");
    expect(stateMessage?.textContent).toContain("No tasks");

    controller.destroy();
    document.body.innerHTML = "";
  });
});
