import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
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

  const loader = new OBJLoader();

  // Parse an OBJ string and add it to the scene.
  function loadObjFromText(text, filename) {
    let object;

    try {
      object = loader.parse(text);
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
    setStatus?.(`Loaded ${filename}`);
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

  // Handle a batch of selected files.
  async function handleFiles(files) {
    if (!files || files.length === 0) {
      return;
    }

    const objFiles = Array.from(files).filter((file) =>
      file.name.toLowerCase().endsWith(".obj")
    );

    if (objFiles.length === 0) {
      setStatus?.("Please select a .obj file.");
      fileInput.value = "";
      return;
    }

    setStatus?.(
      objFiles.length === 1 ? "Loading OBJ..." : `Loading ${objFiles.length} OBJ files...`
    );

    for (const file of objFiles) {
      try {
        const text = await readFileAsText(file);
        loadObjFromText(text, file.name);
      } catch (error) {
        console.error(error);
        setStatus?.(`Error reading ${file.name}.`);
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

  return { loadFromText: loadObjFromText };
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
