// DOM lookup helpers.
// Collect DOM references used by the editor.
export function getDomRefs() {
  return {
    canvas: document.getElementById("viewport-canvas"),
    envGizmoCanvas: document.getElementById("env-gizmo-canvas"),
    fileInput: document.getElementById("obj-input"),
    exportButton: document.getElementById("obj-export"),
    deleteButton: document.getElementById("obj-delete"),
    objectNameInput: document.getElementById("object-name-input"),
    exportNameInput: document.getElementById("export-name-input"),
    exportSceneToggle: document.getElementById("export-scene-toggle"),
    toolsToggle: document.getElementById("tools-toggle"),
    panelToggle: document.getElementById("panel-toggle"),
    panelTabControls: document.getElementById("panel-tab-controls"),
    panelTabModels: document.getElementById("panel-tab-models"),
    panelPaneControls: document.getElementById("panel-pane-controls"),
    panelPaneModels: document.getElementById("panel-pane-models"),
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

// Validate required DOM elements exist.
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
