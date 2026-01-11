import * as THREE from "three";

export function createCamera() {
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
  const target = new THREE.Vector3(0, 0, 0);
  return { camera, target };
}

export function frameObject(object, camera, target) {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  object.position.sub(center);

  const maxDim = Math.max(size.x, size.y, size.z, 1);
  const distance = maxDim * 1.8;
  camera.position.set(distance, distance * 0.9, distance);
  camera.near = maxDim / 100;
  camera.far = maxDim * 100;
  target.set(0, 0, 0);
  camera.lookAt(target);
  camera.updateProjectionMatrix();
}
