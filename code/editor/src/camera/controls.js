import * as THREE from "three";
import { cameraControlSettings } from "../core/config/settings.js";

const ARROW_KEYS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);

// Creates orbit
function createOrbit({ camera, target }) {
  const offset = new THREE.Vector3();
  const spherical = new THREE.Spherical();
  const { rotateSpeed, orbitMinPolarAngle } = cameraControlSettings;

  return (deltaX, deltaY) => {
    offset.copy(camera.position).sub(target);
    spherical.setFromVector3(offset);

    spherical.theta -= deltaX * rotateSpeed;
    spherical.phi -= deltaY * rotateSpeed;
    spherical.phi = Math.max(
      orbitMinPolarAngle,
      Math.min(Math.PI - orbitMinPolarAngle, spherical.phi)
    );

    offset.setFromSpherical(spherical);
    camera.position.copy(target).add(offset);
  };
}

// Creates pan
function createPan({ camera, target, renderer }) {
  const panOffset = new THREE.Vector3();
  const panRight = new THREE.Vector3();
  const panUp = new THREE.Vector3();
  const offset = new THREE.Vector3();

  return (deltaX, deltaY) => {
    const element = renderer.domElement;
    if (!(element?.clientHeight > 0)) return;

    offset.copy(camera.position).sub(target);
    let targetDistance = offset.length();
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

// Creates zoom
function createZoom({ camera, target }) {
  const offset = new THREE.Vector3();
  const spherical = new THREE.Spherical();
  const { zoomSpeed, minDistance, maxDistance } = cameraControlSettings;

  return (deltaY) => {
    offset.copy(camera.position).sub(target);
    spherical.setFromVector3(offset);

    spherical.radius *= 1 + deltaY * zoomSpeed;
    spherical.radius = Math.max(minDistance, Math.min(maxDistance, spherical.radius));

    offset.setFromSpherical(spherical);
    camera.position.copy(target).add(offset);
  };
}

// Handles is editable target
function isEditableTarget(element) {
  return (
    element instanceof HTMLInputElement
    || element instanceof HTMLTextAreaElement
    || element?.isContentEditable
  );
}

// Creates arrow key movement
function createArrowKeyMovement({ camera, target }) {
  const moveSpeed = cameraControlSettings.arrowKeyMoveSpeed ?? 0.15;
  const pressed = new Set();

  const moveDirection = new THREE.Vector3();
  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  const worldUp = new THREE.Vector3(0, 1, 0);

  let animationId = null;

  // Updates movement
  const updateMovement = () => {
    if (pressed.size === 0) return;

    camera.getWorldDirection(forward);
    forward.y = 0;
    if (forward.lengthSq() < 1e-8) return;
    forward.normalize();

    right.crossVectors(forward, worldUp).normalize();

    moveDirection.set(0, 0, 0);
    if (pressed.has("ArrowUp")) moveDirection.add(forward);
    if (pressed.has("ArrowDown")) moveDirection.sub(forward);
    if (pressed.has("ArrowLeft")) moveDirection.sub(right);
    if (pressed.has("ArrowRight")) moveDirection.add(right);

    if (moveDirection.lengthSq() < 1e-8) return;

    moveDirection.normalize().multiplyScalar(moveSpeed);
    camera.position.add(moveDirection);
    target.add(moveDirection);
  };

  // Handles tick
  const tick = () => {
    updateMovement();
    if (pressed.size > 0) {
      animationId = requestAnimationFrame(tick);
    }
  };

  // Handles stop movement
  const stopMovement = () => {
    pressed.clear();
    if (!animationId) return;
    cancelAnimationFrame(animationId);
    animationId = null;
  };

  // Handles on key down
  const onKeyDown = (event) => {
    if (isEditableTarget(event.target)) return;
    if (!ARROW_KEYS.has(event.key)) return;

    event.preventDefault();

    const wasIdle = pressed.size === 0;
    pressed.add(event.key);
    if (wasIdle) {
      tick();
    }
  };

  // Handles on key up
  const onKeyUp = (event) => {
    pressed.delete(event.key);
    if (pressed.size === 0 && animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
  };

  // Handles on blur
  const onBlur = () => {
    stopMovement();
  };

  document.addEventListener("keydown", onKeyDown);
  document.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);

  return () => {
    document.removeEventListener("keydown", onKeyDown);
    document.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("blur", onBlur);
    stopMovement();
  };
}

// Handles attach camera controls
export function attachCameraControls({ canvas, camera, target, renderer }) {
  if (!canvas || !camera || !target || !renderer) {
    return () => {};
  }

  const pan = createPan({ camera, target, renderer });
  const orbit = createOrbit({ camera, target });
  const zoom = createZoom({ camera, target });
  const cleanupArrowKeys = createArrowKeyMovement({ camera, target });

  let mode = null;
  let lastPointerX = 0;
  let lastPointerY = 0;

  // Handles on pointer down
  const onPointerDown = (event) => {
    if (event.button === 0) {
      mode = event.shiftKey ? "pan" : "orbit";
    } else if (event.button === 1) {
      mode = "pan";
    } else {
      mode = null;
    }

    if (!mode) return;

    lastPointerX = event.clientX;
    lastPointerY = event.clientY;
    canvas.setPointerCapture(event.pointerId);
  };

  // Handles on pointer move
  const onPointerMove = (event) => {
    if (!mode) return;

    const deltaX = event.clientX - lastPointerX;
    const deltaY = event.clientY - lastPointerY;

    lastPointerX = event.clientX;
    lastPointerY = event.clientY;

    if (mode === "pan") {
      pan(deltaX, deltaY);
      return;
    }

    orbit(deltaX, deltaY);
  };

  // Handles on pointer up
  const onPointerUp = (event) => {
    if (!mode) return;

    mode = null;
    if (canvas.hasPointerCapture?.(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
  };

  // Handles on pointer leave
  const onPointerLeave = () => {
    mode = null;
  };

  // Handles on context menu
  const onContextMenu = (event) => {
    event.preventDefault();
  };

  // Handles on wheel
  const onWheel = (event) => {
    event.preventDefault();
    zoom(event.deltaY);
  };

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
