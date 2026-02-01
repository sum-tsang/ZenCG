import { config } from "./app/config.js";
import { getDomRefs, assertDom } from "./app/dom.js";
import { createInitialState } from "./app/state.js";
import { createStore } from "./app/store.js";
import { frameObjectBounds } from "./camera/camera.js";
import { createSceneContext } from "./scene/context.js";
import { findImportedRoot, updateSelectionOutline } from "./scene/selection.js";
import { placeImportedObject } from "./scene/placement.js";
import { renderObjectList as renderObjectListView } from "./scene/listView.js";
import { disposeObject } from "./scene/dispose.js";
import { applyTransform, updateStoredTransform } from "./scene/transform.js";
import { createDeleteImportedObject } from "./scene/delete.js";
import { attachCameraControls } from "./camera/cameraSettings.js";
import { createEnvironmentGizmo } from "./scene/environmentGizmo.js";
import { saveStoredImports, loadStoredImports } from "./persistence/storage.js";
import { createSaveScheduler } from "./persistence/saveScheduler.js";
import { restoreStoredImports } from "./persistence/restore.js";
import { setupTransformTools } from "./modelTransformation/transformTools.js";
import { setupImportExport } from "./io/import.js";
import { setupLibraryImport } from "./io/modelLibrary.js";
import { setupShortcuts } from "./app/shortcuts.js";
import { setupResizeAndRender } from "./scene/renderLoop.js";
import { createStatusUpdater } from "./app/status.js";
import { MaterialPanel } from "./modelMaterial/materialPanel.js";

const dom = getDomRefs();
assertDom(dom);

const store = createStore(createInitialState());
const setStatus = createStatusUpdater(dom);

const { renderer, scene, camera, target, importRoot, selectionHelper } =
  createSceneContext(dom.canvas);

let transformationManager = null;
let materialPanel = null;
let importer = null;
let envGizmo = null;
// Placeholder delete handler wired during initialization.
let deleteImportedObject = () => {};

// Set the current selection in the transform manager.
const selectObject = (object) => {
  transformationManager?.setObject(object);
  materialPanel?.setObject(object);
};

// Render the object list using the current store state.
const renderObjectList = () => {
  renderObjectListView({
    dom,
    state: store.getState(),
    onSelect: selectObject,
    onDelete: deleteImportedObject,
  });
};

// Persist current stored imports immediately.
const saveStoredImportsNow = () => {
  saveStoredImports(config, store.getState().storedImports);
};

const scheduleSave = createSaveScheduler({
  isRestoring: () => store.getState().isRestoring,
  save: saveStoredImportsNow,
});

deleteImportedObject = createDeleteImportedObject({
  importRoot,
  store,
  findImportedRoot,
  disposeObject,
  saveStoredImports: saveStoredImportsNow,
  renderObjectList,
  selectObject,
  setStatus,
});

// Initialize editor subsystems and UI wiring.
init();

// Initialize editor subsystems and UI wiring.
function init() {
  envGizmo = createEnvironmentGizmo(dom.envGizmoCanvas, camera);

  // Initialize material panel
  materialPanel = new MaterialPanel("material-panel-container");

  transformationManager = setupTransformTools({
    scene,
    canvas: dom.canvas,
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
  });

  attachCameraControls({
    canvas: dom.canvas,
    camera,
    target,
    renderer,
  });

  importer = setupImportExport({
    dom,
    importRoot,
    store,
    config,
    frameObject: () => frameObjectBounds(importRoot, camera, target),
    setStatus,
    selectObject,
    renderObjectList,
    updateStoredTransform,
    scheduleSave,
    placeImportedObject,
    applyTransform,
    deleteImportedObject,
  });

  setupLibraryImport({
    dom,
    importer,
    setStatus,
  });

  setupShortcuts({
    store,
    transformationManager,
    deleteImportedObject,
  });

  setupResizeAndRender({
    dom,
    camera,
    renderer,
    scene,
    target,
    selectionHelper,
    getCurrentObject: () => store.getState().currentObject,
    transformationManager,
    envGizmo,
    setStatus,
  });

  restoreStoredImports({
    loadStoredImports: () => loadStoredImports(config),
    importer,
    store,
    setStatus,
    saveStoredImports: saveStoredImportsNow,
  });
}
