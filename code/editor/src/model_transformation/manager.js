import { TransformationGizmo } from "./gizmo.js";
import { TransformationPanel } from "./panel.js";
import * as THREE from "three";

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
  }

  onMouseDown(event) {
    if (!this.camera) return;

    // Check if clicking on gizmo
    const gizmoHandled = this.gizmo.onMouseDown(event, this.camera, this.canvas);
    if (gizmoHandled) return;

    // Otherwise, try to select a model
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
    this.gizmo.onMouseMove(event, this.camera, this.canvas);
  }

  onMouseUp(event) {
    this.gizmo.onMouseUp();
  }

  setObject(object) {
    this.currentObject = object;
    this.selectObject(object);
  }

  selectObject(object) {
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
  }

  setCamera(camera) {
    this.camera = camera;
  }

  setMode(mode) {
    this.gizmo.setMode(mode);
  }

  dispose() {
    this.canvas.removeEventListener("mousedown", this.onMouseDown);
    document.removeEventListener("mousemove", this.onMouseMove);
    document.removeEventListener("mouseup", this.onMouseUp);
    this.gizmo.dispose();
    this.panel.dispose();
  }
}
