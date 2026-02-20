import { applyTransformSnapshot, createTransformSnapshot } from "../history/undo.js";
// Handles reset undo history
export function resetUndoHistory(manager) {
  if (!manager.selectedObject) return;
  manager.undoHistory.clear();
  manager.actionHistory.clear();
  notifyHistoryChange(manager);
  recordSnapshot(manager);
  manager.initializedObjects.add(manager.selectedObject);
  manager.initialSnapshots.delete(manager.selectedObject);
}
// Handles clear history
export function clearHistory(manager) {
  manager.undoHistory.clear();
  manager.actionHistory.clear();
  manager.initializedObjects = new WeakSet();
  manager.initialSnapshots = new WeakMap();
  notifyHistoryChange(manager);
}
// Handles record snapshot
export function recordSnapshot(manager, action) {
  if (!manager.selectedObject) return;
  if (!manager.initializedObjects.has(manager.selectedObject)) {
    const initial = manager.initialSnapshots.get(manager.selectedObject);
    if (initial) {
      manager.undoHistory.record(initial);
    }
    manager.initializedObjects.add(manager.selectedObject);
    manager.initialSnapshots.delete(manager.selectedObject);
  }
  const snapshot = createTransformSnapshot(manager.selectedObject);
  const recorded = manager.undoHistory.record(snapshot);
  if (recorded && action) {
    logAction(manager, action);
  }
}
// Handles undo
export function undo(manager) {
  const snapshot = manager.undoHistory.undo();
  if (!snapshot) return false;
  if (!applyTransformSnapshot(snapshot)) return false;
  if (snapshot.object !== manager.selectedObject) {
    manager.selectObject(snapshot.object);
  }
  manager.gizmo.updateGizmoPosition();
  manager.panel.updatePanelFromObject();
  logAction(manager, "undo");
  if (manager.selectedObject) {
    manager.emitTransform({
      position: manager.selectedObject.position.clone(),
      rotation: manager.selectedObject.quaternion.clone(),
      scale: manager.selectedObject.scale.clone(),
      source: "undo",
    });
  }
  return true;
}
// Handles redo
export function redo(manager) {
  const snapshot = manager.undoHistory.redo();
  if (!snapshot) return false;
  if (!applyTransformSnapshot(snapshot)) return false;
  if (snapshot.object !== manager.selectedObject) {
    manager.selectObject(snapshot.object);
  }
  manager.gizmo.updateGizmoPosition();
  manager.panel.updatePanelFromObject();
  logAction(manager, "redo");
  if (manager.selectedObject) {
    manager.emitTransform({
      position: manager.selectedObject.position.clone(),
      rotation: manager.selectedObject.quaternion.clone(),
      scale: manager.selectedObject.scale.clone(),
      source: "redo",
    });
  }
  return true;
}
// Handles log action
export function logAction(manager, action) {
  const label = getActionLabel(action);
  if (!label) return;
  manager.actionHistory.record(label);
  notifyHistoryChange(manager);
}
// Handles notify history change
export function notifyHistoryChange(manager) {
  if (!manager.onHistoryChange) return;
  manager.onHistoryChange(manager.actionHistory.entries({ newestFirst: false }));
}
// Gets action label
function getActionLabel(action) {
  if (!action) return null;
  switch (action) {
    case "translate":
      return "Translate";
    case "rotate":
      return "Rotate";
    case "scale":
      return "Scale";
    case "reset":
      return "Reset";
    case "undo":
      return "Undo";
    case "redo":
      return "Redo";
    case "split":
      return "Create Component";
    case "combine":
      return "Combine Models";
    default:
      return "Transform";
  }
}
// Handles cache initial snapshot
export function cacheInitialSnapshot(manager, object) {
  if (!object || manager.initializedObjects.has(object)) return;
  if (manager.initialSnapshots.has(object)) return;
  const snapshot = createTransformSnapshot(object);
  if (snapshot) {
    manager.initialSnapshots.set(object, snapshot);
  }
}
