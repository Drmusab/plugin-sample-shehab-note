export type InlineQueryView = "list" | "table" | "kanban" | "compact";

export interface InlineQueryBlock {
  id: string;
  query: string;
  view?: InlineQueryView;
  element: HTMLElement;
  source: "code" | "attribute";
}

interface ParsedAttributes {
  query?: string;
  view?: InlineQueryView;
}

export class InlineQueryBlockParser {
  private readonly codeLanguage: string;

  constructor(codeLanguage: string = "tasks") {
    this.codeLanguage = codeLanguage.toLowerCase();
  }

  parse(root: HTMLElement): InlineQueryBlock[] {
    const blocks: InlineQueryBlock[] = [];

    const codeBlocks = root.querySelectorAll<HTMLElement>('[data-type="NodeCodeBlock"]');
    codeBlocks.forEach((element) => {
      const language = (element.dataset.subtype || element.getAttribute("data-subtype") || "").toLowerCase();
      if (language !== this.codeLanguage) {
        return;
      }

      const codeElement =
        element.querySelector<HTMLElement>("code") ||
        element.querySelector<HTMLElement>("textarea") ||
        element.querySelector<HTMLElement>(".hljs") ||
        element;
      const query = codeElement?.textContent?.trim() ?? "";
      if (!query) {
        return;
      }

      const id = element.getAttribute("data-node-id") || `inline-query-${blocks.length}`;
      blocks.push({
        id,
        query,
        element,
        source: "code",
      });
    });

    const attributeBlocks = root.querySelectorAll<HTMLElement>("[data-node-id]");
    attributeBlocks.forEach((element) => {
      if (element.classList.contains("rt-inline-query")) {
        return;
      }
      if (element.getAttribute("data-type") === "NodeCodeBlock") {
        return;
      }
      const attrs = this.parseAttributes(element);
      if (!attrs.query) {
        return;
      }
      const id = element.getAttribute("data-node-id") || `inline-query-${blocks.length}`;
      blocks.push({
        id,
        query: attrs.query,
        view: attrs.view,
        element,
        source: "attribute",
      });
    });

    return blocks;
  }

  private parseAttributes(element: HTMLElement): ParsedAttributes {
    const directQuery =
      element.getAttribute("custom-task-query") ||
      element.getAttribute("data-attr-custom-task-query") ||
      element.dataset.customTaskQuery ||
      element.dataset.attrCustomTaskQuery;
    const directView =
      element.getAttribute("custom-task-view") ||
      element.getAttribute("data-attr-custom-task-view") ||
      element.dataset.customTaskView ||
      element.dataset.attrCustomTaskView;

    if (directQuery) {
      return {
        query: directQuery.trim(),
        view: directView as InlineQueryView | undefined,
      };
    }

    const attrsRaw = element.getAttribute("data-attrs");
    if (!attrsRaw) {
      return {};
    }

    try {
      const attrs = JSON.parse(attrsRaw) as Record<string, string>;
      const query = attrs["custom-task-query"]?.trim();
      const view = attrs["custom-task-view"] as InlineQueryView | undefined;
      return {
        query,
        view,
      };
    } catch {
      return {};
    }
  }
}
