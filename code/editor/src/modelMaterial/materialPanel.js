import { materialEditor } from "./materialEditor.js";

/**
 * MaterialPanel - UI for material editing
 * Provides color picker, texture upload, and material property controls
 */
export class MaterialPanel {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      throw new Error(`Container with id "${containerId}" not found.`);
    }

    this.currentObject = null;
    this.editor = materialEditor;
    this.listeners = {
      onMaterialChange: null,
    };

    this.initializeUI();
  }

  /**
   * Build the material panel DOM structure
   */
  initializeUI() {
    const panel = document.createElement("div");
    panel.id = "material-panel";
    panel.className = "material-panel";

    // Header
    const header = document.createElement("div");
    header.className = "material-header";
    const title = document.createElement("h3");
    title.className = "section-title";
    title.textContent = "MATERIAL";
    header.appendChild(title);
    panel.appendChild(header);

    // Color section
    const colorSection = this.createSection("Base Color");
    const colorRow = document.createElement("div");
    colorRow.className = "material-row color-row";

    this.colorPicker = document.createElement("input");
    this.colorPicker.type = "color";
    this.colorPicker.className = "color-picker";
    this.colorPicker.value = "#ffffff";
    this.colorPicker.addEventListener("input", (e) => this.onColorChange(e.target.value));

    this.colorHexInput = document.createElement("input");
    this.colorHexInput.type = "text";
    this.colorHexInput.className = "color-hex-input";
    this.colorHexInput.placeholder = "#ffffff";
    this.colorHexInput.value = "#ffffff";
    this.colorHexInput.addEventListener("change", (e) => {
      const value = e.target.value;
      if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
        this.colorPicker.value = value;
        this.onColorChange(value);
      }
    });

    colorRow.appendChild(this.colorPicker);
    colorRow.appendChild(this.colorHexInput);
    colorSection.appendChild(colorRow);
    panel.appendChild(colorSection);

    // Texture section
    const textureSection = this.createSection("Texture");
    
    const textureRow = document.createElement("div");
    textureRow.className = "material-row texture-row";

    const textureLabel = document.createElement("label");
    textureLabel.className = "texture-upload-label";
    textureLabel.textContent = "Upload Image";

    this.textureInput = document.createElement("input");
    this.textureInput.type = "file";
    this.textureInput.accept = "image/png,image/jpeg,image/jpg";
    this.textureInput.className = "texture-input";
    this.textureInput.addEventListener("change", (e) => this.onTextureUpload(e));

    textureLabel.appendChild(this.textureInput);
    textureRow.appendChild(textureLabel);

    // Texture preview and remove button
    const texturePreviewRow = document.createElement("div");
    texturePreviewRow.className = "texture-preview-row";
    
    this.texturePreview = document.createElement("div");
    this.texturePreview.className = "texture-preview";
    this.texturePreview.textContent = "No texture";

    this.removeTextureBtn = document.createElement("button");
    this.removeTextureBtn.className = "remove-texture-btn";
    this.removeTextureBtn.textContent = "Remove";
    this.removeTextureBtn.style.display = "none";
    this.removeTextureBtn.addEventListener("click", () => this.onRemoveTexture());

    texturePreviewRow.appendChild(this.texturePreview);
    texturePreviewRow.appendChild(this.removeTextureBtn);
    textureSection.appendChild(textureRow);
    textureSection.appendChild(texturePreviewRow);
    panel.appendChild(textureSection);

    this.container.appendChild(panel);
    this.panel = panel;
  }

  /**
   * Create a labeled section
   */
  createSection(labelText) {
    const section = document.createElement("div");
    section.className = "material-section";

    const label = document.createElement("label");
    label.className = "material-label";
    label.textContent = labelText;
    section.appendChild(label);

    return section;
  }

  /**
   * Set the current object and update UI
   */
  setObject(object) {
    this.currentObject = object;
    this.editor.setObject(object);
    this.updateFromObject();
  }

  /**
   * Update UI to reflect current object's material properties
   */
  updateFromObject() {
    const props = this.editor.getMaterialProperties(this.currentObject);

    // Update color
    this.colorPicker.value = props.color;
    this.colorHexInput.value = props.color;

    // Update texture preview
    if (props.hasTexture) {
      this.texturePreview.textContent = "Texture applied";
      this.texturePreview.classList.add("has-texture");
      this.removeTextureBtn.style.display = "inline-block";
    } else {
      this.texturePreview.textContent = "No texture";
      this.texturePreview.classList.remove("has-texture");
      this.removeTextureBtn.style.display = "none";
    }
  }

  /**
   * Handle color picker change
   */
  onColorChange(color) {
    this.colorHexInput.value = color;
    this.editor.setBaseColor(color, this.currentObject);
    this.emitChange("color", color);
  }

  /**
   * Handle texture file upload
   */
  async onTextureUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      await this.editor.applyTextureFromFile(file, "map", this.currentObject);
      this.texturePreview.textContent = file.name;
      this.texturePreview.classList.add("has-texture");
      this.removeTextureBtn.style.display = "inline-block";
      this.emitChange("texture", file.name);
    } catch (error) {
      console.error("Failed to apply texture:", error);
      this.texturePreview.textContent = "Error loading texture";
    }

    // Reset input so same file can be selected again
    this.textureInput.value = "";
  }

  /**
   * Handle texture removal
   */
  onRemoveTexture() {
    this.editor.removeTexture("map", this.currentObject);
    this.texturePreview.textContent = "No texture";
    this.texturePreview.classList.remove("has-texture");
    this.removeTextureBtn.style.display = "none";
    this.emitChange("texture", null);
  }

  /**
   * Register a callback for material changes
   */
  onMaterialChange(callback) {
    this.listeners.onMaterialChange = callback;
  }

  /**
   * Emit a material change event
   */
  emitChange(property, value) {
    if (this.listeners.onMaterialChange) {
      this.listeners.onMaterialChange({ property, value, object: this.currentObject });
    }
  }

  /**
   * Show/hide the panel
   */
  setVisible(visible) {
    if (this.panel) {
      this.panel.style.display = visible ? "block" : "none";
    }
  }
}
