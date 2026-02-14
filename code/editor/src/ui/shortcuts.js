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

// Register global keyboard shortcuts for editor actions.
export function setupShortcuts({
  store,
  transformationManager,
  deleteImportedObject,
  undoDelete,
  hasUndoDelete,
  copySelection,
  pasteSelection,
  duplicateSelection,
}) {
  document.addEventListener("keydown", (event) => {
    if (isEditableTarget(event.target) && !isTransformPanelTarget(event.target)) return;

    const hasModifier = event.ctrlKey || event.metaKey;
    if (!hasModifier) return;

    const key = event.key.toLowerCase();
    const isCopy = key === "c";
    const isPaste = key === "v";
    const isUndo = key === "undo" || (key === "z" && !event.shiftKey);
    const isRedo = key === "redo" || key === "y" || (key === "z" && event.shiftKey);

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

    if (!isUndo && !isRedo) {
      const code = event.code;
      if (code === "KeyZ" && !event.shiftKey) {
        event.preventDefault();
        const canUndoDelete = typeof hasUndoDelete === "function" && hasUndoDelete();
        if (canUndoDelete && store.getState().currentObject === null) {
          undoDelete?.();
          return;
        }
        const didUndo = transformationManager.undo();
        if (!didUndo && typeof undoDelete === "function") {
          undoDelete();
        }
      } else if (code === "KeyZ" && event.shiftKey) {
        event.preventDefault();
        transformationManager.redo?.();
      }
      return;
    }

    event.preventDefault();
    if (isRedo) {
      transformationManager.redo?.();
      return;
    }

    const canUndoDelete = typeof hasUndoDelete === "function" && hasUndoDelete();
    if (canUndoDelete && store.getState().currentObject === null) {
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
