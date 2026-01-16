import * as THREE from "three";
import { createCamera, frameObjectBounds } from "./camera/camera.js";
import { attachCameraControls } from "./camera/cameraSettings.js";
import { setupObjImport } from "./io/import.js";
import { setupObjExport } from "./io/export.js";
import { TransformationManager } from "./modelTransformation/manager.js";

// DOM hooks
const canvas = document.getElementById("viewport-canvas");
const fileInput = document.getElementById("obj-input");
const exportButton = document.getElementById("obj-export");
const status = document.getElementById("status");
const objectList = document.getElementById("object-list");
const objectListEmpty = document.getElementById("object-list-empty");
const storageKey = "lastObj";
const dbName = "zencg";
const storeName = "models";
const storedImports = [];
let isRestoring = false;

if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error("Viewport canvas not found.");
}

if (!(exportButton instanceof HTMLButtonElement)) {
  throw new Error("OBJ export button not found.");
}

// Renderer
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setClearColor(0x000000, 0);

const scene = new THREE.Scene();
const { camera, target } = createCamera();

const grid = new THREE.GridHelper(200, 20, 0x545454, 0x545454);
grid.material.transparent = true;
grid.material.opacity = 0.5;
scene.add(grid);

scene.add(new THREE.AmbientLight(0xffffff, 0.7));
const keyLight = new THREE.DirectionalLight(0xffffff, 0.8);
keyLight.position.set(5, 6, 4);
scene.add(keyLight);

const importRoot = new THREE.Group();
importRoot.name = "ImportedObjects";
scene.add(importRoot);

const selectionHelper = new THREE.BoxHelper(new THREE.Object3D(), 0xffc857);
selectionHelper.visible = false;
selectionHelper.renderOrder = 1;
const selectionMaterials = Array.isArray(selectionHelper.material)
  ? selectionHelper.material
  : [selectionHelper.material];
selectionMaterials.forEach((material) => {
  if (!material) return;
  material.depthTest = false;
  material.transparent = true;
  material.opacity = 0.8;
});
scene.add(selectionHelper);

function findImportedRoot(object) {
  let current = object;
  while (current && current !== importRoot) {
    if (current.parent === importRoot) {
      return current;
    }
    current = current.parent;
  }
  return null;
}

function updateSelectionOutline(object) {
  if (!object) {
    selectionHelper.visible = false;
    return;
  }

  selectionHelper.setFromObject(object);
  selectionHelper.visible = true;
}

// Status
function setStatus(message) {
  if (status) {
    status.textContent = message;
  }
}

// Input guard
function isEditableTarget(target) {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target?.isContentEditable
  );
}

function isTransformPanelTarget(target) {
  return target instanceof HTMLElement
    ? Boolean(target.closest("#transformation-panel-container"))
    : false;
}

// Current object
let currentObject = null;
const importedObjects = [];
let nextOffsetX = 0;
const importGap = 4;

function placeImportedObject(object) {
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) return;

  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  object.position.sub(center);
  object.position.x += nextOffsetX;

  const width = Math.max(size.x, 1);
  nextOffsetX += width + importGap;
}

function renderObjectList() {
  if (!(objectList instanceof HTMLUListElement)) {
    return;
  }

  objectList.innerHTML = "";
  const hasObjects = importedObjects.length > 0;

  if (objectListEmpty instanceof HTMLElement) {
    objectListEmpty.hidden = hasObjects;
  }

  if (!hasObjects) {
    return;
  }

  importedObjects.forEach((object, index) => {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "object-button";
    const label =
      typeof object?.name === "string" && object.name
        ? object.name
        : `Object ${index + 1}`;
    button.textContent = label;
    if (object === currentObject) {
      button.classList.add("active");
    }
    button.addEventListener("click", () => {
      transformationManager.setObject(object);
    });
    item.append(button);
    objectList.append(item);
  });
}

// IndexedDB
function openDb() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("IndexedDB not available."));
      return;
    }

    const request = indexedDB.open(dbName, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Save last OBJ
function saveStoredImports() {
  const entries = storedImports.map((entry) => ({
    name: entry.name,
    text: entry.text,
  }));
  openDb()
    .then((db) => {
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      store.put({ id: storageKey, entries, updatedAt: Date.now() });
      tx.oncomplete = () => db.close();
      tx.onerror = () => {
        console.warn("Unable to save OBJ to IndexedDB.", tx.error);
        db.close();
      };
    })
    .catch((error) => {
      console.warn("Unable to save OBJ to IndexedDB.", error);
    });
}

// Load last OBJ
function loadStoredImports() {
  return openDb()
    .then(
      (db) =>
        new Promise((resolve) => {
          const tx = db.transaction(storeName, "readonly");
          const store = tx.objectStore(storeName);
          const request = store.get(storageKey);

          request.onsuccess = () => {
            const result = request.result;
            if (result?.entries && Array.isArray(result.entries)) {
              resolve(
                result.entries.filter(
                  (entry) => entry && typeof entry.text === "string"
                )
              );
              return;
            }
            if (result && typeof result.text === "string") {
              resolve([
                {
                  name:
                    typeof result.name === "string" && result.name
                      ? result.name
                      : "restored.obj",
                  text: result.text,
                },
              ]);
              return;
            }
            resolve(null);
          };

          request.onerror = () => {
            console.warn("Unable to read OBJ from IndexedDB.", request.error);
            resolve(null);
          };

          tx.oncomplete = () => db.close();
          tx.onerror = () => {
            console.warn("Unable to read OBJ from IndexedDB.", tx.error);
            db.close();
            resolve(null);
          };
        }),
    )
    .catch((error) => {
      console.warn("Unable to read OBJ from IndexedDB.", error);
      return null;
    });
}

// Import
const importer = setupObjImport({
  fileInput,
  container: importRoot,
  frameObject: () => frameObjectBounds(importRoot, camera, target),
  setStatus,
  onObjectLoaded: (object) => {
    if (!object) return;
    placeImportedObject(object);
    importedObjects.push(object);
    currentObject = object;
    exportButton.disabled = false;
    // Sync selection
    transformationManager.setObject(object);
    renderObjectList();
  },
  onTextLoaded: (text, filename) => {
    storedImports.push({ name: filename, text });
    if (!isRestoring) {
      saveStoredImports();
    }
  },
});

// Export
setupObjExport({
  button: exportButton,
  getObject: () => currentObject,
  setStatus,
});

// Camera controls
attachCameraControls({ canvas, camera, target, renderer });

// Transform tools
const transformationManager = new TransformationManager(scene, canvas, "transformation-panel-container", {
  selectableRoot: importRoot,
  resolveSelection: (object) => findImportedRoot(object),
  onSelectionChange: (object) => {
    currentObject = object ?? null;
    exportButton.disabled = !object;
    updateSelectionOutline(currentObject);
    renderObjectList();
  },
});
transformationManager.setCamera(camera);

// Undo
document.addEventListener("keydown", (event) => {
  if (isEditableTarget(event.target) && !isTransformPanelTarget(event.target)) return;

  const hasModifier = event.ctrlKey || event.metaKey;
  if (!hasModifier) return;

  const key = event.key.toLowerCase();
  let isUndo = key === "undo" || (key === "z" && !event.shiftKey);

  if (!isUndo) {
    const code = event.code;
    isUndo = code === "KeyZ" && !event.shiftKey;
  }

  if (!isUndo) return;

  event.preventDefault();
  transformationManager.undo();
});

// Resize
function resize() {
  const width = Math.max(1, canvas.clientWidth);
  const height = Math.max(1, canvas.clientHeight);

  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}

// Render loop
function render() {
  camera.lookAt(target);
  if (currentObject && selectionHelper.visible) {
    selectionHelper.setFromObject(currentObject);
  }
  renderer.render(scene, camera);
  requestAnimationFrame(render);
}

window.addEventListener("resize", resize);
// Startup
setStatus("Waiting for OBJ file...");
resize();
render();

// Restore last OBJ
loadStoredImports().then((restored) => {
  if (restored && importer?.loadFromText) {
    const entries = Array.isArray(restored) ? restored : [];
    if (entries.length === 0) {
      return;
    }
    setStatus(
      entries.length === 1
        ? "Restoring previous OBJ..."
        : `Restoring ${entries.length} OBJ files...`
    );
    isRestoring = true;
    storedImports.length = 0;
    entries.forEach((entry) => {
      importer.loadFromText(entry.text, entry.name);
    });
    isRestoring = false;
    saveStoredImports();
  }
});
