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

export function attachPanControls({ canvas, camera, target, renderer }) {
  const panOffset = new THREE.Vector3();
  const panRight = new THREE.Vector3();
  const panUp = new THREE.Vector3();
  const panTemp = new THREE.Vector3();
  const orbitOffset = new THREE.Vector3();
  const orbitSpherical = new THREE.Spherical();
  const rotateSpeed = 0.005;
  const zoomSpeed = 0.0015;
  const orbitMin = 0.01;
  const minDistance = 0.2;
  const maxDistance = 200;
  let mode = null;
  let lastPointerX = 0;
  let lastPointerY = 0;

  function panCamera(deltaX, deltaY) {
    const element = renderer.domElement;
    panTemp.copy(camera.position).sub(target);
    let targetDistance = panTemp.length();
    targetDistance *= Math.tan((camera.fov * Math.PI) / 360);

    const panX = (2 * deltaX * targetDistance) / element.clientHeight;
    const panY = (2 * deltaY * targetDistance) / element.clientHeight;

    panRight.setFromMatrixColumn(camera.matrix, 0);
    panRight.multiplyScalar(-panX);
    panUp.setFromMatrixColumn(camera.matrix, 1);
    panUp.multiplyScalar(panY);

    panOffset.copy(panRight).add(panUp);
    camera.position.add(panOffset);
    target.add(panOffset);
  }

  function orbitCamera(deltaX, deltaY) {
    orbitOffset.copy(camera.position).sub(target);
    orbitSpherical.setFromVector3(orbitOffset);
    orbitSpherical.theta -= deltaX * rotateSpeed;
    orbitSpherical.phi -= deltaY * rotateSpeed;
    orbitSpherical.phi = Math.max(orbitMin, Math.min(Math.PI - orbitMin, orbitSpherical.phi));
    orbitOffset.setFromSpherical(orbitSpherical);
    camera.position.copy(target).add(orbitOffset);
  }

  function zoomCamera(deltaY) {
    orbitOffset.copy(camera.position).sub(target);
    orbitSpherical.setFromVector3(orbitOffset);
    orbitSpherical.radius *= 1 + deltaY * zoomSpeed;
    orbitSpherical.radius = Math.max(minDistance, Math.min(maxDistance, orbitSpherical.radius));
    orbitOffset.setFromSpherical(orbitSpherical);
    camera.position.copy(target).add(orbitOffset);
  }

  function onPointerDown(event) {
    if (event.button === 1 || (event.button === 0 && event.shiftKey)) {
      mode = "pan";
    } else if (event.button === 0) {
      mode = "orbit";
    } else {
      mode = null;
    }

    if (mode) {
      lastPointerX = event.clientX;
      lastPointerY = event.clientY;
      canvas.setPointerCapture(event.pointerId);
    }
  }

  function onPointerMove(event) {
    if (!mode) {
      return;
    }

    const deltaX = event.clientX - lastPointerX;
    const deltaY = event.clientY - lastPointerY;
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;

    if (mode === "pan") {
      panCamera(deltaX, deltaY);
    } else if (mode === "orbit") {
      orbitCamera(deltaX, deltaY);
    }
  }

  function onPointerUp(event) {
    if (mode) {
      mode = null;
      canvas.releasePointerCapture(event.pointerId);
    }
  }

  function onPointerLeave() {
    mode = null;
  }

  function onContextMenu(event) {
    event.preventDefault();
  }

  function onWheel(event) {
    event.preventDefault();
    zoomCamera(event.deltaY);
  }

  canvas.addEventListener("contextmenu", onContextMenu);
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointerleave", onPointerLeave);
  canvas.addEventListener("wheel", onWheel, { passive: false });

  return () => {
    canvas.removeEventListener("contextmenu", onContextMenu);
    canvas.removeEventListener("pointerdown", onPointerDown);
    canvas.removeEventListener("pointermove", onPointerMove);
    canvas.removeEventListener("pointerup", onPointerUp);
    canvas.removeEventListener("pointerleave", onPointerLeave);
    canvas.removeEventListener("wheel", onWheel);
  };
}
