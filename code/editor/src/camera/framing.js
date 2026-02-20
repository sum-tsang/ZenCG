import * as THREE from "three";

// Applies frame from bounds
function applyFrameFromBounds({ box, camera, target }) {
  if (!box || box.isEmpty()) return false;

  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z, 1);
  const distance = maxDim * 1.8;

  camera.position.set(
    center.x + distance,
    center.y + distance * 0.9,
    center.z + distance
  );
  camera.near = Math.max(maxDim / 200, 0.05);
  camera.far = Math.max(maxDim * 120, 2000);
  target.copy(center);
  camera.lookAt(target);
  camera.updateProjectionMatrix();
  return true;
}

// Handles frame object bounds
export function frameObjectBounds(object, camera, target) {
  const box = new THREE.Box3().setFromObject(object);
  applyFrameFromBounds({ box, camera, target });
}
