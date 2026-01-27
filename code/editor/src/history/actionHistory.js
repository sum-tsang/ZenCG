const DEFAULT_ACTION_LIMIT = 24;

// Action History Tracker
export class ActionHistory {
  // Constructor
  constructor({ limit = DEFAULT_ACTION_LIMIT } = {}) {
    this.limit = limit;
    this.stack = [];
  }

  // Clear
  clear() {
    this.stack = [];
  }

  // Record
  record(action) {
    if (typeof action !== "string") return;
    const trimmed = action.trim();
    if (!trimmed) return;

    this.stack.push(trimmed);

    if (this.stack.length > this.limit) {
      this.stack.shift();
    }
  }

  // Entries
  entries({ newestFirst = true } = {}) {
    if (!newestFirst) return [...this.stack];
    return [...this.stack].reverse();
  }
}
