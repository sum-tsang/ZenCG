// Debounced save scheduler.
// Create a debounced save scheduler that respects restore mode.
export function createSaveScheduler({ isRestoring, save }) {
  let saveTimeout = null;

  // Schedule a delayed save to batch updates.
  return function scheduleSave() {
    if (isRestoring?.()) return;
    if (saveTimeout) window.clearTimeout(saveTimeout);
    saveTimeout = window.setTimeout(() => {
      save?.();
    }, 200);
  };
}
