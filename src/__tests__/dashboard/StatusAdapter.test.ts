/**
 * Tests for StatusAdapter
 */

import { describe, it, expect } from "vitest";
import {
  symbolToStatus,
  statusToSymbol,
  isDoneSymbol,
  isCancelledSymbol,
  isTodoSymbol,
} from "@/dashboard/adapters/StatusAdapter";

describe("StatusAdapter", () => {
  describe("symbolToStatus", () => {
    it("should convert space to todo", () => {
      expect(symbolToStatus(" ")).toBe("todo");
    });

    it("should convert x to done", () => {
      expect(symbolToStatus("x")).toBe("done");
    });

    it("should convert X (uppercase) to done", () => {
      expect(symbolToStatus("X")).toBe("done");
    });

    it("should convert - to cancelled", () => {
      expect(symbolToStatus("-")).toBe("cancelled");
    });

    it("should convert / to cancelled", () => {
      expect(symbolToStatus("/")).toBe("cancelled");
    });

    it("should default unknown symbols to todo", () => {
      expect(symbolToStatus("?")).toBe("todo");
      expect(symbolToStatus("*")).toBe("todo");
      expect(symbolToStatus("!")).toBe("todo");
    });
  });

  describe("statusToSymbol", () => {
    it("should convert todo to space", () => {
      expect(statusToSymbol("todo")).toBe(" ");
    });

    it("should convert done to x", () => {
      expect(statusToSymbol("done")).toBe("x");
    });

    it("should convert cancelled to -", () => {
      expect(statusToSymbol("cancelled")).toBe("-");
    });
  });

  describe("isDoneSymbol", () => {
    it("should return true for done symbols", () => {
      expect(isDoneSymbol("x")).toBe(true);
      expect(isDoneSymbol("X")).toBe(true);
    });

    it("should return false for non-done symbols", () => {
      expect(isDoneSymbol(" ")).toBe(false);
      expect(isDoneSymbol("-")).toBe(false);
      expect(isDoneSymbol("/")).toBe(false);
    });
  });

  describe("isCancelledSymbol", () => {
    it("should return true for cancelled symbols", () => {
      expect(isCancelledSymbol("-")).toBe(true);
      expect(isCancelledSymbol("/")).toBe(true);
    });

    it("should return false for non-cancelled symbols", () => {
      expect(isCancelledSymbol(" ")).toBe(false);
      expect(isCancelledSymbol("x")).toBe(false);
      expect(isCancelledSymbol("X")).toBe(false);
    });
  });

  describe("isTodoSymbol", () => {
    it("should return true for todo symbols", () => {
      expect(isTodoSymbol(" ")).toBe(true);
    });

    it("should return false for non-todo symbols", () => {
      expect(isTodoSymbol("x")).toBe(false);
      expect(isTodoSymbol("X")).toBe(false);
      expect(isTodoSymbol("-")).toBe(false);
      expect(isTodoSymbol("/")).toBe(false);
    });

    it("should return true for unknown symbols (default to todo)", () => {
      expect(isTodoSymbol("?")).toBe(true);
      expect(isTodoSymbol("*")).toBe(true);
    });
  });

  describe("round-trip conversion", () => {
    it("should preserve status through round-trip conversion", () => {
      const statuses: Array<"todo" | "done" | "cancelled"> = ["todo", "done", "cancelled"];

      statuses.forEach((status) => {
        const symbol = statusToSymbol(status);
        const convertedStatus = symbolToStatus(symbol);
        expect(convertedStatus).toBe(status);
      });
    });
  });
});
