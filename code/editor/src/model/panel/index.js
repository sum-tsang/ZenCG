import * as THREE from "three";
import { unitsToMeters, metersToUnits } from "../../core/config/settings.js";
import { buildTransformationPanelUI } from "./uiFactory.js";
const formatValue = (value, digits = 2) => parseFloat(Number(value).toFixed(digits));

/**
 * TransformationPanel - UI for numerical transformation inputs
 * Provides precise control over translate, rotate, and scale operations
 */
export class TransformationPanel {
  // Initializes class state
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      throw new Error(`Container with id "${containerId}" not found.`);
    }

    this.gizmo = null;
    this.transformObject = null;
    this.isUpdatingFromGizmo = false;
    this.currentMode = "translate";
    this.state = {
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
    };

    this.listeners = {
      onTransform: null,
      onSplitRequest: null,
      onCancelSplit: null,
      onCombineRequest: null,
      onModeChange: null,
    };

    this.initializeUI();
  }
  // Handles initialize ui
  initializeUI() {
    const sections = buildTransformationPanelUI({
      container: this.container,
      state: this.state,
      onSetMode: (mode) => this.setMode(mode),
      onSplit: () => this.listeners.onSplitRequest?.(),
      onCancelSplit: () => this.listeners.onCancelSplit?.(),
      onCombine: () => this.listeners.onCombineRequest?.(),
      onReset: () => this.resetTransform(),
      onInputChange: (input, commit) => this.onInputChange(input, commit),
    });
    this.positionSection = sections.positionSection;
    this.rotationSection = sections.rotationSection;
    this.scaleSection = sections.scaleSection;
  }
  // Sets mode
  setMode(mode) {
    const buttons = this.container.querySelectorAll(".mode-btn");
    buttons.forEach((btn) => {
      btn.classList.remove("active");
      btn.setAttribute("aria-pressed", "false");
    });
    const activeButton = this.container.querySelector(`[data-mode="${mode}"]`);
    if (activeButton) {
      activeButton.classList.add("active");
      activeButton.setAttribute("aria-pressed", "true");
    }

    this.currentMode = mode;
    this.positionSection.style.display = "none";
    this.rotationSection.style.display = "none";
    this.scaleSection.style.display = "none";
    if (mode === "translate") {
      this.positionSection.style.display = "flex";
    } else if (mode === "rotate") {
      this.rotationSection.style.display = "flex";
    } else if (mode === "scale") {
      this.scaleSection.style.display = "flex";
    }

    if (this.gizmo) {
      this.gizmo.setMode(mode);
    }

    if (this.listeners.onModeChange) {
      this.listeners.onModeChange(mode);
    }
  }
  // Handles on input change
  onInputChange(input, commit = false) {
    const property = input.dataset.property;
    const axis = input.dataset.axis;
    const value = parseFloat(input.value) || 0;

    this.state[property][axis] = value;
    this.applyTransformation({ commit });
  }
  // Applies transformation
  applyTransformation({ commit = false } = {}) {
    if (!this.transformObject || this.isUpdatingFromGizmo) return;

    const { position, rotation, scale } = this.state;
    const positionUnits = {
      x: metersToUnits(position.x),
      y: metersToUnits(position.y),
      z: metersToUnits(position.z),
    };
    if (this.transformObject.position) {
      this.transformObject.position.set(positionUnits.x, positionUnits.y, positionUnits.z);
    }
    if (this.transformObject.rotation) {
      this.transformObject.rotation.order = "XYZ";
      this.transformObject.rotation.set(
        (rotation.x * Math.PI) / 180,
        (rotation.y * Math.PI) / 180,
        (rotation.z * Math.PI) / 180
      );
    }
    if (this.transformObject.scale) {
      this.transformObject.scale.set(scale.x, scale.y, scale.z);
    }
    if (this.gizmo) {
      this.gizmo.updateGizmoPosition();
    }
    if (this.listeners.onTransform) {
      this.listeners.onTransform({
        position: this.transformObject.position.clone(),
        rotation: this.transformObject.rotation.clone(),
        scale: this.transformObject.scale.clone(),
        mode: this.currentMode,
        commit,
        source: "panel",
      });
    }
  }
  // Sets object
  setObject(object) {
    this.transformObject = object;
    if (object) {
      this.updatePanelFromObject();
    }
  }
  // Sets gizmo
  setGizmo(gizmo) {
    this.gizmo = gizmo;
    if (this.gizmo && this.transformObject) {
      this.gizmo.setObject(this.transformObject);
      this.gizmo.show();
    }
  }
  // Handles on split
  onSplit(callback) {
    this.listeners.onSplitRequest = callback;
  }
  // Handles on cancel split
  onCancelSplit(callback) {
    this.listeners.onCancelSplit = callback;
  }
  // Handles on combine
  onCombine(callback) {
    this.listeners.onCombineRequest = callback;
  }
  // Sets combine enabled
  setCombineEnabled(enabled) {
    const combineButton = this.container.querySelector(".combine-btn");
    if (!(combineButton instanceof HTMLButtonElement)) return;
    combineButton.disabled = !enabled;
  }
  // Updates panel from object
  updatePanelFromObject() {
    if (!this.transformObject) return;

    this.isUpdatingFromGizmo = true;

    const { position, rotation, scale } = this.transformObject;
    this.state.position = {
      x: formatValue(unitsToMeters(position.x)),
      y: formatValue(unitsToMeters(position.y)),
      z: formatValue(unitsToMeters(position.z)),
    };
    this.state.rotation = {
      x: formatValue((rotation.x * 180) / Math.PI),
      y: formatValue((rotation.y * 180) / Math.PI),
      z: formatValue((rotation.z * 180) / Math.PI),
    };
    this.state.scale = {
      x: formatValue(scale.x),
      y: formatValue(scale.y),
      z: formatValue(scale.z),
    };
    this.updateInputFields();

    this.isUpdatingFromGizmo = false;
  }
  // Updates input fields
  updateInputFields() {
    const { position, rotation, scale } = this.state;
    ["x", "y", "z"].forEach((axis) => {
      const input = this.container.querySelector(`.input-position-${axis}`);
      if (input) input.value = position[axis];
    });
    ["x", "y", "z"].forEach((axis) => {
      const input = this.container.querySelector(`.input-rotation-${axis}`);
      if (input) input.value = rotation[axis];
    });
    ["x", "y", "z"].forEach((axis) => {
      const input = this.container.querySelector(`.input-scale-${axis}`);
      if (input) input.value = scale[axis];
    });
  }
  // Handles reset transform
  resetTransform() {
    if (!this.transformObject) return;

    this.transformObject.position.set(0, 0, 0);
    this.transformObject.rotation.set(0, 0, 0);
    this.transformObject.scale.set(1, 1, 1);

    this.state = {
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
    };

    this.updateInputFields();

    if (this.gizmo) {
      this.gizmo.updateGizmoPosition();
    }

    if (this.listeners.onTransform) {
      this.listeners.onTransform({
        position: this.transformObject.position.clone(),
        rotation: this.transformObject.rotation.clone(),
        scale: this.transformObject.scale.clone(),
        mode: this.currentMode,
        commit: true,
        source: "reset",
        action: "reset",
      });
    }
  }
  // Handles on transform
  onTransform(callback) {
    this.listeners.onTransform = callback;
  }
  // Handles on mode change
  onModeChange(callback) {
    this.listeners.onModeChange = callback;
  }
  // Gets current mode
  getCurrentMode() {
    return this.currentMode;
  }
  // Updates from gizmo
  updateFromGizmo(transform) {
    this.isUpdatingFromGizmo = true;

    if (transform.position) {
      this.state.position = {
        x: formatValue(unitsToMeters(transform.position.x)),
        y: formatValue(unitsToMeters(transform.position.y)),
        z: formatValue(unitsToMeters(transform.position.z)),
      };
    }

    if (transform.rotation) {
      let euler;
      if (transform.rotation instanceof THREE.Quaternion) {
        euler = new THREE.Euler().setFromQuaternion(transform.rotation);
      } else if (transform.rotation instanceof THREE.Euler) {
        euler = transform.rotation;
      } else {
        euler = new THREE.Euler();
      }
      
      this.state.rotation = {
        x: formatValue((euler.x * 180) / Math.PI),
        y: formatValue((euler.y * 180) / Math.PI),
        z: formatValue((euler.z * 180) / Math.PI),
      };
    }

    if (transform.scale) {
      this.state.scale = {
        x: formatValue(transform.scale.x),
        y: formatValue(transform.scale.y),
        z: formatValue(transform.scale.z),
      };
    }

    this.updateInputFields();
    this.isUpdatingFromGizmo = false;
  }
  // Handles dispose
  dispose() {
    this.container.innerHTML = "";
  }
}
