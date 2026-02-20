import { TransformationManager } from "../manager/index.js";
// Creates split part entry
function createSplitPartEntry(object, fallbackName) {
  return {
    name: object?.name || fallbackName,
    text: "",
    transform: null,
    isSplitPart: true,
  };
}
// Sets up transform tools
export function setupTransformTools({
  scene,
  canvas,
  camera,
  importRoot,
  store,
  dom,
  selectionHelper,
  findImportedRoot,
  updateSelectionOutline,
  renderObjectList,
  updateStoredTransform,
  scheduleSave,
  onSelectObject,
  initialHistory,
  onHistoryChange,
  onToolStateChange,
  actionHistoryLimit,
}) {
  const manager = new TransformationManager(
    scene,
    canvas,
    "transformation-panel-container",
    {
      selectableRoot: importRoot,
      initialHistory,
      onHistoryChange,
      onToolStateChange,
      actionHistoryLimit,
      resolveSelection: (object) => findImportedRoot(importRoot, object),
      onSelectionChange: (object) => {
        store.mutate((state) => {
          state.currentObject = object ?? null;
        });
        if (dom.exportButton instanceof HTMLButtonElement) {
          dom.exportButton.disabled = !object;
        }
        if (dom.deleteButton instanceof HTMLButtonElement) {
          dom.deleteButton.disabled = !object;
        }
        updateSelectionOutline(selectionHelper, object);
        renderObjectList();
        if (onSelectObject) onSelectObject(object);
      },
      onMultiSelectionChange: (objects) => {
        store.mutate((state) => {
          state.selectedObjects = Array.isArray(objects) ? objects : [];
        });
      },
      onSplit: ({ original, inside, outside }) => {
        const splitParts = [inside, outside].filter(Boolean);
        if (!splitParts.length) return;
        const splitEntries = splitParts.map((part, index) =>
          createSplitPartEntry(part, index === 0 ? "split_inside" : "split_outside")
        );

        store.mutate((state) => {
          const originalIndex = state.importedObjects.indexOf(original);
          if (originalIndex !== -1) {
            state.importedObjects.splice(originalIndex, 1);
            state.storedImports.splice(originalIndex, 1);
          }

          state.importedObjects.push(...splitParts);
          state.storedImports.push(...splitEntries);
          state.currentObject = inside ?? splitParts[0] ?? null;
        });
        renderObjectList();
        updateSelectionOutline(selectionHelper, inside ?? splitParts[0] ?? null);
        scheduleSave();
      },
      onCombine: ({ combined, originals }) => {
        const selected = Array.isArray(originals) ? originals : [];
        if (!combined || selected.length < 2) return;

        store.mutate((state) => {
          const selectedSet = new Set(selected);
          const nextImported = [];
          const nextStored = [];

          state.importedObjects.forEach((object, index) => {
            if (selectedSet.has(object)) return;
            nextImported.push(object);
            if (index < state.storedImports.length) {
              nextStored.push(state.storedImports[index]);
            }
          });

          nextImported.push(combined);
          nextStored.push({
            name: combined.name || "combined_model",
            text: "",
            transform: null,
            isCombinedPart: true,
          });

          state.importedObjects = nextImported;
          state.storedImports = nextStored;
          state.currentObject = combined;
          state.selectedObjects = [combined];
        });

        renderObjectList();
        updateSelectionOutline(selectionHelper, combined);
        scheduleSave();
      },
    }
  );

  manager.setCamera(camera);
  manager.onTransform(() => {
    const state = store.getState();
    if (!state.currentObject) return;
    store.mutate((state) => {
      updateStoredTransform(state.currentObject, state);
    });
    scheduleSave();
  });

  return manager;
}
