/**
 * Status Adapter
 * 
 * Maps status symbols to status types and vice versa.
 * Compatible with Obsidian-Tasks status symbols.
 */

export type TaskStatus = "todo" | "done" | "cancelled";

/**
 * Status symbol to type mapping (Obsidian-Tasks compatible)
 */
const STATUS_SYMBOL_MAP: Record<string, TaskStatus> = {
  " ": "todo",
  "x": "done",
  "X": "done",
  "-": "cancelled",
  "/": "cancelled",
};

/**
 * Type to status symbol mapping
 */
const TYPE_TO_SYMBOL_MAP: Record<TaskStatus, string> = {
  todo: " ",
  done: "x",
  cancelled: "-",
};

/**
 * Convert status symbol to status type
 */
export function symbolToStatus(symbol: string): TaskStatus {
  return STATUS_SYMBOL_MAP[symbol] || "todo";
}

/**
 * Convert status type to status symbol
 */
export function statusToSymbol(status: TaskStatus): string {
  return TYPE_TO_SYMBOL_MAP[status] || " ";
}

/**
 * Check if a symbol represents a done/completed status
 */
export function isDoneSymbol(symbol: string): boolean {
  return symbolToStatus(symbol) === "done";
}

/**
 * Check if a symbol represents a cancelled status
 */
export function isCancelledSymbol(symbol: string): boolean {
  return symbolToStatus(symbol) === "cancelled";
}

/**
 * Check if a symbol represents a todo/pending status
 */
export function isTodoSymbol(symbol: string): boolean {
  return symbolToStatus(symbol) === "todo";
}
