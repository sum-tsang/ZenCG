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
    this.gizmoGroup.add(ring);

    // Y rotation ring
    ringGeom = new THREE.TorusGeometry(ringRadius, ringThickness, 8, 64);
    ringMat = new THREE.MeshBasicMaterial({ color: ringColors.y, transparent: true, opacity: 0.3 });
    ring = new THREE.Mesh(ringGeom, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.userData.axis = "y";
    ring.userData.isRotationRing = true;
    this.gizmoGroup.add(ring);

    // Z rotation ring
    ringGeom = new THREE.TorusGeometry(ringRadius, ringThickness, 8, 64);
    ringMat = new THREE.MeshBasicMaterial({ color: ringColors.z, transparent: true, opacity: 0.3 });
    ring = new THREE.Mesh(ringGeom, ringMat);
    ring.userData.axis = "z";
    ring.userData.isRotationRing = true;
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

    this.gizmoGroup.position.copy(this.object.position);
    this.gizmoGroup.rotation.copy(this.object.rotation);
    this.gizmoGroup.scale.copy(this.object.scale);
  }

  updateGizmoAppearance() {
    // Adjust gizmo appearance based on mode
    const scale = this.mode === "scale" ? 1.2 : 1;
    this.gizmoGroup.children.forEach((child) => {
      if (child instanceof THREE.ArrowHelper) {
        child.scale.set(scale, scale, scale);
      }
    });
  }

  onMouseDown(event, camera, container) {
    if (!this.object) return;

    const rect = container.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, camera);

    // Check if we're in translate mode - if so, allow dragging the model itself
    if (this.mode === "translate") {
      // Create a plane at the object's position facing the camera
      const cameraDirection = new THREE.Vector3();
      camera.getWorldDirection(cameraDirection);
      const normal = cameraDirection.negate();

      this.dragPlane.setFromNormalAndCoplanarPoint(
        normal,
        this.object.position
      );

      this.isDragging = true;
      this.axis = "free"; // Free movement in translate mode

      // Store initial values
      this.initialPosition.copy(this.object.position);
      this.initialRotation.copy(this.object.rotation);
      this.initialScale.copy(this.object.scale);

      // Get initial drag point
      this.raycaster.ray.intersectPlane(this.dragPlane, this.lastDragPoint);

      return true;
    }

    // For rotate and scale modes, use axis-based interaction
    const interactiveObjects = this.gizmoGroup.children.filter(
      (child) => child.userData.isGizmoAxis
    );
    const intersects = this.raycaster.intersectObjects(interactiveObjects);

    if (intersects.length > 0) {
      this.isDragging = true;
      this.axis = intersects[0].object.userData.axis;

      // Store initial values
      this.initialPosition.copy(this.object.position);
      this.initialRotation.copy(this.object.rotation);
      this.initialScale.copy(this.object.scale);

      // Setup drag plane for rotation/scale
      const normal = this.getAxisVector();

      this.dragPlane.setFromNormalAndCoplanarPoint(
        normal,
        this.object.position
      );

      // Get initial drag point
      this.raycaster.ray.intersectPlane(this.dragPlane, this.lastDragPoint);

      return true;
    }

    return false;
  }

  onMouseMove(event, camera, container) {
    if (!this.isDragging || !this.object || !this.axis) return;

    const rect = container.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, camera);
    this.raycaster.ray.intersectPlane(this.dragPlane, this.dragPoint);

    const delta = new THREE.Vector3().subVectors(this.dragPoint, this.lastDragPoint);

    if (this.mode === "translate") {
      if (this.axis === "free") {
        // Free movement - move the object by the delta
        this.object.position.add(delta);
      } else {
        // Constrained movement along axis
        this.handleTranslate(delta);
      }
    } else if (this.mode === "rotate") {
      this.handleRotate(delta);
    } else if (this.mode === "scale") {
      this.handleScale(delta);
    }

    this.lastDragPoint.copy(this.dragPoint);
    this.updateGizmoPosition();

    if (this.listeners.onTransform) {
      this.listeners.onTransform({
        position: this.object.position.clone(),
        rotation: this.object.rotation.clone(),
        scale: this.object.scale.clone(),
      });
    }
  }

  handleTranslate(delta) {
    const axisVector = this.getAxisVector();
    
    // Project delta onto the axis direction
    const projectedDelta = axisVector.clone().multiplyScalar(delta.dot(axisVector));
    this.object.position.add(projectedDelta);
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

  handleScale(delta) {
    const axisVector = this.getAxisVector();
    const scaleChange = delta.dot(axisVector) * 0.5;
    
    const scale = this.object.scale.clone();
    
    if (this.axis === "x") {
      scale.x = Math.max(0.01, this.initialScale.x + scaleChange);
    } else if (this.axis === "y") {
      scale.y = Math.max(0.01, this.initialScale.y + scaleChange);
    } else if (this.axis === "z") {
      scale.z = Math.max(0.01, this.initialScale.z + scaleChange);
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
      this.isDragging = false;
      this.axis = null;
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
