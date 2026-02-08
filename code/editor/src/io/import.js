// OBJ/MTL import pipeline.
import * as THREE from "three";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { MTLLoader } from "three/addons/loaders/MTLLoader.js";
import { setupObjExport } from "./export.js";

// Convert MTL materials (MeshPhongMaterial) to MeshStandardMaterial for better rendering
// Also applies default material to meshes without any material
function convertToStandardMaterial(object) {
  object.traverse((child) => {
    if (child.isMesh) {
      // If mesh has no material, create a default one
      if (!child.material) {
        console.log("[Import] Mesh has no material, applying default:", child.name);
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

        console.log("[Import] Converting material:", mat.name, "type:", mat.type);
        console.log("[Import] Original color:", mat.color?.getHexString(), "diffuse:", mat.diffuse?.getHexString());

        // Get color from the material - MTL uses 'color' for Kd (diffuse)
        let color = new THREE.Color(0x808080); // Default gray
        
        if (mat.color && (mat.color.r > 0 || mat.color.g > 0 || mat.color.b > 0)) {
          color = mat.color.clone();
        } else if (mat.diffuse && (mat.diffuse.r > 0 || mat.diffuse.g > 0 || mat.diffuse.b > 0)) {
          color = mat.diffuse.clone();
        }

        console.log("[Import] Using color:", color.getHexString());

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
        console.log("[Import] Setting materials on OBJLoader:", materials);
        console.log("[Import] Available material names:", Object.keys(materials.materials || {}));
        objLoader.setMaterials(materials);
      }
      object = objLoader.parse(text);
      
      // Log the materials that were applied
      object.traverse((child) => {
        if (child.isMesh) {
          console.log("[Import] Mesh:", child.name, "Material:", child.material?.name, "Color:", child.material?.color?.getHexString());
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


  // Parse MTL text and return materials
  function loadMtlFromText(text) {
    try {
      // Don't set resource path - we can't load external textures from local files
      // The MTL will still provide base colors (Kd), specular (Ks), etc.
      // To suppress texture loading errors, we use a data URI path that won't trigger requests
      mtlLoader.setResourcePath("");
      
      // Remove texture references from MTL to avoid 404 errors
      // Textures referenced in MTL files (map_Kd, map_Bump, etc.) can't be loaded
      // without the actual texture files being uploaded
      const cleanedText = text
        .split('\n')
        .filter(line => {
          const trimmed = line.trim().toLowerCase();
          // Remove lines that reference texture maps
          return !trimmed.startsWith('map_kd') && 
                 !trimmed.startsWith('map_ks') && 
                 !trimmed.startsWith('map_ka') &&
                 !trimmed.startsWith('map_bump') && 
                 !trimmed.startsWith('bump') &&
                 !trimmed.startsWith('map_d') &&
                 !trimmed.startsWith('map_ns') &&
                 !trimmed.startsWith('disp') &&
                 !trimmed.startsWith('decal') &&
                 !trimmed.startsWith('refl');
        })
        .join('\n');
      
      console.log("[Import] Cleaned MTL (no textures):", cleanedText.substring(0, 300));
      
      const materials = mtlLoader.parse(cleanedText);
      materials.preload();
      
      console.log("[Import] Materials after preload:", materials);
      console.log("[Import] Materials object:", materials.materials);
      
      // Log each material's properties
      Object.entries(materials.materials || {}).forEach(([name, mat]) => {
        console.log(`[Import] Material '${name}':`, {
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

  // Handle a batch of selected files (OBJ and optionally MTL).
  async function handleFiles(files) {
    if (!files || files.length === 0) {
      return;
    }

    const fileArray = Array.from(files);
    console.log("[Import] Files selected:", fileArray.map(f => f.name));
    
    const objFiles = fileArray.filter((file) =>
      file.name.toLowerCase().endsWith(".obj")
    );
    const mtlFiles = fileArray.filter((file) =>
      file.name.toLowerCase().endsWith(".mtl")
    );
    
    console.log("[Import] OBJ files:", objFiles.map(f => f.name));
    console.log("[Import] MTL files:", mtlFiles.map(f => f.name));

    // Build a map of MTL files by base name and full name for matching
    const mtlMap = new Map();
    for (const mtlFile of mtlFiles) {
      const baseName = mtlFile.name.replace(/\.mtl$/i, "");
      mtlMap.set(baseName.toLowerCase(), mtlFile);
      // Also map by full filename for mtllib directive matching
      mtlMap.set(mtlFile.name.toLowerCase().replace(/\.mtl$/i, ""), mtlFile);
    }
    console.log("[Import] MTL map keys:", Array.from(mtlMap.keys()));

    if (objFiles.length === 0) {
      setStatus?.("Please select a .obj file.");
      fileInput.value = "";
      return;
    }

    setStatus?.(
      objFiles.length === 1 ? "Loading OBJ..." : `Loading ${objFiles.length} OBJ files...`
    );

    for (const objFile of objFiles) {
      try {
        const objText = await readFileAsText(objFile);
        const baseName = objFile.name.replace(/\.obj$/i, "");
        console.log("[Import] Processing OBJ:", objFile.name, "baseName:", baseName);
        
        // Check for matching MTL file by base name
        let mtlFile = mtlMap.get(baseName.toLowerCase());
        console.log("[Import] MTL by baseName:", mtlFile?.name || "not found");
        
        // Also check if OBJ references an MTL file via mtllib directive
        if (!mtlFile) {
          const mtllibMatch = objText.match(/^mtllib\s+(.+)$/m);
          if (mtllibMatch) {
            const mtlName = mtllibMatch[1].trim().replace(/\.mtl$/i, "");
            console.log("[Import] OBJ references mtllib:", mtllibMatch[1], "looking for:", mtlName);
            mtlFile = mtlMap.get(mtlName.toLowerCase());
            console.log("[Import] MTL by mtllib:", mtlFile?.name || "not found");
          }
        }
        
        let materials = null;
        
        if (mtlFile) {
          try {
            const mtlText = await readFileAsText(mtlFile);
            console.log("[Import] MTL content preview:", mtlText.substring(0, 200));
            materials = loadMtlFromText(mtlText);
            console.log("[Import] Parsed materials:", materials);
            if (materials) {
              console.log("[Import] Material names:", Object.keys(materials.materials || {}));
              setStatus?.(`Loading ${objFile.name} with materials from ${mtlFile.name}...`);
            }
          } catch (mtlError) {
            console.warn("Could not load MTL file:", mtlError);
          }
        }
        
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
    getObject:
      typeof getExportTarget === "function"
        ? getExportTarget
        : () => store.getState().currentObject,
    getFilename: getExportFilename,
    setStatus,
  });

  dom.deleteButton.addEventListener("click", () => {
    deleteImportedObject(store.getState().currentObject);
  });

  return importer;
}
