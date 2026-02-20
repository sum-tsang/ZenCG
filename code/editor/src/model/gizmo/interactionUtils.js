import * as THREE from "three";
// Gets interactive objects
export function getInteractiveObjects(gizmo) {
  if (gizmo.mode === "scale") {
    return gizmo.gizmoGroup.children.filter(
      (child) => child.userData && child.userData.handleType === "scale"
    );
  }
  if (gizmo.mode === "rotate") {
    return gizmo.gizmoGroup.children.filter(
      (child) => child.userData && child.userData.handleType === "rotate"
    );
  }
  return gizmo.gizmoGroup.children.filter(
    (child) => child.userData && child.userData.isGizmoAxis && !child.userData.handleType
  );
}
// Handles resolve hit data
export function resolveHitData(object) {
  let current = object;
  let axis = null;
  let handleType = null;
  let isHitZone = false;
  let scaleDirection = 1;

  while (current) {
    if (axis === null && current.userData?.axis) axis = current.userData.axis;
    if (handleType === null && current.userData?.handleType) handleType = current.userData.handleType;
    if (current.userData?.scaleDirection !== undefined) scaleDirection = current.userData.scaleDirection;
    if (current.userData?.isHitZone) isHitZone = true;
    current = current.parent;
  }

  return { axis, handleType, isHitZone, scaleDirection };
}
// Updates pointer client
export function updatePointerClient(gizmo, event) {
  if (!event) return;
  if (!Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return;
  gizmo.lastPointerClient = { x: event.clientX, y: event.clientY };
}
// Handles resolve pointer client
export function resolvePointerClient(gizmo, container, pointer = null) {
  if (pointer && Number.isFinite(pointer.x) && Number.isFinite(pointer.y)) {
    return pointer;
  }
  if (
    gizmo.lastPointerClient &&
    Number.isFinite(gizmo.lastPointerClient.x) &&
    Number.isFinite(gizmo.lastPointerClient.y)
  ) {
    return gizmo.lastPointerClient;
  }
  const rect = container.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}
// Gets axis ray parameter
export function getAxisRayParameter(ray, axisOrigin, axisDirection) {
  const r = new THREE.Vector3().subVectors(axisOrigin, ray.origin);
  const a = axisDirection.dot(axisDirection);
  const e = ray.direction.dot(ray.direction);
  const b = axisDirection.dot(ray.direction);
  const c = axisDirection.dot(r);
  const f = ray.direction.dot(r);
  const denom = a * e - b * b;

  if (Math.abs(denom) < 1e-6) {
    return -c / a;
  }
  return (b * f - c * e) / denom;
}
// Handles world to screen
export function worldToScreen(worldPos, camera, rect) {
  const ndc = worldPos.clone().project(camera);
  return new THREE.Vector2(
    (ndc.x + 1) * 0.5 * rect.width,
    (1 - (ndc.y + 1) * 0.5) * rect.height
  );
}
// Gets axis vector
export function getAxisVector(axis) {
  switch (axis) {
    case "x":
      return new THREE.Vector3(1, 0, 0);
    case "y":
      return new THREE.Vector3(0, 1, 0);
    case "z":
      return new THREE.Vector3(0, 0, 1);
    default:
      return new THREE.Vector3(0, 0, 0);
  }
}
// Sets scale axis screen dir
export function setScaleAxisScreenDir(gizmo, camera, container) {
  if (!gizmo.object || !camera || !container) {
    gizmo.scaleAxisScreenDir.set(0, 0);
    return;
  }

  const rect = container.getBoundingClientRect();
  const worldPos = new THREE.Vector3();
  gizmo.object.getWorldPosition(worldPos);

  const axisWorld = getAxisVector(gizmo.axis)
    .clone()
    .applyQuaternion(gizmo.gizmoGroup.quaternion)
    .normalize();

  const axisDistance = gizmo.axisLength * gizmo.gizmoGroup.scale.x;
  const worldTip = worldPos.clone().add(axisWorld.multiplyScalar(axisDistance));
  const screenOrigin = worldToScreen(worldPos, camera, rect);
  const screenTip = worldToScreen(worldTip, camera, rect);

  gizmo.scaleAxisScreenDir.copy(screenTip).sub(screenOrigin);
  if (gizmo.scaleAxisScreenDir.lengthSq() < 1e-4) {
    gizmo.scaleAxisScreenDir.set(0, 0);
    return;
  }
  gizmo.scaleAxisScreenDir.normalize();
}
