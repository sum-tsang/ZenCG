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
  constructor(scene, canvasElement, panelContainerId) {
    this.scene = scene;
    this.canvas = canvasElement;
    this.currentObject = null;
    this.camera = null;
    this.selectedObject = null;
    this.undoHistory = new UndoHistory();
    this.actionHistory = new ActionHistory();
    this.wasDraggingGizmo = false;

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
    this.canvas.addEventListener("mousedown", this.onMouseDown);
    document.addEventListener("mousemove", this.onMouseMove);
    document.addEventListener("mouseup", this.onMouseUp);
    // Prevent the browser context menu when right-clicking the canvas so
    // right-click drags can be used for transformations without interruption.
    this.canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    
    // Also listen to pointer events to detect when left-click camera controls are active
    // This helps prevent conflicts between camera and model transformation
    this.canvas.addEventListener("pointerdown", (e) => {
      if (e.button === 0) {
        // Left-click detected - ensure we're not dragging
        if (this.gizmo.isDragging) {
          this.gizmo.onMouseUp();
        }
      }
    });
  }

  onMouseDown(event) {
    if (!this.camera) return;

    // Only allow gizmo interactions and object selection with the right mouse button
    // (event.button === 2). Left click is reserved for camera controls.
    if (event.button !== 2) return;

    // Prevent browser default (context menu) on right-click action
    event.preventDefault();

    // Check if clicking on gizmo
    this.wasDraggingGizmo = false;
    const gizmoHandled = this.gizmo.onMouseDown(event, this.camera, this.canvas);
    if (gizmoHandled) {
      this.wasDraggingGizmo = true;
      return;
    }

    // Otherwise, try to select a model (right-click selection)
    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);

    // Get all meshes in the scene except the gizmo
    const selectableObjects = [];
    this.scene.traverse((child) => {
      if (
        child instanceof THREE.Mesh &&
        child.name !== "TransformationGizmo" &&
        !child.parent?.name?.includes("TransformationGizmo")
      ) {
        selectableObjects.push(child);
      }
    });

    const intersects = this.raycaster.intersectObjects(selectableObjects);

    if (intersects.length > 0) {
      this.selectObject(intersects[0].object);
    }
  }

  onMouseMove(event) {
    if (!this.camera) return;

    // CRITICAL: If left mouse button is down, completely ignore all model/gizmo interactions
    // Left button is reserved exclusively for camera controls.
    if (event.buttons !== undefined && (event.buttons & 1)) {
      // If we were dragging, stop immediately
      if (this.gizmo.isDragging) {
        this.gizmo.onMouseUp();
      }
      // Completely ignore all model interactions during left-click camera movement
      return;
    }

    // If the gizmo is currently dragging, only forward movement if the drag
    // was started by the right mouse button AND the right button is still pressed
    // (guard against left-button drags and ensure right-click-only editing).
    if (this.gizmo.isDragging) {
      // Only allow if drag was started with right button AND right button is still pressed
      if (this.gizmo.dragButton === 2 && event.buttons !== undefined && (event.buttons & 2)) {
        this.gizmo.onMouseMove(event, this.camera, this.canvas);
      } else {
        // If wrong button or button released, stop dragging
        this.gizmo.onMouseUp();
      }
    } else {
      // Otherwise update hover highlights/cursor (only when not left-clicking)
      if (this.gizmo.highlightUnderMouse && !(event.buttons !== undefined && (event.buttons & 1))) {
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
    }
  }

  setCamera(camera) {
    this.camera = camera;
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
    this.canvas.removeEventListener("mousedown", this.onMouseDown);
    document.removeEventListener("mousemove", this.onMouseMove);
    document.removeEventListener("mouseup", this.onMouseUp);
    this.gizmo.dispose();
    this.panel.dispose();
  }
}
