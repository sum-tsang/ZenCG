// Resolve the top-level imported object for any child.
export function findImportedRoot(importRoot, object) {
  let current = object;
  while (current && current !== importRoot) {
    if (current.parent === importRoot) {
      return current;
    }
    current = current.parent;
  }
  return null;
}

// Update or hide the selection outline based on the current object.
export function updateSelectionOutline(selectionHelper, object) {
  if (!selectionHelper) return;
  if (!object) {
    selectionHelper.visible = false;
    return;
  }

  selectionHelper.setFromObject(object);
  selectionHelper.visible = true;
}
