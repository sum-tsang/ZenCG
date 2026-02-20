import { combineModels } from "../combine/combineModels.js";
// Handles select object
export function selectObject(manager, object) {
  const selectionChanged = manager.selectedObject !== object;
  manager.selectedObject = object;
  manager.selectedObjects = object ? [object] : [];
  syncSelectionUi(manager, selectionChanged);
}
// Handles toggle selection
export function toggleSelection(manager, object) {
  if (!object) {
    selectObject(manager, null);
    return;
  }

  const previousSelected = manager.selectedObject;
  const index = manager.selectedObjects.indexOf(object);
  if (index === -1) {
    manager.selectedObjects.push(object);
    manager.selectedObject = object;
  } else {
    manager.selectedObjects.splice(index, 1);
    if (manager.selectedObject === object) {
      manager.selectedObject = manager.selectedObjects[manager.selectedObjects.length - 1] ?? null;
    }
  }

  const selectionChanged = previousSelected !== manager.selectedObject;
  syncSelectionUi(manager, selectionChanged);
}
// Handles sync selection ui
export function syncSelectionUi(manager, selectionChanged) {
  if (manager.selectedObject) {
    manager.gizmo.setObject(manager.selectedObject);
    manager.gizmo.show();
    manager.panel.setObject(manager.selectedObject);
    manager.panel.setGizmo(manager.gizmo);
    manager.panel.updatePanelFromObject();
  } else {
    manager.gizmo.hide();
  }

  if (selectionChanged) {
    if (manager.selectedObject) {
      manager.cacheInitialSnapshot(manager.selectedObject);
    }
    manager.notifyHistoryChange();
  }

  manager.panel.setCombineEnabled(!manager.boxSelecting && manager.selectedObjects.length > 1);

  if (manager.onSelectionChange) {
    manager.onSelectionChange(manager.selectedObject);
  }
  if (manager.onMultiSelectionChange) {
    manager.onMultiSelectionChange([...manager.selectedObjects]);
  }
}
// Handles combine selected models
export function combineSelectedModels(manager) {
  if (manager.boxSelecting) return false;
  if (!Array.isArray(manager.selectedObjects) || manager.selectedObjects.length < 2) return false;

  const targetParent = manager.selectableRoot || manager.selectedObjects[0]?.parent || manager.scene;
  const result = combineModels(manager.selectedObjects, targetParent);
  if (!result?.combined) return false;

  if (manager.onCombine) {
    manager.onCombine({
      combined: result.combined,
      originals: result.originals,
    });
  }

  selectObject(manager, result.combined);
  manager.recordSnapshot("combine");
  return true;
}
