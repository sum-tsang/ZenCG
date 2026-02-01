import * as THREE from "three";

/**
 * MaterialEditor - Handles material editing for 3D objects
 * Provides functions to change base color and apply textures
 */
export class MaterialEditor {
  constructor() {
    this.textureLoader = new THREE.TextureLoader();
    this.currentObject = null;
    // Track which objects have had their materials cloned
    this.clonedMaterials = new WeakSet();
  }

  /**
   * Set the current object to edit
   * @param {THREE.Object3D} object - The object to edit materials for
   */
  setObject(object) {
    this.currentObject = object;
  }

  /**
   * Ensure a material is unique to this object (clone if shared)
   * @param {THREE.Material} material - The material to check
   * @returns {THREE.Material} A unique material instance
   */
  ensureUniqueMaterial(material) {
    // If we haven't cloned this material yet, clone it
    if (!this.clonedMaterials.has(material)) {
      const cloned = material.clone();
      this.clonedMaterials.add(cloned);
      return cloned;
    }
    return material;
  }

  /**
   * Get all materials from an object (including children)
   * @param {THREE.Object3D} object - The object to get materials from
   * @returns {THREE.Material[]} Array of unique materials
   */
  getMaterials(object) {
    const materials = new Set();
    
    object.traverse((child) => {
      if (child.isMesh && child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach((mat) => materials.add(mat));
        } else {
          materials.add(child.material);
        }
      }
    });

    return Array.from(materials);
  }

  /**
   * Get the current base color of the first material
   * @param {THREE.Object3D} object - The object to check
   * @returns {string} Hex color string (e.g., "#ff0000")
   */
  getBaseColor(object = this.currentObject) {
    if (!object) return "#ffffff";

    const materials = this.getMaterials(object);
    if (materials.length === 0) return "#ffffff";

    const mat = materials[0];
    if (mat.color) {
      return "#" + mat.color.getHexString();
    }
    return "#ffffff";
  }

  /**
   * Set the base color for all materials on an object
   * @param {string|number} color - Color as hex string or number
   * @param {THREE.Object3D} object - The object to modify (optional, uses currentObject)
   */
  setBaseColor(color, object = this.currentObject) {
    if (!object) return;

    const threeColor = new THREE.Color(color);

    object.traverse((child) => {
      if (child.isMesh && child.material) {
        // Clone materials if shared to avoid affecting other objects
        if (Array.isArray(child.material)) {
          child.material = child.material.map((mat) => this.ensureUniqueMaterial(mat));
        } else {
          child.material = this.ensureUniqueMaterial(child.material);
        }
        
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        
        materials.forEach((mat) => {
          // Convert to MeshStandardMaterial if it's a basic material
          if (mat.isMeshBasicMaterial) {
            const newMat = new THREE.MeshStandardMaterial({
              color: threeColor,
              roughness: 0.7,
              metalness: 0.0,
            });
            // Copy common properties
            if (mat.map) newMat.map = mat.map;
            if (mat.transparent) newMat.transparent = mat.transparent;
            if (mat.opacity !== undefined) newMat.opacity = mat.opacity;
            
            // Replace material
            if (Array.isArray(child.material)) {
              const index = child.material.indexOf(mat);
              child.material[index] = newMat;
            } else {
              child.material = newMat;
            }
            mat.dispose();
          } else if (mat.color) {
            mat.color.copy(threeColor);
            mat.needsUpdate = true;
          }
        });
      }
    });
  }

  /**
   * Apply a texture from a file to all materials on an object
   * @param {File} file - The image file (PNG/JPG)
   * @param {string} textureType - Type of texture ('map', 'normalMap', 'roughnessMap', etc.)
   * @param {THREE.Object3D} object - The object to modify
   * @returns {Promise<void>}
   */
  async applyTextureFromFile(file, textureType = "map", object = this.currentObject) {
    if (!object || !file) return;

    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (event) => {
        const dataUrl = event.target.result;
        
        this.textureLoader.load(
          dataUrl,
          (texture) => {
            // Configure texture
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.colorSpace = textureType === "map" ? THREE.SRGBColorSpace : THREE.LinearSRGBColorSpace;

            this.applyTexture(texture, textureType, object);
            resolve(texture);
          },
          undefined,
          (error) => {
            console.error("Error loading texture:", error);
            reject(error);
          }
        );
      };

      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });
  }

  /**
   * Apply a THREE.Texture to all materials on an object
   * @param {THREE.Texture} texture - The texture to apply
   * @param {string} textureType - Type of texture slot
   * @param {THREE.Object3D} object - The object to modify
   */
  applyTexture(texture, textureType = "map", object = this.currentObject) {
    if (!object || !texture) return;

    object.traverse((child) => {
      if (child.isMesh && child.material) {
        // Clone materials if shared to avoid affecting other objects
        if (Array.isArray(child.material)) {
          child.material = child.material.map((mat) => this.ensureUniqueMaterial(mat));
        } else {
          child.material = this.ensureUniqueMaterial(child.material);
        }
        
        const materials = Array.isArray(child.material) ? child.material : [child.material];

        materials.forEach((mat) => {
          // Ensure we have a MeshStandardMaterial for texture support
          if (mat.isMeshBasicMaterial) {
            const newMat = new THREE.MeshStandardMaterial({
              color: mat.color || 0xffffff,
              roughness: 0.7,
              metalness: 0.0,
            });
            
            // Replace material
            if (Array.isArray(child.material)) {
              const index = child.material.indexOf(mat);
              child.material[index] = newMat;
              newMat[textureType] = texture;
            } else {
              child.material = newMat;
              newMat[textureType] = texture;
            }
            mat.dispose();
          } else if (textureType in mat) {
            // Dispose old texture if exists
            if (mat[textureType]) {
              mat[textureType].dispose();
            }
            mat[textureType] = texture;
            mat.needsUpdate = true;
          }
        });
      }
    });
  }

  /**
   * Remove a texture from all materials on an object
   * @param {string} textureType - Type of texture to remove
   * @param {THREE.Object3D} object - The object to modify
   */
  removeTexture(textureType = "map", object = this.currentObject) {
    if (!object) return;

    object.traverse((child) => {
      if (child.isMesh && child.material) {
        // Clone materials if shared to avoid affecting other objects
        if (Array.isArray(child.material)) {
          child.material = child.material.map((mat) => this.ensureUniqueMaterial(mat));
        } else {
          child.material = this.ensureUniqueMaterial(child.material);
        }
        
        const materials = Array.isArray(child.material) ? child.material : [child.material];

        materials.forEach((mat) => {
          if (mat[textureType]) {
            mat[textureType].dispose();
            mat[textureType] = null;
            mat.needsUpdate = true;
          }
        });
      }
    });
  }

  /**
   * Get material properties for UI display
   * @param {THREE.Object3D} object - The object to check
   * @returns {Object} Material properties
   */
  getMaterialProperties(object = this.currentObject) {
    if (!object) {
      return {
        color: "#ffffff",
        hasTexture: false,
        roughness: 0.7,
        metalness: 0.0,
      };
    }

    const materials = this.getMaterials(object);
    if (materials.length === 0) {
      return {
        color: "#ffffff",
        hasTexture: false,
        roughness: 0.7,
        metalness: 0.0,
      };
    }

    const mat = materials[0];
    return {
      color: mat.color ? "#" + mat.color.getHexString() : "#ffffff",
      hasTexture: !!mat.map,
      roughness: mat.roughness ?? 0.7,
      metalness: mat.metalness ?? 0.0,
    };
  }

  /**
   * Set roughness for all materials
   * @param {number} value - Roughness value (0-1)
   * @param {THREE.Object3D} object - The object to modify
   */
  setRoughness(value, object = this.currentObject) {
    if (!object) return;

    object.traverse((child) => {
      if (child.isMesh && child.material) {
        // Clone materials if shared to avoid affecting other objects
        if (Array.isArray(child.material)) {
          child.material = child.material.map((mat) => this.ensureUniqueMaterial(mat));
        } else {
          child.material = this.ensureUniqueMaterial(child.material);
        }
        
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach((mat) => {
          if ("roughness" in mat) {
            mat.roughness = value;
            mat.needsUpdate = true;
          }
        });
      }
    });
  }

  /**
   * Set metalness for all materials
   * @param {number} value - Metalness value (0-1)
   * @param {THREE.Object3D} object - The object to modify
   */
  setMetalness(value, object = this.currentObject) {
    if (!object) return;

    object.traverse((child) => {
      if (child.isMesh && child.material) {
        // Clone materials if shared to avoid affecting other objects
        if (Array.isArray(child.material)) {
          child.material = child.material.map((mat) => this.ensureUniqueMaterial(mat));
        } else {
          child.material = this.ensureUniqueMaterial(child.material);
        }
        
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach((mat) => {
          if ("metalness" in mat) {
            mat.metalness = value;
            mat.needsUpdate = true;
          }
        });
      }
    });
  }
}

// Singleton instance
export const materialEditor = new MaterialEditor();
