import * as THREE from "three";
import {
  appConfig as config,
  BASE_MESH_HEIGHT_METERS,
  metersToUnits,
} from "../config/settings.js";
import {
  getDomRefs,
  assertDom,
  createStatusUpdater,
  setupShortcuts,
  setupUiLayout,
} from "../../ui/ui.js";
import { createInitialState, createStore } from "./state.js";
import {
  frameObjectBounds,
  setCameraAxisView,
  attachCameraControls,
  setupCameraPanel,
} from "../../camera/camera.js";
import { createSceneContext } from "../../scene/context.js";
import {
  findImportedRoot,
  updateSelectionOutline,
  placeImportedObject,
  disposeObject,
  renderObjectList as renderObjectListView,
  applyTransform,
  serializeTransform,
  updateStoredTransform,
  updateStoredMaterial,
  updateStoredName,
  createDeleteImportedObject,
} from "../../scene/objects.js";
import { createEnvironmentGizmo, setupResizeAndRender } from "../../scene/view.js";
import {
  saveStoredImports,
  loadStoredImports,
  createSaveScheduler,
  restoreStoredImports,
  prepareStoredImportsForSave,
  loadActionHistory,
  saveActionHistory,
} from "../../persistence/persistence.js";
import { setupTransformTools } from "../../model/tools/transformTools.js";
import { setupImportExport } from "../../io/workflows/importExport.js";
import { setupLibraryImport } from "../../io/library/modelLibrary.js";
import { MaterialPanel } from "../../model/material/panel.js";
import { createAppUiState } from "./uiState.js";
import { createClipboardActions } from "./clipboard.js";
import { setupFooterControls } from "./panels.js";
import {
  setupObjectNameInput,
  setupExportControls,
  setupAppPanels,
} from "./domBindings.js";

const dom = getDomRefs();
assertDom(dom);

const store = createStore(createInitialState());
const setStatus = createStatusUpdater(dom);

const {
  renderer,
  scene,
  camera,
  target,
  importRoot,
  selectionHelper,
  multiSelectionGroup,
} = createSceneContext(dom.canvas);

let transformationManager = null;
let materialPanel = null;
let importer = null;
let envGizmo = null;

let deleteImportedObject = () => {};
let undoDelete = () => false;
let hasUndoDelete = () => false;
let clearDeleteHistory = () => {};

let copySelectionToClipboard = () => false;
let pasteClipboardSelection = () => false;
let duplicateSelectionInstant = () => false;

const BASE_MESH_NAME_PATTERN = /base[_\s-]?mesh/i;

const {
  updateFooterToolIndicator,
  renderHistoryList,
  updateObjectNameField,
  updateExportNameField,
  updateExportAvailability,
} = createAppUiState({ dom, store });

// Normalizes base mesh scale
const normalizeBaseMeshScale = (object) => {
  if (!object || !BASE_MESH_NAME_PATTERN.test(object.name || "")) return;

  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) return;

  const size = box.getSize(new THREE.Vector3());
  const height = size.y || 0;
  if (height <= 0) return;

  const targetHeight = metersToUnits(BASE_MESH_HEIGHT_METERS);
  const scaleFactor = targetHeight / height;
  if (!Number.isFinite(scaleFactor) || Math.abs(scaleFactor - 1) < 0.001) return;

  object.scale.multiplyScalar(scaleFactor);
  object.updateMatrixWorld(true);
};

// Sets selected object
const setSelectedObject = (object) => {
  if (transformationManager) {
    transformationManager.setObject(object);
    return;
  }
  materialPanel?.setObject(object);
};

// Handles toggle selected object
const toggleSelectedObject = (object) => {
  if (!object) return;
  transformationManager?.toggleSelection?.(object);
};

// Renders object list
const renderObjectList = () => {
  renderObjectListView({
    dom,
    state: store.getState(),
    onSelect: setSelectedObject,
    onDelete: deleteImportedObject,
    onToggleSelect: toggleSelectedObject,
  });
};

// Gets export target
const getExportTarget = () => {
  const state = store.getState();
  if (dom.exportSceneToggle?.checked) {
    return state.importedObjects.length > 0 ? importRoot : null;
  }
  return state.currentObject;
};

// Handles persist stored imports now
const persistStoredImportsNow = () => {
  const state = store.getState();
  const preparedEntries = prepareStoredImportsForSave(
    state.storedImports,
    state.importedObjects
  );

  const didChange =
    preparedEntries.length !== state.storedImports.length
    || preparedEntries.some((entry, index) => entry !== state.storedImports[index]);

  if (didChange) {
    store.mutate((nextState) => {
      nextState.storedImports = preparedEntries;
    });
  }

  saveStoredImports(config, preparedEntries);
};

// Handles clear scene
const clearScene = () => {
  const state = store.getState();
  const count = state.importedObjects.length;
  if (!count) {
    setStatus?.("Scene is already empty.");
    return false;
  }

  for (const object of state.importedObjects) {
    if (!object) continue;
    object.parent?.remove(object);
    disposeObject(object);
  }

  clearDeleteHistory?.();

  store.mutate((nextState) => {
    nextState.currentObject = null;
    nextState.selectedObjects = [];
    nextState.importedObjects = [];
    nextState.storedImports = [];
    nextState.nextOffsetX = 0;
  });

  if (transformationManager) {
    transformationManager.clearHistory?.();
    transformationManager.selectObject(null);
  } else {
    updateSelectionOutline(selectionHelper, null);
  }

  materialPanel?.setObject(null);

  renderObjectList();
  updateObjectNameField(null);
  updateExportNameField(null);
  updateExportAvailability();
  persistStoredImportsNow();

  setStatus?.(
    count === 1
      ? "Cleared 1 object from the scene."
      : `Cleared ${count} objects from the scene.`
  );

  return true;
};

// Sets camera preset
const setCameraPreset = (axis) => {
  const applied = setCameraAxisView({
    camera,
    target,
    sceneRoot: importRoot,
    axis,
  });
  if (!applied) return;

  setStatus?.(`Camera view: ${String(axis).toUpperCase().replace("+", "")}`);
};

const scheduleSave = createSaveScheduler({
  isRestoring: () => store.getState().isRestoring,
  save: persistStoredImportsNow,
});

({
  copySelectionToClipboard,
  pasteClipboardSelection,
  duplicateSelectionInstant,
} = createClipboardActions({
  store,
  importRoot,
  importGap: config.importGap,
  serializeTransform,
  getTransformationManager: () => transformationManager,
  selectObject: setSelectedObject,
  renderObjectList,
  scheduleSave,
  setStatus,
}));

setupObjectNameInput({
  dom,
  store,
  updateStoredName,
  renderObjectList,
  updateExportNameField,
  scheduleSave,
  setStatus,
});

setupExportControls({
  dom,
  store,
  updateExportAvailability,
  updateExportNameField,
  clearScene,
});

setupAppPanels({
  dom,
  updateExportAvailability,
});

({ deleteImportedObject, undoDelete, hasUndoDelete, clearDeleteHistory } =
  createDeleteImportedObject({
    importRoot,
    store,
    findImportedRoot,
    disposeObject,
    saveStoredImports: persistStoredImportsNow,
    renderObjectList,
    selectObject: setSelectedObject,
    setStatus,
  }));

updateFooterToolIndicator();
init();

// Handles init
function init() {
  envGizmo = createEnvironmentGizmo(dom.envGizmoCanvas, camera);

  materialPanel = new MaterialPanel("material-panel-container");
  setupCameraPanel({
    containerId: "camera-panel-container",
    onAxisView: setCameraPreset,
  });

  materialPanel.onMaterialChange(({ object }) => {
    if (!object) return;
    store.mutate((state) => {
      updateStoredMaterial(object, state);
    });
    scheduleSave();
  });

  const initialHistory =
    loadActionHistory({
      key: config.actionHistoryKey,
      limit: config.actionHistoryLimit,
    }) ?? [];

  renderHistoryList(initialHistory);

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
    initialHistory,
    actionHistoryLimit: config.actionHistoryLimit,
    onHistoryChange: (entries) => {
      saveActionHistory({
        key: config.actionHistoryKey,
        entries,
        limit: config.actionHistoryLimit,
      });
      renderHistoryList(entries);
    },
    onToolStateChange: (toolState) => {
      updateFooterToolIndicator(toolState);
    },
    onSelectObject: (object) => {
      materialPanel?.setObject(object);
      updateObjectNameField(object);
      updateExportNameField(object);
      updateExportAvailability();
    },
  });

  updateFooterToolIndicator(transformationManager.getToolState?.());

  setupFooterControls({
    dom,
    store,
    getTransformationManager: () => transformationManager,
    undoDelete,
    hasUndoDelete,
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
    selectObject: setSelectedObject,
    renderObjectList,
    updateStoredTransform,
    scheduleSave,
    placeImportedObject,
    applyTransform,
    deleteImportedObject,
    beforeObjectAdd: (object) => {
      if (!store.getState().isRestoring) {
        normalizeBaseMeshScale(object);
      }
    },
    getExportTarget,
    getExportFilename: () => dom.exportNameInput?.value,
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
    clearScene,
    undoDelete,
    hasUndoDelete,
    copySelection: copySelectionToClipboard,
    pasteSelection: pasteClipboardSelection,
    duplicateSelection: duplicateSelectionInstant,
  });

  setupResizeAndRender({
    dom,
    camera,
    renderer,
    scene,
    target,
    selectionHelper,
    multiSelectionGroup,
    getCurrentObject: () => store.getState().currentObject,
    getSelectedObjects: () => store.getState().selectedObjects,
    transformationManager,
    envGizmo,
    setStatus,
  });

  setupUiLayout();

  restoreStoredImports({
    loadStoredImports: () => loadStoredImports(config),
    importer,
    store,
    setStatus,
    saveStoredImports: persistStoredImportsNow,
  });
}
