import * as THREE from "three";

export function createOrbit({ camera, target }) {
  const orbitOffset = new THREE.Vector3();
  const orbitSpherical = new THREE.Spherical();
  const rotateSpeed = 0.005;
  const orbitMin = 0.01;

  return function orbit(deltaX, deltaY) {
    orbitOffset.copy(camera.position).sub(target);
    orbitSpherical.setFromVector3(orbitOffset);
    orbitSpherical.theta -= deltaX * rotateSpeed;
    orbitSpherical.phi -= deltaY * rotateSpeed;
    orbitSpherical.phi = Math.max(orbitMin, Math.min(Math.PI - orbitMin, orbitSpherical.phi));
    orbitOffset.setFromSpherical(orbitSpherical);
    camera.position.copy(target).add(orbitOffset);
  };
}
