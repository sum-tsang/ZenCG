import * as THREE from "three";

export function createZoom({ camera, target }) {
  const orbitOffset = new THREE.Vector3();
  const orbitSpherical = new THREE.Spherical();
  const zoomSpeed = 0.0015;
  const minDistance = 0.2;
  const maxDistance = 200;

  return function zoom(deltaY) {
    orbitOffset.copy(camera.position).sub(target);
    orbitSpherical.setFromVector3(orbitOffset);
    orbitSpherical.radius *= 1 + deltaY * zoomSpeed;
    orbitSpherical.radius = Math.max(minDistance, Math.min(maxDistance, orbitSpherical.radius));
    orbitOffset.setFromSpherical(orbitSpherical);
    camera.position.copy(target).add(orbitOffset);
  };
}
