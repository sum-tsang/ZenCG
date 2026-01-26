import * as THREE from "three";

/**
 * TransformationGizmo - Interactive 3D gizmo for model transformations
 * Provides visual feedback for translate, rotate, and scale operations
 */
export class TransformationGizmo {
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
    this.initialMouseScreen = new THREE.Vector2();
    this.initialHandleWorldPos = new THREE.Vector3();
    this.dragButton = null;

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
  }

  initializeAxes() {
    const axisLength = 6;
    const arrowLength = 1.2;
    const arrowRadius = 0.25;

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
      
      // Create arrow helper for visual representation
      const origin = new THREE.Vector3();
      const arrow = new THREE.ArrowHelper(
        direction,
        origin,
        axisLength,
        color,
        arrowLength,
        arrowRadius
      );
      arrow.name = `axis-${axis}`;
      arrow.userData.axis = axis;
      this.gizmoGroup.add(arrow);
      this.axes[axis] = arrow;

      // Create invisible cylinder for mouse interaction - MUCH BIGGER
      const cylinderGeom = new THREE.CylinderGeometry(
        0.6,
        0.6,
        axisLength * 1.5,
        16
      );
      const cylinderMat = new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
      });
      const cylinder = new THREE.Mesh(cylinderGeom, cylinderMat);
      cylinder.userData.axis = axis;
      cylinder.userData.isGizmoAxis = true;

      // Rotate cylinder to align with axis
      if (axis === "x") {
        cylinder.rotation.z = Math.PI / 2;
      } else if (axis === "z") {
        cylinder.rotation.x = Math.PI / 2;
      }

      this.gizmoGroup.add(cylinder);
      // Add explicit scale handle (colored box) at the end of the axis
      const boxGeom = new THREE.BoxGeometry(0.8, 0.8, 0.8);
      const boxMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 });
      const box = new THREE.Mesh(boxGeom, boxMat);
      box.name = `scale-handle-${axis}`;
      box.userData.axis = axis;
      box.userData.isGizmoAxis = true;
      box.userData.handleType = "scale";
      // position the box at the tip of the arrow
      box.position.copy(direction.clone().multiplyScalar(axisLength + arrowLength * 0.6));
      // Hidden by default unless in scale mode
      box.visible = this.mode === "scale";
      this.gizmoGroup.add(box);
    });

    // Add rotation rings for visual feedback
    this.addRotationRings();
  }

  addRotationRings() {
    const ringRadius = 5;
    const ringThickness = 0.2;

    const ringColors = {
      x: 0xff0000,
      y: 0x00ff00,
      z: 0x0000ff,
    };

    // X rotation ring
    let ringGeom = new THREE.TorusGeometry(ringRadius, ringThickness, 8, 64);
    let ringMat = new THREE.MeshBasicMaterial({ color: ringColors.x, transparent: true, opacity: 0.3 });
    let ring = new THREE.Mesh(ringGeom, ringMat);
    ring.rotation.y = Math.PI / 2;
    ring.userData.axis = "x";
    ring.userData.isRotationRing = true;
    ring.userData.isGizmoAxis = true;
    ring.userData.handleType = "rotate";
    ring.visible = this.mode === "rotate";
    this.gizmoGroup.add(ring);

    // Y rotation ring
    ringGeom = new THREE.TorusGeometry(ringRadius, ringThickness, 8, 64);
    ringMat = new THREE.MeshBasicMaterial({ color: ringColors.y, transparent: true, opacity: 0.3 });
    ring = new THREE.Mesh(ringGeom, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.userData.axis = "y";
    ring.userData.isRotationRing = true;
    ring.userData.isGizmoAxis = true;
    ring.userData.handleType = "rotate";
    ring.visible = this.mode === "rotate";
    this.gizmoGroup.add(ring);

    // Z rotation ring
    ringGeom = new THREE.TorusGeometry(ringRadius, ringThickness, 8, 64);
    ringMat = new THREE.MeshBasicMaterial({ color: ringColors.z, transparent: true, opacity: 0.3 });
    ring = new THREE.Mesh(ringGeom, ringMat);
    ring.userData.axis = "z";
    ring.userData.isRotationRing = true;
    ring.userData.isGizmoAxis = true;
    ring.userData.handleType = "rotate";
    ring.visible = this.mode === "rotate";
    this.gizmoGroup.add(ring);
  }

  setObject(object) {
    this.object = object;
    if (object) {
      this.updateGizmoPosition();
    }
  }

  setMode(mode) {
    if (["translate", "rotate", "scale"].includes(mode)) {
      this.mode = mode;
      this.updateGizmoAppearance();
    }
  }

  updateGizmoPosition() {
    if (!this.object) return;

    // Use world transforms so the gizmo matches the object's world-space
    // position/rotation/scale even when the object is nested under a parent
    const worldPos = new THREE.Vector3();
    const worldQuat = new THREE.Quaternion();
    const worldScale = new THREE.Vector3();

    // Ensure matrices are up-to-date so world queries return current values
    if (this.object.parent) this.object.parent.updateMatrixWorld(true);
    this.object.updateMatrixWorld(true);

    this.object.getWorldPosition(worldPos);
    this.object.getWorldQuaternion(worldQuat);
    this.object.getWorldScale(worldScale);

    this.gizmoGroup.position.copy(worldPos);
    this.gizmoGroup.quaternion.copy(worldQuat);
    this.gizmoGroup.scale.copy(worldScale);
  }

  updateGizmoAppearance() {
    // Adjust gizmo appearance based on mode
    const arrowScale = this.mode === "scale" ? 1.2 : 1;
    this.gizmoGroup.children.forEach((child) => {
      // Arrow helpers scale slightly when in scale mode
      if (child instanceof THREE.ArrowHelper) {
        child.scale.set(arrowScale, arrowScale, arrowScale);
        child.visible = true;
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
  highlightUnderMouse(event, camera, container) {
    if (!container) return;
    const rect = container.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, camera);

    const interactive = this.gizmoGroup.children.filter(
      (c) => c.userData && (c.userData.isGizmoAxis || c.userData.isRotationRing)
    );
    const intersects = this.raycaster.intersectObjects(interactive);

    if (intersects.length > 0) {
      const hit = intersects[0].object;
      // set cursor style
      const type = hit.userData.handleType || this.mode;
      if (type === "scale") container.style.cursor = "ew-resize";
      else if (type === "rotate") container.style.cursor = "grab";
      else container.style.cursor = "move";

      // highlight object
      if (this.highlightedObject && this.highlightedObject !== hit) {
        if (this.highlightedObject.material) this.highlightedObject.material.opacity = this.highlightedObject.userData.handleType === "scale" ? 0.9 : 0.5;
      }
      if (hit.material) hit.material.opacity = 1.0;
      this.highlightedObject = hit;
    } else {
      container.style.cursor = "auto";
      if (this.highlightedObject) {
        if (this.highlightedObject.material) {
          const defOpacity = this.highlightedObject.userData.handleType === "scale" ? (this.mode === "scale" ? 0.9 : 0) : (this.mode === "rotate" ? 0.5 : 0.15);
          this.highlightedObject.material.opacity = defOpacity;
        }
        this.highlightedObject = null;
      }
    }
  }

  onMouseDown(event, camera, container, forceFreeTranslate = false) {
    // Do not allow left-button to start model/gizmo drags.
    // Left-click will still be used for selection by the manager.
    if (event.button === 0) return false;

    if (!this.object) return;

    const rect = container.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, camera);

    // NOTE: Do not start free translate here unconditionally. Free translate
    // should only begin when the user actually clicks the object itself
    // (handled later via objectIntersects). This prevents accidental
    // translations when right-clicking empty space.

    // For rotate and scale modes, use axis-based interaction
    const interactiveObjects = this.gizmoGroup.children.filter((child) => child.userData.isGizmoAxis);
    const intersects = this.raycaster.intersectObjects(interactiveObjects);

    // Also test whether the click hit the current object (for translate mode)
    const objectIntersects = this.object ? this.raycaster.intersectObject(this.object, true) : [];
    if (intersects.length > 0) {
      this.isDragging = true;
      this.dragButton = event.button;
      this.axis = intersects[0].object.userData.axis;
      this.handleType = intersects[0].object.userData.handleType || null;

      // Store initial values
      this.initialPosition.copy(this.object.position);
      this.initialRotation.copy(this.object.rotation);
      this.initialScale.copy(this.object.scale);
      this.object.getWorldQuaternion(this.initialQuaternion);
      this.startMouseScreenY = event.clientY;
      this.lastMouseScreenY = event.clientY;
      
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

      // Setup drag plane for rotation/scale
      // For scaling, use a plane perpendicular to camera view so mouse movement
      // projects naturally onto the axis direction
      if (this.handleType === "scale" || this.mode === "scale") {
        // Use camera-facing plane - this allows the handle to follow mouse direction
        const cameraDirection = new THREE.Vector3();
        camera.getWorldDirection(cameraDirection);
        const normal = cameraDirection.negate();

        const worldPos = new THREE.Vector3();
        this.object.getWorldPosition(worldPos);

        this.dragPlane.setFromNormalAndCoplanarPoint(normal, worldPos);
      } else {
        // For rotation, use plane perpendicular to axis
        const normal = this.getAxisVector();
        const worldPos = new THREE.Vector3();
        this.object.getWorldPosition(worldPos);
        this.dragPlane.setFromNormalAndCoplanarPoint(normal, worldPos);
      }

      // Get initial drag point
      this.raycaster.ray.intersectPlane(this.dragPlane, this.lastDragPoint);
      this.initialDragPoint.copy(this.lastDragPoint);

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

        // Get initial drag point
        this.raycaster.ray.intersectPlane(this.dragPlane, this.lastDragPoint);

        return true;
      }

    return false;
  }

  onMouseMove(event, camera, container) {
    // CRITICAL: If left mouse button is pressed, completely ignore this event
    // Left button is reserved for camera controls only
    if (event.buttons !== undefined && (event.buttons & 1)) {
      // Stop dragging if left button is detected
      if (this.isDragging) {
        this.onMouseUp();
      }
      return;
    }
    
    // Only process mouse move if a drag was started and it was started
    // by the right mouse button (button === 2).
    if (!this.isDragging || this.dragButton !== 2 || !this.object || !this.axis) return;

    const rect = container.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, camera);
    this.raycaster.ray.intersectPlane(this.dragPlane, this.dragPoint);

    const delta = new THREE.Vector3().subVectors(this.dragPoint, this.lastDragPoint);

    if (this.mode === "translate") {
      if (this.axis === "free") {
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
        // Constrained movement along axis
        this.handleTranslate(delta);
      }
    } else {
      // Prefer explicit handle type (e.g., clicking a scale handle)
      if (this.handleType === "scale" || this.mode === "scale") {
        // Use screen-space distance for stable scaling
        this.handleScale(event);
      } else if (this.handleType === "rotate" || this.mode === "rotate") {
        this.handleRotate(delta);
      }
    }

    this.lastDragPoint.copy(this.dragPoint);
    
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

  handleTranslate(delta) {
    // Apply axis-constrained translation in world-space then convert to local
    const axisVector = this.getAxisVector();
    if (axisVector.lengthSq() === 0) return;

    // axisVector is in local space of the gizmo; convert to world-space
    const worldAxis = axisVector.clone().applyQuaternion(this.gizmoGroup.quaternion).normalize();

    // Project delta onto world axis
    const projectedDelta = worldAxis.clone().multiplyScalar(delta.dot(worldAxis));

    // Compute new world position and convert to parent-local
    if (this.object.parent) this.object.parent.updateMatrixWorld(true);
    this.object.updateMatrixWorld(true);

    const worldPos = new THREE.Vector3();
    this.object.getWorldPosition(worldPos);
    worldPos.add(projectedDelta);
    if (this.object.parent) this.object.parent.worldToLocal(worldPos);
    this.object.position.copy(worldPos);
  }

  handleRotate(delta) {
    const rotationAmount = delta.length() * 0.01;
    const axisVector = this.getAxisVector();

    const quaternion = new THREE.Quaternion();
    quaternion.setFromAxisAngle(axisVector, rotationAmount);

    const currentQuat = new THREE.Quaternion().setFromEuler(this.object.rotation);
    currentQuat.multiplyQuaternions(quaternion, currentQuat);

    this.object.quaternion.copy(currentQuat);
  }

  handleScale(event) {
    // Use vertical mouse movement to compute a multiplicative scale factor.
    // Use vertical mouse movement relative to the initial click to compute
    // a stable multiplicative scale factor. Use an exponential mapping so
    // scaling is smooth and symmetric and never flips sign.
    const sensitivity = 0.005; // adjust to taste
    const dy = this.startMouseScreenY - event.clientY;
    const factor = Math.exp(dy * sensitivity);

    const scale = this.initialScale.clone();
    if (this.axis === "x") {
      scale.x = Math.max(0.01, this.initialScale.x * factor);
    } else if (this.axis === "y") {
      scale.y = Math.max(0.01, this.initialScale.y * factor);
    } else if (this.axis === "z") {
      scale.z = Math.max(0.01, this.initialScale.z * factor);
    } else {
      // Uniform scale if axis isn't specified
      scale.multiplyScalar(factor);
      scale.x = Math.max(0.01, scale.x);
      scale.y = Math.max(0.01, scale.y);
      scale.z = Math.max(0.01, scale.z);
    }

    this.object.scale.copy(scale);
  }

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
      }
      
      this.isDragging = false;
      this.axis = null;
      this.handleType = null;
      this.dragButton = null;
    }
  }

  onTransform(callback) {
    this.listeners.onTransform = callback;
  }

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

  show() {
    this.gizmoGroup.visible = true;
  }

  hide() {
    this.gizmoGroup.visible = false;
  }

  dispose() {
    this.gizmoGroup.children.forEach((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    });
    this.scene.remove(this.gizmoGroup);
  }
}
