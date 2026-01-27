import * as THREE from "three";
import { createCamera, frameObjectBounds } from "./camera/camera.js";
import { attachCameraControls } from "./camera/cameraSettings.js";
import { setupObjImport } from "./io/import.js";
import { setupObjExport } from "./io/export.js";
import { TransformationManager } from "./modelTransformation/manager.js";

// Config
const config = {
  storageKey: "lastObj",
  dbName: "zencg",
  storeName: "models",
  importGap: 4,
};

// DOM & State
const dom = {
  canvas: document.getElementById("viewport-canvas"),
  fileInput: document.getElementById("obj-input"),
  exportButton: document.getElementById("obj-export"),
  deleteButton: document.getElementById("obj-delete"),
  status: document.getElementById("status"),
  objectList: document.getElementById("object-list"),
  objectListEmpty: document.getElementById("object-list-empty"),
};

assertDom(dom);

const state = {
  currentObject: null,
  importedObjects: [],
  storedImports: [],
  nextOffsetX: 0,
  isRestoring: false,
};

let transformationManager = null;
let importer = null;

// Scene
const { renderer, scene, camera, target, importRoot, selectionHelper } =
  createSceneContext(dom.canvas);

// Init
init();

// DOM Helpers
// Assert DOM
function assertDom({ canvas, exportButton, deleteButton }) {
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error("Viewport canvas not found.");
  }

  if (!(exportButton instanceof HTMLButtonElement)) {
    throw new Error("OBJ export button not found.");
  }

  if (!(deleteButton instanceof HTMLButtonElement)) {
    throw new Error("OBJ delete button not found.");
  }
}

// Set Status
function setStatus(message) {
  if (dom.status) {
    dom.status.textContent = message;
  }
}

// Is Editable Target
function isEditableTarget(target) {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target?.isContentEditable
  );
}

// Is Transform Panel Target
function isTransformPanelTarget(target) {
  return target instanceof HTMLElement
    ? Boolean(target.closest("#transformation-panel-container"))
    : false;
}

// Scene Helpers
// Create Scene Context
function createSceneContext(canvas) {
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

  const selectionHelper = createSelectionHelper(scene);

  return { renderer, scene, camera, target, importRoot, selectionHelper };
}

// Create Selection Helper
function createSelectionHelper(scene) {
  const helper = new THREE.BoxHelper(new THREE.Object3D(), 0xffc857);
  helper.visible = false;
  helper.renderOrder = 1;
  const materials = Array.isArray(helper.material) ? helper.material : [helper.material];
  materials.forEach((material) => {
    if (!material) return;
    material.depthTest = false;
    material.transparent = true;
    material.opacity = 0.8;
  });
  scene.add(helper);
  return helper;
}

// Selection
// Find Imported Root
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

// Update Selection Outline
function updateSelectionOutline(object) {
  if (!object) {
    selectionHelper.visible = false;
    return;
  }

  selectionHelper.setFromObject(object);
  selectionHelper.visible = true;
}

// Objects
// Place Imported Object
function placeImportedObject(object) {
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) return;

  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  object.position.sub(center);
  object.position.x += state.nextOffsetX;

  const width = Math.max(size.x, 1);
  state.nextOffsetX += width + config.importGap;
}

// Render Object List
function renderObjectList() {
  if (!(dom.objectList instanceof HTMLUListElement)) {
    return;
  }

  dom.objectList.innerHTML = "";
  const hasObjects = state.importedObjects.length > 0;

  if (dom.objectListEmpty instanceof HTMLElement) {
    dom.objectListEmpty.hidden = hasObjects;
  }

  if (!hasObjects) {
    return;
  }

  state.importedObjects.forEach((object, index) => {
    const item = document.createElement("li");
    item.className = "object-item";
    const row = document.createElement("div");
    row.className = "object-row";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "object-button";
    const label =
      typeof object?.name === "string" && object.name
        ? object.name
        : `Object ${index + 1}`;
    button.textContent = label;
    if (object === state.currentObject) {
      button.classList.add("active");
    }
    button.addEventListener("click", () => {
      selectObject(object);
    });
    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "object-delete";
    removeButton.textContent = "Delete";
    removeButton.addEventListener("click", (event) => {
      event.stopPropagation();
      deleteImportedObject(object);
    });
    row.append(button, removeButton);
    item.append(row);
    dom.objectList.append(item);
  });
}

// Select Object
function selectObject(object) {
  transformationManager?.setObject(object);
}

// Dispose Object
function disposeObject(object) {
  object.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    const material = child.material;
    if (Array.isArray(material)) {
      material.forEach((mat) => mat.dispose());
    } else if (material) {
      material.dispose();
    }
  });
}

// Delete Imported Object
function deleteImportedObject(object) {
  const root = object ? findImportedRoot(object) ?? object : null;
  if (!root) return;

  const index = state.importedObjects.indexOf(root);
  if (index === -1) return;

  const wasCurrent = state.currentObject === root;
  importRoot.remove(root);
  disposeObject(root);
  state.importedObjects.splice(index, 1);
  if (index < state.storedImports.length) {
    state.storedImports.splice(index, 1);
  }
  if (state.importedObjects.length === 0) {
    state.nextOffsetX = 0;
  }
  saveStoredImports();

  if (wasCurrent) {
    const next = state.importedObjects[index] ?? state.importedObjects[index - 1] ?? null;
    selectObject(next);
  } else {
    renderObjectList();
  }

  const name =
    typeof root?.name === "string" && root.name ? root.name : "object";
  setStatus(`Deleted ${name}.`);
}

// Persistence
// Open IndexedDB
function openDb() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("IndexedDB not available."));
      return;
    }

    const request = indexedDB.open(config.dbName, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(config.storeName)) {
        db.createObjectStore(config.storeName, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Save Stored Imports
function saveStoredImports() {
  const entries = state.storedImports.map((entry) => ({
    name: entry.name,
    text: entry.text,
  }));
  openDb()
    .then((db) => {
      const tx = db.transaction(config.storeName, "readwrite");
      const store = tx.objectStore(config.storeName);
      store.put({ id: config.storageKey, entries, updatedAt: Date.now() });
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

// Load Stored Imports
function loadStoredImports() {
  return openDb()
    .then(
      (db) =>
        new Promise((resolve) => {
          const tx = db.transaction(config.storeName, "readonly");
          const store = tx.objectStore(config.storeName);
          const request = store.get(config.storageKey);

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
        })
    )
    .catch((error) => {
      console.warn("Unable to read OBJ from IndexedDB.", error);
      return null;
    });
}

// Features
// Init
function init() {
  setupTransformTools();
  setupCameraControls();
  setupImportExport();
  setupShortcuts();
  setupResizeAndRender();
  restoreStoredImports();
}

// Setup Camera Controls
function setupCameraControls() {
  attachCameraControls({
    canvas: dom.canvas,
    camera,
    target,
    renderer,
  });
}

// Setup Transform Tools
function setupTransformTools() {
  transformationManager = new TransformationManager(
    scene,
    dom.canvas,
    "transformation-panel-container",
    {
      selectableRoot: importRoot,
      resolveSelection: (object) => findImportedRoot(object),
      onSelectionChange: (object) => {
        state.currentObject = object ?? null;
        dom.exportButton.disabled = !object;
        dom.deleteButton.disabled = !object;
        updateSelectionOutline(state.currentObject);
        renderObjectList();
      },
    }
  );
  transformationManager.setCamera(camera);
}

// Setup Import/Export
function setupImportExport() {
  importer = setupObjImport({
    fileInput: dom.fileInput,
    container: importRoot,
    frameObject: () => frameObjectBounds(importRoot, camera, target),
    setStatus,
    onObjectLoaded: (object) => {
      if (!object) return;
      placeImportedObject(object);
      state.importedObjects.push(object);
      state.currentObject = object;
      dom.exportButton.disabled = false;
      dom.deleteButton.disabled = false;
      selectObject(object);
      renderObjectList();
    },
    onTextLoaded: (text, filename) => {
      state.storedImports.push({ name: filename, text });
      if (!state.isRestoring) {
        saveStoredImports();
      }
    },
  });

  setupObjExport({
    button: dom.exportButton,
    getObject: () => state.currentObject,
    setStatus,
  });

  dom.deleteButton.addEventListener("click", () => {
    deleteImportedObject(state.currentObject);
  });
}

// Setup Shortcuts
function setupShortcuts() {
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

  document.addEventListener("keydown", (event) => {
    if (isEditableTarget(event.target)) return;

    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      deleteImportedObject(state.currentObject);
    }
  });
}

// Setup Resize and Render
function setupResizeAndRender() {
  window.addEventListener("resize", resize);
  setStatus("Waiting for OBJ file...");
  resize();
  render();
}

// Resize
function resize() {
  const width = Math.max(1, dom.canvas.clientWidth);
  const height = Math.max(1, dom.canvas.clientHeight);

  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}

// Render
function render() {
  camera.lookAt(target);
  if (state.currentObject && selectionHelper.visible) {
    selectionHelper.setFromObject(state.currentObject);
  }
  if (state.currentObject) {
    transformationManager?.gizmo?.updateGizmoPosition();
  }
  renderer.render(scene, camera);
  requestAnimationFrame(render);
}

// Restore Stored Imports
function restoreStoredImports() {
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
      state.isRestoring = true;
      state.storedImports.length = 0;
      entries.forEach((entry) => {
        importer.loadFromText(entry.text, entry.name);
      });
      state.isRestoring = false;
      saveStoredImports();
    }
  });
}
