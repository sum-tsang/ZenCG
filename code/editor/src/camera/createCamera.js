import * as THREE from "three";

// Creates camera
export function createCamera() {
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 2000);
  const target = new THREE.Vector3(0, 0, 0);

  camera.position.set(8, 6, 8);
  camera.lookAt(target);
  camera.updateMatrixWorld();

  return { camera, target };
}
