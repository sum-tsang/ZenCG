import * as THREE from "three";
import { createCamera, frameObject } from "./camera/camera.js";
import { attachControls } from "./controls/attachControls.js";
import { setupObjImport } from "./io/import.js";
import { setupObjExport } from "./io/export.js";
import { TransformationManager } from "./model_transformation/manager.js";

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

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setClearColor(0x111111, 1);

const scene = new THREE.Scene();
const { camera, target } = createCamera();

scene.add(new THREE.AmbientLight(0xffffff, 0.7));
const keyLight = new THREE.DirectionalLight(0xffffff, 0.8);
keyLight.position.set(5, 6, 4);
scene.add(keyLight);

function setStatus(message) {
  if (status) {
    status.textContent = message;
  }
}

let currentObject = null;

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

const importer = setupObjImport({
  fileInput,
  scene,
  frameObject: (object) => frameObject(object, camera, target),
  setStatus,
  onObjectLoaded: (object) => {
    currentObject = object;
    exportButton.disabled = false;
    // Set the loaded object in transformation manager
    transformationManager.setObject(object);
  },
  onTextLoaded: (text, filename) => {
    saveLastObj(text, filename);
  },
});

setupObjExport({
  button: exportButton,
  getObject: () => currentObject,
  setStatus,
});

attachControls({ canvas, camera, target, renderer });

// Initialize transformation tools
const transformationManager = new TransformationManager(
  scene,
  canvas,
  "transformation-panel-container"
);
transformationManager.setCamera(camera);

function resize() {
  const width = Math.max(1, canvas.clientWidth);
  const height = Math.max(1, canvas.clientHeight);

  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}

function render() {
  camera.lookAt(target);
  renderer.render(scene, camera);
  requestAnimationFrame(render);
}

window.addEventListener("resize", resize);
setStatus("Waiting for OBJ file...");
resize();
render();

loadLastObj().then((restored) => {
  if (restored && importer?.loadFromText) {
    setStatus("Restoring previous OBJ...");
    importer.loadFromText(restored.text, restored.name);
  }
});
