import { setupObjImport } from "../obj/import.js";
import { setupObjExport } from "../obj/export.js";

export { setupObjImport, setupObjExport };
// Sets up import export
export function setupImportExport({
  dom,
  importRoot,
  store,
  config,
  frameObject,
  setStatus,
  selectObject,
  renderObjectList,
  updateStoredTransform,
  scheduleSave,
  placeImportedObject,
  applyTransform,
  deleteImportedObject,
  beforeObjectAdd,
  getExportTarget,
  getExportFilename,
}) {
  const importer = setupObjImport({
    fileInput: dom.fileInput,
    container: importRoot,
    frameObject,
    setStatus,
    onObjectLoaded: (object) => {
      if (!object) return;
      if (typeof beforeObjectAdd === "function") {
        beforeObjectAdd(object);
      }
      store.mutate((state) => {
        placeImportedObject(object, state, config);
        if (state.isRestoring && state.pendingTransforms.length > 0) {
          const transform = state.pendingTransforms.shift();
          applyTransform(object, transform);
        }
        state.importedObjects.push(object);
        state.currentObject = object;
      });
      dom.exportButton.disabled = false;
      dom.deleteButton.disabled = false;
      selectObject(object);
      renderObjectList();
    },
    onTextLoaded: (text, filename) => {
      store.mutate((state) => {
        state.storedImports.push({ name: filename, text });
        if (state.currentObject) {
          updateStoredTransform(state.currentObject, state);
        }
      });
      scheduleSave();
    },
  });

  setupObjExport({
    button: dom.exportButton,
    getObject:
      typeof getExportTarget === "function"
        ? getExportTarget
        : () => store.getState().currentObject,
    getFilename: getExportFilename,
    setStatus,
  });

  dom.deleteButton.addEventListener("click", () => {
    deleteImportedObject(store.getState().currentObject);
  });

  return importer;
}
