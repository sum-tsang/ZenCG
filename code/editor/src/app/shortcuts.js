// Keyboard shortcuts.
// Detect inputs/textareas/contenteditable targets.
function isEditableTarget(target) {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target?.isContentEditable
  );
}

// Detect key events originating from the transform panel.
function isTransformPanelTarget(target) {
  return target instanceof HTMLElement
    ? Boolean(target.closest("#transformation-panel-container"))
    : false;
}

// Register global keyboard shortcuts for undo/delete.
export function setupShortcuts({
  store,
  transformationManager,
  deleteImportedObject,
  undoDelete,
  hasUndoDelete,
}) {
  document.addEventListener("keydown", (event) => {
    if (isEditableTarget(event.target) && !isTransformPanelTarget(event.target)) return;

    const hasModifier = event.ctrlKey || event.metaKey;
    if (!hasModifier) return;

    const key = event.key.toLowerCase();
    let isUndo = key === "undo" || (key === "z" && !event.shiftKey);

    if (!isUndo) {
      const code = event.code;
      isUndo = code === "KeyZ" && !event.shiftKey;
    }

    if (!isUndo) return;

    event.preventDefault();
    const canUndoDelete = typeof hasUndoDelete === "function" && hasUndoDelete();
    if (canUndoDelete && store.getState().currentObject === null) {
      event.preventDefault();
      undoDelete?.();
      return;
    }

    const didUndo = transformationManager.undo();
    if (!didUndo && typeof undoDelete === "function") {
      undoDelete();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (isEditableTarget(event.target)) return;

    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      deleteImportedObject(store.getState().currentObject);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (isEditableTarget(event.target)) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    const key = event.key.toLowerCase();
    if (key === "g") {
      event.preventDefault();
      transformationManager.setMode("translate");
    } else if (key === "r") {
      event.preventDefault();
      transformationManager.setMode("rotate");
    } else if (key === "s") {
      event.preventDefault();
      transformationManager.setMode("scale");
    }
  });
}
