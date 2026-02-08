// Action history tracker.
const DEFAULT_ACTION_LIMIT = 24;

// Action History Tracker
export class ActionHistory {
  // Constructor
  constructor({ limit = DEFAULT_ACTION_LIMIT } = {}) {
    this.limit = limit;
    this.stack = [];
  }

  // Replace entries with a sanitized list.
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
