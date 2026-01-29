// Collect DOM references used by the editor.
export function getDomRefs() {
  return {
    canvas: document.getElementById("viewport-canvas"),
    envGizmoCanvas: document.getElementById("env-gizmo-canvas"),
    fileInput: document.getElementById("obj-input"),
    exportButton: document.getElementById("obj-export"),
    deleteButton: document.getElementById("obj-delete"),
    status: document.getElementById("status"),
    librarySelect: document.getElementById("library-select"),
    libraryImportButton: document.getElementById("library-import"),
    objectList: document.getElementById("object-list"),
    objectListEmpty: document.getElementById("object-list-empty"),
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
