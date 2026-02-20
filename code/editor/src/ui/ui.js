// Collect the DOM nodes used across the editor
export function getDomRefs() {
  return {
    canvas: document.getElementById("viewport-canvas"),
    envGizmoCanvas: document.getElementById("env-gizmo-canvas"),
    fileInput: document.getElementById("obj-input"),
    exportButton: document.getElementById("obj-export"),
    deleteButton: document.getElementById("obj-delete"),
    clearSceneButton: document.getElementById("obj-clear-scene"),
    objectNameInput: document.getElementById("object-name-input"),
    exportNameInput: document.getElementById("export-name-input"),
    exportSceneToggle: document.getElementById("export-scene-toggle"),
    toolsToggle: document.getElementById("tools-toggle"),
    panelToggle: document.getElementById("panel-toggle"),
    panelTabControls: document.getElementById("panel-tab-controls"),
    panelTabModels: document.getElementById("panel-tab-models"),
    panelPaneControls: document.getElementById("panel-pane-controls"),
    panelPaneModels: document.getElementById("panel-pane-models"),
    toolsTabTransform: document.getElementById("tools-tab-transform"),
    toolsTabCamera: document.getElementById("tools-tab-camera"),
    toolsPaneTransform: document.getElementById("tools-pane-transform"),
    toolsPaneCamera: document.getElementById("tools-pane-camera"),
    historyList: document.getElementById("action-history-list"),
    manualButton: document.getElementById("manual-button"),
    manualModal: document.getElementById("manual-modal"),
    status: document.getElementById("status"),
    libraryGalleryList: document.getElementById("library-gallery-list"),
    objectList: document.getElementById("object-list"),
    objectListEmpty: document.getElementById("object-list-empty"),
    undoButton: document.getElementById("undo-button"),
    redoButton: document.getElementById("redo-button"),
    recentAction: document.getElementById("recent-action"),
    footerToolValue: document.getElementById("footer-tool-value"),
    footerAxisX: document.getElementById("footer-axis-x"),
    footerAxisY: document.getElementById("footer-axis-y"),
    footerAxisZ: document.getElementById("footer-axis-z"),
  };
}

// Validate required DOM elements early at startup
export function assertDom({ canvas, exportButton, deleteButton }) {
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error("Viewport canvas not found.");
  }

  if (!(exportButton instanceof HTMLButtonElement)) {
    throw new Error("OBJ export button not found.");
  }

  if (!(deleteButton instanceof HTMLButtonElement)) {
    throw new Error("OBJ delete button not found.");
  }
}

// Create a small helper to update the footer status text
export function createStatusUpdater(dom) {
  return function setStatus(message) {
    if (dom.status) {
      dom.status.textContent = message;
    }
  };
}

// Runs clamp
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

// Keep floating tools aligned with the current viewport layout
export function setupUiLayout() {
  const gizmo = document.getElementById("viewport-tools");
  const toolsIsland = document.getElementById("tools-island");
  const toolsToggle = document.getElementById("tools-toggle");
  if (!gizmo && !(toolsIsland && toolsToggle)) return;

  let rafId = 0;

  // Updates the target state
  const update = () => {
    const rootStyles = getComputedStyle(document.documentElement);
    const edgeGap = parseFloat(rootStyles.getPropertyValue("--edge-gap"));
    const islandGap = parseFloat(rootStyles.getPropertyValue("--island-gap"));
    const toolsWidth = parseFloat(rootStyles.getPropertyValue("--tools-width"));

    const left = Number.isFinite(edgeGap) ? edgeGap : 0;
    const top = Number.isFinite(islandGap) ? islandGap : 12;
    const width = Number.isFinite(toolsWidth) ? toolsWidth : 225;
    const maxWidth = Math.max(140, window.innerWidth - (left * 2));

    if (gizmo) {
      gizmo.style.left = `${Math.round(left)}px`;
      gizmo.style.top = `${Math.round(top)}px`;
      gizmo.style.width = `${Math.round(clamp(width, 140, maxWidth))}px`;
    }

    if (toolsIsland instanceof HTMLElement && toolsToggle instanceof HTMLElement) {
      const islandRect = toolsIsland.getBoundingClientRect();
      const centerY = islandRect.top + islandRect.height / 2;
      if (Number.isFinite(centerY) && islandRect.height > 0) {
        toolsToggle.style.top = `${Math.round(centerY)}px`;
        toolsToggle.style.bottom = "auto";
        toolsToggle.style.transform = "translateY(-50%)";
      }
    }
  };

  // Runs schedule
  const schedule = () => {
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      rafId = 0;
      update();
    });
  };

  window.addEventListener("resize", schedule);

  if ("ResizeObserver" in window) {
    const ro = new ResizeObserver(schedule);
    if (gizmo) {
      ro.observe(gizmo);
    }
    if (toolsIsland) {
      ro.observe(toolsIsland);
    }
  }

  schedule();
}

// Returns whether editable target
function isEditableTarget(target) {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target?.isContentEditable
  );
}

// Returns whether transform panel target
function isTransformPanelTarget(target) {
  return target instanceof HTMLElement
    ? Boolean(target.closest("#transformation-panel-container"))
    : false;
}

// Register global keyboard shortcuts for editor actions
export function setupShortcuts({
  store,
  transformationManager,
  deleteImportedObject,
  clearScene,
  undoDelete,
  hasUndoDelete,
  copySelection,
  pasteSelection,
  duplicateSelection,
}) {
  // Runs run undo
  const runUndo = () => {
    const canUndoDelete = typeof hasUndoDelete === "function" && hasUndoDelete();
    if (canUndoDelete && store.getState().currentObject === null) {
      undoDelete?.();
      return;
    }

    const didUndo = transformationManager.undo?.();
    if (!didUndo && typeof undoDelete === "function") {
      undoDelete();
    }
  };

  document.addEventListener("keydown", (event) => {
    if (isEditableTarget(event.target) && !isTransformPanelTarget(event.target)) return;

    const hasModifier = event.ctrlKey || event.metaKey;
    if (!hasModifier) return;

    const key = event.key.toLowerCase();
    const isCopy = key === "c";
    const isPaste = key === "v";

    if (isCopy || isPaste) {
      if (isEditableTarget(event.target)) return;
      event.preventDefault();
      if (isCopy) {
        copySelection?.();
      } else {
        pasteSelection?.();
      }
      return;
    }

    const isUndoShortcut = event.code === "KeyZ" && !event.shiftKey;
    const isRedoShortcut = event.code === "KeyY" || (event.code === "KeyZ" && event.shiftKey);

    if (!isUndoShortcut && !isRedoShortcut) {
      return;
    }

    event.preventDefault();
    if (isRedoShortcut) {
      transformationManager.redo?.();
      return;
    }
    runUndo();
  });

  document.addEventListener("keydown", (event) => {
    if (isEditableTarget(event.target)) return;

    if (event.shiftKey && event.key === "Delete") {
      event.preventDefault();
      clearScene?.();
      return;
    }

    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      deleteImportedObject(store.getState().currentObject);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (isEditableTarget(event.target)) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    const key = event.key.toLowerCase();
    if (key === "enter") {
      const finished = transformationManager.finishAxisShortcut?.();
      if (finished) {
        event.preventDefault();
      }
      return;
    }
    if (key === "escape") {
      const canceled = transformationManager.cancelAxisShortcut?.();
      if (canceled) {
        event.preventDefault();
      }
      return;
    }

    if (key === "t") {
      event.preventDefault();
      transformationManager.setMode("translate");
    } else if (key === "r") {
      event.preventDefault();
      transformationManager.setMode("rotate");
    } else if (key === "s") {
      event.preventDefault();
      transformationManager.setMode("scale");
    } else if (key === "x" || key === "y" || key === "z") {
      event.preventDefault();
      transformationManager.startAxisShortcut?.(key);
    } else if (key === "d") {
      event.preventDefault();
      duplicateSelection?.();
    } else if (key === "c") {
      event.preventDefault();
      transformationManager.combineSelectedModels?.();
    }
  });
}
