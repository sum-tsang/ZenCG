import * as THREE from "three";

/**
 * TransformationGizmo - Interactive 3D gizmo for model transformations
 * Provides visual feedback for translate, rotate, and scale operations
 */
export class TransformationGizmo {
  // Initialize gizmo state and geometry.
  constructor(scene) {
    this.scene = scene;
    this.object = null;
    this.mode = "translate"; // translate, rotate, scale
    this.axis = null; // x, y, z
    this.gizmoGroup = new THREE.Group();
    this.gizmoGroup.name = "TransformationGizmo";
    this.scene.add(this.gizmoGroup);

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.isDragging = false;
    this.dragPlane = new THREE.Plane();
    this.dragPoint = new THREE.Vector3();
    this.lastDragPoint = new THREE.Vector3();
    this.initialPosition = new THREE.Vector3();
    this.initialRotation = new THREE.Euler();
    this.initialScale = new THREE.Vector3();
    this.initialQuaternion = new THREE.Quaternion();
    this.initialDragPoint = new THREE.Vector3();
    this.initialBoundingBoxSize = new THREE.Vector3();
    this.handleType = null; // 'scale' | 'rotate' | null
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
    this.camera = null;
    this.viewport = null;
    this.axisLength = 6;
    this.desiredScreenSize = 120;

    // Interactive axes
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

  // Build axis meshes and interaction handles.
  initializeAxes() {
    const axisLength = this.axisLength;
    const shaftRadius = 0.14;
    const arrowHeadLength = 1.4;
    const headRadius = 0.38;
    const shaftLength = axisLength - arrowHeadLength * 0.6;

    // Colors: Red (X), Green (Y), Blue (Z)
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
      
      // Create arrow handle for translate mode
      const arrowGroup = new THREE.Group();
      arrowGroup.name = `axis-${axis}`;
      arrowGroup.userData.axis = axis;
      arrowGroup.userData.isGizmoAxis = true;
      arrowGroup.userData.isArrowGroup = true;

      const shaftGeom = new THREE.CylinderGeometry(shaftRadius, shaftRadius, shaftLength, 16);
      const shaftMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 });
      const shaft = new THREE.Mesh(shaftGeom, shaftMat);
      shaft.position.y = shaftLength / 2;
      shaft.userData.axis = axis;
      shaft.userData.isGizmoAxis = true;
      shaft.userData.isArrowVisual = true;
      shaft.userData.baseOpacity = 0.9;
      shaft.material.depthTest = false;
      shaft.renderOrder = 2;

      const headGeom = new THREE.ConeGeometry(headRadius, arrowHeadLength, 18);
      const headMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 });
      const head = new THREE.Mesh(headGeom, headMat);
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

      this.gizmoGroup.add(arrowGroup);
      this.axes[axis] = arrowGroup;

      // Create invisible cylinder for mouse interaction - MUCH BIGGER
      const cylinderGeom = new THREE.CylinderGeometry(
        0.9,
        0.9,
        axisLength * 1.4,
        16
      );
      const cylinderMat = new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
      });
      const cylinder = new THREE.Mesh(cylinderGeom, cylinderMat);
      cylinder.userData.axis = axis;
      cylinder.userData.isGizmoAxis = true;
      cylinder.userData.isHitZone = true;
      cylinder.renderOrder = 1;

      // Rotate cylinder to align with axis
      if (axis === "x") {
        cylinder.rotation.z = Math.PI / 2;
      } else if (axis === "z") {
        cylinder.rotation.x = Math.PI / 2;
      }

      this.gizmoGroup.add(cylinder);

      // Scale handle (box) for scale mode.
      const scaleGeom = new THREE.BoxGeometry(0.75, 0.75, 0.75);
      const scaleMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8 });
      const scaleHandle = new THREE.Mesh(scaleGeom, scaleMat);
      scaleHandle.position.copy(direction).multiplyScalar(axisLength + 0.7);
      scaleHandle.userData.axis = axis;
      scaleHandle.userData.isGizmoAxis = true;
      scaleHandle.userData.handleType = "scale";
      scaleHandle.userData.baseOpacity = 0.8;
      scaleHandle.renderOrder = 2;
      scaleHandle.material.depthTest = false;
      this.gizmoGroup.add(scaleHandle);
    });

    // Add rotation rings for rotate mode.
    this.addRotationRings();
  }

  // Add rotation rings for rotate mode.
  addRotationRings() {
    const ringRadius = 5.2;
    const ringThickness = 0.16;

    const ringDefs = [
      { axis: "x", color: 0xff0000, normal: new THREE.Vector3(1, 0, 0) },
      { axis: "y", color: 0x00ff00, normal: new THREE.Vector3(0, 1, 0) },
      { axis: "z", color: 0x0000ff, normal: new THREE.Vector3(0, 0, 1) },
    ];

    const baseNormal = new THREE.Vector3(0, 0, 1);
    ringDefs.forEach(({ axis, color, normal }) => {
      const ringGeom = new THREE.TorusGeometry(ringRadius, ringThickness, 8, 64);
      const ringMat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(ringGeom, ringMat);
      ring.quaternion.setFromUnitVectors(baseNormal, normal);
      ring.userData.axis = axis;
      ring.userData.isRotationRing = true;
      ring.userData.isGizmoAxis = true;
      ring.userData.handleType = "rotate";
      ring.userData.baseOpacity = 0.5;
      ring.visible = this.mode === "rotate";
      ring.renderOrder = 2;
      ring.material.depthTest = false;
      this.gizmoGroup.add(ring);
    });
  }

  // Set the active camera and viewport for hit testing.
  setCamera(camera, viewport) {
    this.camera = camera ?? null;
    if (viewport) this.viewport = viewport;
  }

  // Bind the gizmo to a target object.
  setObject(object) {
    this.object = object;
    if (object) {
      this.updateGizmoPosition();
    }
  }

  // Switch gizmo mode between translate/rotate/scale.
  setMode(mode) {
    if (["translate", "rotate", "scale"].includes(mode)) {
      this.mode = mode;
      this.updateGizmoAppearance();
      if (this.object) {
        this.show();
      }
    }
  }

  // Update gizmo position to match the bound object.
  updateGizmoPosition() {
    if (!this.object) return;

    // Use world transforms so the gizmo matches the object's world-space
    // position/rotation/scale even when the object is nested under a parent
    const worldPos = new THREE.Vector3();
    const worldQuat = new THREE.Quaternion();
    // Ensure matrices are up-to-date so world queries return current values
    if (this.object.parent) this.object.parent.updateMatrixWorld(true);
    this.object.updateMatrixWorld(true);

    this.object.getWorldPosition(worldPos);
    this.object.getWorldQuaternion(worldQuat);

    this.gizmoGroup.position.copy(worldPos);
    this.gizmoGroup.quaternion.copy(worldQuat);
    this.updateGizmoScale(worldPos);
  }

  // Keep the gizmo a consistent screen size.
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

  // Show/hide elements based on the current mode.
  updateGizmoAppearance() {
    // Adjust gizmo appearance based on mode
    const arrowScale = this.mode === "scale" ? 1.2 : 1;
    this.gizmoGroup.children.forEach((child) => {
      // Arrows scale slightly when in scale mode
      if (child.userData && child.userData.isArrowGroup) {
        child.scale.set(arrowScale, arrowScale, arrowScale);
        child.visible = this.mode === "translate";
      }

      // Scale handles: visible only in scale mode
      if (child.userData && child.userData.handleType === "scale") {
        child.visible = this.mode === "scale";
        if (child.material) child.material.opacity = this.mode === "scale" ? 0.9 : 0;
      }

      // Rotation rings: visible only in rotate mode
      if (child.userData && child.userData.handleType === "rotate") {
        child.visible = this.mode === "rotate";
        if (child.material) child.material.opacity = this.mode === "rotate" ? 0.5 : 0.15;
      }
    });
  }

  // Raycast under mouse to highlight handles and change cursor
  // Highlight the gizmo axis under the cursor.
  highlightUnderMouse(event, camera, container) {
    if (!container) return;
    const rect = container.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, camera);

    // Restore the default opacity for a gizmo handle.
    const resetOpacity = (object) => {
      if (!object?.material) return;
      const baseOpacity = object.userData?.baseOpacity;
      if (typeof baseOpacity === "number") {
        object.material.opacity = baseOpacity;
        return;
      }
      const defOpacity =
        object.userData.handleType === "scale"
          ? this.mode === "scale"
            ? 0.9
            : 0
          : this.mode === "rotate"
            ? 0.5
            : 0.15;
      object.material.opacity = defOpacity;
    };

    const interactive = this.getInteractiveObjects();
    const intersects = this.raycaster.intersectObjects(interactive, true);

    if (intersects.length > 0) {
      const hit = intersects[0].object;
      const resolved = this.resolveHitData(hit);
      // set cursor style
      const type = resolved.handleType || this.mode;
      if (type === "scale") container.style.cursor = "ew-resize";
      else if (type === "rotate") container.style.cursor = "grab";
      else container.style.cursor = "move";

      if (resolved.isHitZone) {
        if (this.highlightedObject) {
          resetOpacity(this.highlightedObject);
          this.highlightedObject = null;
        }
        return;
      }

      // highlight object
      if (this.highlightedObject && this.highlightedObject !== hit) {
        resetOpacity(this.highlightedObject);
      }
      if (hit.material) hit.material.opacity = 1.0;
      this.highlightedObject = hit;
    } else {
      container.style.cursor = "auto";
      if (this.highlightedObject) {
        resetOpacity(this.highlightedObject);
        this.highlightedObject = null;
      }
    }
  }

  // Return the closest gizmo hit (if any) without starting a drag.
  getHitInfo(event, camera, container) {
    if (!container) return null;
    const rect = container.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, camera);

    const interactive = this.getInteractiveObjects();
    const intersects = this.raycaster.intersectObjects(interactive, true);
    if (!intersects.length) return null;

    const hit = intersects[0];
    const resolved = this.resolveHitData(hit.object);
    return { hit, resolved };
  }

  getInteractiveObjects() {
    if (this.mode === "scale") {
      return this.gizmoGroup.children.filter(
        (c) => c.userData && c.userData.handleType === "scale"
      );
    }
    if (this.mode === "rotate") {
      return this.gizmoGroup.children.filter(
        (c) => c.userData && c.userData.handleType === "rotate"
      );
    }
    return this.gizmoGroup.children.filter(
      (c) => c.userData && c.userData.isGizmoAxis && !c.userData.handleType
    );
  }

  // Normalize hit data for gizmo handle detection.
  resolveHitData(object) {
    let current = object;
    let axis = null;
    let handleType = null;
    let isHitZone = false;

    while (current) {
      if (axis === null && current.userData?.axis) axis = current.userData.axis;
      if (handleType === null && current.userData?.handleType) handleType = current.userData.handleType;
      if (current.userData?.isHitZone) isHitZone = true;
      current = current.parent;
    }

    return { axis, handleType, isHitZone };
  }

  // Begin drag interactions when a handle is clicked.
  onMouseDown(event, camera, container, forceFreeTranslate = false) {
    if (event.button !== 0 && event.button !== 2) return false;

    if (!this.object) return;

    const rect = container.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, camera);

    // NOTE: Do not start free translate here unconditionally. Free translate
    // should only begin when the user actually clicks the object itself
    // (handled later via objectIntersects). This prevents accidental
    // translations when clicking empty space.

    // For rotate and scale modes, use axis-based interaction
    const interactiveObjects = this.getInteractiveObjects();
    const intersects = this.raycaster.intersectObjects(interactiveObjects, true);

    // Also test whether the click hit the current object (for translate mode)
    const objectIntersects = this.object ? this.raycaster.intersectObject(this.object, true) : [];
    if (intersects.length > 0) {
      const hit = intersects[0].object;
      const resolved = this.resolveHitData(hit);
      if (!resolved.axis) return false;

      this.isDragging = true;
      this.dragButton = event.button;
      this.axis = resolved.axis;
      this.handleType = resolved.handleType;

      // Store initial values
      this.initialPosition.copy(this.object.position);
      this.initialRotation.copy(this.object.rotation);
      this.initialScale.copy(this.object.scale);
      this.object.getWorldQuaternion(this.initialQuaternion);
      this.startMouseScreenY = event.clientY;
      this.lastMouseScreenY = event.clientY;
      this.lastMouseScreenX = event.clientX;
      
      // Store initial mouse position for screen-space scaling
      const rect = container.getBoundingClientRect();
      this.initialMouseScreen.x = event.clientX - rect.left;
      this.initialMouseScreen.y = event.clientY - rect.top;
      
      // Store initial handle position in world space (for scaling reference)
      if (this.handleType === "scale" || this.mode === "scale") {
        // Get the handle position (at the end of the axis)
        const axisVec = this.getAxisVector();
        const axisLength = 6;
        const arrowLength = 1.2;
        const handleLocalPos = axisVec.clone().multiplyScalar(axisLength + arrowLength * 0.6);
        this.initialHandleWorldPos.copy(handleLocalPos);
        this.initialHandleWorldPos.applyQuaternion(this.initialQuaternion);
        this.initialHandleWorldPos.add(this.object.position);
      }

      // Store initial bounding box size for scaling calculations
      // Calculate with normalized scale to get base size (prevents feedback loop)
      const originalScale = this.object.scale.clone();
      this.object.scale.set(1, 1, 1);
      const box = new THREE.Box3().setFromObject(this.object);
      this.initialBoundingBoxSize.copy(box.getSize(new THREE.Vector3()));
      this.object.scale.copy(originalScale); // Restore original scale
      
      // CRITICAL: Ensure initial scale is properly stored and won't change
      // This prevents any feedback loops
      this.initialScale.x = originalScale.x;
      this.initialScale.y = originalScale.y;
      this.initialScale.z = originalScale.z;
      
      // CRITICAL: Store initial scale as a deep copy to prevent any modifications
      // This ensures the initial scale never changes during dragging
      this.initialScale.x = originalScale.x;
      this.initialScale.y = originalScale.y;
      this.initialScale.z = originalScale.z;

      if (this.mode === "translate") {
        // Cache world axis data for robust axis dragging (no plane degeneracy)
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
      }

      // Setup drag plane for rotation/scale
      // For scaling, use a plane perpendicular to camera view so mouse movement
      // projects naturally onto the axis direction.
      if (isScale) {
        // Use camera-facing plane - this allows the handle to follow mouse direction
        const cameraDirection = new THREE.Vector3();
        camera.getWorldDirection(cameraDirection);
        const normal = cameraDirection.negate();

        const worldPos = new THREE.Vector3();
        this.object.getWorldPosition(worldPos);

        this.dragPlane.setFromNormalAndCoplanarPoint(normal, worldPos);
      } else if (isRotate) {
        // For rotation, use plane perpendicular to axis in world space
        const axisWorld = this.getAxisVector()
          .clone()
          .applyQuaternion(this.gizmoGroup.quaternion)
          .normalize();
        this.rotationAxisWorld.copy(axisWorld);

        this.object.getWorldPosition(this.rotationCenterWorld);
        this.dragPlane.setFromNormalAndCoplanarPoint(axisWorld, this.rotationCenterWorld);
      }

      if (isScale || isRotate) {
        // Get initial drag point
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

      // If in translate mode, only start free translation when clicking on the object itself
      // or when explicitly forced (e.g., clicking the selection outline box)
      if (this.mode === "translate" && (objectIntersects.length > 0 || forceFreeTranslate)) {
        // Create a plane at the object's position facing the camera
        const cameraDirection = new THREE.Vector3();
        camera.getWorldDirection(cameraDirection);
        const normal = cameraDirection.negate();

        const worldPos = new THREE.Vector3();
        this.object.getWorldPosition(worldPos);
        this.dragPlane.setFromNormalAndCoplanarPoint(normal, worldPos);

        this.isDragging = true;
        this.dragButton = event.button;
        this.axis = "free"; // Free movement in translate mode

        // Store initial values
        this.initialPosition.copy(this.object.position);
        this.initialRotation.copy(this.object.rotation);
        this.initialScale.copy(this.object.scale);
        this.startMouseScreenY = event.clientY;
        this.lastMouseScreenY = event.clientY;
        this.lastMouseScreenX = event.clientX;

        // Get initial drag point
        this.raycaster.ray.intersectPlane(this.dragPlane, this.lastDragPoint);

        return true;
      }

    return false;
  }

  // Update transformations while dragging.
  onMouseMove(event, camera, container) {
    if (!this.isDragging || !this.object || !this.axis) return;
    if (event.buttons !== undefined) {
      const leftDown = (event.buttons & 1) !== 0;
      const rightDown = (event.buttons & 2) !== 0;
      if (
        (this.dragButton === 0 && !leftDown) ||
        (this.dragButton === 2 && !rightDown)
      ) {
        this.onMouseUp();
        return;
      }
    }

    const rect = container.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, camera);
    let didUpdateDragPoint = false;

    if (this.mode === "translate") {
      if (this.axis === "free") {
        this.raycaster.ray.intersectPlane(this.dragPlane, this.dragPoint);
        const delta = new THREE.Vector3().subVectors(this.dragPoint, this.lastDragPoint);
        didUpdateDragPoint = true;
        // Free movement - apply world-space delta to the object's local position
        // Ensure matrices are current so world/local conversions are accurate
        if (this.object.parent) this.object.parent.updateMatrixWorld(true);
        this.object.updateMatrixWorld(true);

        const worldPos = new THREE.Vector3();
        this.object.getWorldPosition(worldPos);
        worldPos.add(delta);
        if (this.object.parent) {
          this.object.parent.worldToLocal(worldPos);
        }
        this.object.position.copy(worldPos);
      } else {
        // Constrained movement along axis using ray/axis closest points
        this.handleTranslate(this.raycaster.ray);
      }
    } else {
      this.raycaster.ray.intersectPlane(this.dragPlane, this.dragPoint);
      didUpdateDragPoint = true;
      // Prefer explicit handle type (e.g., clicking a scale handle)
      if (this.handleType === "scale" || this.mode === "scale") {
        // Use screen-space distance for stable scaling
        this.handleScale(event);
      } else if (this.handleType === "rotate" || this.mode === "rotate") {
        this.handleRotate();
      }
    }

    if (didUpdateDragPoint) {
      this.lastDragPoint.copy(this.dragPoint);
    }
    
    // Update gizmo position, but for scaling, only update position/rotation, not scale
    // to prevent feedback loops
    if (this.handleType === "scale" || this.mode === "scale") {
      // Only update position and rotation during scaling, not scale
      const worldPos = new THREE.Vector3();
      const worldQuat = new THREE.Quaternion();
      this.object.getWorldPosition(worldPos);
      this.object.getWorldQuaternion(worldQuat);
      this.gizmoGroup.position.copy(worldPos);
      this.gizmoGroup.quaternion.copy(worldQuat);
      // Don't update gizmo scale during scaling drag
    } else {
      this.updateGizmoPosition();
    }

    // Only trigger transform callback if not scaling (to prevent feedback loops)
    // For scaling, we'll update the panel only when drag ends
    if (this.listeners.onTransform && !(this.handleType === "scale" || this.mode === "scale")) {
      this.listeners.onTransform({
        position: this.object.position.clone(),
        rotation: this.object.rotation.clone(),
        scale: this.object.scale.clone(),
      });
    }
  }

  // Apply translation deltas along the selected axis.
  handleTranslate(ray) {
    // Apply axis-constrained translation using closest points between ray and axis.
    if (!ray) return;
    if (this.dragAxisWorld.lengthSq() === 0) return;

    const t = this.getAxisRayParameter(ray, this.dragAxisOriginWorld, this.dragAxisWorld);
    if (!Number.isFinite(t)) return;

    const delta = this.dragAxisWorld.clone().multiplyScalar(t - this.dragAxisStartT);
    const worldPos = this.dragAxisOriginWorld.clone().add(delta);

    if (this.object.parent) this.object.parent.updateMatrixWorld(true);
    if (this.object.parent) this.object.parent.worldToLocal(worldPos);
    this.object.position.copy(worldPos);
  }

  getAxisRayParameter(ray, axisOrigin, axisDirection) {
    const r = new THREE.Vector3().subVectors(axisOrigin, ray.origin);
    const a = axisDirection.dot(axisDirection);
    const e = ray.direction.dot(ray.direction);
    const b = axisDirection.dot(ray.direction);
    const c = axisDirection.dot(r);
    const f = ray.direction.dot(r);
    const denom = a * e - b * b;

    if (Math.abs(denom) < 1e-6) {
      // Lines are nearly parallel; fall back to closest point to ray origin.
      return -c / a;
    }

    return (b * f - c * e) / denom;
  }

  setScaleAxisScreenDir(camera, container) {
    if (!this.object || !camera || !container) {
      this.scaleAxisScreenDir.set(0, 0);
      return;
    }

    const rect = container.getBoundingClientRect();
    const worldPos = new THREE.Vector3();
    this.object.getWorldPosition(worldPos);

    const axisWorld = this.getAxisVector()
      .clone()
      .applyQuaternion(this.gizmoGroup.quaternion)
      .normalize();

    const axisDistance = this.axisLength * this.gizmoGroup.scale.x;
    const worldTip = worldPos.clone().add(axisWorld.multiplyScalar(axisDistance));

    const screenOrigin = this.worldToScreen(worldPos, camera, rect);
    const screenTip = this.worldToScreen(worldTip, camera, rect);

    this.scaleAxisScreenDir.copy(screenTip).sub(screenOrigin);
    if (this.scaleAxisScreenDir.lengthSq() < 1e-4) {
      this.scaleAxisScreenDir.set(0, 0);
      return;
    }
    this.scaleAxisScreenDir.normalize();
  }

  worldToScreen(worldPos, camera, rect) {
    const ndc = worldPos.clone().project(camera);
    return new THREE.Vector2(
      (ndc.x + 1) * 0.5 * rect.width,
      (1 - (ndc.y + 1) * 0.5) * rect.height
    );
  }

  // Apply rotation based on drag angle.
  handleRotate() {
    if (this.rotationStartVector.lengthSq() === 0) return;

    const axis = this.rotationAxisWorld.clone().normalize();
    const currentVector = this.dragPoint
      .clone()
      .sub(this.rotationCenterWorld)
      .projectOnPlane(axis)
      .normalize();

    if (currentVector.lengthSq() === 0) return;

    const cross = new THREE.Vector3().crossVectors(this.rotationStartVector, currentVector);
    const dot = THREE.MathUtils.clamp(this.rotationStartVector.dot(currentVector), -1, 1);
    const angle = Math.atan2(axis.dot(cross), dot);

    const deltaQuat = new THREE.Quaternion().setFromAxisAngle(axis, angle);
    const newWorldQuat = deltaQuat.multiply(this.rotationStartWorldQuat.clone());
    const parentInv = this.rotationParentWorldQuat.clone().invert();
    const newLocalQuat = parentInv.multiply(newWorldQuat);

    this.object.quaternion.copy(newLocalQuat);
  }

  // Apply scaling along the selected axis.
  handleScale(event) {
    // Use incremental movement along the axis ray intersection when possible,
    // with screen-space projection as a fallback.
    const axisDistance = this.axisLength * this.gizmoGroup.scale.x;
    let factor = 1;

    if (
      this.scaleAxisWorld.lengthSq() > 0 &&
      Number.isFinite(this.scaleAxisLastT) &&
      axisDistance > 1e-6
    ) {
      const currentT = this.getAxisRayParameter(
        this.raycaster.ray,
        this.scaleAxisOriginWorld,
        this.scaleAxisWorld
      );
      if (Number.isFinite(currentT)) {
        const deltaT = currentT - this.scaleAxisLastT;
        const normalized = deltaT / axisDistance;
        const rawFactor = Math.exp(normalized * 1.0);
        factor = Math.min(4, Math.max(0.25, rawFactor));
        this.scaleAxisLastT = currentT;
      }
    }

    if (factor === 1) {
      // Screen-space fallback (keeps working when axis is nearly parallel to the view)
      const sensitivity = 0.003;
      const dx = event.clientX - this.lastMouseScreenX;
      const dy = event.clientY - this.lastMouseScreenY;

      let delta = -dy;
      if (this.scaleAxisScreenDir.lengthSq() > 0) {
        delta = dx * this.scaleAxisScreenDir.x + dy * this.scaleAxisScreenDir.y;
      }

      const rawFactor = Math.exp(delta * sensitivity);
      factor = Math.min(4, Math.max(0.25, rawFactor));
    }

    const scale = this.object.scale.clone();
    if (event.shiftKey) {
      scale.multiplyScalar(factor);
      scale.x = Math.max(0.01, scale.x);
      scale.y = Math.max(0.01, scale.y);
      scale.z = Math.max(0.01, scale.z);
    } else if (this.axis === "x") {
      scale.x = Math.max(0.01, scale.x * factor);
    } else if (this.axis === "y") {
      scale.y = Math.max(0.01, scale.y * factor);
    } else if (this.axis === "z") {
      scale.z = Math.max(0.01, scale.z * factor);
    } else {
      // Uniform scale if axis isn't specified
      scale.multiplyScalar(factor);
      scale.x = Math.max(0.01, scale.x);
      scale.y = Math.max(0.01, scale.y);
      scale.z = Math.max(0.01, scale.z);
    }

    this.object.scale.copy(scale);
    this.lastMouseScreenX = event.clientX;
    this.lastMouseScreenY = event.clientY;
  }

  // Resolve the active axis vector.
  getAxisVector() {
    switch (this.axis) {
      case "x":
        return new THREE.Vector3(1, 0, 0);
      case "y":
        return new THREE.Vector3(0, 1, 0);
      case "z":
        return new THREE.Vector3(0, 0, 1);
      default:
        return new THREE.Vector3(0, 0, 0);
    }
  }

  // Finalize drag interactions and emit commits.
  onMouseUp() {
    if (this.isDragging) {
      // If we were scaling, trigger transform callback now to update panel
      if (this.handleType === "scale" || this.mode === "scale") {
        if (this.listeners.onTransform && this.object) {
          this.listeners.onTransform({
            position: this.object.position.clone(),
            rotation: this.object.rotation.clone(),
            scale: this.object.scale.clone(),
          });
        }
        this.updateGizmoPosition();
      }
      
      this.isDragging = false;
      this.axis = null;
      this.handleType = null;
      this.dragButton = null;
    }
  }

  // Register a transform event callback.
  onTransform(callback) {
    this.listeners.onTransform = callback;
  }

  // Set gizmo and object transforms programmatically.
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

  // Show the gizmo group.
  show() {
    this.gizmoGroup.visible = true;
  }

  // Hide the gizmo group.
  hide() {
    this.gizmoGroup.visible = false;
  }

  // Dispose geometries and materials.
  dispose() {
    this.gizmoGroup.children.forEach((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    });
    this.scene.remove(this.gizmoGroup);
  }
}
