// Action history persistence.
const DEFAULT_ACTION_HISTORY_KEY = "zencg_action_history";
const DEFAULT_ACTION_HISTORY_LIMIT = 24;

function getStorage() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch (error) {
    console.warn("Action history storage unavailable.", error);
    return null;
  }
}

function cleanEntries(entries = [], limit = DEFAULT_ACTION_HISTORY_LIMIT) {
  if (!Array.isArray(entries)) return [];
  const cleaned = entries
    .filter((entry) => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (Number.isFinite(limit) && limit > 0) {
    return cleaned.slice(-limit);
  }
  return cleaned;
}

export function loadActionHistory({
  key = DEFAULT_ACTION_HISTORY_KEY,
  limit = DEFAULT_ACTION_HISTORY_LIMIT,
} = {}) {
  const storage = getStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const entries = Array.isArray(parsed) ? parsed : parsed?.entries;
    const cleaned = cleanEntries(entries, limit);
    return cleaned.length ? cleaned : null;
  } catch (error) {
    console.warn("Unable to load action history.", error);
    return null;
  }
}

export function saveActionHistory({
  key = DEFAULT_ACTION_HISTORY_KEY,
  entries = [],
  limit = DEFAULT_ACTION_HISTORY_LIMIT,
} = {}) {
  const storage = getStorage();
  if (!storage || !Array.isArray(entries)) return;
  try {
    storage.setItem(
      key,
      JSON.stringify({
        entries: cleanEntries(entries, limit),
        updatedAt: Date.now(),
      })
    );
  } catch (error) {
    console.warn("Unable to save action history.", error);
  }
}
