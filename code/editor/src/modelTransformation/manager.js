import { TransformationGizmo } from "./gizmo.js";
import { TransformationPanel } from "./panel.js";
import * as THREE from "three";
import {
  UndoHistory,
  applyTransformSnapshot,
  createTransformSnapshot,
} from "../history/undo.js";
import { ActionHistory } from "../history/actionHistory.js";

/**
 * TransformationManager - Orchestrates the 3D gizmo and UI panel
 * Handles real-time synchronization between gizmo interactions and numerical inputs
 */
export class TransformationManager {
  constructor(scene, canvasElement, panelContainerId, options = {}) {
    this.scene = scene;
    this.canvas = canvasElement;
    this.currentObject = null;
    this.camera = null;
    this.selectedObject = null;
    this.undoHistory = new UndoHistory();
    this.actionHistory = new ActionHistory();
    this.wasDraggingGizmo = false;
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
    });

    this.panel.onTransform((transform) => {
      if (this.selectedObject) {
        this.selectedObject.position.copy(transform.position);
        if (transform.rotation instanceof THREE.Quaternion) {
          this.selectedObject.quaternion.copy(transform.rotation);
        } else {
          this.selectedObject.rotation.copy(transform.rotation);
        }
        this.selectedObject.scale.copy(transform.scale);
        this.gizmo.updateGizmoPosition();
        const action = transform?.commit ? transform.action || transform.mode : null;
        this.recordSnapshot(action);
      }
    });

    // Mouse event handlers
    this.onMouseDown = this.onMouseDown.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onMouseUp = this.onMouseUp.bind(this);

    this.setupEventListeners();
  }

  setupEventListeners() {
    this.canvas.addEventListener("pointerdown", this.onMouseDown);
    document.addEventListener("pointermove", this.onMouseMove);
    document.addEventListener("pointerup", this.onMouseUp);
    // Prevent the browser context menu so drag interactions aren't interrupted.
    this.canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  }

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

    if (selectedObject && this.gizmo?.mode === "translate") {
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

  onMouseUp(event) {
    this.gizmo.onMouseUp();
    if (this.wasDraggingGizmo) {
      this.recordSnapshot(this.gizmo.mode);
      this.wasDraggingGizmo = false;
    }
  }

  setObject(object) {
    this.currentObject = object;
    this.selectObject(object);
  }

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

  setCamera(camera) {
    this.camera = camera;
    this.gizmo.setCamera(camera, this.canvas);
  }

  setMode(mode) {
    this.gizmo.setMode(mode);
  }

  resetUndoHistory() {
    this.undoHistory.clear();
    this.actionHistory.clear();
    this.panel.renderHistory([]);
    this.recordSnapshot();
  }

  recordSnapshot(action) {
    if (!this.selectedObject) return;
    const snapshot = createTransformSnapshot(this.selectedObject);
    const recorded = this.undoHistory.record(snapshot);
    if (recorded && action) {
      this.logAction(action);
    }
  }

  undo() {
    const snapshot = this.undoHistory.undo();
    if (!snapshot) return false;
    if (snapshot.object !== this.selectedObject) return false;
    applyTransformSnapshot(snapshot);
    this.gizmo.updateGizmoPosition();
    this.panel.updatePanelFromObject();
    this.logAction("undo");
    return true;
  }

  logAction(action) {
    const label = this.getActionLabel(action);
    if (!label) return;
    this.actionHistory.record(label);
    this.panel.renderHistory(this.actionHistory.entries());
  }

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

  dispose() {
    this.canvas.removeEventListener("pointerdown", this.onMouseDown);
    document.removeEventListener("pointermove", this.onMouseMove);
    document.removeEventListener("pointerup", this.onMouseUp);
    this.gizmo.dispose();
    this.panel.dispose();
  }
}
