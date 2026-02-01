import { materialEditor } from "../modelMaterial/materialEditor.js";

// Restore persisted imports and apply their saved transforms.
export function restoreStoredImports({
  loadStoredImports,
  importer,
  store,
  setStatus,
  saveStoredImports,
}) {
  loadStoredImports().then(async (restored) => {
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
        state.pendingMaterials = entries.map((entry) => entry?.material ?? null);
      });
      entries.forEach((entry) => {
        importer.loadFromText(entry.text, entry.name);
      });

      // Apply materials after objects are loaded
      const state = store.getState();
      for (let i = 0; i < state.importedObjects.length; i++) {
        const object = state.importedObjects[i];
        const materialData = state.pendingMaterials?.[i];
        if (materialData && object) {
          await materialEditor.applySerializedMaterial(materialData, object);
        }
      }

      store.mutate((state) => {
        state.isRestoring = false;
        state.pendingTransforms = [];
        state.pendingMaterials = [];
      });
      saveStoredImports();
    }
  });
}
