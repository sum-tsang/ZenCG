import * as THREE from "three";
import {
  initializeAxes as initializeGizmoAxes,
  addRotationRings as addGizmoRotationRings,
} from "./axes.js";
import {
  getInteractiveObjects as getInteractiveGizmoObjects,
  resolveHitData as resolveGizmoHitData,
  updatePointerClient as updateGizmoPointerClient,
  resolvePointerClient as resolveGizmoPointerClient,
  getAxisRayParameter as getGizmoAxisRayParameter,
  setScaleAxisScreenDir as setGizmoScaleAxisScreenDir,
  worldToScreen as projectWorldToScreen,
  getAxisVector as getGizmoAxisVector,
} from "./interactionUtils.js";
import {
  handleTranslate as handleGizmoTranslate,
  handleRotate as handleGizmoRotate,
  handleScale as handleGizmoScale,
} from "./dragHandlers.js";
import {
  highlightUnderMouse as highlightGizmoUnderMouse,
  getHitInfo as getGizmoHitInfo,
  onMouseDown as handleGizmoMouseDown,
  onMouseMove as handleGizmoMouseMove,
  onMouseUp as handleGizmoMouseUp,
  cancelKeyboardDrag as cancelGizmoKeyboardDrag,
} from "./pointerHandlers.js";

/**
 * TransformationGizmo - Interactive 3D gizmo for model transformations
 * Provides visual feedback for translate, rotate, and scale operations
 */
export class TransformationGizmo {
  // Initializes class state
  constructor(scene) {
    this.scene = scene;
    this.object = null;
    this.mode = "translate";
    this.axis = null;
    this.gizmoGroup = new THREE.Group();
    this.gizmoGroup.name = "TransformationGizmo";
    this.scene.add(this.gizmoGroup);

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.isDragging = false;
    this.dragSource = null;
    this.dragPlane = new THREE.Plane();
    this.dragPoint = new THREE.Vector3();
    this.lastDragPoint = new THREE.Vector3();
    this.initialPosition = new THREE.Vector3();
    this.initialRotation = new THREE.Euler();
    this.initialScale = new THREE.Vector3();
    this.initialQuaternion = new THREE.Quaternion();
    this.initialDragPoint = new THREE.Vector3();
    this.initialBoundingBoxSize = new THREE.Vector3();
    this.handleType = null;
    this.highlightedObject = null;
    this.startMouseScreenY = 0;
    this.lastMouseScreenY = 0;
    this.lastMouseScreenX = 0;
    this.initialMouseScreen = new THREE.Vector2();
    this.initialHandleWorldPos = new THREE.Vector3();
    this.dragButton = null;
    this.rotationAxisWorld = new THREE.Vector3();
    this.rotationCenterWorld = new THREE.Vector3();
    this.rotationStartVector = new THREE.Vector3();
    this.rotationStartWorldQuat = new THREE.Quaternion();
    this.rotationParentWorldQuat = new THREE.Quaternion();
    this.dragAxisWorld = new THREE.Vector3();
    this.dragAxisOriginWorld = new THREE.Vector3();
    this.dragAxisStartT = 0;
    this.scaleAxisWorld = new THREE.Vector3();
    this.scaleAxisOriginWorld = new THREE.Vector3();
    this.scaleAxisStartT = 0;
    this.scaleAxisLastT = 0;
    this.scaleAxisScreenDir = new THREE.Vector2();
    this.asymmetricScale = false;
    this.scaleDirection = 1;
    this.camera = null;
    this.viewport = null;
    this.axisLength = 6;
    this.desiredScreenSize = 120;
    this.lastPointerClient = null;
    this.axes = {
      x: null,
      y: null,
      z: null,
    };

    this.listeners = {
      onTransform: null,
    };

    this.initializeAxes();
    this.updateGizmoAppearance();
  }
  // Handles initialize axes
  initializeAxes() {
    initializeGizmoAxes(this);
  }
  // Handles add rotation rings
  addRotationRings() {
    addGizmoRotationRings(this);
  }
  // Sets camera
  setCamera(camera, viewport) {
    this.camera = camera ?? null;
    if (viewport) this.viewport = viewport;
  }
  // Sets object
  setObject(object) {
    this.object = object;
    if (object) {
      this.updateGizmoPosition();
    }
  }
  // Sets mode
  setMode(mode) {
    if (["translate", "rotate", "scale"].includes(mode)) {
      this.mode = mode;
      this.updateGizmoAppearance();
      if (this.object) {
        this.show();
      }
    }
  }
  // Updates gizmo position
  updateGizmoPosition() {
    if (!this.object) return;
    const worldPos = new THREE.Vector3();
    const worldQuat = new THREE.Quaternion();
    if (this.object.parent) this.object.parent.updateMatrixWorld(true);
    this.object.updateMatrixWorld(true);

    this.object.getWorldPosition(worldPos);
    this.object.getWorldQuaternion(worldQuat);

    this.gizmoGroup.position.copy(worldPos);
    this.gizmoGroup.quaternion.copy(worldQuat);
    this.updateGizmoScale(worldPos);
  }
  // Updates gizmo scale
  updateGizmoScale(worldPos) {
    if (!this.camera || !this.viewport) return;

    const height = Math.max(this.viewport.clientHeight || 1, 1);
    let visibleHeight = 1;

    if (this.camera.isPerspectiveCamera) {
      const distance = worldPos.distanceTo(this.camera.position);
      const vFov = THREE.MathUtils.degToRad(this.camera.fov);
      visibleHeight = 2 * Math.tan(vFov / 2) * distance;
    } else if (this.camera.isOrthographicCamera) {
      visibleHeight = (this.camera.top - this.camera.bottom) / this.camera.zoom;
    }

    const pixelsPerUnit = height / visibleHeight;
    const desiredWorldLength = this.desiredScreenSize / pixelsPerUnit;
    const scale = desiredWorldLength / this.axisLength;
    this.gizmoGroup.scale.setScalar(scale);
  }
  // Updates gizmo appearance
  updateGizmoAppearance() {
    const arrowScale = this.mode === "scale" ? 1.2 : 1;
    this.gizmoGroup.children.forEach((child) => {
      if (child.userData && child.userData.isArrowGroup) {
        child.scale.set(arrowScale, arrowScale, arrowScale);
        child.visible = this.mode === "translate";
      }
      if (child.userData && child.userData.handleType === "scale") {
        child.visible = this.mode === "scale";
        if (child.material) child.material.opacity = this.mode === "scale" ? 0.9 : 0;
      }
      if (child.userData && child.userData.handleType === "rotate") {
        child.visible = this.mode === "rotate";
        if (child.material) child.material.opacity = this.mode === "rotate" ? 0.5 : 0.15;
      }
    });
  }
  // Handles highlight under mouse
  highlightUnderMouse(event, camera, container) {
    highlightGizmoUnderMouse(this, event, camera, container);
  }
  // Gets hit info
  getHitInfo(event, camera, container) {
    return getGizmoHitInfo(this, event, camera, container);
  }
  // Gets interactive objects
  getInteractiveObjects() {
    return getInteractiveGizmoObjects(this);
  }
  // Handles resolve hit data
  resolveHitData(object) {
    return resolveGizmoHitData(object);
  }
  // Updates pointer client
  updatePointerClient(event) {
    updateGizmoPointerClient(this, event);
  }
  // Handles resolve pointer client
  resolvePointerClient(container, pointer = null) {
    return resolveGizmoPointerClient(this, container, pointer);
  }

  beginAxisDrag({
    axis,
    handleType = null,
    scaleDirection = 1,
    camera,
    container,
    clientX,
    clientY,
    dragSource = "mouse",
  }) {
    if (!this.object || !camera || !container) return false;
    if (!["x", "y", "z"].includes(axis)) return false;

    const rect = container.getBoundingClientRect();
    this.mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, camera);

    this.isDragging = true;
    this.dragSource = dragSource;
    this.dragButton = dragSource === "mouse" ? 2 : null;
    this.axis = axis;
    this.handleType = handleType;
    this.initialPosition.copy(this.object.position);
    this.initialRotation.copy(this.object.rotation);
    this.initialScale.copy(this.object.scale);
    this.object.getWorldQuaternion(this.initialQuaternion);
    this.startMouseScreenY = clientY;
    this.lastMouseScreenY = clientY;
    this.lastMouseScreenX = clientX;
    this.initialMouseScreen.x = clientX - rect.left;
    this.initialMouseScreen.y = clientY - rect.top;
    if (this.handleType === "scale" || this.mode === "scale") {
      const axisVec = this.getAxisVector();
      const axisLength = 6;
      const arrowLength = 1.2;
      const handleLocalPos = axisVec.clone().multiplyScalar(axisLength + arrowLength * 0.6);
      this.initialHandleWorldPos.copy(handleLocalPos);
      this.initialHandleWorldPos.applyQuaternion(this.initialQuaternion);
      this.initialHandleWorldPos.add(this.object.position);
    }
    const originalScale = this.object.scale.clone();
    this.object.scale.set(1, 1, 1);
    const box = new THREE.Box3().setFromObject(this.object);
    this.initialBoundingBoxSize.copy(box.getSize(new THREE.Vector3()));
    this.object.scale.copy(originalScale);
    this.initialScale.copy(originalScale);

    if (this.mode === "translate") {
      this.object.updateMatrixWorld(true);
      this.object.getWorldPosition(this.dragAxisOriginWorld);
      this.dragAxisWorld
        .copy(this.getAxisVector())
        .applyQuaternion(this.gizmoGroup.quaternion)
        .normalize();
      const startT = this.getAxisRayParameter(
        this.raycaster.ray,
        this.dragAxisOriginWorld,
        this.dragAxisWorld
      );
      this.dragAxisStartT = Number.isFinite(startT) ? startT : 0;
    }

    const isScale = this.handleType === "scale" || this.mode === "scale";
    const isRotate = this.handleType === "rotate" || this.mode === "rotate";

    if (isScale) {
      this.object.updateMatrixWorld(true);
      this.object.getWorldPosition(this.scaleAxisOriginWorld);
      this.scaleAxisWorld
        .copy(this.getAxisVector())
        .applyQuaternion(this.gizmoGroup.quaternion)
        .normalize();
      const startT = this.getAxisRayParameter(
        this.raycaster.ray,
        this.scaleAxisOriginWorld,
        this.scaleAxisWorld
      );
      if (Number.isFinite(startT)) {
        this.scaleAxisStartT = startT;
        this.scaleAxisLastT = startT;
      }
      this.setScaleAxisScreenDir(camera, container);
      this.scaleDirection = scaleDirection || 1;
    }
    if (isScale) {
      const cameraDirection = new THREE.Vector3();
      camera.getWorldDirection(cameraDirection);
      const normal = cameraDirection.negate();

      const worldPos = new THREE.Vector3();
      this.object.getWorldPosition(worldPos);

      this.dragPlane.setFromNormalAndCoplanarPoint(normal, worldPos);
    } else if (isRotate) {
      const axisWorld = this.getAxisVector()
        .clone()
        .applyQuaternion(this.gizmoGroup.quaternion)
        .normalize();
      this.rotationAxisWorld.copy(axisWorld);

      this.object.getWorldPosition(this.rotationCenterWorld);
      this.dragPlane.setFromNormalAndCoplanarPoint(axisWorld, this.rotationCenterWorld);
    }

    if (isScale || isRotate) {
      this.raycaster.ray.intersectPlane(this.dragPlane, this.lastDragPoint);
      this.initialDragPoint.copy(this.lastDragPoint);
    }

    if (isRotate) {
      this.object.getWorldQuaternion(this.rotationStartWorldQuat);
      if (this.object.parent) {
        this.object.parent.getWorldQuaternion(this.rotationParentWorldQuat);
      } else {
        this.rotationParentWorldQuat.identity();
      }
      this.rotationStartVector
        .copy(this.lastDragPoint)
        .sub(this.rotationCenterWorld)
        .projectOnPlane(this.rotationAxisWorld)
        .normalize();
    }

    return true;
  }
  // Handles start keyboard axis drag
  startKeyboardAxisDrag(axis, camera, container, pointer = null) {
    if (!this.object || !camera || !container) return false;
    const axisKey = typeof axis === "string" ? axis.toLowerCase() : "";
    if (!["x", "y", "z"].includes(axisKey)) return false;

    if (this.isDragging) {
      this.onMouseUp();
    }

    const pointerClient = this.resolvePointerClient(container, pointer);
    const handleType =
      this.mode === "rotate" ? "rotate" : this.mode === "scale" ? "scale" : null;
    return this.beginAxisDrag({
      axis: axisKey,
      handleType,
      scaleDirection: 1,
      camera,
      container,
      clientX: pointerClient.x,
      clientY: pointerClient.y,
      dragSource: "keyboard",
    });
  }
  // Handles is keyboard dragging
  isKeyboardDragging() {
    return this.isDragging && this.dragSource === "keyboard";
  }
  // Handles on mouse down
  onMouseDown(event, camera, container) {
    return handleGizmoMouseDown(this, event, camera, container);
  }
  // Handles on mouse move
  onMouseMove(event, camera, container) {
    handleGizmoMouseMove(this, event, camera, container);
  }
  // Handles translate
  handleTranslate(ray) {
    handleGizmoTranslate(this, ray);
  }
  // Gets axis ray parameter
  getAxisRayParameter(ray, axisOrigin, axisDirection) {
    return getGizmoAxisRayParameter(ray, axisOrigin, axisDirection);
  }
  // Sets scale axis screen dir
  setScaleAxisScreenDir(camera, container) {
    setGizmoScaleAxisScreenDir(this, camera, container);
  }
  // Handles world to screen
  worldToScreen(worldPos, camera, rect) {
    return projectWorldToScreen(worldPos, camera, rect);
  }
  // Handles rotate
  handleRotate() {
    handleGizmoRotate(this);
  }
  // Handles scale
  handleScale(event) {
    handleGizmoScale(this, event);
  }
  // Gets axis vector
  getAxisVector() {
    return getGizmoAxisVector(this.axis);
  }
  // Handles on mouse up
  onMouseUp() {
    handleGizmoMouseUp(this);
  }
  // Handles cancel keyboard drag
  cancelKeyboardDrag() {
    return cancelGizmoKeyboardDrag(this);
  }
  // Handles on transform
  onTransform(callback) {
    this.listeners.onTransform = callback;
  }
  // Sets transform
  setTransform(position, rotation, scale) {
    if (this.object) {
      if (position) this.object.position.copy(position);
      if (rotation) {
        if (rotation instanceof THREE.Euler) {
          this.object.rotation.copy(rotation);
        } else {
          this.object.rotation.setFromQuaternion(rotation);
        }
      }
      if (scale) this.object.scale.copy(scale);
      this.updateGizmoPosition();
    }
  }
  // Handles show
  show() {
    this.gizmoGroup.visible = true;
  }
  // Handles hide
  hide() {
    this.gizmoGroup.visible = false;
  }
  // Handles dispose
  dispose() {
    this.gizmoGroup.children.forEach((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    });
    this.scene.remove(this.gizmoGroup);
  }
}
