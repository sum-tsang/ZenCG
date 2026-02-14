// Model combination helpers.
import * as THREE from "three";

function uniqueObjects(objects = []) {
  const seen = new Set();
  return (Array.isArray(objects) ? objects : []).filter((object) => {
    const id = object?.uuid;
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function buildCombinedName(objects = []) {
  const first = objects[0];
  const firstName = typeof first?.name === "string" ? first.name.trim() : "";
  if (firstName) {
    return `${firstName}_combined`;
  }
  return "combined_model";
}

function recenterGroupToBounds(group) {
  if (!group || !group.parent || group.children.length === 0) return;
  group.updateMatrixWorld(true);

  const bounds = new THREE.Box3().setFromObject(group);
  if (bounds.isEmpty()) return;

  const centerWorld = bounds.getCenter(new THREE.Vector3());
  const parentInverse = group.parent.matrixWorld.clone().invert();
  const centerLocal = centerWorld.applyMatrix4(parentInverse);

  group.position.copy(centerLocal);
  group.children.forEach((child) => {
    child.position.sub(centerLocal);
  });
}

/**
 * Combine selected top-level objects under a single group.
 * Returns null when there are not enough objects to combine.
 */
export function combineModels(objects = [], parent) {
  const selected = uniqueObjects(objects);
  if (!parent || selected.length < 2) return null;

  parent.updateMatrixWorld(true);

  const combined = new THREE.Group();
  combined.name = buildCombinedName(selected);
  parent.add(combined);

  selected.forEach((object) => {
    combined.add(object);
  });

  recenterGroupToBounds(combined);
  combined.updateMatrixWorld(true);

  return { combined, originals: selected };
}
