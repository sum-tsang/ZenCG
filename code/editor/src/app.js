// App bootstrap and wiring.
import * as THREE from "three";
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
import {
  applyTransform,
  updateStoredTransform,
  updateStoredMaterial,
  updateStoredName,
} from "./scene/transform.js";
import { createDeleteImportedObject } from "./scene/delete.js";
import { attachCameraControls } from "./camera/cameraSettings.js";
import { createEnvironmentGizmo } from "./scene/environmentGizmo.js";
import { saveStoredImports, loadStoredImports } from "./persistence/storage.js";
import { createSaveScheduler } from "./persistence/saveScheduler.js";
import { restoreStoredImports } from "./persistence/restore.js";
import {
  loadActionHistory,
  saveActionHistory,
} from "./persistence/actionHistoryStorage.js";
import { setupTransformTools } from "./modelTransformation/transformTools.js";
import { setupImportExport } from "./io/import.js";
import { setupLibraryImport } from "./io/modelLibrary.js";
import { setupShortcuts } from "./app/shortcuts.js";
import { setupUiLayout } from "./app/layout.js";
import { setupResizeAndRender } from "./scene/renderLoop.js";
import { createStatusUpdater } from "./app/status.js";
import { MaterialPanel } from "./modelMaterial/materialPanel.js";
import { BASE_MESH_HEIGHT_METERS, metersToUnits } from "./app/units.js";

const dom = getDomRefs();
assertDom(dom);

const store = createStore(createInitialState());
const setStatus = createStatusUpdater(dom);

const { renderer, scene, camera, target, importRoot, selectionHelper, multiSelectionGroup } =
  createSceneContext(dom.canvas);

let transformationManager = null;
let materialPanel = null;
let importer = null;
let envGizmo = null;
// Placeholder delete handler wired during initialization.
let deleteImportedObject = () => {};
let undoDelete = () => false;
let hasUndoDelete = () => false;
let lastAutoExportName = "";
const BASE_MESH_RE = /base[_\s-]?mesh/i;

const normalizeBaseName = (value, fallback = "zencg-export") => {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  return trimmed.replace(/\.(obj|mtl|zip)$/i, "");
};

const updateObjectNameField = (object) => {
  if (!(dom.objectNameInput instanceof HTMLInputElement)) return;
  if (!object) {
    dom.objectNameInput.value = "";
    dom.objectNameInput.placeholder = "Select an object";
    dom.objectNameInput.disabled = true;
    return;
  }
  dom.objectNameInput.disabled = false;
  dom.objectNameInput.value =
    typeof object.name === "string" && object.name ? object.name : "";
};

const updateExportNameField = (object) => {
  if (!(dom.exportNameInput instanceof HTMLInputElement)) return;
  const exportWholeScene = Boolean(dom.exportSceneToggle?.checked);
  const base = normalizeBaseName(
    exportWholeScene ? "scene" : object?.name || "",
    "zencg-export"
  );
  if (!dom.exportNameInput.value || dom.exportNameInput.value === lastAutoExportName) {
    dom.exportNameInput.value = base;
    lastAutoExportName = base;
  }
};

const updateExportAvailability = () => {
  if (!(dom.exportButton instanceof HTMLButtonElement)) return;
  const state = store.getState();
  const exportWholeScene = Boolean(dom.exportSceneToggle?.checked);
  const hasScene = state.importedObjects.length > 0;
  dom.exportButton.disabled = exportWholeScene ? !hasScene : !state.currentObject;
};

const normalizeBaseMeshScale = (object) => {
  if (!object || !BASE_MESH_RE.test(object.name || "")) return;
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

// Set the current selection in the transform manager.
const selectObject = (object) => {
  transformationManager?.setObject(object);
  materialPanel?.setObject(object);
};

// Render the object list using the current store state.
const toggleMultiSelect = (object) => {
  if (!object) return;
  transformationManager?.toggleSelection?.(object);
};

const renderObjectList = () => {
  renderObjectListView({
    dom,
    state: store.getState(),
    onSelect: selectObject,
    onDelete: deleteImportedObject,
    onToggleSelect: toggleMultiSelect,
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

if (dom.objectNameInput instanceof HTMLInputElement) {
  const commitRename = () => {
    const object = store.getState().currentObject;
    if (!object) return;
    const nextName = dom.objectNameInput.value.trim();
    if (!nextName) {
      dom.objectNameInput.value = object.name || "";
      return;
    }
    if (object.name === nextName) return;
    object.name = nextName;
    store.mutate((state) => {
      updateStoredName(object, state, nextName);
    });
    renderObjectList();
    updateExportNameField(object);
    scheduleSave();
    setStatus?.(`Renamed to ${nextName}.`);
  };

  dom.objectNameInput.addEventListener("change", commitRename);
  dom.objectNameInput.addEventListener("blur", commitRename);
  dom.objectNameInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      dom.objectNameInput.blur();
    }
  });
}

if (dom.exportSceneToggle instanceof HTMLInputElement) {
  dom.exportSceneToggle.addEventListener("change", () => {
    updateExportAvailability();
    updateExportNameField(store.getState().currentObject);
  });
}

const setEdgeToggleState = (button, collapsed, expandedLabel, collapsedLabel, expandedIcon, collapsedIcon) => {
  if (!(button instanceof HTMLButtonElement)) return;
  button.setAttribute("aria-pressed", collapsed ? "true" : "false");
  button.setAttribute("aria-label", collapsed ? collapsedLabel : expandedLabel);
  button.title = collapsed ? collapsedLabel : expandedLabel;
  const icon = button.querySelector(".edge-toggle-icon");
  if (icon) {
    icon.textContent = collapsed ? collapsedIcon : expandedIcon;
  }
};

const setupManualModal = () => {
  const { manualButton, manualModal } = dom;
  if (!(manualButton instanceof HTMLButtonElement)) return;
  if (!(manualModal instanceof HTMLElement)) return;

  const closeButtons = manualModal.querySelectorAll("[data-manual-close]");
  let lastFocusedElement = null;

  const isOpen = () => document.body.classList.contains("manual-open");

  const setManualState = (open) => {
    document.body.classList.toggle("manual-open", open);
    manualModal.setAttribute("aria-hidden", open ? "false" : "true");
    manualButton.setAttribute("aria-expanded", open ? "true" : "false");
  };

  const openManual = () => {
    if (isOpen()) return;
    lastFocusedElement = document.activeElement;
    setManualState(true);
    const closeButton = manualModal.querySelector("[data-manual-close]");
    if (closeButton instanceof HTMLButtonElement) {
      closeButton.focus();
    }
  };

  const closeManual = () => {
    if (!isOpen()) return;
    setManualState(false);
    if (lastFocusedElement instanceof HTMLElement) {
      lastFocusedElement.focus();
    }
  };

  manualButton.addEventListener("click", openManual);
  closeButtons.forEach((button) => {
    button.addEventListener("click", closeManual);
  });

  manualModal.addEventListener("click", (event) => {
    if (event.target === manualModal) {
      closeManual();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (!isOpen()) return;
    event.preventDefault();
    closeManual();
  });
};

if (dom.toolsToggle instanceof HTMLButtonElement) {
  const updateToolsToggle = () => {
    const collapsed = document.body.classList.contains("left-panel-collapsed");
    setEdgeToggleState(
      dom.toolsToggle,
      collapsed,
      "Collapse tools panel",
      "Expand tools panel",
      "<",
      ">"
    );
  };
  dom.toolsToggle.addEventListener("click", () => {
    document.body.classList.toggle("left-panel-collapsed");
    updateToolsToggle();
  });
  updateToolsToggle();
}

if (dom.panelToggle instanceof HTMLButtonElement) {
  const updatePanelToggle = () => {
    const collapsed = document.body.classList.contains("right-panel-collapsed");
    setEdgeToggleState(
      dom.panelToggle,
      collapsed,
      "Collapse control panel",
      "Expand control panel",
      ">",
      "<"
    );
  };
  dom.panelToggle.addEventListener("click", () => {
    document.body.classList.toggle("right-panel-collapsed");
    updatePanelToggle();
    updateExportAvailability();
  });
  updatePanelToggle();
}

setupManualModal();

({ deleteImportedObject, undoDelete, hasUndoDelete } = createDeleteImportedObject({
  importRoot,
  store,
  findImportedRoot,
  disposeObject,
  saveStoredImports: saveStoredImportsNow,
  renderObjectList,
  selectObject,
  setStatus,
}));

// Initialize editor subsystems and UI wiring.
init();
function init() {
  envGizmo = createEnvironmentGizmo(dom.envGizmoCanvas, camera);

  // Initialize material panel
  materialPanel = new MaterialPanel("material-panel-container");

  // Wire up material changes to trigger saves
  materialPanel.onMaterialChange(({ object }) => {
    if (!object) return;
    store.mutate((state) => {
      updateStoredMaterial(object, state);
    });
    scheduleSave();
  });

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
    initialHistory: loadActionHistory({
      key: config.actionHistoryKey,
      limit: config.actionHistoryLimit,
    }),
    actionHistoryLimit: config.actionHistoryLimit,
    onHistoryChange: (entries) =>
      saveActionHistory({
        key: config.actionHistoryKey,
        entries,
        limit: config.actionHistoryLimit,
      }),
    onSelectObject: (object) => {
      materialPanel?.setObject(object);
      updateObjectNameField(object);
      updateExportNameField(object);
      updateExportAvailability();
    },
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
    beforeObjectAdd: (object) => {
      if (!store.getState().isRestoring) {
        normalizeBaseMeshScale(object);
      }
    },
    getExportTarget: () => {
      const state = store.getState();
      if (dom.exportSceneToggle?.checked) {
        return state.importedObjects.length > 0 ? importRoot : null;
      }
      return state.currentObject;
    },
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
    undoDelete,
    hasUndoDelete,
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
    saveStoredImports: saveStoredImportsNow,
  });
}
