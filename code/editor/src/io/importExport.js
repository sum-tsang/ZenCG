import * as THREE from "three";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { MTLLoader } from "three/addons/loaders/MTLLoader.js";
import { OBJExporter } from "three/addons/exporters/OBJExporter.js";

const INVALID_FILENAME_CHARS = /[<>:"/\\|?*\x00-\x1F]/g;

function normalizeExportBaseName(name, fallback = "zencg-export") {
  const raw = typeof name === "string" ? name.trim() : "";
  if (!raw) return fallback;
  const cleaned = raw.replace(INVALID_FILENAME_CHARS, "-").replace(/\s+/g, " ").trim();
  const withoutExtension = cleaned.replace(/\.(obj|mtl|zip)$/i, "");
  return withoutExtension || fallback;
}

function generateMtlContent(object, textures) {
  const materials = new Map();
  let materialIndex = 0;

  object.traverse((child) => {
    if (child.isMesh && child.material) {
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach((mat) => {
        if (!materials.has(mat.uuid)) {
          const name = mat.name || `material_${materialIndex++}`;
          materials.set(mat.uuid, { material: mat, name });
        }
      });
    }
  });

  if (materials.size === 0) return { mtl: null, materialMap: new Map() };

  let mtlContent = "# ZenCG Material Export\n\n";
  const materialMap = new Map();

  materials.forEach(({ material, name }) => {
    materialMap.set(material.uuid, name);
    mtlContent += `newmtl ${name}\n`;
    mtlContent += "Ka 0.2 0.2 0.2\n";

    if (material.color) {
      const c = material.color;
      mtlContent += `Kd ${c.r.toFixed(6)} ${c.g.toFixed(6)} ${c.b.toFixed(6)}\n`;
    } else {
      mtlContent += "Kd 0.8 0.8 0.8\n";
    }

    if (material.specular) {
      const s = material.specular;
      mtlContent += `Ks ${s.r.toFixed(6)} ${s.g.toFixed(6)} ${s.b.toFixed(6)}\n`;
    } else {
      mtlContent += "Ks 0.0 0.0 0.0\n";
    }

    const roughness = material.roughness ?? 0.5;
    const shininess = Math.max(1, (1 - roughness) * 100);
    mtlContent += `Ns ${shininess.toFixed(6)}\n`;

    const opacity = material.opacity ?? 1.0;
    mtlContent += `d ${opacity.toFixed(6)}\n`;
    mtlContent += "illum 2\n";

    if (material.map && material.map.image) {
      const textureName = `${name}_diffuse.png`;
      textures.push({ name: textureName, texture: material.map });
      mtlContent += `map_Kd ${textureName}\n`;
    }

    mtlContent += "\n";
  });

  return { mtl: mtlContent, materialMap };
}

function textureToBlob(texture) {
  return new Promise((resolve) => {
    if (!texture.image) {
      resolve(null);
      return;
    }

    const canvas = document.createElement("canvas");
    const img = texture.image;
    canvas.width = img.width || 256;
    canvas.height = img.height || 256;
    const ctx = canvas.getContext("2d");

    try {
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((blob) => resolve(blob), "image/png");
    } catch (error) {
      console.warn("Could not export texture:", error);
      resolve(null);
    }
  });
}

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

async function exportAsZip(objContent, mtlContent, textures, setStatus, baseName) {
  const safeBaseName = normalizeExportBaseName(baseName);
  const objFilename = `${safeBaseName}.obj`;
  const mtlFilename = `${safeBaseName}.mtl`;

  downloadFile(objContent, objFilename, "text/plain");

  if (mtlContent) {
    downloadFile(mtlContent, mtlFilename, "text/plain");
  }

  for (const { name, texture } of textures) {
    const blob = await textureToBlob(texture);
    if (blob) {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = name;
      link.click();
      URL.revokeObjectURL(url);
    }
  }

  setStatus?.(`Exported OBJ + MTL + ${textures.length} texture(s).`);
}

// Wire export button behavior for current object or scene target.
export function setupObjExport({ button, getObject, getFilename, setStatus }) {
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error("OBJ export button not found.");
  }

  const exporter = new OBJExporter();

  button.addEventListener("click", async () => {
    const object = getObject?.();
    if (!object) {
      setStatus?.("No model to export.");
      return;
    }

    const baseName = normalizeExportBaseName(
      typeof getFilename === "function" ? getFilename() : "",
      normalizeExportBaseName(object?.name || "")
    );
    const objFilename = `${baseName}.obj`;
    const mtlFilename = `${baseName}.mtl`;

    const textures = [];
    const { mtl, materialMap } = generateMtlContent(object, textures);

    object.traverse((child) => {
      if (child.isMesh && child.material) {
        const mat = Array.isArray(child.material) ? child.material[0] : child.material;
        const mtlName = materialMap.get(mat.uuid);
        if (mtlName) {
          mat.name = mtlName;
        }
      }
    });

    let objOutput = exporter.parse(object);

    if (mtl) {
      objOutput = `mtllib ${mtlFilename}\n` + objOutput;
    }

    if (textures.length > 0) {
      setStatus?.("Exporting with textures...");
      await exportAsZip(objOutput, mtl, textures, setStatus, baseName);
    } else if (mtl) {
      downloadFile(objOutput, objFilename, "text/plain");
      downloadFile(mtl, mtlFilename, "text/plain");
      setStatus?.("Exported OBJ + MTL.");
    } else {
      downloadFile(objOutput, objFilename, "text/plain");
      setStatus?.("Exported OBJ.");
    }
  });
}

const DEBUG_IMPORT = false;
const debug = (...args) => {
  if (DEBUG_IMPORT) {
    console.log(...args);
  }
};

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
      debug("[Import] Original color:", mat.color?.getHexString(), "diffuse:", mat.diffuse?.getHexString());

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

// Wire OBJ/MTL file input parsing and object creation.
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
          debug("[Import] Mesh:", child.name, "Material:", child.material?.name, "Color:", child.material?.color?.getHexString());
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
            const mtlName = mtllibMatch[1].trim().replace(/\.mtl$/i, "");
            mtlFile = mtlMap.get(mtlName.toLowerCase());
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

// Connect import/export handlers to app state and UI updates.
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
