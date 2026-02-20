import * as THREE from "three";
// Handles translate
export function handleTranslate(gizmo, ray) {
  if (!ray) return;
  if (gizmo.dragAxisWorld.lengthSq() === 0) return;

  const t = gizmo.getAxisRayParameter(ray, gizmo.dragAxisOriginWorld, gizmo.dragAxisWorld);
  if (!Number.isFinite(t)) return;

  const delta = gizmo.dragAxisWorld.clone().multiplyScalar(t - gizmo.dragAxisStartT);
  const worldPos = gizmo.dragAxisOriginWorld.clone().add(delta);

  if (gizmo.object.parent) gizmo.object.parent.updateMatrixWorld(true);
  if (gizmo.object.parent) gizmo.object.parent.worldToLocal(worldPos);
  gizmo.object.position.copy(worldPos);
}
// Handles rotate
export function handleRotate(gizmo) {
  if (gizmo.rotationStartVector.lengthSq() === 0) return;

  const axis = gizmo.rotationAxisWorld.clone().normalize();
  const currentVector = gizmo.dragPoint
    .clone()
    .sub(gizmo.rotationCenterWorld)
    .projectOnPlane(axis)
    .normalize();
  if (currentVector.lengthSq() === 0) return;

  const cross = new THREE.Vector3().crossVectors(gizmo.rotationStartVector, currentVector);
  const dot = THREE.MathUtils.clamp(gizmo.rotationStartVector.dot(currentVector), -1, 1);
  const angle = Math.atan2(axis.dot(cross), dot);

  const deltaQuat = new THREE.Quaternion().setFromAxisAngle(axis, angle);
  const newWorldQuat = deltaQuat.multiply(gizmo.rotationStartWorldQuat.clone());
  const parentInv = gizmo.rotationParentWorldQuat.clone().invert();
  const newLocalQuat = parentInv.multiply(newWorldQuat);
  gizmo.object.quaternion.copy(newLocalQuat);
}
// Handles scale
export function handleScale(gizmo, event) {
  const axisDistance = gizmo.axisLength * gizmo.gizmoGroup.scale.x;
  let factor = 1;

  if (
    gizmo.scaleAxisWorld.lengthSq() > 0 &&
    Number.isFinite(gizmo.scaleAxisLastT) &&
    axisDistance > 1e-6
  ) {
    const currentT = gizmo.getAxisRayParameter(
      gizmo.raycaster.ray,
      gizmo.scaleAxisOriginWorld,
      gizmo.scaleAxisWorld
    );
    if (Number.isFinite(currentT)) {
      const deltaT = currentT - gizmo.scaleAxisLastT;
      const normalized = deltaT / axisDistance;
      const rawFactor = Math.exp(normalized * 1.0);
      factor = Math.min(4, Math.max(0.25, rawFactor));
      gizmo.scaleAxisLastT = currentT;
    }
  }

  if (factor === 1) {
    const sensitivity = 0.003;
    const dx = event.clientX - gizmo.lastMouseScreenX;
    const dy = event.clientY - gizmo.lastMouseScreenY;

    let delta = -dy;
    if (gizmo.scaleAxisScreenDir.lengthSq() > 0) {
      delta = dx * gizmo.scaleAxisScreenDir.x + dy * gizmo.scaleAxisScreenDir.y;
    }

    const rawFactor = Math.exp(delta * sensitivity);
    factor = Math.min(4, Math.max(0.25, rawFactor));
  }

  const scale = gizmo.object.scale.clone();

  if (event.shiftKey) {
    scale.multiplyScalar(factor);
    scale.x = Math.max(0.01, scale.x);
    scale.y = Math.max(0.01, scale.y);
    scale.z = Math.max(0.01, scale.z);
  } else if (gizmo.axis === "x") {
    scale.x = Math.max(0.01, scale.x * factor);
  } else if (gizmo.axis === "y") {
    scale.y = Math.max(0.01, scale.y * factor);
  } else if (gizmo.axis === "z") {
    scale.z = Math.max(0.01, scale.z * factor);
  } else {
    scale.multiplyScalar(factor);
    scale.x = Math.max(0.01, scale.x);
    scale.y = Math.max(0.01, scale.y);
    scale.z = Math.max(0.01, scale.z);
  }

  gizmo.object.scale.copy(scale);
  gizmo.lastMouseScreenX = event.clientX;
  gizmo.lastMouseScreenY = event.clientY;
}
