// App bootstrap and wiring.
import * as THREE from "three";
import { config, BASE_MESH_HEIGHT_METERS, metersToUnits } from "./core/settings.js";
import { getDomRefs, assertDom } from "./ui/dom.js";
import { createInitialState, createStore } from "./core/index.js";
import { frameObjectBounds } from "./camera/camera.js";
import { createSceneContext } from "./scene/context.js";
import { findImportedRoot, updateSelectionOutline } from "./scene/selection.js";
import { placeImportedObject } from "./scene/placement.js";
import { renderObjectList as renderObjectListView } from "./scene/listView.js";
import { disposeObject } from "./scene/dispose.js";
import {
  applyTransform,
  serializeTransform,
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
import { prepareStoredImportsForSave } from "./persistence/entrySerialization.js";
import {
  loadActionHistory,
  saveActionHistory,
} from "./persistence/actionHistoryStorage.js";
import { setupTransformTools } from "./model/transform/transformTools.js";
import { setupImportExport } from "./io/import.js";
import { setupLibraryImport } from "./io/modelLibrary.js";
import { setupShortcuts } from "./ui/shortcuts.js";
import { setupUiLayout } from "./ui/layout.js";
import { setupResizeAndRender } from "./scene/renderLoop.js";
import { createStatusUpdater } from "./ui/status.js";
import { MaterialPanel } from "./model/materials/materialPanel.js";

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
const TOOL_LABELS = {
  translate: "Move",
  rotate: "Rotate",
  scale: "Scale",
};

const updateRecentActionIndicator = (entries = []) => {
  if (!(dom.recentAction instanceof HTMLElement)) return;
  const latest = Array.isArray(entries) && entries.length ? entries[entries.length - 1] : null;
  dom.recentAction.textContent = latest || "No actions yet";
};

const updateFooterToolIndicator = (toolState = {}) => {
  const modeKey =
    typeof toolState?.mode === "string" ? toolState.mode.toLowerCase() : "translate";
  const normalizedMode = Object.prototype.hasOwnProperty.call(TOOL_LABELS, modeKey)
    ? modeKey
    : "translate";
  const activeAxis =
    typeof toolState?.axis === "string" ? toolState.axis.toLowerCase() : "";

  if (dom.footerToolValue instanceof HTMLElement) {
    dom.footerToolValue.textContent = TOOL_LABELS[normalizedMode];
  }

  const axisElements = {
    x: dom.footerAxisX,
    y: dom.footerAxisY,
    z: dom.footerAxisZ,
  };

  Object.entries(axisElements).forEach(([axis, element]) => {
    if (!(element instanceof HTMLElement)) return;
    element.classList.toggle("is-active", axis === activeAxis);
  });
};

const renderHistoryList = (entries = []) => {
  updateRecentActionIndicator(entries);
  if (!(dom.historyList instanceof HTMLUListElement)) return;
  dom.historyList.innerHTML = "";
  const orderedEntries = Array.isArray(entries) ? [...entries].reverse() : [];

  if (!orderedEntries.length) {
    const empty = document.createElement("li");
    empty.className = "history-item history-empty";
    empty.textContent = "No actions yet";
    dom.historyList.appendChild(empty);
    return;
  }

  orderedEntries.forEach((entry) => {
    const item = document.createElement("li");
    item.className = "history-item";
    item.textContent = entry;
    dom.historyList.appendChild(item);
  });
};

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

const duplicateClipboard = {
  items: [],
  pasteIteration: 0,
};

const cloneStoredEntry = (entry) => {
  if (!entry) return null;
  if (typeof structuredClone === "function") {
    return structuredClone(entry);
  }
  try {
    return JSON.parse(JSON.stringify(entry));
  } catch {
    return { ...entry };
  }
};

const cloneObjectMaterials = (object) => {
  if (!object) return;
  object.traverse((child) => {
    if (!child?.isMesh || !child.material) return;
    if (Array.isArray(child.material)) {
      child.material = child.material.map((material) =>
        material?.clone ? material.clone() : material
      );
      return;
    }
    if (child.material?.clone) {
      child.material = child.material.clone();
    }
  });
};

const getDuplicationSelection = () => {
  const state = store.getState();
  const selected =
    Array.isArray(state.selectedObjects) && state.selectedObjects.length
      ? state.selectedObjects
      : state.currentObject
        ? [state.currentObject]
        : [];
  if (!selected.length) return [];

  const selectedSet = new Set(selected);
  return state.importedObjects.filter((object) => selectedSet.has(object));
};

const getDuplicateName = (baseName) => {
  if (typeof baseName === "string" && baseName.trim()) {
    return baseName.trim();
  }
  return "object";
};

const copySelectionToClipboard = ({ silent = false } = {}) => {
  const selection = getDuplicationSelection();
  if (!selection.length) {
    if (!silent) {
      setStatus?.("Select at least one model to copy.");
    }
    return false;
  }

  const state = store.getState();
  const indexByObject = new Map(
    state.importedObjects.map((object, index) => [object, index])
  );

  const items = selection
    .map((object) => {
      const index = indexByObject.get(object);
      if (index === undefined) return null;
      const template = object.clone(true);
      template.updateMatrixWorld(true);
      return {
        template,
        sourceName: object.name,
        storedEntry: cloneStoredEntry(state.storedImports[index]),
      };
    })
    .filter(Boolean);

  if (!items.length) {
    if (!silent) {
      setStatus?.("No copyable model selected.");
    }
    return false;
  }

  duplicateClipboard.items = items;
  duplicateClipboard.pasteIteration = 0;

  if (!silent) {
    setStatus?.(
      items.length === 1 ? "Copied 1 model." : `Copied ${items.length} models.`
    );
  }
  return true;
};

const pasteClipboardSelection = ({
  statusVerb = "Pasted",
  showEmptyStatus = true,
} = {}) => {
  if (!duplicateClipboard.items.length) {
    if (showEmptyStatus) {
      setStatus?.("Copy a model first.");
    }
    return false;
  }

  duplicateClipboard.pasteIteration += 1;
  const offsetAmount =
    Math.max(config.importGap, 0.5) * duplicateClipboard.pasteIteration;
  const offset = new THREE.Vector3(offsetAmount, 0, offsetAmount * 0.25);

  const pastedObjects = [];
  const pastedEntries = [];

  duplicateClipboard.items.forEach((item) => {
    const clone = item.template.clone(true);
    cloneObjectMaterials(clone);
    clone.position.add(offset);
    clone.name = getDuplicateName(item.sourceName || item.storedEntry?.name);
    clone.updateMatrixWorld(true);
    importRoot.add(clone);
    pastedObjects.push(clone);

    const entry = cloneStoredEntry(item.storedEntry) ?? {};
    entry.name = clone.name;
    entry.text = typeof entry.text === "string" ? entry.text : "";
    entry.transform = serializeTransform(clone);
    entry.material = entry.material ?? null;
    pastedEntries.push(entry);
  });

  if (!pastedObjects.length) {
    if (showEmptyStatus) {
      setStatus?.("Unable to paste copied model.");
    }
    return false;
  }

  store.mutate((state) => {
    state.importedObjects.push(...pastedObjects);
    state.storedImports.push(...pastedEntries);
  });

  if (transformationManager && pastedObjects.length > 0) {
    transformationManager.selectObject(pastedObjects[0]);
    for (let index = 1; index < pastedObjects.length; index += 1) {
      transformationManager.toggleSelection(pastedObjects[index]);
    }
  } else {
    selectObject(pastedObjects[pastedObjects.length - 1] ?? null);
  }

  renderObjectList();
  scheduleSave();
  setStatus?.(
    pastedObjects.length === 1
      ? `${statusVerb} 1 model.`
      : `${statusVerb} ${pastedObjects.length} models.`
  );
  return true;
};

const duplicateSelectionInstant = () => {
  const copied = copySelectionToClipboard({ silent: true });
  if (!copied) {
    setStatus?.("Select at least one model to duplicate.");
    return false;
  }
  return pasteClipboardSelection({
    statusVerb: "Duplicated",
    showEmptyStatus: false,
  });
};

// Persist current stored imports immediately.
const saveStoredImportsNow = () => {
  const state = store.getState();
  const preparedEntries = prepareStoredImportsForSave(
    state.storedImports,
    state.importedObjects
  );
  const didChange =
    preparedEntries.length !== state.storedImports.length ||
    preparedEntries.some((entry, index) => entry !== state.storedImports[index]);
  if (didChange) {
    state.storedImports = preparedEntries;
  }
  saveStoredImports(config, preparedEntries);
};

const scheduleSave = createSaveScheduler({
  isRestoring: () => store.getState().isRestoring,
  save: saveStoredImportsNow,
});
updateFooterToolIndicator();

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

const setupFooterControls = () => {
  if (dom.undoButton instanceof HTMLButtonElement) {
    dom.undoButton.addEventListener("click", () => {
      const canUndoDelete = typeof hasUndoDelete === "function" && hasUndoDelete();
      if (canUndoDelete && store.getState().currentObject === null) {
        undoDelete?.();
        return;
      }
      const didUndo = transformationManager?.undo?.();
      if (!didUndo && typeof undoDelete === "function") {
        undoDelete();
      }
    });
  }

  if (dom.redoButton instanceof HTMLButtonElement) {
    dom.redoButton.addEventListener("click", () => {
      transformationManager?.redo?.();
    });
  }
};

const setupPanelTabs = () => {
  if (!(dom.panelTabControls instanceof HTMLButtonElement)) return;
  if (!(dom.panelTabModels instanceof HTMLButtonElement)) return;
  if (!(dom.panelPaneControls instanceof HTMLElement)) return;
  if (!(dom.panelPaneModels instanceof HTMLElement)) return;

  const setActiveTab = (tabKey) => {
    const showModels = tabKey === "models";
    dom.panelPaneControls.hidden = showModels;
    dom.panelPaneModels.hidden = !showModels;

    dom.panelTabControls.classList.toggle("is-active", !showModels);
    dom.panelTabModels.classList.toggle("is-active", showModels);
    dom.panelTabControls.setAttribute("aria-selected", showModels ? "false" : "true");
    dom.panelTabModels.setAttribute("aria-selected", showModels ? "true" : "false");
  };

  dom.panelTabControls.addEventListener("click", () => {
    setActiveTab("controls");
  });

  dom.panelTabModels.addEventListener("click", () => {
    setActiveTab("models");
  });

  setActiveTab("controls");
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
setupPanelTabs();

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

  const initialHistory = loadActionHistory({
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

  setupFooterControls();

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
    saveStoredImports: saveStoredImportsNow,
  });
}
