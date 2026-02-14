// Selection helpers.
import * as THREE from "three";

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

  if (typeof selectionHelper.setFromObject === "function") {
    selectionHelper.setFromObject(object);
  }
  selectionHelper.visible = true;
}

// Update outlines for multi-selected objects (excluding the primary).
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
