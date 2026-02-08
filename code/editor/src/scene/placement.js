// Placement helpers.
import * as THREE from "three";

// Position a newly imported object with spacing offset.
export function placeImportedObject(object, state, config) {
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) return;

  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  object.position.sub(center);
  object.position.x += state.nextOffsetX;

  const width = Math.max(size.x, 1);
  state.nextOffsetX += width + config.importGap;
}
