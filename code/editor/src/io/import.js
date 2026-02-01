import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { MTLLoader } from "three/addons/loaders/MTLLoader.js";
import { setupObjExport } from "./export.js";

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

  const objLoader = new OBJLoader();
  const mtlLoader = new MTLLoader();

  // Parse an OBJ string and add it to the scene.
  function loadObjFromText(text, filename, materials = null) {
    let object;

    try {
      if (materials) {
        objLoader.setMaterials(materials);
      }
      object = objLoader.parse(text);
    } catch (error) {
      console.error(error);
      setStatus?.("Failed to parse OBJ file.");
      return;
    }

    object.name = filename;
    container.add(object);
    onObjectLoaded?.(object);
    frameObject?.(object);
    onTextLoaded?.(text, filename);
    setStatus?.(`Loaded ${filename}${materials ? " with materials" : ""}`);
    
    return object;
  }

  // Parse MTL text and return materials
  function loadMtlFromText(text, basePath = "") {
    try {
      // Set resource path for textures referenced in MTL
      mtlLoader.setResourcePath(basePath);
      const materials = mtlLoader.parse(text);
      materials.preload();
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
    const objFiles = fileArray.filter((file) =>
      file.name.toLowerCase().endsWith(".obj")
    );
    const mtlFiles = fileArray.filter((file) =>
      file.name.toLowerCase().endsWith(".mtl")
    );

    // Build a map of MTL files by base name for matching
    const mtlMap = new Map();
    for (const mtlFile of mtlFiles) {
      const baseName = mtlFile.name.replace(/\.mtl$/i, "");
      mtlMap.set(baseName.toLowerCase(), mtlFile);
    }

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
        
        // Check for matching MTL file
        const mtlFile = mtlMap.get(baseName.toLowerCase());
        let materials = null;
        
        if (mtlFile) {
          try {
            const mtlText = await readFileAsText(mtlFile);
            materials = loadMtlFromText(mtlText);
            if (materials) {
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
}) {
  const importer = setupObjImport({
    fileInput: dom.fileInput,
    container: importRoot,
    frameObject,
    setStatus,
    onObjectLoaded: (object) => {
      if (!object) return;
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
    getObject: () => store.getState().currentObject,
    setStatus,
  });

  dom.deleteButton.addEventListener("click", () => {
    deleteImportedObject(store.getState().currentObject);
  });

  return importer;
}
