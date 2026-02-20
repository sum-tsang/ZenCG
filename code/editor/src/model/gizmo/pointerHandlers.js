import * as THREE from "three";
// Sets ray from client
function setRayFromClient(gizmo, clientX, clientY, camera, container) {
  const rect = container.getBoundingClientRect();
  gizmo.mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  gizmo.mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  gizmo.raycaster.setFromCamera(gizmo.mouse, camera);
  return rect;
}
// Handles reset handle opacity
function resetHandleOpacity(gizmo, object) {
  if (!object?.material) return;

  const baseOpacity = object.userData?.baseOpacity;
  if (typeof baseOpacity === "number") {
    object.material.opacity = baseOpacity;
    return;
  }

  const defaultOpacity =
    object.userData.handleType === "scale"
      ? gizmo.mode === "scale"
        ? 0.9
        : 0
      : gizmo.mode === "rotate"
        ? 0.5
        : 0.15;
  object.material.opacity = defaultOpacity;
}
// Handles emit transform
function emitTransform(gizmo) {
  if (!gizmo.listeners.onTransform || !gizmo.object) return;
  gizmo.listeners.onTransform({
    position: gizmo.object.position.clone(),
    rotation: gizmo.object.rotation.clone(),
    scale: gizmo.object.scale.clone(),
  });
}
// Handles sync gizmo during scale
function syncGizmoDuringScale(gizmo) {
  const worldPos = new THREE.Vector3();
  const worldQuat = new THREE.Quaternion();
  gizmo.object.getWorldPosition(worldPos);
  gizmo.object.getWorldQuaternion(worldQuat);
  gizmo.gizmoGroup.position.copy(worldPos);
  gizmo.gizmoGroup.quaternion.copy(worldQuat);
}
// Handles highlight under mouse
export function highlightUnderMouse(gizmo, event, camera, container) {
  if (!container) return;

  setRayFromClient(gizmo, event.clientX, event.clientY, camera, container);
  const interactive = gizmo.getInteractiveObjects();
  const intersects = gizmo.raycaster.intersectObjects(interactive, true);

  if (!intersects.length) {
    container.style.cursor = "auto";
    if (gizmo.highlightedObject) {
      resetHandleOpacity(gizmo, gizmo.highlightedObject);
      gizmo.highlightedObject = null;
    }
    return;
  }

  const hit = intersects[0].object;
  const resolved = gizmo.resolveHitData(hit);
  const type = resolved.handleType || gizmo.mode;

  if (type === "scale") {
    container.style.cursor = "ew-resize";
  } else if (type === "rotate") {
    container.style.cursor = "grab";
  } else {
    container.style.cursor = "move";
  }

  if (resolved.isHitZone) {
    if (gizmo.highlightedObject) {
      resetHandleOpacity(gizmo, gizmo.highlightedObject);
      gizmo.highlightedObject = null;
    }
    return;
  }

  if (gizmo.highlightedObject && gizmo.highlightedObject !== hit) {
    resetHandleOpacity(gizmo, gizmo.highlightedObject);
  }

  if (hit.material) {
    hit.material.opacity = 1.0;
  }
  gizmo.highlightedObject = hit;
}
// Gets hit info
export function getHitInfo(gizmo, event, camera, container) {
  if (!container) return null;

  setRayFromClient(gizmo, event.clientX, event.clientY, camera, container);
  const interactive = gizmo.getInteractiveObjects();
  const intersects = gizmo.raycaster.intersectObjects(interactive, true);

  if (!intersects.length) return null;

  const hit = intersects[0];
  const resolved = gizmo.resolveHitData(hit.object);
  return { hit, resolved };
}
// Handles on mouse down
export function onMouseDown(gizmo, event, camera, container) {
  if (event.button !== 2) return false;
  if (!gizmo.object) return false;

  gizmo.updatePointerClient(event);
  setRayFromClient(gizmo, event.clientX, event.clientY, camera, container);

  const interactiveObjects = gizmo.getInteractiveObjects();
  const intersects = gizmo.raycaster.intersectObjects(interactiveObjects, true);

  if (!intersects.length) return false;

  const hit = intersects[0].object;
  const resolved = gizmo.resolveHitData(hit);
  if (!resolved.axis) return false;

  return gizmo.beginAxisDrag({
    axis: resolved.axis,
    handleType: resolved.handleType,
    scaleDirection: resolved.scaleDirection || 1,
    camera,
    container,
    clientX: event.clientX,
    clientY: event.clientY,
    dragSource: "mouse",
  });
}
// Handles on mouse move
export function onMouseMove(gizmo, event, camera, container) {
  gizmo.updatePointerClient(event);
  if (!gizmo.isDragging || !gizmo.object || !gizmo.axis) return;

  if (event.buttons !== undefined && gizmo.dragSource !== "keyboard") {
    const rightDown = (event.buttons & 2) !== 0;
    if (!rightDown) {
      gizmo.onMouseUp();
      return;
    }
  }

  setRayFromClient(gizmo, event.clientX, event.clientY, camera, container);

  let didUpdateDragPoint = false;
  if (gizmo.mode === "translate") {
    gizmo.handleTranslate(gizmo.raycaster.ray);
  } else {
    gizmo.raycaster.ray.intersectPlane(gizmo.dragPlane, gizmo.dragPoint);
    didUpdateDragPoint = true;

    if (gizmo.handleType === "scale" || gizmo.mode === "scale") {
      gizmo.handleScale(event);
    } else if (gizmo.handleType === "rotate" || gizmo.mode === "rotate") {
      gizmo.handleRotate();
    }
  }

  if (didUpdateDragPoint) {
    gizmo.lastDragPoint.copy(gizmo.dragPoint);
  }

  const isScaleDrag = gizmo.handleType === "scale" || gizmo.mode === "scale";
  if (isScaleDrag) {
    syncGizmoDuringScale(gizmo);
  } else {
    gizmo.updateGizmoPosition();
  }

  if (!isScaleDrag) {
    emitTransform(gizmo);
  }
}
// Handles on mouse up
export function onMouseUp(gizmo) {
  if (!gizmo.isDragging) return;

  const isScaleDrag = gizmo.handleType === "scale" || gizmo.mode === "scale";
  if (isScaleDrag) {
    emitTransform(gizmo);
    gizmo.updateGizmoPosition();
  }

  gizmo.isDragging = false;
  gizmo.axis = null;
  gizmo.handleType = null;
  gizmo.dragButton = null;
  gizmo.dragSource = null;
}
// Handles cancel keyboard drag
export function cancelKeyboardDrag(gizmo) {
  if (!gizmo.isKeyboardDragging() || !gizmo.object) return false;

  gizmo.object.position.copy(gizmo.initialPosition);
  gizmo.object.rotation.copy(gizmo.initialRotation);
  gizmo.object.scale.copy(gizmo.initialScale);
  gizmo.updateGizmoPosition();
  emitTransform(gizmo);

  gizmo.onMouseUp();
  return true;
}
