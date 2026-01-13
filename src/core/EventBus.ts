export type RecurringTaskCreatePayload = {
  source: "block-menu" | "block" | "command";
  linkedBlockId?: string;
  linkedBlockContent?: string;
  suggestedName?: string;
  suggestedTime?: string | null;
  blockId?: string;
  blockContent?: string;
  time?: string | null;
};

export type PluginEvents = {
  "recurring-task-create": RecurringTaskCreatePayload;
  "recurring-task-settings": { action: "toggle" };
  "recurring-task-complete": { taskId: string };
  "task-snooze": { taskId: string; minutes: number };
};

type EventHandler<T> = (payload: T) => void;

export class EventBus<Events extends Record<string, unknown>> {
  private listeners = new Map<keyof Events, Set<EventHandler<Events[keyof Events]>>>();

  on<K extends keyof Events>(
    event: K,
    handler: EventHandler<Events[K]>
  ): () => void {
    const existing = this.listeners.get(event);
    if (existing) {
      existing.add(handler as EventHandler<Events[keyof Events]>);
      return () => existing.delete(handler as EventHandler<Events[keyof Events]>);
    }

    const next = new Set<EventHandler<Events[keyof Events]>>();
    next.add(handler as EventHandler<Events[keyof Events]>);
    this.listeners.set(event, next);
    return () => next.delete(handler as EventHandler<Events[keyof Events]>);
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    const handlers = this.listeners.get(event);
    if (!handlers) {
      return;
    }
    for (const handler of handlers) {
      handler(payload as Events[keyof Events]);
    }
  }
}

export const eventBus = new EventBus<PluginEvents>();
