import * as THREE from "three";
// Handles add rotation rings
export function addRotationRings(gizmo) {
  const ringRadius = 5.2;
  const ringThickness = 0.16;
  const ringDefs = [
    { axis: "x", color: 0xff0000, normal: new THREE.Vector3(1, 0, 0) },
    { axis: "y", color: 0x00ff00, normal: new THREE.Vector3(0, 1, 0) },
    { axis: "z", color: 0x0000ff, normal: new THREE.Vector3(0, 0, 1) },
  ];

  const baseNormal = new THREE.Vector3(0, 0, 1);
  ringDefs.forEach(({ axis, color, normal }) => {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(ringRadius, ringThickness, 8, 64),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
      })
    );
    ring.quaternion.setFromUnitVectors(baseNormal, normal);
    ring.userData.axis = axis;
    ring.userData.isRotationRing = true;
    ring.userData.isGizmoAxis = true;
    ring.userData.handleType = "rotate";
    ring.userData.baseOpacity = 0.5;
    ring.visible = gizmo.mode === "rotate";
    ring.renderOrder = 2;
    ring.material.depthTest = false;
    gizmo.gizmoGroup.add(ring);
  });
}
// Handles initialize axes
export function initializeAxes(gizmo) {
  const axisLength = gizmo.axisLength;
  const shaftRadius = 0.14;
  const arrowHeadLength = 1.4;
  const headRadius = 0.38;
  const shaftLength = axisLength - arrowHeadLength * 0.6;

  const colors = {
    x: 0xff0000,
    y: 0x00ff00,
    z: 0x0000ff,
  };
  const directions = {
    x: new THREE.Vector3(1, 0, 0),
    y: new THREE.Vector3(0, 1, 0),
    z: new THREE.Vector3(0, 0, 1),
  };

  Object.entries(colors).forEach(([axis, color]) => {
    const direction = directions[axis];
    const arrowGroup = new THREE.Group();
    arrowGroup.name = `axis-${axis}`;
    arrowGroup.userData.axis = axis;
    arrowGroup.userData.isGizmoAxis = true;
    arrowGroup.userData.isArrowGroup = true;

    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(shaftRadius, shaftRadius, shaftLength, 16),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 })
    );
    shaft.position.y = shaftLength / 2;
    shaft.userData.axis = axis;
    shaft.userData.isGizmoAxis = true;
    shaft.userData.isArrowVisual = true;
    shaft.userData.baseOpacity = 0.9;
    shaft.material.depthTest = false;
    shaft.renderOrder = 2;

    const head = new THREE.Mesh(
      new THREE.ConeGeometry(headRadius, arrowHeadLength, 18),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 })
    );
    head.position.y = shaftLength + arrowHeadLength / 2;
    head.userData.axis = axis;
    head.userData.isGizmoAxis = true;
    head.userData.isArrowVisual = true;
    head.userData.baseOpacity = 0.95;
    head.material.depthTest = false;
    head.renderOrder = 2;

    arrowGroup.add(shaft, head);
    arrowGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
    arrowGroup.renderOrder = 2;

    gizmo.gizmoGroup.add(arrowGroup);
    gizmo.axes[axis] = arrowGroup;

    const cylinder = new THREE.Mesh(
      new THREE.CylinderGeometry(0.9, 0.9, axisLength * 1.4, 16),
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
      })
    );
    cylinder.userData.axis = axis;
    cylinder.userData.isGizmoAxis = true;
    cylinder.userData.isHitZone = true;
    cylinder.renderOrder = 1;
    if (axis === "x") {
      cylinder.rotation.z = Math.PI / 2;
    } else if (axis === "z") {
      cylinder.rotation.x = Math.PI / 2;
    }
    gizmo.gizmoGroup.add(cylinder);
    // Handles add scale handle
    const addScaleHandle = (directionSign) => {
      const scaleHandle = new THREE.Mesh(
        new THREE.BoxGeometry(0.75, 0.75, 0.75),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8 })
      );
      scaleHandle.position.copy(direction).multiplyScalar((axisLength + 0.7) * directionSign);
      scaleHandle.userData.axis = axis;
      scaleHandle.userData.isGizmoAxis = true;
      scaleHandle.userData.handleType = "scale";
      scaleHandle.userData.scaleDirection = directionSign;
      scaleHandle.userData.baseOpacity = 0.8;
      scaleHandle.renderOrder = 2;
      scaleHandle.material.depthTest = false;
      gizmo.gizmoGroup.add(scaleHandle);
    };

    addScaleHandle(1);
    addScaleHandle(-1);
  });

  addRotationRings(gizmo);
}
