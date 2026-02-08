// Transform panel UI.
import * as THREE from "three";
import { unitsToMeters, metersToUnits } from "../app/units.js";

const svgNs = "http://www.w3.org/2000/svg";

function createModeIcon(mode) {
  const svg = document.createElementNS(svgNs, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.classList.add("mode-icon");

  const path = document.createElementNS(svgNs, "path");

  if (mode === "translate") {
    path.setAttribute(
      "d",
      "M12 2l3 3h-2v4h-2V5H9l3-3zm0 20l-3-3h2v-4h2v4h2l-3 3zm10-10l-3 3v-2h-4v-2h4V9l3 3zM2 12l3-3v2h4v2H5v2l-3-3z"
    );
  } else if (mode === "rotate") {
    path.setAttribute(
      "d",
      "M12 4a8 8 0 1 1-7.45 5H6a6 6 0 1 0 6-4V4zM5 9V5h4l-1.6 1.6A8 8 0 0 1 12 4"
    );
  } else {
    path.setAttribute(
      "d",
      "M5 5h5v2H7v3H5V5zm14 14h-5v-2h3v-3h2v5zM14 5h5v5h-2V7h-3V5zM5 14h2v3h3v2H5v-5z"
    );
  }

  svg.appendChild(path);
  return svg;
}

const formatValue = (value, digits = 2) => parseFloat(Number(value).toFixed(digits));

/**
 * TransformationPanel - UI for numerical transformation inputs
 * Provides precise control over translate, rotate, and scale operations
 */
export class TransformationPanel {
  // Initialize panel UI state and wire events.
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      throw new Error(`Container with id "${containerId}" not found.`);
    }

    this.gizmo = null;
    this.transformObject = null;
    this.isUpdatingFromGizmo = false;
    this.currentMode = "translate";
    this.historyList = null;

    // State tracking
    this.state = {
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
    };

    this.listeners = {
      onTransform: null,
      onSplitRequest: null,
      onCancelSplit: null,
    };

    this.initializeUI();
  }

  // Build the panel DOM structure and inputs.
  initializeUI() {
    // Clear existing content
    this.container.innerHTML = "";

    // Create transformation panel structure
    const panel = document.createElement("div");
    panel.id = "transformation-panel";
    panel.className = "transform-panel";

    // Mode selector
    const modeGroup = this.createSection("Mode");
    const modeButtons = document.createElement("div");
    modeButtons.className = "mode-buttons";

    const modes = [
      { name: "Translate", value: "translate" },
      { name: "Rotate", value: "rotate" },
      { name: "Scale", value: "scale" },
    ];

    modes.forEach((mode) => {
      const btn = document.createElement("button");
      btn.setAttribute("aria-label", mode.name);
      btn.setAttribute("title", mode.name);
      btn.setAttribute("aria-pressed", mode.value === "translate" ? "true" : "false");
      btn.className = `mode-btn ${mode.value}`;
      if (mode.value === "translate") btn.classList.add("active");
      btn.dataset.mode = mode.value;
      btn.addEventListener("click", (e) => this.setMode(e.currentTarget.dataset.mode));
      btn.appendChild(createModeIcon(mode.value));
      modeButtons.appendChild(btn);
    });

    modeGroup.appendChild(modeButtons);
    panel.appendChild(modeGroup);

    // Create Component button (placed near top for visibility)
    const splitRow = document.createElement("div");
    splitRow.className = "split-row";
    const splitBtn = document.createElement("button");
    splitBtn.className = "split-btn";
    const splitLabel = document.createElement("span");
    splitLabel.className = "split-label";
    splitLabel.textContent = "Create Component";
    const splitHint = document.createElement("span");
    splitHint.className = "split-hint";
    splitHint.textContent = "click mesh";
    splitBtn.append(splitLabel, splitHint);
    splitRow.appendChild(splitBtn);
    
    // Cancel button (hidden by default, shown during box selection)
    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = "Cancel";
    cancelBtn.className = "cancel-split-btn";
    cancelBtn.style.display = "none";
    splitRow.appendChild(cancelBtn);
    
    panel.appendChild(splitRow);
    splitBtn.addEventListener("click", () => {
      if (this.listeners.onSplitRequest) this.listeners.onSplitRequest();
    });
    cancelBtn.addEventListener("click", () => {
      if (this.listeners.onCancelSplit) this.listeners.onCancelSplit();
    });

    const unitIndicator = document.createElement("p");
    unitIndicator.className = "unit-indicator";
    unitIndicator.textContent = "Units: m";
    panel.appendChild(unitIndicator);

    // Position section
    this.positionSection = this.createTransformSection("Position", "position", "Position (m)");
    panel.appendChild(this.positionSection);

    // Rotation section
    this.rotationSection = this.createTransformSection("Rotation", "rotation", "Rotation (deg)");
    this.rotationSection.style.display = "none";
    panel.appendChild(this.rotationSection);

    // Scale section
    this.scaleSection = this.createTransformSection("Scale", "scale", "Scale (x)");
    this.scaleSection.style.display = "none";
    panel.appendChild(this.scaleSection);

    // Reset button
    const resetSection = this.createSection("Reset");
    const resetBtn = document.createElement("button");
    resetBtn.textContent = "Reset to Default";
    resetBtn.className = "reset-btn";
    resetBtn.addEventListener("click", () => this.resetTransform());
    resetSection.appendChild(resetBtn);
    panel.appendChild(resetSection);

    const externalHistory = document.getElementById("action-history-list");
    if (externalHistory instanceof HTMLUListElement) {
      this.historyList = externalHistory;
    } else {
      // History section (fallback)
      const historySection = this.createSection("History");
      historySection.classList.add("history-section");
      const historyScroll = document.createElement("div");
      historyScroll.className = "history-scroll";
      this.historyList = document.createElement("ul");
      this.historyList.className = "history-list";
      historyScroll.appendChild(this.historyList);
      historySection.appendChild(historyScroll);
      panel.appendChild(historySection);
    }

    this.container.appendChild(panel);
    this.renderHistory([]);
    this.setupListeners();
  }

  // Create a titled panel section wrapper.
  createSection(title) {
    const section = document.createElement("div");
    section.className = "transform-section";

    const titleEl = document.createElement("h3");
    titleEl.textContent = title;
    titleEl.className = "section-title";
    section.appendChild(titleEl);

    return section;
  }

  // Create a position/rotation/scale input section.
  createTransformSection(title, property, label) {
    const section = this.createSection(title);
    section.className = "transform-section expanded";

    const contentDiv = document.createElement("div");
    contentDiv.className = "transform-content";

    const axes = ["x", "y", "z"];

    axes.forEach((axis) => {
      const row = document.createElement("div");
      row.className = "input-row";

      const labelEl = document.createElement("label");
      labelEl.textContent = axis.toUpperCase();
      labelEl.className = `label-${axis}`;

      const input = document.createElement("input");
      input.type = "number";
      input.className = `input-${property}-${axis}`;
      input.dataset.property = property;
      input.dataset.axis = axis;
      input.step = property === "rotation" ? "1" : "0.01";
      input.value = this.state[property][axis];

      // Set appropriate initial value and step
      if (property === "scale") {
        input.value = "1";
        input.min = "0.01";
        input.max = "10";
      } else if (property === "rotation") {
        input.value = "0";
        input.min = "-360";
        input.max = "360";
      } else {
        input.value = "0";
      }

      input.addEventListener("input", (e) =>
        this.onInputChange(e.target, false)
      );
      input.addEventListener("change", (e) =>
        this.onInputChange(e.target, true)
      );

      const unit = document.createElement("span");
      unit.className = "input-unit";
      if (property === "rotation") {
        unit.textContent = "°";
      } else if (property === "scale") {
        unit.textContent = "x";
      } else {
        unit.textContent = "m";
      }

      row.appendChild(labelEl);
      row.appendChild(input);
      row.appendChild(unit);
      contentDiv.appendChild(row);
    });

    section.appendChild(contentDiv);
    return section;
  }

  // Hook any delegated listeners for the panel.
  setupListeners() {
    // Delegate click handlers for mode buttons are already set up in initializeUI
  }

  // Switch the active transform mode and visible inputs.
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

    // Hide all sections
    this.positionSection.style.display = "none";
    this.rotationSection.style.display = "none";
    this.scaleSection.style.display = "none";

    // Show only the active section
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
  }

  // Handle numeric input changes and emit transforms.
  onInputChange(input, commit = false) {
    const property = input.dataset.property;
    const axis = input.dataset.axis;
    const value = parseFloat(input.value) || 0;

    this.state[property][axis] = value;

    // Apply transformation
    this.applyTransformation({ commit });
  }

  applyTransformation({ commit = false } = {}) {
    if (!this.transformObject || this.isUpdatingFromGizmo) return;

    const { position, rotation, scale } = this.state;
    const positionUnits = {
      x: metersToUnits(position.x),
      y: metersToUnits(position.y),
      z: metersToUnits(position.z),
    };

    // Update position
    if (this.transformObject.position) {
      this.transformObject.position.set(positionUnits.x, positionUnits.y, positionUnits.z);
    }

    // Update rotation (convert degrees to radians)
    if (this.transformObject.rotation) {
      this.transformObject.rotation.order = "XYZ";
      this.transformObject.rotation.set(
        (rotation.x * Math.PI) / 180,
        (rotation.y * Math.PI) / 180,
        (rotation.z * Math.PI) / 180
      );
    }

    // Update scale
    if (this.transformObject.scale) {
      this.transformObject.scale.set(scale.x, scale.y, scale.z);
    }

    // Update gizmo position
    if (this.gizmo) {
      this.gizmo.updateGizmoPosition();
    }

    // Notify listeners
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

  // Bind the panel to a target object.
  setObject(object) {
    this.transformObject = object;
    if (object) {
      this.updatePanelFromObject();
    }
  }

  // Attach the active gizmo to drive UI updates.
  setGizmo(gizmo) {
    this.gizmo = gizmo;
    if (this.gizmo && this.transformObject) {
      this.gizmo.setObject(this.transformObject);
      this.gizmo.show();
    }
  }

  // Register a split request callback.
  onSplit(callback) {
    this.listeners.onSplitRequest = callback;
  }

  // Register a cancel split callback.
  onCancelSplit(callback) {
    this.listeners.onCancelSplit = callback;
  }

  // Refresh input values from the bound object.
  updatePanelFromObject() {
    if (!this.transformObject) return;

    this.isUpdatingFromGizmo = true;

    const { position, rotation, scale } = this.transformObject;

    // Update position
    this.state.position = {
      x: formatValue(unitsToMeters(position.x)),
      y: formatValue(unitsToMeters(position.y)),
      z: formatValue(unitsToMeters(position.z)),
    };

    // Update rotation (convert radians to degrees)
    this.state.rotation = {
      x: formatValue((rotation.x * 180) / Math.PI),
      y: formatValue((rotation.y * 180) / Math.PI),
      z: formatValue((rotation.z * 180) / Math.PI),
    };

    // Update scale
    this.state.scale = {
      x: formatValue(scale.x),
      y: formatValue(scale.y),
      z: formatValue(scale.z),
    };

    // Update input fields
    this.updateInputFields();

    this.isUpdatingFromGizmo = false;
  }

  // Sync input fields from the current state values.
  updateInputFields() {
    const { position, rotation, scale } = this.state;

    // Update position inputs
    ["x", "y", "z"].forEach((axis) => {
      const input = this.container.querySelector(`.input-position-${axis}`);
      if (input) input.value = position[axis];
    });

    // Update rotation inputs
    ["x", "y", "z"].forEach((axis) => {
      const input = this.container.querySelector(`.input-rotation-${axis}`);
      if (input) input.value = rotation[axis];
    });

    // Update scale inputs
    ["x", "y", "z"].forEach((axis) => {
      const input = this.container.querySelector(`.input-scale-${axis}`);
      if (input) input.value = scale[axis];
    });
  }

  // Reset the bound object to default transforms.
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

  // Register a transform change callback.
  onTransform(callback) {
    this.listeners.onTransform = callback;
  }

  // Return the current transform mode.
  getCurrentMode() {
    return this.currentMode;
  }

  // Render the action history list.
  renderHistory(entries = []) {
    if (!this.historyList) return;
    this.historyList.innerHTML = "";

    if (!entries.length) {
      const empty = document.createElement("li");
      empty.className = "history-item history-empty";
      empty.textContent = "No actions yet";
      this.historyList.appendChild(empty);
      return;
    }

    entries.forEach((entry) => {
      const item = document.createElement("li");
      item.className = "history-item";
      item.textContent = entry;
      this.historyList.appendChild(item);
    });
  }

  // Update inputs from gizmo-driven transforms.
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

  dispose() {
    this.container.innerHTML = "";
  }
}
