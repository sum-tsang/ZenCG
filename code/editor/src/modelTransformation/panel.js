import * as THREE from "three";

/**
 * TransformationPanel - UI for numerical transformation inputs
 * Provides precise control over translate, rotate, and scale operations
 */
export class TransformationPanel {
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
    };

    this.initializeUI();
  }

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
      btn.textContent = mode.name;
      btn.className = `mode-btn ${mode.value}`;
      if (mode.value === "translate") btn.classList.add("active");
      btn.dataset.mode = mode.value;
      btn.addEventListener("click", (e) => this.setMode(e.target.dataset.mode));
      modeButtons.appendChild(btn);
    });

    modeGroup.appendChild(modeButtons);
    panel.appendChild(modeGroup);

    // Position section
    this.positionSection = this.createTransformSection("Position", "position", "Position (units)");
    panel.appendChild(this.positionSection);

    // Rotation section
    this.rotationSection = this.createTransformSection("Rotation", "rotation", "Rotation (degrees)");
    this.rotationSection.style.display = "none";
    panel.appendChild(this.rotationSection);

    // Scale section
    this.scaleSection = this.createTransformSection("Scale", "scale", "Scale (multiplier)");
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

    // History section
    const historySection = this.createSection("History");
    historySection.classList.add("history-section");
    this.historyList = document.createElement("ul");
    this.historyList.className = "history-list";
    historySection.appendChild(this.historyList);
    panel.appendChild(historySection);

    this.container.appendChild(panel);
    this.renderHistory([]);
    this.setupListeners();
  }

  createSection(title) {
    const section = document.createElement("div");
    section.className = "transform-section";

    const titleEl = document.createElement("h3");
    titleEl.textContent = title;
    titleEl.className = "section-title";
    section.appendChild(titleEl);

    return section;
  }

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

      row.appendChild(labelEl);
      row.appendChild(input);
      contentDiv.appendChild(row);
    });

    section.appendChild(contentDiv);
    return section;
  }

  setupListeners() {
    // Delegate click handlers for mode buttons are already set up in initializeUI
  }

  setMode(mode) {
    const buttons = this.container.querySelectorAll(".mode-btn");
    buttons.forEach((btn) => btn.classList.remove("active"));
    this.container
      .querySelector(`[data-mode="${mode}"]`)
      .classList.add("active");

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

    // Update position
    if (this.transformObject.position) {
      this.transformObject.position.set(position.x, position.y, position.z);
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

  setObject(object) {
    this.transformObject = object;
    if (object) {
      this.updatePanelFromObject();
    }
  }

  setGizmo(gizmo) {
    this.gizmo = gizmo;
    if (this.gizmo && this.transformObject) {
      this.gizmo.setObject(this.transformObject);
      this.gizmo.show();
    }
  }

  updatePanelFromObject() {
    if (!this.transformObject) return;

    this.isUpdatingFromGizmo = true;

    const { position, rotation, scale } = this.transformObject;

    // Update position
    this.state.position = {
      x: parseFloat(position.x.toFixed(2)),
      y: parseFloat(position.y.toFixed(2)),
      z: parseFloat(position.z.toFixed(2)),
    };

    // Update rotation (convert radians to degrees)
    this.state.rotation = {
      x: parseFloat(((rotation.x * 180) / Math.PI).toFixed(2)),
      y: parseFloat(((rotation.y * 180) / Math.PI).toFixed(2)),
      z: parseFloat(((rotation.z * 180) / Math.PI).toFixed(2)),
    };

    // Update scale
    this.state.scale = {
      x: parseFloat(scale.x.toFixed(2)),
      y: parseFloat(scale.y.toFixed(2)),
      z: parseFloat(scale.z.toFixed(2)),
    };

    // Update input fields
    this.updateInputFields();

    this.isUpdatingFromGizmo = false;
  }

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

  onTransform(callback) {
    this.listeners.onTransform = callback;
  }

  getCurrentMode() {
    return this.currentMode;
  }

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

  updateFromGizmo(transform) {
    this.isUpdatingFromGizmo = true;

    if (transform.position) {
      this.state.position = {
        x: parseFloat(transform.position.x.toFixed(2)),
        y: parseFloat(transform.position.y.toFixed(2)),
        z: parseFloat(transform.position.z.toFixed(2)),
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
        x: parseFloat(((euler.x * 180) / Math.PI).toFixed(2)),
        y: parseFloat(((euler.y * 180) / Math.PI).toFixed(2)),
        z: parseFloat(((euler.z * 180) / Math.PI).toFixed(2)),
      };
    }

    if (transform.scale) {
      this.state.scale = {
        x: parseFloat(transform.scale.x.toFixed(2)),
        y: parseFloat(transform.scale.y.toFixed(2)),
        z: parseFloat(transform.scale.z.toFixed(2)),
      };
    }

    this.updateInputFields();
    this.isUpdatingFromGizmo = false;
  }

  dispose() {
    this.container.innerHTML = "";
  }
}
