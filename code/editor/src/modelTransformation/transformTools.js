import { TransformationManager } from "./manager.js";

// Create and configure the transformation manager wiring.
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
}) {
  const manager = new TransformationManager(
    scene,
    canvas,
    "transformation-panel-container",
    {
      selectableRoot: importRoot,
      resolveSelection: (object) => findImportedRoot(importRoot, object),
      onSelectionChange: (object) => {
        store.mutate((state) => {
          state.currentObject = object ?? null;
        });
        dom.exportButton.disabled = !object;
        dom.deleteButton.disabled = !object;
        updateSelectionOutline(selectionHelper, object);
        renderObjectList();
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
