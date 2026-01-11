import { OBJLoader } from "three/addons/loaders/OBJLoader.js";

export function setupObjImport({
  fileInput,
  scene,
  frameObject,
  setStatus,
  onObjectLoaded,
  onTextLoaded,
}) {
  if (!(fileInput instanceof HTMLInputElement)) {
    throw new Error("OBJ input not found.");
  }

  const loader = new OBJLoader();
  let currentObject = null;

  function loadObjFromText(text, filename) {
    let object;

    try {
      object = loader.parse(text);
    } catch (error) {
      console.error(error);
      setStatus?.("Failed to parse OBJ file.");
      return;
    }

    if (currentObject) {
      scene.remove(currentObject);
    }

    currentObject = object;
    scene.add(object);
    frameObject(object);
    onObjectLoaded?.(object);
    onTextLoaded?.(text, filename);
    setStatus?.(`Loaded ${filename}`);
  }

  function handleFile(file) {
    if (!file) {
      return;
    }

    if (!file.name.toLowerCase().endsWith(".obj")) {
      setStatus?.("Please select a .obj file.");
      fileInput.value = "";
      return;
    }

    setStatus?.("Loading OBJ...");
    const reader = new FileReader();

    reader.onload = () => {
      const text = reader.result;
      if (typeof text === "string") {
        loadObjFromText(text, file.name);
      } else {
        setStatus?.("Unable to read OBJ file.");
      }
      fileInput.value = "";
    };

    reader.onerror = () => {
      setStatus?.("Error reading OBJ file.");
      fileInput.value = "";
    };

    reader.readAsText(file);
  }

  fileInput.addEventListener("change", (event) => {
    const input = event.target;
    if (input instanceof HTMLInputElement) {
      handleFile(input.files?.[0] ?? null);
    }
  });

  return { loadFromText: loadObjFromText };
}
