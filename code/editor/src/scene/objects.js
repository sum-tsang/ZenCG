
import * as THREE from "three";
import { persistenceSettings } from "../core/settings.js";
import { materialEditor } from "../model/materialEditor.js";

// Render the object list panel from current store state.
export function renderObjectList({ dom, state, onSelect, onDelete, onToggleSelect }) {
  if (!(dom.objectList instanceof HTMLUListElement)) {
    return;
  }

  const hasObjects = state.importedObjects.length > 0;

  if (dom.objectListEmpty instanceof HTMLElement) {
    dom.objectListEmpty.hidden = hasObjects;
  }

  if (!hasObjects) {
    dom.objectList.replaceChildren();
    return;
  }

  const selectedSet = Array.isArray(state.selectedObjects)
    ? new Set(state.selectedObjects)
    : null;
  const fragment = document.createDocumentFragment();

  state.importedObjects.forEach((object, index) => {
    const item = document.createElement("li");
    item.className = "object-item";
    const row = document.createElement("div");
    row.className = "object-row";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "object-button";
    const label =
      typeof object?.name === "string" && object.name
        ? object.name
        : `Object ${index + 1}`;
    button.textContent = label;
    if (object === state.currentObject) {
      button.classList.add("active");
    }
    if (
      selectedSet?.has(object) &&
      object !== state.currentObject
    ) {
      row.classList.add("multi-selected");
    }
    button.addEventListener("click", () => {
      onSelect?.(object);
    });
    row.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      onToggleSelect?.(object);
    });
    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "object-delete";
    removeButton.textContent = "Delete";
    removeButton.addEventListener("click", (event) => {
      event.stopPropagation();
      onDelete?.(object);
    });
    row.append(button, removeButton);
    item.append(row);
    fragment.append(item);
  });

  dom.objectList.replaceChildren(fragment);
}

// Resolve a clicked child object to its top-level imported root.
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

// Show or hide the primary selection helper outline.
export function updateSelectionOutline(selectionHelper, object) {
  if (!selectionHelper) return;
  if (!object) {
    selectionHelper.visible = false;
    return;
  }

  if (typeof selectionHelper.setFromObject === "function") {
    selectionHelper.setFromObject(object);
  }
  selectionHelper.visible = true;
}

// Maintain helper outlines for non-primary multi-selection objects.
export function updateMultiSelectionOutlines(group, objects = [], primary) {
  if (!group) return;
  const selected = Array.isArray(objects) ? objects : [];
  const next = new Set();

  if (!group.userData.helpers) {
    group.userData.helpers = new Map();
  }
  const helpers = group.userData.helpers;

  selected.forEach((object) => {
    if (!object || object === primary) return;
    next.add(object.uuid);
    let helper = helpers.get(object.uuid);
    if (!helper) {
      helper = new THREE.BoxHelper(object, 0xfbbf24);
      helper.renderOrder = 1;
      const materials = Array.isArray(helper.material)
        ? helper.material
        : [helper.material];
      materials.forEach((material) => {
        if (!material) return;
        material.depthTest = false;
        material.transparent = true;
        material.opacity = 0.65;
      });
      helpers.set(object.uuid, helper);
      group.add(helper);
    } else {
      helper.setFromObject(object);
      helper.visible = true;
    }
  });

  for (const [uuid, helper] of helpers) {
    if (!next.has(uuid)) {
      group.remove(helper);
      const materials = Array.isArray(helper.material)
        ? helper.material
        : [helper.material];
      materials.forEach((material) => material?.dispose?.());
      helper.geometry?.dispose?.();
      helpers.delete(uuid);
    }
  }
}

// Serialize transform state for persistence.
export function serializeTransform(object) {
  return {
    position: object.position.toArray(),
    quaternion: object.quaternion.toArray(),
    scale: object.scale.toArray(),
  };
}

// Apply a persisted transform payload to an object.
export function applyTransform(object, transform) {
  if (!transform) return;
  if (Array.isArray(transform.position) && transform.position.length === 3) {
    object.position.fromArray(transform.position);
  }
  if (Array.isArray(transform.quaternion) && transform.quaternion.length === 4) {
    object.quaternion.fromArray(transform.quaternion);
  }
  if (Array.isArray(transform.scale) && transform.scale.length === 3) {
    object.scale.fromArray(transform.scale);
  }
}

// Sync current transform into stored import metadata.
export function updateStoredTransform(object, state) {
  const index = state.importedObjects.indexOf(object);
  if (index === -1) return;
  const entry = state.storedImports[index];
  if (!entry) return;
  entry.transform = serializeTransform(object);
}

// Sync current material into stored import metadata.
export function updateStoredMaterial(object, state) {
  const index = state.importedObjects.indexOf(object);
  if (index === -1) return;
  const entry = state.storedImports[index];
  if (!entry) return;
  entry.material = materialEditor.serializeMaterial(object);
}

// Sync display name into stored import metadata.
export function updateStoredName(object, state, name) {
  const index = state.importedObjects.indexOf(object);
  if (index === -1) return;
  const entry = state.storedImports[index];
  if (!entry) return;
  if (typeof name === "string" && name.trim()) {
    entry.name = name.trim();
  }
}

// Place a new import with consistent horizontal spacing.
export function placeImportedObject(object, state, appConfig) {
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) return;

  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  object.position.sub(center);
  object.position.x += state.nextOffsetX;

  const width = Math.max(size.x, 1);
  state.nextOffsetX += width + appConfig.importGap;
}

// Release geometry and materials for an object tree.
export function disposeObject(object) {
  object.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    const material = child.material;
    if (Array.isArray(material)) {
      material.forEach((mat) => mat.dispose());
    } else if (material) {
      material.dispose();
    }
  });
}

// Create delete/undo handlers for imported objects.
export function createDeleteImportedObject({
  importRoot,
  store,
  findImportedRoot,
  disposeObject,
  saveStoredImports,
  renderObjectList,
  selectObject,
  setStatus,
}) {
  const deletedStack = [];
  const maxUndo = persistenceSettings.deleteUndoLimit;

  const cloneEntry = (entry) => {
    if (!entry) return null;
    if (typeof structuredClone === "function") {
      return structuredClone(entry);
    }
    return JSON.parse(JSON.stringify(entry));
  };

  const disposeDeleted = (entry) => {
    if (!entry?.object) return;
    disposeObject(entry.object);
  };

  const deleteImportedObject = (object) => {
    const state = store.getState();
    const root = object ? findImportedRoot(importRoot, object) ?? object : null;
    if (!root) return;

    const index = state.importedObjects.indexOf(root);
    if (index === -1) return;

    const storedEntry = cloneEntry(state.storedImports[index]);
    const wasCurrent = state.currentObject === root;
    importRoot.remove(root);

    store.mutate((state) => {
      state.importedObjects.splice(index, 1);
      if (Array.isArray(state.selectedObjects)) {
        state.selectedObjects = state.selectedObjects.filter((item) => item !== root);
      }
      if (index < state.storedImports.length) {
        state.storedImports.splice(index, 1);
      }
      if (state.importedObjects.length === 0) {
        state.nextOffsetX = 0;
      }
    });

    saveStoredImports();

    if (wasCurrent) {
      const updated = store.getState().importedObjects;
      const next = updated[index] ?? updated[index - 1] ?? null;
      selectObject(next);
    } else {
      renderObjectList();
    }

    const name = typeof root?.name === "string" && root.name ? root.name : "object";
    setStatus?.(`Deleted ${name}.`);

    deletedStack.push({ object: root, storedEntry, index });
    while (deletedStack.length > maxUndo) {
      const discarded = deletedStack.shift();
      disposeDeleted(discarded);
    }
  };

  const undoDelete = () => {
    const entry = deletedStack.pop();
    if (!entry?.object) return false;

    const { object, storedEntry, index } = entry;
    importRoot.add(object);

    store.mutate((state) => {
      const insertIndex = Math.min(Math.max(index, 0), state.importedObjects.length);
      state.importedObjects.splice(insertIndex, 0, object);
      if (storedEntry) {
        state.storedImports.splice(insertIndex, 0, storedEntry);
      }
    });

    saveStoredImports();
    selectObject(object);
    renderObjectList();

    const name = typeof object?.name === "string" && object.name ? object.name : "object";
    setStatus?.(`Restored ${name}.`);
    return true;
  };

  const hasUndoDelete = () => deletedStack.length > 0;

  const clearDeleteHistory = () => {
    while (deletedStack.length > 0) {
      const entry = deletedStack.pop();
      disposeDeleted(entry);
    }
  };

  return { deleteImportedObject, undoDelete, hasUndoDelete, clearDeleteHistory };
}
