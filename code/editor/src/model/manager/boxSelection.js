import * as THREE from "three";
import { splitMeshByBox } from "../split/splitMeshByBox.js";
// Updates split button content
function updateSplitButtonContent(button, label, hint = "") {
  if (!button) return;
  const labelEl = button.querySelector(".split-label");
  const hintEl = button.querySelector(".split-hint");
  if (labelEl) {
    labelEl.textContent = label;
  }
  if (hintEl) {
    hintEl.textContent = hint;
  }
  if (!labelEl && !hintEl) {
    button.textContent = hint ? `${label} (${hint})` : label;
  }
}
// Gets selection button elements
function getSelectionButtonElements(manager) {
  return {
    button: manager.panel.container.querySelector(".split-btn"),
    cancelButton: manager.panel.container.querySelector(".cancel-split-btn"),
  };
}
// Sets selection button state
function setSelectionButtonState(manager, { label, hint = "", showCancel = false }) {
  const { button, cancelButton } = getSelectionButtonElements(manager);
  updateSplitButtonContent(button, label, hint);
  if (cancelButton) {
    cancelButton.style.display = showCancel ? "inline-block" : "none";
  }
  manager.panel.setCombineEnabled(!manager.boxSelecting && manager.selectedObjects.length > 1);
}
// Gets box handle size
export function getBoxHandleSize(boxMesh) {
  if (!boxMesh?.userData?.boxMin || !boxMesh?.userData?.boxMax) return 0.1;
  const boxSize = new THREE.Vector3().subVectors(
    boxMesh.userData.boxMax,
    boxMesh.userData.boxMin
  );
  const shortestAxis = Math.max(0.01, Math.min(boxSize.x, boxSize.y, boxSize.z));
  return THREE.MathUtils.clamp(shortestAxis * 0.12, 0.06, 0.16);
}
// Updates box handle positions
export function updateBoxHandlePositions(manager, boxMesh, handles) {
  if (!boxMesh || !handles) return;

  const min = boxMesh.userData.boxMin;
  const max = boxMesh.userData.boxMax;
  const center = new THREE.Vector3().addVectors(min, max).multiplyScalar(0.5);
  const handleSize = getBoxHandleSize(boxMesh);

  handles.forEach((handle) => {
    const axis = handle.userData.axis;
    const dir = handle.userData.direction;
    const pos = center.clone();

    if (axis === "x") {
      pos.x = dir > 0 ? max.x : min.x;
    } else if (axis === "y") {
      pos.y = dir > 0 ? max.y : min.y;
    } else if (axis === "z") {
      pos.z = dir > 0 ? max.z : min.z;
    }

    handle.position.copy(pos);
    handle.scale.setScalar(handleSize);
  });
}
// Creates box handles
export function createBoxHandles(manager, boxMesh) {
  const handles = [];
  const handleGeom = new THREE.BoxGeometry(1, 1, 1);
  const faces = [
    { axis: "x", dir: 1, color: 0xff4444 },
    { axis: "x", dir: -1, color: 0xff4444 },
    { axis: "y", dir: 1, color: 0x44ff44 },
    { axis: "y", dir: -1, color: 0x44ff44 },
    { axis: "z", dir: 1, color: 0x4444ff },
    { axis: "z", dir: -1, color: 0x4444ff },
  ];

  faces.forEach((face) => {
    const handle = new THREE.Mesh(
      handleGeom.clone(),
      new THREE.MeshBasicMaterial({
        color: face.color,
        transparent: true,
        opacity: 0.9,
        depthTest: false,
      })
    );
    handle.scale.setScalar(getBoxHandleSize(boxMesh));
    handle.name = `BoxHandle_${face.axis}_${face.dir > 0 ? "pos" : "neg"}`;
    handle.userData.axis = face.axis;
    handle.userData.direction = face.dir;
    handle.userData.isBoxHandle = true;
    handle.renderOrder = 1000;
    manager.scene.add(handle);
    handles.push(handle);
  });

  updateBoxHandlePositions(manager, boxMesh, handles);
  return handles;
}
// Handles rebuild box mesh
export function rebuildBoxMesh(manager) {
  if (!manager.boxMesh) return;

  const min = manager.boxMesh.userData.boxMin;
  const max = manager.boxMesh.userData.boxMax;
  const size = new THREE.Vector3().subVectors(max, min);
  const center = new THREE.Vector3().addVectors(min, max).multiplyScalar(0.5);

  manager.boxMesh.geometry.dispose();
  manager.boxMesh.geometry = new THREE.BoxGeometry(
    Math.max(0.01, size.x),
    Math.max(0.01, size.y),
    Math.max(0.01, size.z)
  );
  manager.boxMesh.position.copy(center);

  if (manager.boxHelper) {
    manager.boxHelper.update();
  }
  updateBoxHandlePositions(manager, manager.boxMesh, manager.boxHandles);
}
// Handles remove box handles
export function removeBoxHandles(manager) {
  if (!manager.boxHandles) return;
  manager.boxHandles.forEach((handle) => {
    manager.scene.remove(handle);
    handle.geometry.dispose();
    handle.material.dispose();
  });
  manager.boxHandles = null;
}
// Handles start box selection
export function startBoxSelection(manager) {
  if (!manager.selectedObject) return;

  const box = new THREE.Box3().setFromObject(manager.selectedObject);
  const size = new THREE.Vector3();
  box.getSize(size);
  const center = new THREE.Vector3();
  box.getCenter(center);

  const boxMesh = new THREE.Mesh(
    new THREE.BoxGeometry(size.x || 1, size.y || 1, size.z || 1),
    new THREE.MeshBasicMaterial({
      color: 0xffff00,
      transparent: true,
      opacity: 0.12,
      depthTest: false,
    })
  );
  boxMesh.name = "SelectionBox";
  boxMesh.position.copy(center);
  boxMesh.userData.boxMin = center.clone().sub(size.clone().multiplyScalar(0.5));
  boxMesh.userData.boxMax = center.clone().add(size.clone().multiplyScalar(0.5));
  manager.scene.add(boxMesh);

  const helper = new THREE.BoxHelper(boxMesh, 0xffdd00);
  manager.scene.add(helper);

  manager.boxHandles = createBoxHandles(manager, boxMesh);
  manager.boxMesh = boxMesh;
  manager.boxHelper = helper;
  manager.boxSelecting = true;
  manager.gizmo.hide();
  setSelectionButtonState(manager, {
    label: "Confirm Component",
    showCancel: true,
  });
}
// Handles cleanup box selection artifacts
function cleanupBoxSelectionArtifacts(manager) {
  removeBoxHandles(manager);
  if (manager.boxMesh) {
    manager.scene.remove(manager.boxMesh);
    manager.boxMesh.geometry.dispose();
    manager.boxMesh.material.dispose();
    manager.boxMesh = null;
  }
  if (manager.boxHelper) {
    manager.scene.remove(manager.boxHelper);
    manager.boxHelper = null;
  }
  manager.boxSelecting = false;
}
// Handles confirm box selection
export function confirmBoxSelection(manager) {
  if (!manager.boxMesh || !manager.selectedObject) return;

  const box = new THREE.Box3(
    manager.boxMesh.userData.boxMin.clone(),
    manager.boxMesh.userData.boxMax.clone()
  );
  const targetParent =
    manager.selectableRoot || manager.selectedObject.parent || manager.scene;
  const parts = splitMeshByBox(manager.selectedObject, box, targetParent);

  cleanupBoxSelectionArtifacts(manager);

  if (parts?.inside) {
    parts.inside.updateMatrixWorld(true);
    if (parts.outside) parts.outside.updateMatrixWorld(true);
    if (manager.onSplit) {
      manager.onSplit({
        original: manager.selectedObject,
        inside: parts.inside,
        outside: parts.outside,
      });
    }

    manager.selectObject(parts.inside);
    manager.recordSnapshot("split");
  } else {
    manager.gizmo.setObject(manager.selectedObject);
    manager.gizmo.show();
    manager.panel.setObject(manager.selectedObject);
    alert("Split failed: make sure the selection box covers only part of the mesh.");
  }

  setSelectionButtonState(manager, {
    label: "Create Component",
    hint: "click mesh",
    showCancel: false,
  });
}
// Handles cancel box selection
export function cancelBoxSelection(manager) {
  if (!manager.boxSelecting) return;
  cleanupBoxSelectionArtifacts(manager);
  setSelectionButtonState(manager, {
    label: "Create Component",
    hint: "click mesh",
    showCancel: false,
  });

  if (manager.selectedObject) {
    manager.gizmo.setObject(manager.selectedObject);
    manager.gizmo.show();
  } else {
    manager.gizmo.hide();
  }
}
// Handles box selection pointer down
export function handleBoxSelectionPointerDown(manager, event) {
  if (!manager.boxSelecting) return false;
  if (event.button !== 2) return true;

  event.preventDefault();
  const rect = manager.canvas.getBoundingClientRect();
  manager.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  manager.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  manager.raycaster.setFromCamera(manager.mouse, manager.camera);

  if (manager.boxHandles?.length) {
    const handleHits = manager.raycaster.intersectObjects(manager.boxHandles);
    if (handleHits.length > 0) {
      const hit = handleHits[0];
      manager.draggingBoxHandle = hit.object;
      manager.boxHandleDragStart = hit.point.clone();
      manager.boxHandleLastPoint = hit.point.clone();

      const cameraDir = new THREE.Vector3();
      manager.camera.getWorldDirection(cameraDir);
      manager.boxHandleDragPlane = new THREE.Plane();
      manager.boxHandleDragPlane.setFromNormalAndCoplanarPoint(cameraDir, hit.point);
      event.stopImmediatePropagation();
    }
  }

  return true;
}
// Handles swap if inverted
function swapIfInverted(min, max, key) {
  if (min[key] <= max[key]) return;
  const tmp = min[key];
  min[key] = max[key];
  max[key] = tmp;
}
// Handles box selection pointer move
export function handleBoxSelectionPointerMove(manager, event) {
  if (!(manager.draggingBoxHandle && manager.boxMesh && manager.boxHandleDragPlane)) {
    return false;
  }

  const rect = manager.canvas.getBoundingClientRect();
  manager.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  manager.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  manager.raycaster.setFromCamera(manager.mouse, manager.camera);

  const intersectPoint = manager.boxDragIntersectPoint;
  if (!manager.raycaster.ray.intersectPlane(manager.boxHandleDragPlane, intersectPoint)) {
    return true;
  }

  const axis = manager.draggingBoxHandle.userData.axis;
  const dir = manager.draggingBoxHandle.userData.direction;
  const delta = manager.boxDragDelta.subVectors(intersectPoint, manager.boxHandleLastPoint);
  const axisDelta = axis === "x" ? delta.x : axis === "y" ? delta.y : delta.z;
  const { boxMin: min, boxMax: max } = manager.boxMesh.userData;

  if (dir > 0) {
    max[axis] += axisDelta;
  } else {
    min[axis] += axisDelta;
  }

  swapIfInverted(min, max, "x");
  swapIfInverted(min, max, "y");
  swapIfInverted(min, max, "z");

  rebuildBoxMesh(manager);
  manager.boxHandleLastPoint.copy(intersectPoint);
  return true;
}
