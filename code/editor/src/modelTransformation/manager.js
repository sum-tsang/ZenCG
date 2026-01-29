import { TransformationGizmo } from "./gizmo.js";
import { TransformationPanel } from "./panel.js";
import * as THREE from "three";
import {
  UndoHistory,
  applyTransformSnapshot,
  createTransformSnapshot,
} from "./undo.js";
import { ActionHistory } from "./actionHistory.js";

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
    this.undoHistory = new UndoHistory();
    this.actionHistory = new ActionHistory();
    this.wasDraggingGizmo = false;
    this.transformListeners = new Set();
    this.selectableRoot = options.selectableRoot ?? null;
    this.resolveSelection =
      typeof options.resolveSelection === "function" ? options.resolveSelection : null;
    this.onSelectionChange =
      typeof options.onSelectionChange === "function" ? options.onSelectionChange : null;

    // Initialize gizmo and panel
    this.gizmo = new TransformationGizmo(scene);
    this.panel = new TransformationPanel(panelContainerId);

    // Raycaster for model selection
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

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

    // Mouse event handlers
    this.onMouseDown = this.onMouseDown.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onMouseUp = this.onMouseUp.bind(this);

    this.setupEventListeners();
  }

  // Attach pointer listeners for selection and gizmo interactions.
  setupEventListeners() {
    this.canvas.addEventListener("pointerdown", this.onMouseDown);
    document.addEventListener("pointermove", this.onMouseMove);
    document.addEventListener("pointerup", this.onMouseUp);
    // Prevent the browser context menu so drag interactions aren't interrupted.
    this.canvas.addEventListener("contextmenu", (e) => e.preventDefault());
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
    // Attach to scene root so world transforms are simple
    this.scene.add(boxMesh);

    // Outline helper
    const helper = new THREE.BoxHelper(boxMesh, 0xffdd00);
    this.scene.add(helper);

    this.boxMesh = boxMesh;
    this.boxHelper = helper;
    this.boxSelecting = true;

    // Switch gizmo to operate on the box
    this.gizmo.setObject(this.boxMesh);
    this.gizmo.show();

    // Update panel button label if possible
    const btn = this.panel.container.querySelector('.split-btn');
    if (btn) btn.textContent = 'Confirm Component';
  }

  // Confirm box selection and split the mesh.
  confirmBoxSelection() {
    if (!this.boxMesh || !this.selectedObject) return;
    // Compute box bounds in world space
    this.boxMesh.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(this.boxMesh);

    // Perform split: extract faces whose centroids are inside box
    const newPart = this.splitMeshByBox(this.selectedObject, box);

    // Cleanup box
    this.scene.remove(this.boxMesh);
    if (this.boxHelper) this.scene.remove(this.boxHelper);
    this.boxMesh.geometry.dispose();
    this.boxMesh.material.dispose();
    this.boxMesh = null;
    this.boxHelper = null;
    this.boxSelecting = false;

    // Restore gizmo to selected object (or newPart if you'd like to select the created component)
    if (newPart) {
      // Ensure world matrices are current
      newPart.updateMatrixWorld(true);
      // Explicitly select the created component and update gizmo/panel
      this.selectObject(newPart);
      this.gizmo.setObject(newPart);
      this.panel.setObject(newPart);
      this.panel.updatePanelFromObject();
      this.gizmo.updateGizmoPosition();
      // Record the split as an action
      this.recordSnapshot('split');
      this.logAction('split');
    } else {
      this.gizmo.setObject(this.selectedObject);
      this.panel.setObject(this.selectedObject);
    }

    const btn = this.panel.container.querySelector('.split-btn');
    if (btn) btn.textContent = 'Create Component (click mesh)';
  }

  // Cancel box selection and restore gizmo state.
  cancelBoxSelection() {
    if (!this.boxSelecting) return;
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
    const btn = this.panel.container.querySelector('.split-btn');
    if (btn) btn.textContent = 'Create Component (click mesh)';
    // Restore gizmo target
    if (this.selectedObject) {
      this.gizmo.setObject(this.selectedObject);
    } else {
      this.gizmo.hide();
    }
  }

  // Handle pointer down events for selection/dragging.
  onMouseDown(event) {
    if (!this.camera) return;

    // Allow left-click (0) and right-click (2) for selection/gizmo.
    if (event.button !== 0 && event.button !== 2) return;

    if (event.button === 2) {
      // Prevent browser default (context menu) on right-click action
      event.preventDefault();
    }

    // Check if clicking on gizmo
    this.wasDraggingGizmo = false;
    const gizmoHandled = this.gizmo.onMouseDown(event, this.camera, this.canvas);
    if (gizmoHandled) {
      this.wasDraggingGizmo = true;
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }

    // Otherwise, try to select a model
    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);

    const selectableObjects = [];
    if (this.selectableRoot) {
      this.selectableRoot.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          selectableObjects.push(child);
        }
      });
    } else {
      // Get all meshes in the scene except the gizmo
      this.scene.traverse((child) => {
        if (
          child instanceof THREE.Mesh &&
          child.name !== "TransformationGizmo" &&
          !child.parent?.name?.includes("TransformationGizmo")
        ) {
          selectableObjects.push(child);
        }
      });
    }

    const intersects = this.raycaster.intersectObjects(selectableObjects);

    let selectedObject = null;
    if (intersects.length > 0) {
      const hit = intersects[0].object;
      const resolved = this.resolveSelection ? this.resolveSelection(hit) : hit;
      if (resolved) {
        this.selectObject(resolved);
        selectedObject = resolved;
      }
    }

    // If the user clicked inside the selection bounding box (yellow outline)
    // but didn't hit actual geometry, treat that as a selection hit so the
    // user can start free translation by dragging the outline.
    if (!selectedObject && this.selectedObject) {
      // Ensure matrices are up-to-date for accurate bounds
      this.selectedObject.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(this.selectedObject);
      const hitPoint = this.raycaster.ray.intersectBox(box, new THREE.Vector3());
      if (hitPoint) {
        selectedObject = this.selectedObject;
      }
    }

    // Only allow forcing a free-translate on the selected model when
    // we're NOT currently editing a box selection. While a box selection
    // is active we must prevent transforming the underlying model and
    // only operate on the selection box itself.
    if (!this.boxSelecting && selectedObject && this.gizmo?.mode === "translate") {
      // If click was on the bounding box rather than geometry, force free translate
      const force = selectedObject === this.selectedObject && intersects.length === 0;
      if (this.gizmo.onMouseDown(event, this.camera, this.canvas, force)) {
        this.wasDraggingGizmo = true;
      }
    }

    if (!selectedObject && !this.wasDraggingGizmo) {
      if (this.selectedObject) {
        this.selectObject(null);
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
    this.gizmo.onMouseUp();
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
    if (object) {
      this.gizmo.setObject(object);
      this.gizmo.show();
      this.panel.setObject(object);
      this.panel.setGizmo(this.gizmo);
      this.panel.updatePanelFromObject();
    } else {
      this.gizmo.hide();
    }
    if (selectionChanged) {
      if (object) {
        this.resetUndoHistory();
      } else {
        this.undoHistory.clear();
        this.actionHistory.clear();
        this.panel.renderHistory([]);
      }
      if (this.onSelectionChange) {
        this.onSelectionChange(object);
      }
    }
  }

  // Split a mesh into two parts based on whether triangle centroids lie inside the given Box3
  // Split a mesh into inside/outside parts based on a Box3.
  splitMeshByBox(mesh, box3) {
    const geom = mesh.geometry;
    if (!geom || !geom.attributes || !geom.attributes.position) return null;

    const posAttr = geom.getAttribute('position');
    const normAttr = geom.getAttribute('normal');
    const uvAttr = geom.getAttribute('uv');
    const index = geom.index;

    const worldMatrix = mesh.matrixWorld;

    const insidePositions = [];
    const insideNormals = [];
    const insideUVs = [];
    const outsidePositions = [];
    const outsideNormals = [];
    const outsideUVs = [];

    // Push a vertex's attributes into the provided buffers.
    function pushVertexTo(arrPos, arrNorm, arrUV, vi) {
      arrPos.push(posAttr.getX(vi), posAttr.getY(vi), posAttr.getZ(vi));
      if (normAttr) arrNorm.push(normAttr.getX(vi), normAttr.getY(vi), normAttr.getZ(vi));
      if (uvAttr) arrUV.push(uvAttr.getX(vi), uvAttr.getY(vi));
    }

    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();

    if (index) {
      for (let fi = 0; fi < index.count; fi += 3) {
        const i0 = index.getX(fi);
        const i1 = index.getX(fi + 1);
        const i2 = index.getX(fi + 2);

        a.fromBufferAttribute(posAttr, i0).applyMatrix4(worldMatrix);
        b.fromBufferAttribute(posAttr, i1).applyMatrix4(worldMatrix);
        c.fromBufferAttribute(posAttr, i2).applyMatrix4(worldMatrix);

        const centroid = new THREE.Vector3().addVectors(a, b).add(c).multiplyScalar(1 / 3);

        if (box3.containsPoint(centroid)) {
          pushVertexTo(insidePositions, insideNormals, insideUVs, i0);
          pushVertexTo(insidePositions, insideNormals, insideUVs, i1);
          pushVertexTo(insidePositions, insideNormals, insideUVs, i2);
        } else {
          pushVertexTo(outsidePositions, outsideNormals, outsideUVs, i0);
          pushVertexTo(outsidePositions, outsideNormals, outsideUVs, i1);
          pushVertexTo(outsidePositions, outsideNormals, outsideUVs, i2);
        }
      }
    } else {
      // Non-indexed geometry: tri verts are sequential
      for (let vi = 0; vi < posAttr.count; vi += 3) {
        a.fromBufferAttribute(posAttr, vi).applyMatrix4(worldMatrix);
        b.fromBufferAttribute(posAttr, vi + 1).applyMatrix4(worldMatrix);
        c.fromBufferAttribute(posAttr, vi + 2).applyMatrix4(worldMatrix);
        const centroid = new THREE.Vector3().addVectors(a, b).add(c).multiplyScalar(1 / 3);
        if (box3.containsPoint(centroid)) {
          pushVertexTo(insidePositions, insideNormals, insideUVs, vi);
          pushVertexTo(insidePositions, insideNormals, insideUVs, vi + 1);
          pushVertexTo(insidePositions, insideNormals, insideUVs, vi + 2);
        } else {
          pushVertexTo(outsidePositions, outsideNormals, outsideUVs, vi);
          pushVertexTo(outsidePositions, outsideNormals, outsideUVs, vi + 1);
          pushVertexTo(outsidePositions, outsideNormals, outsideUVs, vi + 2);
        }
      }
    }

    // If no inside faces, do nothing
    if (insidePositions.length === 0) return null;

    // Build new geometries
    const geomA = new THREE.BufferGeometry();
    geomA.setAttribute('position', new THREE.Float32BufferAttribute(insidePositions, 3));
    if (insideNormals.length) geomA.setAttribute('normal', new THREE.Float32BufferAttribute(insideNormals, 3));
    if (insideUVs.length) geomA.setAttribute('uv', new THREE.Float32BufferAttribute(insideUVs, 2));

    const geomB = new THREE.BufferGeometry();
    if (outsidePositions.length) {
      geomB.setAttribute('position', new THREE.Float32BufferAttribute(outsidePositions, 3));
      if (outsideNormals.length) geomB.setAttribute('normal', new THREE.Float32BufferAttribute(outsideNormals, 3));
      if (outsideUVs.length) geomB.setAttribute('uv', new THREE.Float32BufferAttribute(outsideUVs, 2));
    }

    // Create meshes
    const mat = mesh.material && mesh.material.clone ? mesh.material.clone() : mesh.material;
    const meshA = new THREE.Mesh(geomA, mat);
    meshA.name = mesh.name + "-part";
    // Place both meshes under the same parent transform as original
    const parent = mesh.parent || this.scene;
    // Create group to hold replacement and place it in the scene root
    const group = new THREE.Group();
    group.name = mesh.name + "-splitGroup";
    // Use the mesh's world transform so children stay in the same world positions
    const worldPos = new THREE.Vector3();
    const worldQuat = new THREE.Quaternion();
    const worldScale = new THREE.Vector3();
    mesh.getWorldPosition(worldPos);
    mesh.getWorldQuaternion(worldQuat);
    mesh.getWorldScale(worldScale);
    group.position.copy(worldPos);
    group.quaternion.copy(worldQuat);
    group.scale.copy(worldScale);
    this.scene.add(group);
    // Reset meshA transform so it's local to the new group
    meshA.position.set(0, 0, 0);
    meshA.quaternion.identity();
    meshA.scale.set(1, 1, 1);
    group.add(meshA);

    if (geomB.attributes && geomB.attributes.position) {
      const meshB = new THREE.Mesh(geomB, mesh.material && mesh.material.clone ? mesh.material.clone() : mesh.material);
      meshB.name = mesh.name + "-rest";
      meshB.position.set(0, 0, 0);
      meshB.quaternion.identity();
      meshB.scale.set(1,1,1);
      group.add(meshB);
    }

    // Remove original mesh
    // Remove original mesh from its parent
    if (mesh.parent) mesh.parent.remove(mesh);
    if (mesh.geometry) mesh.geometry.dispose();
    // Note: not disposing original material to avoid side effects if shared

    // Ensure world matrices are up-to-date
    meshA.updateMatrixWorld(true);
    return meshA;
  }

  // Provide the camera for raycasting and gizmo interactions.
  setCamera(camera) {
    this.camera = camera;
    this.gizmo.setCamera(camera, this.canvas);
  }

  // Set the current gizmo mode.
  setMode(mode) {
    this.gizmo.setMode(mode);
  }

  // Reset undo history to the current object transform.
  resetUndoHistory() {
    this.undoHistory.clear();
    this.actionHistory.clear();
    this.panel.renderHistory([]);
    this.recordSnapshot();
  }

  // Record a transform snapshot for undo/history.
  recordSnapshot(action) {
    if (!this.selectedObject) return;
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
    if (snapshot.object !== this.selectedObject) return false;
    applyTransformSnapshot(snapshot);
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

  // Append a user-facing action label to history.
  logAction(action) {
    const label = this.getActionLabel(action);
    if (!label) return;
    this.actionHistory.record(label);
    this.panel.renderHistory(this.actionHistory.entries());
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
}
