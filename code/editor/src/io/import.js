// OBJ/MTL import pipeline.
import * as THREE from "three";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { MTLLoader } from "three/addons/loaders/MTLLoader.js";
import { setupObjExport } from "./export.js";

const DEBUG_IMPORT = false;
const debug = (...args) => {
  if (DEBUG_IMPORT) {
    console.log(...args);
  }
};

// Convert MTL materials (MeshPhongMaterial) to MeshStandardMaterial for better rendering
// Also applies default material to meshes without any material
function convertToStandardMaterial(object) {
  object.traverse((child) => {
    if (child.isMesh) {
      // If mesh has no material, create a default one
      if (!child.material) {
        debug("[Import] Mesh has no material, applying default:", child.name);
        child.material = new THREE.MeshStandardMaterial({
          color: 0x808080,
          roughness: 0.7,
          metalness: 0.0,
          side: THREE.DoubleSide,
        });
        return;
      }

      const mats = Array.isArray(child.material) ? child.material : [child.material];
      const convertedMats = mats.map((mat) => {
        // Skip if already a MeshStandardMaterial
        if (mat.isMeshStandardMaterial) return mat;

        debug("[Import] Converting material:", mat.name, "type:", mat.type);
        debug("[Import] Original color:", mat.color?.getHexString(), "diffuse:", mat.diffuse?.getHexString());

        // Get color from the material - MTL uses 'color' for Kd (diffuse)
        let color = new THREE.Color(0x808080); // Default gray
        
        if (mat.color && (mat.color.r > 0 || mat.color.g > 0 || mat.color.b > 0)) {
          color = mat.color.clone();
        } else if (mat.diffuse && (mat.diffuse.r > 0 || mat.diffuse.g > 0 || mat.diffuse.b > 0)) {
          color = mat.diffuse.clone();
        }

        debug("[Import] Using color:", color.getHexString());

        // Create new standard material with properties from the old one
        const newMat = new THREE.MeshStandardMaterial({
          color: color,
          roughness: mat.shininess ? Math.max(0.1, 1 - mat.shininess / 100) : 0.7,
          metalness: 0.0,
          transparent: mat.transparent || false,
          opacity: mat.opacity ?? 1.0,
          side: THREE.DoubleSide, // Use double side to avoid culling issues
        });

        // Copy texture if present
        if (mat.map) {
          newMat.map = mat.map;
        }

        // Copy name
        newMat.name = mat.name || "";

        // Dispose old material
        mat.dispose();

        return newMat;
      });

      child.material = Array.isArray(child.material) ? convertedMats : convertedMats[0];
    }
  });
}

// Wire up OBJ file input handling and parsing.
export function setupObjImport({
  fileInput,
  container,
  frameObject,
  setStatus,
  onObjectLoaded,
  onTextLoaded,
}) {
  if (!(fileInput instanceof HTMLInputElement)) {
    throw new Error("OBJ input not found.");
  }

  const mtlLoader = new MTLLoader();

  // Parse an OBJ string and add it to the scene.
  function loadObjFromText(text, filename, materials = null) {
    let object;

    try {
      // Create a fresh OBJLoader for each load to avoid state issues
      const objLoader = new OBJLoader();
      if (materials) {
        debug("[Import] Setting materials on OBJLoader:", materials);
        debug("[Import] Available material names:", Object.keys(materials.materials || {}));
        objLoader.setMaterials(materials);
      }
      object = objLoader.parse(text);
      
      // Log the materials that were applied
      object.traverse((child) => {
        if (child.isMesh) {
          debug("[Import] Mesh:", child.name, "Material:", child.material?.name, "Color:", child.material?.color?.getHexString());
        }
      });
    } catch (error) {
      console.error(error);
      setStatus?.("Failed to parse OBJ file.");
      return;
    }

    // Always convert/fix materials - handles MTL materials and missing materials
    convertToStandardMaterial(object);

    object.name = filename;
    container.add(object);
    onObjectLoaded?.(object);
    frameObject?.(object);
    onTextLoaded?.(text, filename);
    setStatus?.(`Loaded ${filename}${materials ? " with materials" : ""}`);
    
    return object;
  }


  // Parse MTL text and return materials.
  function loadMtlFromText(text, options = {}) {
    const {
      stripTextures = true,
      resourcePath = "",
    } = options;
    try {
      // Uploaded MTL files usually do not include bundled texture uploads, so
      // texture map lines are stripped by default. Library imports can override
      // this and provide a resource path for bundled textures.
      mtlLoader.setResourcePath(
        typeof resourcePath === "string" ? resourcePath : ""
      );

      const sourceText = stripTextures
        ? text
            .split("\n")
            .filter((line) => {
              const trimmed = line.trim().toLowerCase();
              // Remove lines that reference texture maps.
              return !trimmed.startsWith("map_kd") &&
                !trimmed.startsWith("map_ks") &&
                !trimmed.startsWith("map_ka") &&
                !trimmed.startsWith("map_bump") &&
                !trimmed.startsWith("bump") &&
                !trimmed.startsWith("map_d") &&
                !trimmed.startsWith("map_ns") &&
                !trimmed.startsWith("disp") &&
                !trimmed.startsWith("decal") &&
                !trimmed.startsWith("refl");
            })
            .join("\n")
        : text;

      if (stripTextures) {
        debug("[Import] Cleaned MTL (no textures):", sourceText.substring(0, 300));
      }

      const materials = mtlLoader.parse(sourceText);
      materials.preload();
      
      debug("[Import] Materials after preload:", materials);
      debug("[Import] Materials object:", materials.materials);
      
      // Log each material's properties
      Object.entries(materials.materials || {}).forEach(([name, mat]) => {
        debug(`[Import] Material '${name}':`, {
          type: mat.type,
          color: mat.color?.getHexString(),
          diffuse: mat.diffuse?.getHexString(),
          specular: mat.specular?.getHexString(),
          shininess: mat.shininess,
        });
      });
      
      return materials;
    } catch (error) {
      console.error("Failed to parse MTL file:", error);
      return null;
    }
  }

  // Read a File as text.
  function readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        const text = reader.result;
        if (typeof text === "string") {
          resolve(text);
        } else {
          reject(new Error("Unable to read OBJ file."));
        }
      };

      reader.onerror = () => {
        reject(new Error("Error reading OBJ file."));
      };

      reader.readAsText(file);
    });
  }

  const yieldToMainThread = () =>
    new Promise((resolve) => {
      if (typeof requestIdleCallback === "function") {
        requestIdleCallback(() => resolve(), { timeout: 50 });
      } else {
        requestAnimationFrame(() => resolve());
      }
    });

  // Handle a batch of selected files (OBJ and optionally MTL).
  async function handleFiles(files) {
    if (!files || files.length === 0) {
      return;
    }

    const fileArray = Array.from(files);
    debug("[Import] Files selected:", fileArray.map((f) => f.name));

    const objFiles = fileArray.filter((file) =>
      file.name.toLowerCase().endsWith(".obj")
    );
    const mtlFiles = fileArray.filter((file) =>
      file.name.toLowerCase().endsWith(".mtl")
    );

    debug("[Import] OBJ files:", objFiles.map((f) => f.name));
    debug("[Import] MTL files:", mtlFiles.map((f) => f.name));

    // Build a map of MTL files by base name and full name for matching
    const mtlMap = new Map();
    for (const mtlFile of mtlFiles) {
      const baseName = mtlFile.name.replace(/\.mtl$/i, "");
      mtlMap.set(baseName.toLowerCase(), mtlFile);
      // Also map by full filename for mtllib directive matching
      mtlMap.set(mtlFile.name.toLowerCase().replace(/\.mtl$/i, ""), mtlFile);
    }
    debug("[Import] MTL map keys:", Array.from(mtlMap.keys()));

    if (objFiles.length === 0) {
      setStatus?.("Please select a .obj file.");
      fileInput.value = "";
      return;
    }

    setStatus?.(
      objFiles.length === 1 ? "Loading OBJ..." : `Loading ${objFiles.length} OBJ files...`
    );

    const objReads = await Promise.allSettled(
      objFiles.map((objFile) => readFileAsText(objFile))
    );
    const mtlTextCache = new Map();

    const getMtlMaterials = async (mtlFile) => {
      if (!mtlFile) return null;
      const key = mtlFile.name.toLowerCase();
      let text = mtlTextCache.get(key);
      if (!text) {
        text = await readFileAsText(mtlFile);
        mtlTextCache.set(key, text);
      }
      return loadMtlFromText(text);
    };

    for (let i = 0; i < objFiles.length; i += 1) {
      const objFile = objFiles[i];
      const readResult = objReads[i];
      try {
        if (!readResult || readResult.status !== "fulfilled") {
          throw readResult?.reason || new Error("Unable to read OBJ file.");
        }
        const objText = readResult.value;
        const baseName = objFile.name.replace(/\.obj$/i, "");
        debug("[Import] Processing OBJ:", objFile.name, "baseName:", baseName);

        // Check for matching MTL file by base name
        let mtlFile = mtlMap.get(baseName.toLowerCase());
        debug("[Import] MTL by baseName:", mtlFile?.name || "not found");

        // Also check if OBJ references an MTL file via mtllib directive
        if (!mtlFile) {
          const mtllibMatch = objText.match(/^mtllib\s+(.+)$/im);
          if (mtllibMatch) {
            const mtlName = mtllibMatch[1].trim().replace(/\.mtl$/i, "");
            debug("[Import] OBJ references mtllib:", mtllibMatch[1], "looking for:", mtlName);
            mtlFile = mtlMap.get(mtlName.toLowerCase());
            debug("[Import] MTL by mtllib:", mtlFile?.name || "not found");
          }
        }

        let materials = null;

        if (mtlFile) {
          try {
            materials = await getMtlMaterials(mtlFile);
          } catch (mtlError) {
            console.warn("Could not load MTL file:", mtlError);
          }
        }

        const label = `${objFile.name}${materials ? ` with ${mtlFile?.name || "materials"}` : ""}`;
        setStatus?.(
          objFiles.length > 1
            ? `Loading ${i + 1}/${objFiles.length}: ${label}...`
            : `Loading ${label}...`
        );
        await yieldToMainThread();
        loadObjFromText(objText, objFile.name, materials);
      } catch (error) {
        console.error(error);
        setStatus?.(`Error reading ${objFile.name}.`);
      }
    }

    fileInput.value = "";
  }

  fileInput.addEventListener("change", (event) => {
    const input = event.target;
    if (input instanceof HTMLInputElement) {
      handleFiles(input.files);
    }
  });

  return { loadFromText: loadObjFromText, loadMtlFromText };
}

// Coordinate OBJ import, export, and delete wiring.
export function setupImportExport({
  dom,
  importRoot,
  store,
  config,
  frameObject,
  setStatus,
  selectObject,
  renderObjectList,
  updateStoredTransform,
  scheduleSave,
  placeImportedObject,
  applyTransform,
  deleteImportedObject,
  beforeObjectAdd,
  getExportTarget,
  getExportFilename,
}) {
  const importer = setupObjImport({
    fileInput: dom.fileInput,
    container: importRoot,
    frameObject,
    setStatus,
    onObjectLoaded: (object) => {
      if (!object) return;
      if (typeof beforeObjectAdd === "function") {
        beforeObjectAdd(object);
      }
      store.mutate((state) => {
        placeImportedObject(object, state, config);
        if (state.isRestoring && state.pendingTransforms.length > 0) {
          const transform = state.pendingTransforms.shift();
          applyTransform(object, transform);
        }
        state.importedObjects.push(object);
        state.currentObject = object;
      });
      dom.exportButton.disabled = false;
      dom.deleteButton.disabled = false;
      selectObject(object);
      renderObjectList();
    },
    onTextLoaded: (text, filename) => {
      store.mutate((state) => {
        state.storedImports.push({ name: filename, text });
        if (state.currentObject) {
          updateStoredTransform(state.currentObject, state);
        }
      });
      scheduleSave();
    },
  });

  setupObjExport({
    button: dom.exportButton,
<<<<<<< HEAD
    getObject: () => store.getState().currentObject,
    getAllObjects: () => store.getState().importedObjects,
=======
    getObject:
      typeof getExportTarget === "function"
        ? getExportTarget
        : () => store.getState().currentObject,
    getFilename: getExportFilename,
>>>>>>> 73763f094f1b648a9601aef0c04717d6b025c542
    setStatus,
  });

  dom.deleteButton.addEventListener("click", () => {
    deleteImportedObject(store.getState().currentObject);
  });

  return importer;
}
