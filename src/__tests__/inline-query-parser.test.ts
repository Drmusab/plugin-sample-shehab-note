import { describe, expect, it } from "vitest";
import { InlineQueryBlockParser } from "@/core/inline-query/InlineQueryBlockParser";

describe("InlineQueryBlockParser", () => {
  it("detects fenced tasks code blocks", () => {
    const root = document.createElement("div");
    const block = document.createElement("div");
    block.setAttribute("data-node-id", "block-1");
    block.setAttribute("data-type", "NodeCodeBlock");
    block.setAttribute("data-subtype", "tasks");

    const code = document.createElement("code");
    code.textContent = "not done\nsort by due";
    block.appendChild(code);
    root.appendChild(block);

    const parser = new InlineQueryBlockParser();
    const blocks = parser.parse(root);

    expect(blocks).toHaveLength(1);
    expect(blocks[0].query).toContain("not done");
    expect(blocks[0].source).toBe("code");
  });

  it("detects attribute-based query blocks", () => {
    const root = document.createElement("div");
    const block = document.createElement("div");
    block.setAttribute("data-node-id", "block-2");
    block.setAttribute(
      "data-attrs",
      JSON.stringify({
        "custom-task-query": "due before today",
        "custom-task-view": "table",
      })
    );
    root.appendChild(block);

    const parser = new InlineQueryBlockParser();
    const blocks = parser.parse(root);

    expect(blocks).toHaveLength(1);
    expect(blocks[0].query).toBe("due before today");
    expect(blocks[0].view).toBe("table");
    expect(blocks[0].source).toBe("attribute");
  });
});
