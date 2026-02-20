const DEFAULT_ACTION_LIMIT = 24;

export class ActionHistory {
  // Initializes class state
  constructor({ limit = DEFAULT_ACTION_LIMIT } = {}) {
    this.limit = limit;
    this.stack = [];
  }
  // Sets entries
  setEntries(entries = []) {
    if (!Array.isArray(entries)) {
      this.stack = [];
      return;
    }
    const cleaned = entries
      .filter((entry) => typeof entry === "string")
      .map((entry) => entry.trim())
      .filter(Boolean);
    this.stack = cleaned.slice(-this.limit);
  }
  // Handles clear
  clear() {
    this.stack = [];
  }
  // Handles record
  record(action) {
    if (typeof action !== "string") return;
    const trimmed = action.trim();
    if (!trimmed) return;
    this.stack.push(trimmed);
    if (this.stack.length > this.limit) {
      this.stack.shift();
    }
  }
  // Handles entries
  entries({ newestFirst = true } = {}) {
    if (!newestFirst) return [...this.stack];
    return [...this.stack].reverse();
  }
}
