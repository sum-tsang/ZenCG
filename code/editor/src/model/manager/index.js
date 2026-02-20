import { TransformationGizmo } from "../gizmo/index.js";
import { TransformationPanel } from "../panel/index.js";
import * as THREE from "three";
import {
  startBoxSelection,
  createBoxHandles,
  getBoxHandleSize,
  updateBoxHandlePositions,
  rebuildBoxMesh,
  removeBoxHandles,
  confirmBoxSelection,
  cancelBoxSelection,
  handleBoxSelectionPointerDown,
  handleBoxSelectionPointerMove,
} from "./boxSelection.js";
import {
  selectObject as selectManagerObject,
  toggleSelection as toggleManagerSelection,
  syncSelectionUi as syncManagerSelectionUi,
  combineSelectedModels as combineManagerSelection,
} from "./selection.js";
import {
  resetUndoHistory as resetManagerUndoHistory,
  clearHistory as clearManagerHistory,
  recordSnapshot as recordManagerSnapshot,
  undo as undoManagerHistory,
  redo as redoManagerHistory,
  logAction as logManagerAction,
  notifyHistoryChange as notifyManagerHistoryChange,
  cacheInitialSnapshot as cacheManagerInitialSnapshot,
} from "./history.js";
import { UndoHistory } from "../history/undo.js";
import { ActionHistory } from "../history/actionHistory.js";

/**
 * TransformationManager - Orchestrates the 3D gizmo and UI panel
 * Handles real-time synchronization between gizmo interactions and numerical inputs
 */
export class TransformationManager {
  // Initializes class state
  constructor(scene, canvasElement, panelContainerId, options = {}) {
    this.scene = scene;
    this.canvas = canvasElement;
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
    this.gizmo = new TransformationGizmo(scene);
    this.panel = new TransformationPanel(panelContainerId);
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.boxDragIntersectPoint = new THREE.Vector3();
    this.boxDragDelta = new THREE.Vector3();
    this.gizmo.onTransform((transform) => {
      this.panel.updateFromGizmo(transform);
      this.emitTransform({ ...transform, source: "gizmo" });
    });
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
    this.panel.onSplit(() => {
      if (this.boxSelecting) {
        this.confirmBoxSelection();
      } else {
        this.startBoxSelection();
      }
    });
    this.panel.onCancelSplit(() => {
      this.cancelBoxSelection();
    });
    this.panel.onCombine(() => {
      this.combineSelectedModels();
    });
    this.panel.onModeChange((mode) => {
      this.gizmo.setMode(mode);
      this.notifyToolStateChange();
    });
    this.onMouseDown = this.onMouseDown.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onMouseUp = this.onMouseUp.bind(this);
    this.onContextMenu = this.onContextMenu.bind(this);

    this.setupEventListeners();
    this.notifyToolStateChange();
  }
  // Sets up event listeners
  setupEventListeners() {
    this.canvas.addEventListener("pointerdown", this.onMouseDown, false);
    document.addEventListener("pointermove", this.onMouseMove, false);
    document.addEventListener("pointerup", this.onMouseUp, false);
    this.canvas.addEventListener("contextmenu", this.onContextMenu);
  }
  // Gets selectable intersections
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
  // Handles resolve selectable hit
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
  // Handles start box selection
  startBoxSelection() {
    startBoxSelection(this);
  }
  // Creates box handles
  createBoxHandles(boxMesh) {
    return createBoxHandles(this, boxMesh);
  }
  // Gets box handle size
  getBoxHandleSize(boxMesh) {
    return getBoxHandleSize(boxMesh);
  }
  // Updates box handle positions
  updateBoxHandlePositions(boxMesh, handles) {
    updateBoxHandlePositions(this, boxMesh, handles);
  }
  // Handles rebuild box mesh
  rebuildBoxMesh() {
    rebuildBoxMesh(this);
  }
  // Handles remove box handles
  removeBoxHandles() {
    removeBoxHandles(this);
  }
  // Handles confirm box selection
  confirmBoxSelection() {
    confirmBoxSelection(this);
  }
  // Handles cancel box selection
  cancelBoxSelection() {
    cancelBoxSelection(this);
  }
  // Handles on mouse down
  onMouseDown(event) {
    if (!this.camera) return;
    this.lastPointerClient = { x: event.clientX, y: event.clientY };

    if (this.gizmo?.isKeyboardDragging?.()) {
      this.finishAxisShortcut();
    }

    if (handleBoxSelectionPointerDown(this, event)) {
      return;
    }
    if (event.button !== 2) return;
    event.preventDefault();
    this.wasDraggingGizmo = false;
    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);

    const intersects = this.getSelectableIntersections();
    const selectableHit = this.resolveSelectableHit(intersects);
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
  // Handles on mouse move
  onMouseMove(event) {
    if (!this.camera) return;
    this.lastPointerClient = { x: event.clientX, y: event.clientY };

    if (handleBoxSelectionPointerMove(this, event)) {
      return;
    }
    if (this.gizmo.isDragging) {
      this.gizmo.onMouseMove(event, this.camera, this.canvas);
    } else {
      if (this.gizmo.highlightUnderMouse) {
        this.gizmo.highlightUnderMouse(event, this.camera, this.canvas);
      }
    }
  }
  // Handles on mouse up
  onMouseUp(event) {
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
  // Handles on context menu
  onContextMenu(event) {
    event.preventDefault();
  }
  // Sets object
  setObject(object) {
    this.selectObject(object);
  }
  // Handles select object
  selectObject(object) {
    selectManagerObject(this, object);
  }
  // Handles toggle selection
  toggleSelection(object) {
    toggleManagerSelection(this, object);
  }
  // Handles sync selection ui
  syncSelectionUi(selectionChanged) {
    syncManagerSelectionUi(this, selectionChanged);
  }
  // Handles combine selected models
  combineSelectedModels() {
    return combineManagerSelection(this);
  }
  // Sets camera
  setCamera(camera) {
    this.camera = camera;
    this.gizmo.setCamera(camera, this.canvas);
  }
  // Sets mode
  setMode(mode) {
    if (this.gizmo?.isDragging) return;
    this.panel.setMode(mode);
  }
  // Handles start axis shortcut
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
  // Handles finish axis shortcut
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
  // Handles cancel axis shortcut
  cancelAxisShortcut() {
    if (!this.gizmo?.isKeyboardDragging?.()) return false;
    const canceled = this.gizmo.cancelKeyboardDrag?.();
    this.wasDraggingGizmo = false;
    this.notifyToolStateChange();
    return Boolean(canceled);
  }
  // Gets tool state
  getToolState() {
    return {
      mode: this.panel?.getCurrentMode?.() || this.gizmo?.mode || "translate",
      axis: this.gizmo?.axis || null,
    };
  }
  // Handles notify tool state change
  notifyToolStateChange() {
    if (!this.onToolStateChange) return;
    this.onToolStateChange(this.getToolState());
  }
  // Handles reset undo history
  resetUndoHistory() {
    resetManagerUndoHistory(this);
  }
  // Handles clear history
  clearHistory() {
    clearManagerHistory(this);
  }
  // Handles record snapshot
  recordSnapshot(action) {
    recordManagerSnapshot(this, action);
  }
  // Handles undo
  undo() {
    return undoManagerHistory(this);
  }
  // Handles redo
  redo() {
    return redoManagerHistory(this);
  }
  // Handles log action
  logAction(action) {
    logManagerAction(this, action);
  }
  // Handles notify history change
  notifyHistoryChange() {
    notifyManagerHistoryChange(this);
  }
  // Handles dispose
  dispose() {
    this.canvas.removeEventListener("pointerdown", this.onMouseDown);
    document.removeEventListener("pointermove", this.onMouseMove);
    document.removeEventListener("pointerup", this.onMouseUp);
    this.canvas.removeEventListener("contextmenu", this.onContextMenu);
    this.gizmo.dispose();
    this.panel.dispose();
  }
  // Handles on transform
  onTransform(callback) {
    if (typeof callback !== "function") return () => {};
    this.transformListeners.add(callback);
    return () => this.transformListeners.delete(callback);
  }
  // Handles emit transform
  emitTransform(transform) {
    this.transformListeners.forEach((callback) => {
      callback(transform);
    });
  }
  // Handles cache initial snapshot
  cacheInitialSnapshot(object) {
    cacheManagerInitialSnapshot(this, object);
  }
}
