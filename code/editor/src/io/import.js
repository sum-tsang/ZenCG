import { OBJLoader } from "three/addons/loaders/OBJLoader.js";

// Setup OBJ Import
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

  // Load OBJ From Text
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

  // Read File As Text
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

  // Handle Files
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
