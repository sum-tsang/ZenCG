// Create a delete handler for imported objects.
export function createDeleteImportedObject({
  importRoot,
  store,
  findImportedRoot,
  disposeObject,
  saveStoredImports,
  renderObjectList,
  selectObject,
  setStatus,
}) {
  // Remove an object, clean up, and update state/UI.
  return function deleteImportedObject(object) {
    const state = store.getState();
    const root = object ? findImportedRoot(importRoot, object) ?? object : null;
    if (!root) return;

    const index = state.importedObjects.indexOf(root);
    if (index === -1) return;

    const wasCurrent = state.currentObject === root;
    importRoot.remove(root);
    disposeObject(root);

    store.mutate((state) => {
      state.importedObjects.splice(index, 1);
      if (index < state.storedImports.length) {
        state.storedImports.splice(index, 1);
      }
      if (state.importedObjects.length === 0) {
        state.nextOffsetX = 0;
      }
    });

    saveStoredImports();

    if (wasCurrent) {
      const updated = store.getState().importedObjects;
      const next = updated[index] ?? updated[index - 1] ?? null;
      selectObject(next);
    } else {
      renderObjectList();
    }

    const name = typeof root?.name === "string" && root.name ? root.name : "object";
    setStatus?.(`Deleted ${name}.`);
  };
}
