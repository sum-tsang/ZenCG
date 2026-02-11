// Transform manager orchestration.
import { TransformationGizmo } from "./gizmo.js";
import { TransformationPanel } from "./panel.js";
import * as THREE from "three";
import { splitMeshByBox } from "../modelComponents/splitMeshByBox.js";
import { combineModels } from "../modelCombination/combineModels.js";
import {
  UndoHistory,
  applyTransformSnapshot,
  createTransformSnapshot,
} from "./undo.js";
import { ActionHistory } from "./actionHistory.js";

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

/**
 * TransformationManager - Orchestrates the 3D gizmo and UI panel
 * Handles real-time synchronization between gizmo interactions and numerical inputs
 */
export class TransformationManager {
  // Initialize manager state, gizmo, and panel wiring.
  constructor(scene, canvasElement, panelContainerId, options = {}) {
    this.scene = scene;
    this.canvas = canvasElement;
    this.currentObject = null;
    this.camera = null;
    this.selectedObject = null;
    this.selectedObjects = [];
    this.undoHistory = new UndoHistory();
    this.actionHistory = new ActionHistory({ limit: options.actionHistoryLimit });
    this.initializedObjects = new WeakSet();
    this.initialSnapshots = new WeakMap();
    this.wasDraggingGizmo = false;
    this.lastPointerClient = null;
    this.transformListeners = new Set();
    this.selectableRoot = options.selectableRoot ?? null;
    this.resolveSelection =
      typeof options.resolveSelection === "function" ? options.resolveSelection : null;
    this.onSelectionChange =
      typeof options.onSelectionChange === "function" ? options.onSelectionChange : null;
    this.onMultiSelectionChange =
      typeof options.onMultiSelectionChange === "function"
        ? options.onMultiSelectionChange
        : null;
    this.onSplit =
      typeof options.onSplit === "function" ? options.onSplit : null;
    this.onCombine =
      typeof options.onCombine === "function" ? options.onCombine : null;
    this.onHistoryChange =
      typeof options.onHistoryChange === "function" ? options.onHistoryChange : null;
    this.onToolStateChange =
      typeof options.onToolStateChange === "function" ? options.onToolStateChange : null;

    if (Array.isArray(options.initialHistory)) {
      this.actionHistory.setEntries(options.initialHistory);
    }

    // Initialize gizmo and panel
    this.gizmo = new TransformationGizmo(scene);
    this.panel = new TransformationPanel(panelContainerId);

    // Raycaster for model selection
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.boxDragIntersectPoint = new THREE.Vector3();
    this.boxDragDelta = new THREE.Vector3();

    // Wire up connections
    this.gizmo.onTransform((transform) => {
      this.panel.updateFromGizmo(transform);
      this.emitTransform({ ...transform, source: "gizmo" });
    });
    // Apply transforms either to the selected object or to the active selection box
    this.panel.onTransform((transform) => {
      const target = this.boxSelecting && this.boxMesh ? this.boxMesh : this.selectedObject;
      if (target) {
        target.position.copy(transform.position);
        if (transform.rotation instanceof THREE.Quaternion) {
          target.quaternion.copy(transform.rotation);
        } else {
          target.rotation.copy(transform.rotation);
        }
        target.scale.copy(transform.scale);
        this.gizmo.updateGizmoPosition();
        const action = transform?.commit ? transform.action || transform.mode : null;
        if (!this.boxSelecting) this.recordSnapshot(action);
      }
      this.emitTransform(transform);
    });

    // Wire split button from panel
    this.panel.onSplit(() => {
      if (this.boxSelecting) {
        // Confirm selection
        this.confirmBoxSelection();
      } else {
        this.startBoxSelection();
      }
    });

    // Wire cancel button from panel
    this.panel.onCancelSplit(() => {
      this.cancelBoxSelection();
    });

    // Wire combine button from panel
    this.panel.onCombine(() => {
      this.combineSelectedModels();
    });
    this.panel.onModeChange((mode) => {
      this.gizmo.setMode(mode);
      this.notifyToolStateChange();
    });

    // Mouse event handlers
    this.onMouseDown = this.onMouseDown.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onMouseUp = this.onMouseUp.bind(this);

    this.setupEventListeners();
    this.notifyToolStateChange();
  }

  // NOTE: split logic moved to modelComponents/splitMeshByBox.js

  // Attach pointer listeners for selection and gizmo interactions.
  setupEventListeners() {
    // Use arrow functions to ensure proper binding and capture
    const self = this;
    this.canvas.addEventListener("pointerdown", (event) => self.onMouseDown(event), false);
    document.addEventListener("pointermove", (event) => self.onMouseMove(event), false);
    document.addEventListener("pointerup", (event) => self.onMouseUp(event), false);
    // Prevent the browser context menu so drag interactions aren't interrupted.
    this.canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  // Return ray intersections for selectable scene content.
  getSelectableIntersections() {
    if (this.selectableRoot) {
      return this.raycaster.intersectObject(this.selectableRoot, true);
    }

    const roots = [];
    this.scene.children.forEach((child) => {
      if (!child) return;
      if (child.name === "TransformationGizmo") return;
      roots.push(child);
    });

    if (!roots.length) return [];
    return this.raycaster.intersectObjects(roots, true);
  }

  // Resolve the first valid selectable mesh hit.
  resolveSelectableHit(intersections) {
    if (!Array.isArray(intersections) || intersections.length === 0) return null;

    for (let index = 0; index < intersections.length; index += 1) {
      const hit = intersections[index];
      const hitObject = hit?.object;
      if (!(hitObject instanceof THREE.Mesh)) continue;
      if (
        hitObject.name === "TransformationGizmo" ||
        hitObject.parent?.name?.includes("TransformationGizmo")
      ) {
        continue;
      }

      const resolved = this.resolveSelection ? this.resolveSelection(hitObject) : hitObject;
      if (!resolved) continue;
      return { hit, hitObject, resolved };
    }

    return null;
  }

  // Start a box selection workflow for component splitting.
  startBoxSelection() {
    if (!this.selectedObject) return;
    // Create box that matches selected object's bounds
    const box = new THREE.Box3().setFromObject(this.selectedObject);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);

    const geom = new THREE.BoxGeometry(size.x || 1, size.y || 1, size.z || 1);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffff00,
      transparent: true,
      opacity: 0.12,
      depthTest: false,
    });
    const boxMesh = new THREE.Mesh(geom, mat);
    boxMesh.name = "SelectionBox";
    boxMesh.position.copy(center);
    // Store the current box bounds for asymmetric resizing
    boxMesh.userData.boxMin = center.clone().sub(size.clone().multiplyScalar(0.5));
    boxMesh.userData.boxMax = center.clone().add(size.clone().multiplyScalar(0.5));
    // Attach to scene root so world transforms are simple
    this.scene.add(boxMesh);

    // Outline helper
    const helper = new THREE.BoxHelper(boxMesh, 0xffdd00);
    this.scene.add(helper);

    // Create drag handles for asymmetric resizing (6 faces)
    this.boxHandles = this.createBoxHandles(boxMesh);

    this.boxMesh = boxMesh;
    this.boxHelper = helper;
    this.boxSelecting = true;

    // Hide the regular gizmo during box selection
    this.gizmo.hide();

    // Hide mode buttons and show only split controls
    const modeButtons = this.panel.container.querySelector('.mode-buttons');
    if (modeButtons) modeButtons.style.display = 'none';

    // Update panel buttons for box selection mode
    const btn = this.panel.container.querySelector('.split-btn');
    const cancelBtn = this.panel.container.querySelector('.cancel-split-btn');
    updateSplitButtonContent(btn, 'Confirm Component');
    if (cancelBtn) cancelBtn.style.display = 'inline-block';
    this.panel.setCombineEnabled(false);
  }

  // Create 6 drag handles for the selection box faces
  createBoxHandles(boxMesh) {
    const handles = [];
    const handleSize = 0.4;
    const handleGeom = new THREE.BoxGeometry(handleSize, handleSize, handleSize);
    
    // Define the 6 faces: +X, -X, +Y, -Y, +Z, -Z
    const faces = [
      { axis: 'x', dir: 1, color: 0xff4444 },   // +X (red)
      { axis: 'x', dir: -1, color: 0xff4444 },  // -X (red)
      { axis: 'y', dir: 1, color: 0x44ff44 },   // +Y (green)
      { axis: 'y', dir: -1, color: 0x44ff44 },  // -Y (green)
      { axis: 'z', dir: 1, color: 0x4444ff },   // +Z (blue)
      { axis: 'z', dir: -1, color: 0x4444ff },  // -Z (blue)
    ];

    faces.forEach(face => {
      const handleMat = new THREE.MeshBasicMaterial({ 
        color: face.color, 
        transparent: true, 
        opacity: 0.9,
        depthTest: false 
      });
      const handle = new THREE.Mesh(handleGeom.clone(), handleMat);
      handle.name = `BoxHandle_${face.axis}_${face.dir > 0 ? 'pos' : 'neg'}`;
      handle.userData.axis = face.axis;
      handle.userData.direction = face.dir;
      handle.userData.isBoxHandle = true;
      handle.renderOrder = 1000;
      this.scene.add(handle);
      handles.push(handle);
    });

    this.updateBoxHandlePositions(boxMesh, handles);
    return handles;
  }

  // Update handle positions based on box bounds
  updateBoxHandlePositions(boxMesh, handles) {
    if (!boxMesh || !handles) return;
    
    const min = boxMesh.userData.boxMin;
    const max = boxMesh.userData.boxMax;
    const center = new THREE.Vector3().addVectors(min, max).multiplyScalar(0.5);

    handles.forEach(handle => {
      const axis = handle.userData.axis;
      const dir = handle.userData.direction;
      const pos = center.clone();
      
      if (axis === 'x') {
        pos.x = dir > 0 ? max.x : min.x;
      } else if (axis === 'y') {
        pos.y = dir > 0 ? max.y : min.y;
      } else if (axis === 'z') {
        pos.z = dir > 0 ? max.z : min.z;
      }
      
      handle.position.copy(pos);
    });
  }

  // Rebuild the box mesh geometry based on current bounds
  rebuildBoxMesh() {
    if (!this.boxMesh) return;
    
    const min = this.boxMesh.userData.boxMin;
    const max = this.boxMesh.userData.boxMax;
    const size = new THREE.Vector3().subVectors(max, min);
    const center = new THREE.Vector3().addVectors(min, max).multiplyScalar(0.5);
    
    // Dispose old geometry and create new one
    this.boxMesh.geometry.dispose();
    this.boxMesh.geometry = new THREE.BoxGeometry(
      Math.max(0.01, size.x),
      Math.max(0.01, size.y),
      Math.max(0.01, size.z)
    );
    this.boxMesh.position.copy(center);
    
    // Update the outline helper
    if (this.boxHelper) {
      this.boxHelper.update();
    }
    
    // Update handle positions
    this.updateBoxHandlePositions(this.boxMesh, this.boxHandles);
  }

  // Clean up box handles
  removeBoxHandles() {
    if (this.boxHandles) {
      this.boxHandles.forEach(handle => {
        this.scene.remove(handle);
        handle.geometry.dispose();
        handle.material.dispose();
      });
      this.boxHandles = null;
    }
  }

  // Confirm box selection and split the mesh.
  confirmBoxSelection() {
    if (!this.boxMesh || !this.selectedObject) return;
    // Compute box bounds from stored min/max (more accurate than geometry)
    const box = new THREE.Box3(
      this.boxMesh.userData.boxMin.clone(),
      this.boxMesh.userData.boxMax.clone()
    );

    // Use the selectableRoot (importRoot) as parent so new meshes appear in object list
    // Fall back to the original mesh's parent if selectableRoot is not set
    const targetParent = this.selectableRoot || this.selectedObject.parent || this.scene;

    // Perform split: extract faces whose centroids are inside box
    const parts = splitMeshByBox(this.selectedObject, box, targetParent);

    // Cleanup box and handles
    this.removeBoxHandles();
    this.scene.remove(this.boxMesh);
    if (this.boxHelper) this.scene.remove(this.boxHelper);
    this.boxMesh.geometry.dispose();
    this.boxMesh.material.dispose();
    this.boxMesh = null;
    this.boxHelper = null;
    this.boxSelecting = false;

    // Restore gizmo to selected object (or the 'inside' part if split produced parts)
    if (parts && parts.inside) {
      // Ensure world matrices are current
      parts.inside.updateMatrixWorld(true);
      if (parts.outside) parts.outside.updateMatrixWorld(true);
      
      // Notify listeners about the split (for updating object list, etc.)
      if (this.onSplit) {
        this.onSplit({
          original: this.selectedObject,
          inside: parts.inside,
          outside: parts.outside,
        });
      }
      
      // Select the created inside component and update gizmo/panel
      this.selectObject(parts.inside);
      this.gizmo.setObject(parts.inside);
      this.panel.setObject(parts.inside);
      this.panel.updatePanelFromObject();
      this.gizmo.updateGizmoPosition();
      // Record the split as an action
      this.recordSnapshot('split');
      this.logAction('split');
    } else {
      // Split failed (all triangles on one side) - restore selection
      this.gizmo.setObject(this.selectedObject);
      this.gizmo.show();
      this.panel.setObject(this.selectedObject);
      alert('Split failed: make sure the selection box covers only part of the mesh.');
    }

    const btn = this.panel.container.querySelector('.split-btn');
    const cancelBtn = this.panel.container.querySelector('.cancel-split-btn');
    const modeButtons = this.panel.container.querySelector('.mode-buttons');
    updateSplitButtonContent(btn, 'Create Component', 'click mesh');
    if (cancelBtn) cancelBtn.style.display = 'none';
    if (modeButtons) modeButtons.style.display = '';
    this.panel.setCombineEnabled(!this.boxSelecting && this.selectedObjects.length > 1);
  }

  // Cancel box selection and restore gizmo state.
  cancelBoxSelection() {
    if (!this.boxSelecting) return;
    
    // Clean up handles
    this.removeBoxHandles();
    
    if (this.boxMesh) {
      this.scene.remove(this.boxMesh);
      this.boxMesh.geometry.dispose();
      this.boxMesh.material.dispose();
      this.boxMesh = null;
    }
    if (this.boxHelper) {
      this.scene.remove(this.boxHelper);
      this.boxHelper = null;
    }
    this.boxSelecting = false;
    
    const btn2 = this.panel.container.querySelector('.split-btn');
    const cancelBtn2 = this.panel.container.querySelector('.cancel-split-btn');
    const modeButtons2 = this.panel.container.querySelector('.mode-buttons');
    updateSplitButtonContent(btn2, 'Create Component', 'click mesh');
    if (cancelBtn2) cancelBtn2.style.display = 'none';
    if (modeButtons2) modeButtons2.style.display = '';
    this.panel.setCombineEnabled(!this.boxSelecting && this.selectedObjects.length > 1);
    // Restore gizmo target
    if (this.selectedObject) {
      this.gizmo.setObject(this.selectedObject);
      this.gizmo.show();
    } else {
      this.gizmo.hide();
    }
  }

  // Handle pointer down events for selection/dragging.
  onMouseDown(event) {
    if (!this.camera) return;
    this.lastPointerClient = { x: event.clientX, y: event.clientY };

    if (this.gizmo?.isKeyboardDragging?.()) {
      this.finishAxisShortcut();
    }

    // During box selection mode, only right-click (2) can drag handles
    if (this.boxSelecting) {
      if (event.button !== 2) return; // Only right-click for box handle dragging
      event.preventDefault(); // Prevent context menu
      
      const rect = this.canvas.getBoundingClientRect();
      this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      this.raycaster.setFromCamera(this.mouse, this.camera);
      
      // Check if we hit a box handle
      if (this.boxHandles && this.boxHandles.length > 0) {
        const handleHits = this.raycaster.intersectObjects(this.boxHandles);
        if (handleHits.length > 0) {
          const hitHandle = handleHits[0].object;
          this.draggingBoxHandle = hitHandle;
          this.boxHandleDragStart = handleHits[0].point.clone();
          this.boxHandleLastPoint = handleHits[0].point.clone();
          
          // Create a drag plane perpendicular to camera but containing the hit point
          const cameraDir = new THREE.Vector3();
          this.camera.getWorldDirection(cameraDir);
          this.boxHandleDragPlane = new THREE.Plane();
          this.boxHandleDragPlane.setFromNormalAndCoplanarPoint(cameraDir, handleHits[0].point);
          
          event.stopImmediatePropagation();
          return;
        }
      }
      
      return; // Block all other interactions during box selection
    }

    // Only right-click (2) for all transform/selection interactions
    if (event.button !== 2) return;
    event.preventDefault(); // Prevent context menu

    // Build selection ray first so we can prioritize real model hits over gizmo hit zones.
    this.wasDraggingGizmo = false;
    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);

    const intersects = this.getSelectableIntersections();
    const selectableHit = this.resolveSelectableHit(intersects);

    // Decide whether the gizmo should handle the click before selection.
    const gizmoHit = this.gizmo?.getHitInfo
      ? this.gizmo.getHitInfo(event, this.camera, this.canvas)
      : null;
    let allowGizmo = false;
    if (gizmoHit) {
      const isVisibleHandle = !gizmoHit.resolved.isHitZone;
      if (isVisibleHandle) {
        allowGizmo = true;
      } else if (!selectableHit) {
        allowGizmo = true;
      } else {
        const isDifferentObject = selectableHit.resolved !== this.selectedObject;
        const gizmoCloser = gizmoHit.hit.distance <= selectableHit.hit.distance - 1e-4;
        allowGizmo = gizmoCloser && !isDifferentObject;
      }
    }

    if (allowGizmo) {
      const gizmoHandled = this.gizmo.onMouseDown(event, this.camera, this.canvas);
      if (gizmoHandled) {
        this.wasDraggingGizmo = true;
        this.notifyToolStateChange();
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
    }

    let selectedObject = null;
    if (selectableHit) {
      this.toggleSelection(selectableHit.resolved);
      selectedObject = this.selectedObject;
    }

    if (!selectedObject && !this.wasDraggingGizmo) {
      if (this.selectedObject || this.selectedObjects.length > 0) {
        this.toggleSelection(null);
      }
    }

    if (selectedObject || this.wasDraggingGizmo) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }

  // Handle pointer move events for hover/drag updates.
  onMouseMove(event) {
    if (!this.camera) return;
    this.lastPointerClient = { x: event.clientX, y: event.clientY };

    // Handle box handle dragging (asymmetric resize)
    if (this.draggingBoxHandle && this.boxMesh && this.boxHandleDragPlane) {
      const rect = this.canvas.getBoundingClientRect();
      this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      this.raycaster.setFromCamera(this.mouse, this.camera);
      
      const intersectPoint = this.boxDragIntersectPoint;
      if (this.raycaster.ray.intersectPlane(this.boxHandleDragPlane, intersectPoint)) {
        const axis = this.draggingBoxHandle.userData.axis;
        const dir = this.draggingBoxHandle.userData.direction;
        
        // Calculate movement along the handle's axis
        const delta = this.boxDragDelta.subVectors(intersectPoint, this.boxHandleLastPoint);
        let axisDelta = 0;
        if (axis === 'x') axisDelta = delta.x;
        else if (axis === 'y') axisDelta = delta.y;
        else if (axis === 'z') axisDelta = delta.z;
        
        // Update the appropriate bound (min or max) based on direction
        if (dir > 0) {
          // Moving the max bound
          if (axis === 'x') this.boxMesh.userData.boxMax.x += axisDelta;
          else if (axis === 'y') this.boxMesh.userData.boxMax.y += axisDelta;
          else if (axis === 'z') this.boxMesh.userData.boxMax.z += axisDelta;
        } else {
          // Moving the min bound
          if (axis === 'x') this.boxMesh.userData.boxMin.x += axisDelta;
          else if (axis === 'y') this.boxMesh.userData.boxMin.y += axisDelta;
          else if (axis === 'z') this.boxMesh.userData.boxMin.z += axisDelta;
        }
        
        // Ensure min < max (prevent inverted box)
        const min = this.boxMesh.userData.boxMin;
        const max = this.boxMesh.userData.boxMax;
        if (min.x > max.x) { const t = min.x; min.x = max.x; max.x = t; }
        if (min.y > max.y) { const t = min.y; min.y = max.y; max.y = t; }
        if (min.z > max.z) { const t = min.z; min.z = max.z; max.z = t; }
        
        this.rebuildBoxMesh();
        this.boxHandleLastPoint.copy(intersectPoint);
      }
      return;
    }

    // If the gizmo is currently dragging, forward movement to the gizmo handler.
    if (this.gizmo.isDragging) {
      this.gizmo.onMouseMove(event, this.camera, this.canvas);
    } else {
      // Otherwise update hover highlights/cursor
      if (this.gizmo.highlightUnderMouse) {
        this.gizmo.highlightUnderMouse(event, this.camera, this.canvas);
      }
    }
  }

  // Handle pointer up events for drag completion.
  onMouseUp(event) {
    // End box handle dragging
    if (this.draggingBoxHandle) {
      this.draggingBoxHandle = null;
      this.boxHandleDragPlane = null;
      return;
    }
    
    this.gizmo.onMouseUp();
    this.notifyToolStateChange();
    if (this.wasDraggingGizmo) {
      this.recordSnapshot(this.gizmo.mode);
      this.wasDraggingGizmo = false;
    }
  }

  // Set the active object and update selection state.
  setObject(object) {
    this.currentObject = object;
    this.selectObject(object);
  }

  // Select an object and sync gizmo/panel UI.
  selectObject(object) {
    const selectionChanged = this.selectedObject !== object;
    this.selectedObject = object;
    this.selectedObjects = object ? [object] : [];
    this.syncSelectionUi(selectionChanged);
  }

  // Toggle object selection for multi-select.
  toggleSelection(object) {
    if (!object) {
      this.selectObject(null);
      return;
    }

    const previousSelected = this.selectedObject;
    const index = this.selectedObjects.indexOf(object);
    if (index === -1) {
      this.selectedObjects.push(object);
      this.selectedObject = object;
    } else {
      this.selectedObjects.splice(index, 1);
      if (this.selectedObject === object) {
        this.selectedObject = this.selectedObjects[this.selectedObjects.length - 1] ?? null;
      }
    }

    const selectionChanged = previousSelected !== this.selectedObject;
    this.syncSelectionUi(selectionChanged);
  }

  // Sync gizmo/panel UI after selection changes.
  syncSelectionUi(selectionChanged) {
    if (this.selectedObject) {
      this.gizmo.setObject(this.selectedObject);
      this.gizmo.show();
      this.panel.setObject(this.selectedObject);
      this.panel.setGizmo(this.gizmo);
      this.panel.updatePanelFromObject();
    } else {
      this.gizmo.hide();
    }

    if (selectionChanged) {
      if (this.selectedObject) {
        this.cacheInitialSnapshot(this.selectedObject);
      }
      this.notifyHistoryChange();
    }

    this.panel.setCombineEnabled(!this.boxSelecting && this.selectedObjects.length > 1);

    // Always notify of selection (for material panel, etc.)
    if (this.onSelectionChange) {
      this.onSelectionChange(this.selectedObject);
    }
    if (this.onMultiSelectionChange) {
      this.onMultiSelectionChange([...this.selectedObjects]);
    }
  }

  // Combine selected imported objects into a single group.
  combineSelectedModels() {
    if (this.boxSelecting) return false;
    if (!Array.isArray(this.selectedObjects) || this.selectedObjects.length < 2) return false;

    const targetParent = this.selectableRoot || this.selectedObjects[0]?.parent || this.scene;
    const result = combineModels(this.selectedObjects, targetParent);
    if (!result?.combined) return false;

    if (this.onCombine) {
      this.onCombine({
        combined: result.combined,
        originals: result.originals,
      });
    }

    this.selectObject(result.combined);
    this.gizmo.setObject(result.combined);
    this.panel.setObject(result.combined);
    this.panel.updatePanelFromObject();
    this.gizmo.updateGizmoPosition();
    this.recordSnapshot("combine");
    return true;
  }


  // Provide the camera for raycasting and gizmo interactions.
  setCamera(camera) {
    this.camera = camera;
    this.gizmo.setCamera(camera, this.canvas);
  }

  // Set the current gizmo mode.
  setMode(mode) {
    if (this.gizmo?.isDragging) return;
    this.panel.setMode(mode);
  }

  // Start keyboard-driven axis transform for the active mode.
  startAxisShortcut(axis) {
    if (this.boxSelecting) return false;
    if (!this.selectedObject || !this.camera) return false;
    const axisKey = typeof axis === "string" ? axis.toLowerCase() : "";
    if (!["x", "y", "z"].includes(axisKey)) return false;

    if (this.gizmo?.isKeyboardDragging?.()) {
      this.finishAxisShortcut();
    }

    const started = this.gizmo.startKeyboardAxisDrag(
      axisKey,
      this.camera,
      this.canvas,
      this.lastPointerClient
    );
    if (!started) return false;
    this.wasDraggingGizmo = true;
    this.notifyToolStateChange();
    return true;
  }

  // Commit active keyboard-driven axis transform.
  finishAxisShortcut() {
    if (!this.gizmo?.isKeyboardDragging?.()) return false;
    this.gizmo.onMouseUp();
    if (this.wasDraggingGizmo) {
      this.recordSnapshot(this.gizmo.mode);
      this.wasDraggingGizmo = false;
    }
    this.notifyToolStateChange();
    return true;
  }

  // Cancel active keyboard-driven axis transform and restore initial transform.
  cancelAxisShortcut() {
    if (!this.gizmo?.isKeyboardDragging?.()) return false;
    const canceled = this.gizmo.cancelKeyboardDrag?.();
    this.wasDraggingGizmo = false;
    this.notifyToolStateChange();
    return Boolean(canceled);
  }

  // Return current tool state for external UI indicators.
  getToolState() {
    return {
      mode: this.panel?.getCurrentMode?.() || this.gizmo?.mode || "translate",
      axis: this.gizmo?.axis || null,
    };
  }

  // Notify listeners that the visible tool state changed.
  notifyToolStateChange() {
    if (!this.onToolStateChange) return;
    this.onToolStateChange(this.getToolState());
  }

  // Reset undo history to the current object transform.
  resetUndoHistory() {
    if (!this.selectedObject) return;
    this.undoHistory.clear();
    this.actionHistory.clear();
    this.notifyHistoryChange();
    this.recordSnapshot();
    this.initializedObjects.add(this.selectedObject);
    this.initialSnapshots.delete(this.selectedObject);
  }

  // Record a transform snapshot for undo/history.
  recordSnapshot(action) {
    if (!this.selectedObject) return;
    if (!this.initializedObjects.has(this.selectedObject)) {
      const initial = this.initialSnapshots.get(this.selectedObject);
      if (initial) {
        this.undoHistory.record(initial);
      }
      this.initializedObjects.add(this.selectedObject);
      this.initialSnapshots.delete(this.selectedObject);
    }
    const snapshot = createTransformSnapshot(this.selectedObject);
    const recorded = this.undoHistory.record(snapshot);
    if (recorded && action) {
      this.logAction(action);
    }
  }

  // Undo the last transform action.
  undo() {
    const snapshot = this.undoHistory.undo();
    if (!snapshot) return false;
    if (!applyTransformSnapshot(snapshot)) return false;
    if (snapshot.object !== this.selectedObject) {
      this.selectObject(snapshot.object);
    }
    this.gizmo.updateGizmoPosition();
    this.panel.updatePanelFromObject();
    this.logAction("undo");
    if (this.selectedObject) {
      this.emitTransform({
        position: this.selectedObject.position.clone(),
        rotation: this.selectedObject.quaternion.clone(),
        scale: this.selectedObject.scale.clone(),
        source: "undo",
      });
    }
    return true;
  }

  // Redo the last undone transform action.
  redo() {
    const snapshot = this.undoHistory.redo();
    if (!snapshot) return false;
    if (!applyTransformSnapshot(snapshot)) return false;
    if (snapshot.object !== this.selectedObject) {
      this.selectObject(snapshot.object);
    }
    this.gizmo.updateGizmoPosition();
    this.panel.updatePanelFromObject();
    this.logAction("redo");
    if (this.selectedObject) {
      this.emitTransform({
        position: this.selectedObject.position.clone(),
        rotation: this.selectedObject.quaternion.clone(),
        scale: this.selectedObject.scale.clone(),
        source: "redo",
      });
    }
    return true;
  }

  // Append a user-facing action label to history.
  logAction(action) {
    const label = this.getActionLabel(action);
    if (!label) return;
    this.actionHistory.record(label);
    this.notifyHistoryChange();
  }

  // Persist history updates when available.
  notifyHistoryChange() {
    if (!this.onHistoryChange) return;
    this.onHistoryChange(this.actionHistory.entries({ newestFirst: false }));
  }

  // Map internal actions to display labels.
  getActionLabel(action) {
    if (!action) return null;
    switch (action) {
      case "translate":
        return "Translate";
      case "rotate":
        return "Rotate";
      case "scale":
        return "Scale";
      case "reset":
        return "Reset";
      case "undo":
        return "Undo";
      case "redo":
        return "Redo";
      case "split":
        return "Create Component";
      case "combine":
        return "Combine Models";
      default:
        return "Transform";
    }
  }

  // Dispose gizmo resources and detach event handlers.
  dispose() {
    this.canvas.removeEventListener("pointerdown", this.onMouseDown);
    document.removeEventListener("pointermove", this.onMouseMove);
    document.removeEventListener("pointerup", this.onMouseUp);
    this.gizmo.dispose();
    this.panel.dispose();
  }

  // Register a transform change callback.
  onTransform(callback) {
    if (typeof callback !== "function") return () => {};
    this.transformListeners.add(callback);
    return () => this.transformListeners.delete(callback);
  }

  // Emit a transform event to listeners.
  emitTransform(transform) {
    this.transformListeners.forEach((callback) => {
      callback(transform);
    });
  }

  // Cache the initial state for a selected object before its first change.
  cacheInitialSnapshot(object) {
    if (!object || this.initializedObjects.has(object)) return;
    if (this.initialSnapshots.has(object)) return;
    const snapshot = createTransformSnapshot(object);
    if (snapshot) {
      this.initialSnapshots.set(object, snapshot);
    }
  }
}
