// Delete/undo helpers.
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
  const deletedStack = [];
  const maxUndo = 10;

  const cloneEntry = (entry) => {
    if (!entry) return null;
    if (typeof structuredClone === "function") {
      return structuredClone(entry);
    }
    return JSON.parse(JSON.stringify(entry));
  };

  const disposeDeleted = (entry) => {
    if (!entry?.object) return;
    disposeObject(entry.object);
  };

  // Remove an object, clean up, and update state/UI.
  const deleteImportedObject = (object) => {
    const state = store.getState();
    const root = object ? findImportedRoot(importRoot, object) ?? object : null;
    if (!root) return;

    const index = state.importedObjects.indexOf(root);
    if (index === -1) return;

    const storedEntry = cloneEntry(state.storedImports[index]);
    const wasCurrent = state.currentObject === root;
    importRoot.remove(root);

    store.mutate((state) => {
      state.importedObjects.splice(index, 1);
      if (Array.isArray(state.selectedObjects)) {
        state.selectedObjects = state.selectedObjects.filter((item) => item !== root);
      }
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

    deletedStack.push({ object: root, storedEntry, index });
    while (deletedStack.length > maxUndo) {
      const discarded = deletedStack.shift();
      disposeDeleted(discarded);
    }
  };

  const undoDelete = () => {
    const entry = deletedStack.pop();
    if (!entry?.object) return false;

    const { object, storedEntry, index } = entry;
    importRoot.add(object);

    store.mutate((state) => {
      const insertIndex = Math.min(Math.max(index, 0), state.importedObjects.length);
      state.importedObjects.splice(insertIndex, 0, object);
      if (storedEntry) {
        state.storedImports.splice(insertIndex, 0, storedEntry);
      }
    });

    saveStoredImports();
    selectObject(object);
    renderObjectList();

    const name = typeof object?.name === "string" && object.name ? object.name : "object";
    setStatus?.(`Restored ${name}.`);
    return true;
  };

  const hasUndoDelete = () => deletedStack.length > 0;

  return { deleteImportedObject, undoDelete, hasUndoDelete };
}
