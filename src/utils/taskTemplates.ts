import type { FrequencyType } from "@/core/models/Frequency";
import type { TaskPriority } from "@/core/models/Task";

export interface TaskTemplate {
  id: string;
  label: string;
  name: string;
  frequencyType: FrequencyType;
  interval: number;
  time: string;
  weekdays: number[];
  dayOfMonth: number;
  month: number;
  enabled: boolean;
  linkedBlockId?: string;
  priority: TaskPriority;
  tags: string[];
}

const TEMPLATE_STORAGE_KEY = "recurring-task-templates";

export function loadTaskTemplates(): TaskTemplate[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(TEMPLATE_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) {
      return [];
    }
    return data.filter((item): item is TaskTemplate => !!item && typeof item.id === "string");
  } catch {
    return [];
  }
}

export function saveTaskTemplate(template: TaskTemplate): TaskTemplate[] {
  const templates = loadTaskTemplates();
  const existingIndex = templates.findIndex((item) => item.id === template.id);
  if (existingIndex >= 0) {
    templates[existingIndex] = template;
  } else {
    templates.push(template);
  }
  persistTemplates(templates);
  return templates;
}

export function deleteTaskTemplate(templateId: string): TaskTemplate[] {
  const templates = loadTaskTemplates().filter((template) => template.id !== templateId);
  persistTemplates(templates);
  return templates;
}

function persistTemplates(templates: TaskTemplate[]): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(templates));
}

export function createTemplateId(): string {
  return `template_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
