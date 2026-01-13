import * as THREE from "three";
import { createCamera, frameObject } from "./camera/camera.js";
import { attachCameraControls } from "./camera/cameraSettings.js";
import { setupObjImport } from "./io/import.js";
import { setupObjExport } from "./io/export.js";
import { TransformationManager } from "./modelTransformation/manager.js";

// DOM hooks
const canvas = document.getElementById("viewport-canvas");
const fileInput = document.getElementById("obj-input");
const exportButton = document.getElementById("obj-export");
const status = document.getElementById("status");
const storageKey = "lastObj";
const dbName = "zencg";
const storeName = "models";

if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error("Viewport canvas not found.");
}

if (!(exportButton instanceof HTMLButtonElement)) {
  throw new Error("OBJ export button not found.");
}

// Renderer
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setClearColor(0x111111, 1);

const scene = new THREE.Scene();
const { camera, target } = createCamera();

scene.add(new THREE.AmbientLight(0xffffff, 0.7));
const keyLight = new THREE.DirectionalLight(0xffffff, 0.8);
keyLight.position.set(5, 6, 4);
scene.add(keyLight);

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

// Current object
let currentObject = null;

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
function saveLastObj(text, name) {
  openDb()
    .then((db) => {
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      store.put({ id: storageKey, name, text, updatedAt: Date.now() });
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
function loadLastObj() {
  return openDb()
    .then(
      (db) =>
        new Promise((resolve) => {
          const tx = db.transaction(storeName, "readonly");
          const store = tx.objectStore(storeName);
          const request = store.get(storageKey);

          request.onsuccess = () => {
            const result = request.result;
            if (result && typeof result.text === "string") {
              resolve({
                name:
                  typeof result.name === "string" && result.name
                    ? result.name
                    : "restored.obj",
                text: result.text,
              });
            } else {
              resolve(null);
            }
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
  scene,
  frameObject: (object) => frameObject(object, camera, target),
  setStatus,
  onObjectLoaded: (object) => {
    currentObject = object;
    exportButton.disabled = false;
    // Sync selection
    transformationManager.setObject(object);
  },
  onTextLoaded: (text, filename) => {
    saveLastObj(text, filename);
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
const transformationManager = new TransformationManager(
  scene,
  canvas,
  "transformation-panel-container"
);
transformationManager.setCamera(camera);

// Undo shortcut
document.addEventListener("keydown", (event) => {
  if (isEditableTarget(event.target)) return;

  const isUndo =
    (event.ctrlKey || event.metaKey) &&
    !event.shiftKey &&
    event.key.toLowerCase() === "z";

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
  renderer.render(scene, camera);
  requestAnimationFrame(render);
}

window.addEventListener("resize", resize);
// Startup
setStatus("Waiting for OBJ file...");
resize();
render();

// Restore last OBJ
loadLastObj().then((restored) => {
  if (restored && importer?.loadFromText) {
    setStatus("Restoring previous OBJ...");
    importer.loadFromText(restored.text, restored.name);
  }
});
