import * as THREE from "three";
import {
  collectMaterials,
  forEachMeshMaterial,
  generateBoxProjectionUVs as applyBoxProjectionUVs,
} from "./utils.js";

/**
 * MaterialEditor - Handles material editing for 3D objects
 * Provides functions to change base color and apply textures
 */
export class MaterialEditor {
  // Initializes class state
  constructor() {
    this.textureLoader = new THREE.TextureLoader();
    this.currentObject = null;
    this.clonedMaterials = new WeakSet();
  }

  /**
   * Set the current object to edit
   * @param {THREEObject3D} object - The object to edit materials for
   */
  setObject(object) {
    this.currentObject = object;
  }

  /**
   * Ensure a material is unique to this object (clone if shared)
   * @param {THREEMaterial} material - The material to check
   * @returns {THREEMaterial} A unique material instance
   */
  ensureUniqueMaterial(material) {
    if (!this.clonedMaterials.has(material)) {
      const cloned = material.clone();
      this.clonedMaterials.add(cloned);
      return cloned;
    }
    return material;
  }

  /**
   * Generate UV coordinates for a mesh using box projection
   * This is needed for meshes that don't have UV coordinates
   * @param {THREEMesh} mesh - The mesh to generate UVs for
   */
  generateBoxProjectionUVs(mesh) {
    applyBoxProjectionUVs(mesh);
  }

  /**
   * Get all materials from an object (including children)
   * @param {THREEObject3D} object - The object to get materials from
   * @returns {THREEMaterial[]} Array of unique materials
   */
  getMaterials(object) {
    return collectMaterials(object);
  }

  /**
   * Get the current base color of the first material
   * @param {THREEObject3D} object - The object to check
   * @returns {string} Hex color string (eg, "#ff0000")
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
   * @param {THREEObject3D} object - The object to modify (optional, uses currentObject)
   */
  setBaseColor(color, object = this.currentObject) {
    if (!object) return;

    const threeColor = new THREE.Color(color);
    forEachMeshMaterial(object, {
      ensureUniqueMaterial: (mat) => this.ensureUniqueMaterial(mat),
      onMaterial: ({ material, setMaterial }) => {
        if (material.isMeshBasicMaterial) {
          const newMaterial = new THREE.MeshStandardMaterial({
            color: threeColor,
            roughness: 0.7,
            metalness: 0.0,
          });
          if (material.map) newMaterial.map = material.map;
          if (material.transparent) newMaterial.transparent = material.transparent;
          if (material.opacity !== undefined) newMaterial.opacity = material.opacity;
          setMaterial(newMaterial);
          material.dispose();
          return;
        }
        if (material.color) {
          material.color.copy(threeColor);
          material.needsUpdate = true;
        }
      },
    });
  }

  /**
   * Apply a texture from a file to all materials on an object
   * @param {File} file - The image file (PNG/JPG)
   * @param {string} textureType - Type of texture ('map', 'normalMap', 'roughnessMap', etc)
   * @param {THREEObject3D} object - The object to modify
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
   * Apply a THREETexture to all materials on an object
   * @param {THREETexture} texture - The texture to apply
   * @param {string} textureType - Type of texture slot
   * @param {THREEObject3D} object - The object to modify
   */
  applyTexture(texture, textureType = "map", object = this.currentObject) {
    if (!object || !texture) return;
    forEachMeshMaterial(object, {
      ensureUniqueMaterial: (mat) => this.ensureUniqueMaterial(mat),
      ensureUvProjection: true,
      onMaterial: ({ material, setMaterial }) => {
        if (material.isMeshBasicMaterial) {
          const newMaterial = new THREE.MeshStandardMaterial({
            color: material.color || 0xffffff,
            roughness: 0.7,
            metalness: 0.0,
          });
          newMaterial[textureType] = texture;
          setMaterial(newMaterial);
          material.dispose();
          return;
        }
        if (textureType in material) {
          if (material[textureType]) {
            material[textureType].dispose();
          }
          material[textureType] = texture;
          material.needsUpdate = true;
        }
      },
    });
  }

  /**
   * Remove a texture from all materials on an object
   * @param {string} textureType - Type of texture to remove
   * @param {THREEObject3D} object - The object to modify
   */
  removeTexture(textureType = "map", object = this.currentObject) {
    if (!object) return;
    forEachMeshMaterial(object, {
      ensureUniqueMaterial: (mat) => this.ensureUniqueMaterial(mat),
      onMaterial: ({ material }) => {
        if (!material[textureType]) return;
        material[textureType].dispose();
        material[textureType] = null;
        material.needsUpdate = true;
      },
    });
  }

  /**
   * Get material properties for UI display
   * @param {THREEObject3D} object - The object to check
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
   * @param {THREEObject3D} object - The object to modify
   */
  setRoughness(value, object = this.currentObject) {
    if (!object) return;
    forEachMeshMaterial(object, {
      ensureUniqueMaterial: (mat) => this.ensureUniqueMaterial(mat),
      onMaterial: ({ material }) => {
        if (!("roughness" in material)) return;
        material.roughness = value;
        material.needsUpdate = true;
      },
    });
  }

  /**
   * Set metalness for all materials
   * @param {number} value - Metalness value (0-1)
   * @param {THREEObject3D} object - The object to modify
   */
  setMetalness(value, object = this.currentObject) {
    if (!object) return;
    forEachMeshMaterial(object, {
      ensureUniqueMaterial: (mat) => this.ensureUniqueMaterial(mat),
      onMaterial: ({ material }) => {
        if (!("metalness" in material)) return;
        material.metalness = value;
        material.needsUpdate = true;
      },
    });
  }

  /**
   * Serialize material data for persistence
   * @param {THREEObject3D} object - The object to serialize materials from
   * @returns {Object|null} Serialized material data
   */
  serializeMaterial(object) {
    if (!object) return null;

    const materials = this.getMaterials(object);
    if (materials.length === 0) return null;

    const mat = materials[0];
    const data = {
      color: mat.color ? "#" + mat.color.getHexString() : "#ffffff",
      roughness: mat.roughness ?? 0.7,
      metalness: mat.metalness ?? 0.0,
      textureDataUrl: null,
    };
    if (mat.map && mat.map.image) {
      try {
        const canvas = document.createElement("canvas");
        const img = mat.map.image;
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        data.textureDataUrl = canvas.toDataURL("image/png");
      } catch (e) {
        console.warn("Could not serialize texture:", e);
      }
    }

    return data;
  }

  /**
   * Apply serialized material data to an object
   * @param {Object} materialData - Serialized material data
   * @param {THREEObject3D} object - The object to apply materials to
   * @returns {Promise<void>}
   */
  async applySerializedMaterial(materialData, object) {
    if (!materialData || !object) return;
    if (materialData.color) {
      this.setBaseColor(materialData.color, object);
    }
    if (typeof materialData.roughness === "number") {
      this.setRoughness(materialData.roughness, object);
    }
    if (typeof materialData.metalness === "number") {
      this.setMetalness(materialData.metalness, object);
    }
    if (materialData.textureDataUrl) {
      try {
        await this.applyTextureFromDataUrl(materialData.textureDataUrl, "map", object);
      } catch (e) {
        console.warn("Could not restore texture:", e);
      }
    }
  }

  /**
   * Apply a texture from a data URL
   * @param {string} dataUrl - The data URL of the texture image
   * @param {string} textureType - Type of texture ('map', 'normalMap', etc)
   * @param {THREEObject3D} object - The object to modify
   * @returns {Promise<THREETexture>}
   */
  applyTextureFromDataUrl(dataUrl, textureType = "map", object = this.currentObject) {
    if (!object || !dataUrl) return Promise.resolve(null);

    return new Promise((resolve, reject) => {
      this.textureLoader.load(
        dataUrl,
        (texture) => {
          texture.wrapS = THREE.RepeatWrapping;
          texture.wrapT = THREE.RepeatWrapping;
          texture.colorSpace = textureType === "map" ? THREE.SRGBColorSpace : THREE.LinearSRGBColorSpace;
          this.applyTexture(texture, textureType, object);
          resolve(texture);
        },
        undefined,
        (error) => {
          console.error("Error loading texture from data URL:", error);
          reject(error);
        }
      );
    });
  }
}
export const materialEditor = new MaterialEditor();
