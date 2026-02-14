// Camera control wiring.
import * as THREE from "three";

function createOrbit({ camera, target }) {
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

function createPan({ camera, target, renderer }) {
  const panOffset = new THREE.Vector3();
  const panRight = new THREE.Vector3();
  const panUp = new THREE.Vector3();
  const panTemp = new THREE.Vector3();

  return function pan(deltaX, deltaY) {
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
  };
}

function createZoom({ camera, target }) {
  const orbitOffset = new THREE.Vector3();
  const orbitSpherical = new THREE.Spherical();
  const zoomSpeed = 0.0015;
  const minDistance = 0.2;
  const maxDistance = 1500;

  return function zoom(deltaY) {
    orbitOffset.copy(camera.position).sub(target);
    orbitSpherical.setFromVector3(orbitOffset);
    orbitSpherical.radius *= 1 + deltaY * zoomSpeed;
    orbitSpherical.radius = Math.max(minDistance, Math.min(maxDistance, orbitSpherical.radius));
    orbitOffset.setFromSpherical(orbitSpherical);
    camera.position.copy(target).add(orbitOffset);
  };
}

// Attach Camera Controls
export function attachCameraControls({ canvas, camera, target, renderer }) {
  const pan = createPan({ camera, target, renderer });
  const orbit = createOrbit({ camera, target });
  const zoom = createZoom({ camera, target });
  let mode = null;
  let lastPointerX = 0;
  let lastPointerY = 0;

  // On Pointer Down
  function onPointerDown(event) {
    // Left-click: orbit (shift = pan). Middle-click: pan.
    if (event.button === 0) {
      mode = event.shiftKey ? "pan" : "orbit";
    } else if (event.button === 1) {
      mode = "pan";
    } else {
      mode = null;
    }

    if (mode) {
      lastPointerX = event.clientX;
      lastPointerY = event.clientY;
      canvas.setPointerCapture(event.pointerId);
    }
  }

  // On Pointer Move
  function onPointerMove(event) {
    if (!mode) {
      return;
    }

    const deltaX = event.clientX - lastPointerX;
    const deltaY = event.clientY - lastPointerY;
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;

    if (mode === "pan") {
      pan(deltaX, deltaY);
    } else if (mode === "orbit") {
      orbit(deltaX, deltaY);
    }
  }

  // On Pointer Up
  function onPointerUp(event) {
    if (mode) {
      mode = null;
      canvas.releasePointerCapture(event.pointerId);
    }
  }

  // On Pointer Leave
  function onPointerLeave() {
    mode = null;
  }

  // On Context Menu
  function onContextMenu(event) {
    event.preventDefault();
  }

  // On Wheel
  function onWheel(event) {
    event.preventDefault();
    zoom(event.deltaY);
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
