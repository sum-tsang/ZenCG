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
  onSelectObject,
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
        // Notify app of selection change (for material panel, etc.)
        if (onSelectObject) onSelectObject(object);
      },
      onSplit: ({ original, inside, outside }) => {
        store.mutate((state) => {
          // Remove original from importedObjects and storedImports
          const originalIndex = state.importedObjects.indexOf(original);
          if (originalIndex !== -1) {
            state.importedObjects.splice(originalIndex, 1);
            state.storedImports.splice(originalIndex, 1);
          }
          
          // Add the new split parts as separate imported objects
          // Wrap each mesh in a Group to match the structure of imported objects
          const insideGroup = inside.parent === importRoot ? inside : inside;
          const outsideGroup = outside.parent === importRoot ? outside : outside;
          
          state.importedObjects.push(insideGroup);
          state.importedObjects.push(outsideGroup);
          
          // Add placeholder entries for storedImports (these are split parts, not full OBJ files)
          state.storedImports.push({
            name: inside.name || "split_inside",
            text: "", // Split parts don't have original OBJ text
            transform: null,
            isSplitPart: true,
          });
          state.storedImports.push({
            name: outside.name || "split_outside", 
            text: "",
            transform: null,
            isSplitPart: true,
          });
          
          // Update current object to the inside part
          state.currentObject = insideGroup;
        });
        
        // Re-render the object list to show both parts
        renderObjectList();
        updateSelectionOutline(selectionHelper, inside);
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
