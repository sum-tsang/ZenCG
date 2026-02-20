import * as THREE from "three";

// Gets scene focus
function getSceneFocus(sceneRoot, fallbackTarget) {
  const box = sceneRoot ? new THREE.Box3().setFromObject(sceneRoot) : null;
  if (box && !box.isEmpty()) {
    const size = box.getSize(new THREE.Vector3());
    return {
      center: box.getCenter(new THREE.Vector3()),
      radius: Math.max(size.x, size.y, size.z, 1) * 0.5,
    };
  }

  return {
    center: fallbackTarget ? fallbackTarget.clone() : new THREE.Vector3(0, 0, 0),
    radius: 1,
  };
}

// Handles resolve axis direction
function resolveAxisDirection(axis) {
  const normalized =
    typeof axis === "string" ? axis.trim().toLowerCase().replace(/\s+/g, "") : "";

  switch (normalized) {
    case "x":
    case "+x":
      return new THREE.Vector3(1, 0, 0);
    case "-x":
      return new THREE.Vector3(-1, 0, 0);
    case "y":
    case "+y":
      return new THREE.Vector3(0, 1, 0);
    case "-y":
      return new THREE.Vector3(0, -1, 0);
    case "z":
    case "+z":
      return new THREE.Vector3(0, 0, 1);
    case "-z":
      return new THREE.Vector3(0, 0, -1);
    default:
      return null;
  }
}

// Sets camera axis view
export function setCameraAxisView({ camera, target, sceneRoot, axis }) {
  if (!camera || !target) return false;

  const direction = resolveAxisDirection(axis);
  if (!direction) return false;

  const { center, radius } = getSceneFocus(sceneRoot, target);
  const currentDistance = camera.position.distanceTo(target);
  const minDistance = Math.max(radius * 2.6, 2);
  const distance =
    Number.isFinite(currentDistance) && currentDistance > 0
      ? Math.max(currentDistance, minDistance)
      : minDistance;

  target.copy(center);
  camera.position.copy(center).addScaledVector(direction, distance);

  if (direction.y > 0.5) {
    camera.up.set(0, 0, -1);
  } else if (direction.y < -0.5) {
    camera.up.set(0, 0, 1);
  } else {
    camera.up.set(0, 1, 0);
  }

  camera.near = Math.max(radius / 250, 0.05);
  camera.far = Math.max(radius * 300, 2000);
  camera.lookAt(target);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  return true;
}
