// Restore persisted imports and apply their saved transforms.
export function restoreStoredImports({
  loadStoredImports,
  importer,
  store,
  setStatus,
  saveStoredImports,
}) {
  loadStoredImports().then((restored) => {
    if (restored && importer?.loadFromText) {
      const entries = Array.isArray(restored) ? restored : [];
      if (entries.length === 0) {
        return;
      }
      setStatus(
        entries.length === 1
          ? "Restoring previous OBJ..."
          : `Restoring ${entries.length} OBJ files...`
      );
      store.mutate((state) => {
        state.isRestoring = true;
        state.storedImports.length = 0;
        state.pendingTransforms = entries.map((entry) => entry?.transform ?? null);
      });
      entries.forEach((entry) => {
        importer.loadFromText(entry.text, entry.name);
      });
      store.mutate((state) => {
        state.isRestoring = false;
        state.pendingTransforms = [];
      });
      saveStoredImports();
    }
  });
}
