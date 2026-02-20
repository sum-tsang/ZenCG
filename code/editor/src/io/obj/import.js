import * as THREE from "three";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { MTLLoader } from "three/addons/loaders/MTLLoader.js";

const DEBUG_IMPORT = false;
// Handles debug
const debug = (...args) => {
  if (DEBUG_IMPORT) {
    console.log(...args);
  }
};
// Handles convert to standard material
function convertToStandardMaterial(object) {
  object.traverse((child) => {
    if (!child.isMesh) return;

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
      if (mat.isMeshStandardMaterial) return mat;

      debug("[Import] Converting material:", mat.name, "type:", mat.type);
      debug(
        "[Import] Original color:",
        mat.color?.getHexString(),
        "diffuse:",
        mat.diffuse?.getHexString()
      );

      let color = new THREE.Color(0x808080);
      if (mat.color && (mat.color.r > 0 || mat.color.g > 0 || mat.color.b > 0)) {
        color = mat.color.clone();
      } else if (mat.diffuse && (mat.diffuse.r > 0 || mat.diffuse.g > 0 || mat.diffuse.b > 0)) {
        color = mat.diffuse.clone();
      }

      const newMat = new THREE.MeshStandardMaterial({
        color,
        roughness: mat.shininess ? Math.max(0.1, 1 - mat.shininess / 100) : 0.7,
        metalness: 0.0,
        transparent: mat.transparent || false,
        opacity: mat.opacity ?? 1.0,
        side: THREE.DoubleSide,
      });

      if (mat.map) {
        newMat.map = mat.map;
      }
      newMat.name = mat.name || "";
      mat.dispose();
      return newMat;
    });

    child.material = Array.isArray(child.material) ? convertedMats : convertedMats[0];
  });
}
// Handles read file as text
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
// Handles yield to main thread
const yieldToMainThread = () =>
  new Promise((resolve) => {
    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(() => resolve(), { timeout: 50 });
    } else {
      requestAnimationFrame(() => resolve());
    }
  });
// Sets up obj import
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
  // Loads obj from text
  function loadObjFromText(text, filename, materials = null) {
    let object;
    try {
      const objLoader = new OBJLoader();
      if (materials) {
        debug("[Import] Setting materials on OBJLoader:", materials);
        debug("[Import] Available material names:", Object.keys(materials.materials || {}));
        objLoader.setMaterials(materials);
      }
      object = objLoader.parse(text);
      object.traverse((child) => {
        if (child.isMesh) {
          debug(
            "[Import] Mesh:",
            child.name,
            "Material:",
            child.material?.name,
            "Color:",
            child.material?.color?.getHexString()
          );
        }
      });
    } catch (error) {
      console.error(error);
      setStatus?.("Failed to parse OBJ file.");
      return;
    }

    convertToStandardMaterial(object);
    object.name = filename;
    container.add(object);
    onObjectLoaded?.(object);
    frameObject?.(object);
    onTextLoaded?.(text, filename);
    setStatus?.(`Loaded ${filename}${materials ? " with materials" : ""}`);
    return object;
  }
  // Loads mtl from text
  function loadMtlFromText(text, options = {}) {
    const { stripTextures = true, resourcePath = "" } = options;
    try {
      mtlLoader.setResourcePath(typeof resourcePath === "string" ? resourcePath : "");

      const sourceText = stripTextures
        ? text
            .split("\n")
            .filter((line) => {
              const trimmed = line.trim().toLowerCase();
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

      const materials = mtlLoader.parse(sourceText);
      materials.preload();
      return materials;
    } catch (error) {
      console.error("Failed to parse MTL file:", error);
      return null;
    }
  }
  async function handleFiles(files) {
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    const objFiles = fileArray.filter((file) => file.name.toLowerCase().endsWith(".obj"));
    const mtlFiles = fileArray.filter((file) => file.name.toLowerCase().endsWith(".mtl"));

    const mtlMap = new Map();
    for (const mtlFile of mtlFiles) {
      const baseName = mtlFile.name.replace(/\.mtl$/i, "");
      mtlMap.set(baseName.toLowerCase(), mtlFile);
      mtlMap.set(mtlFile.name.toLowerCase().replace(/\.mtl$/i, ""), mtlFile);
    }

    if (objFiles.length === 0) {
      setStatus?.("Please select a .obj file.");
      fileInput.value = "";
      return;
    }

    setStatus?.(
      objFiles.length === 1 ? "Loading OBJ..." : `Loading ${objFiles.length} OBJ files...`
    );

    const objReads = await Promise.allSettled(objFiles.map((objFile) => readFileAsText(objFile)));
    const mtlTextCache = new Map();
    // Gets mtl materials
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
        let mtlFile = mtlMap.get(baseName.toLowerCase());

        if (!mtlFile) {
          const mtllibMatch = objText.match(/^mtllib\s+(.+)$/im);
          if (mtllibMatch) {
            const mtlName = mtlMatchName(mtllibMatch);
            mtlFile = mtlMap.get(mtlName);
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
// Handles mtl match name
function mtlMatchName(mtllibMatch) {
  return mtllibMatch[1].trim().replace(/\.mtl$/i, "").toLowerCase();
}
