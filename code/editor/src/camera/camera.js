  
import * as THREE from "three";
import { cameraAxisButtons, cameraControlSettings } from "../core/settings.js";

// Create the main perspective camera and its look target.
export function createCamera() {
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 2000);
  const target = new THREE.Vector3(0, 0, 0);
  camera.position.set(8, 6, 8);
  camera.lookAt(target);
  camera.updateMatrixWorld();
  return { camera, target };
}

// Frame a single object by moving camera and target.
export function frameObject(object, camera, target) {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  object.position.sub(center);

  const maxDim = Math.max(size.x, size.y, size.z, 1);
  const distance = maxDim * 1.8;
  camera.position.set(distance, distance * 0.9, distance);
  camera.near = Math.max(maxDim / 200, 0.05);
  camera.far = Math.max(maxDim * 120, 2000);
  target.set(0, 0, 0);
  camera.lookAt(target);
  camera.updateProjectionMatrix();
}

// Frame world-space bounds without changing object transforms.
export function frameObjectBounds(object, camera, target) {
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) return;

  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  const maxDim = Math.max(size.x, size.y, size.z, 1);
  const distance = maxDim * 1.8;
  camera.position.set(center.x + distance, center.y + distance * 0.9, center.z + distance);
  camera.near = Math.max(maxDim / 200, 0.05);
  camera.far = Math.max(maxDim * 120, 2000);
  target.copy(center);
  camera.lookAt(target);
  camera.updateProjectionMatrix();
}

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

function resolveAxisDirection(axis) {
  const normalized = typeof axis === "string" ? axis.trim().toLowerCase().replace(/\s+/g, "") : "";
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

// Keep camera orientation while recentering to current scene bounds.
export function recenterCameraToScene({ camera, target, sceneRoot }) {
  if (!camera || !target) return false;
  const { center } = getSceneFocus(sceneRoot, target);
  const offset = new THREE.Vector3().copy(camera.position).sub(target);
  if (offset.lengthSq() < 1e-6) {
    offset.set(8, 6, 8);
  }
  target.copy(center);
  camera.position.copy(center).add(offset);
  camera.lookAt(target);
  camera.updateMatrixWorld();
  return true;
}

// Snap to a cardinal axis view around the scene center.
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

function createOrbit({ camera, target }) {
  const orbitOffset = new THREE.Vector3();
  const orbitSpherical = new THREE.Spherical();
  const { rotateSpeed, orbitMinPolarAngle } = cameraControlSettings;

  return function orbit(deltaX, deltaY) {
    orbitOffset.copy(camera.position).sub(target);
    orbitSpherical.setFromVector3(orbitOffset);
    orbitSpherical.theta -= deltaX * rotateSpeed;
    orbitSpherical.phi -= deltaY * rotateSpeed;
    orbitSpherical.phi = Math.max(
      orbitMinPolarAngle,
      Math.min(Math.PI - orbitMinPolarAngle, orbitSpherical.phi)
    );
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
  const { zoomSpeed, minDistance, maxDistance } = cameraControlSettings;

  return function zoom(deltaY) {
    orbitOffset.copy(camera.position).sub(target);
    orbitSpherical.setFromVector3(orbitOffset);
    orbitSpherical.radius *= 1 + deltaY * zoomSpeed;
    orbitSpherical.radius = Math.max(
      minDistance,
      Math.min(maxDistance, orbitSpherical.radius)
    );
    orbitOffset.setFromSpherical(orbitSpherical);
    camera.position.copy(target).add(orbitOffset);
  };
}

function createArrowKeyMovement({ camera, target }) {
  const moveSpeed = cameraControlSettings.arrowKeyMoveSpeed ?? 0.15;
  const keysPressed = new Set();
  const moveDirection = new THREE.Vector3();
  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  const worldUp = new THREE.Vector3(0, 1, 0);
  let animationId = null;

  function updateMovement() {
    if (keysPressed.size === 0) return;

    camera.getWorldDirection(forward);
    forward.y = 0;
    if (forward.lengthSq() < 1e-8) return;
    forward.normalize();
    right.crossVectors(forward, worldUp).normalize();

    moveDirection.set(0, 0, 0);
    if (keysPressed.has("ArrowUp")) moveDirection.add(forward);
    if (keysPressed.has("ArrowDown")) moveDirection.sub(forward);
    if (keysPressed.has("ArrowLeft")) moveDirection.sub(right);
    if (keysPressed.has("ArrowRight")) moveDirection.add(right);

    if (moveDirection.lengthSq() < 1e-8) return;
    moveDirection.normalize().multiplyScalar(moveSpeed);
    camera.position.add(moveDirection);
    target.add(moveDirection);
  }

  function animate() {
    updateMovement();
    if (keysPressed.size > 0) {
      animationId = requestAnimationFrame(animate);
    }
  }

  function isEditableTarget(target) {
    return (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target?.isContentEditable
    );
  }

  function onKeyDown(event) {
    if (isEditableTarget(event.target)) return;
    const key = event.key;
    if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(key)) return;
    event.preventDefault();
    const wasEmpty = keysPressed.size === 0;
    keysPressed.add(key);
    if (wasEmpty) {
      animate();
    }
  }

  function onKeyUp(event) {
    keysPressed.delete(event.key);
    if (keysPressed.size === 0 && animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
  }

  function onBlur() {
    keysPressed.clear();
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
  }

  document.addEventListener("keydown", onKeyDown);
  document.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);

  return () => {
    document.removeEventListener("keydown", onKeyDown);
    document.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("blur", onBlur);
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
  };
}

// Attach mouse/pointer orbit, pan, and zoom controls.
export function attachCameraControls({ canvas, camera, target, renderer }) {
  const pan = createPan({ camera, target, renderer });
  const orbit = createOrbit({ camera, target });
  const zoom = createZoom({ camera, target });
  const cleanupArrowKeys = createArrowKeyMovement({ camera, target });
  let mode = null;
  let lastPointerX = 0;
  let lastPointerY = 0;

  function onPointerDown(event) {
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
    cleanupArrowKeys();
  };
}

// Build the camera preset button panel UI.
export function setupCameraPanel({
  containerId,
  onAxisView,
}) {
  const container = document.getElementById(containerId);
  if (!container) {
    throw new Error(`Camera panel container with id "${containerId}" not found.`);
  }

  container.innerHTML = "";

  const panel = document.createElement("div");
  panel.className = "camera-panel";

  const viewsSection = document.createElement("div");
  viewsSection.className = "camera-section";

  const viewsTitle = document.createElement("h3");
  viewsTitle.className = "section-title";
  viewsTitle.textContent = "View Presets";
  viewsSection.appendChild(viewsTitle);

  const axisGrid = document.createElement("div");
  axisGrid.className = "camera-axis-grid";

  cameraAxisButtons.forEach(({ label, axis, axisKey, slot, negative }) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `camera-axis-btn axis-${axisKey}`;
    if (negative) {
      button.classList.add("is-negative");
    }
    button.dataset.axis = axis;
    button.dataset.slot = slot;
    button.style.gridArea = slot;
    button.textContent = label;
    button.title = `View from ${label}`;
    button.setAttribute("aria-label", `View from ${label}`);
    button.addEventListener("click", () => {
      onAxisView?.(axis);
    });
    axisGrid.appendChild(button);
  });

  viewsSection.appendChild(axisGrid);
  panel.append(viewsSection);
  container.appendChild(panel);

  return {
    dispose() {
      container.innerHTML = "";
    },
  };
}
