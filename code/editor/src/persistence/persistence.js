import { appConfig, persistenceSettings } from "../core/config/settings.js";
import { materialEditor } from "../model/material/editor.js";
import { serializeTransform } from "../scene/objects.js";
import { OBJExporter } from "three/addons/exporters/OBJExporter.js";

let cachedDbPromise = null;
let cachedDbKey = "";

const DEFAULT_ACTION_HISTORY_KEY = appConfig.actionHistoryKey;
const DEFAULT_ACTION_HISTORY_LIMIT = appConfig.actionHistoryLimit;

// Gets DB key
function getDbKey(config) {
  return `${config.dbName}::${config.storeName}`;
}

// Clears cached DB
function clearCachedDb() {
  cachedDbPromise = null;
  cachedDbKey = "";
}

// Opens DB
function openDb(config) {
  const dbKey = getDbKey(config);
  if (cachedDbPromise && cachedDbKey === dbKey) {
    return cachedDbPromise;
  }

  cachedDbKey = dbKey;
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      clearCachedDb();
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
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        clearCachedDb();
      };
      resolve(db);
    };
    request.onerror = () => {
      clearCachedDb();
      reject(request.error);
    };
    request.onblocked = () => {
      console.warn("IndexedDB open blocked.");
    };
  });
}

// Returns whether stored OBJ text
function hasStoredObjText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

// Normalizes stored name
function normalizeStoredName(value, fallback = "restored.obj") {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  return fallback;
}

// Save imports (OBJ text + metadata) to IndexedDB
export function saveStoredImports(config, storedImports) {
  const sourceEntries = Array.isArray(storedImports) ? storedImports : [];
  const entries = sourceEntries
    .map((entry) => ({
      name: entry?.name,
      text: entry?.text,
      transform: entry?.transform ?? null,
      material: entry?.material ?? null,
    }))
    .filter((entry) => hasStoredObjText(entry.text));

  cachedDbPromise = openDb(config);
  cachedDbPromise
    .then((db) => {
      const tx = db.transaction(config.storeName, "readwrite");
      const store = tx.objectStore(config.storeName);
      store.put({ id: config.storageKey, entries, updatedAt: Date.now() });
      tx.onerror = () => {
        console.warn("Unable to save OBJ to IndexedDB.", tx.error);
      };
    })
    .catch((error) => {
      console.warn("Unable to save OBJ to IndexedDB.", error);
    });
}

// Read saved imports from IndexedDB
export function loadStoredImports(config) {
  cachedDbPromise = openDb(config);
  return cachedDbPromise
    .then(
      (db) =>
        new Promise((resolve) => {
          const tx = db.transaction(config.storeName, "readonly");
          const store = tx.objectStore(config.storeName);
          const request = store.get(config.storageKey);

          request.onsuccess = () => {
            const result = request.result;
            if (result?.entries && Array.isArray(result.entries)) {
              const validEntries = result.entries
                .filter((entry) => entry && hasStoredObjText(entry.text))
                .map((entry, index) => ({
                  ...entry,
                  name: normalizeStoredName(entry.name, `restored_${index + 1}.obj`),
                }));
              resolve(validEntries);
              return;
            }
            if (result && hasStoredObjText(result.text)) {
              resolve([
                {
                  name: normalizeStoredName(result.name),
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
          tx.onerror = () => {
            console.warn("Unable to read OBJ from IndexedDB.", tx.error);
            resolve(null);
          };
        })
    )
    .catch((error) => {
      console.warn("Unable to read OBJ from IndexedDB.", error);
      return null;
    });
}

// Debounce save requests to reduce write churn
export function createSaveScheduler({
  isRestoring,
  save,
  delayMs = persistenceSettings.autoSaveDebounceMs,
}) {
  let saveTimeout = null;

  return function scheduleSave() {
    if (isRestoring?.()) return;
    if (saveTimeout) window.clearTimeout(saveTimeout);
    saveTimeout = window.setTimeout(() => {
      save?.();
    }, delayMs);
  };
}

// Gets storage
function getStorage() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch (error) {
    console.warn("Action history storage unavailable.", error);
    return null;
  }
}

// Runs clean entries
function cleanEntries(entries = [], limit = DEFAULT_ACTION_HISTORY_LIMIT) {
  if (!Array.isArray(entries)) return [];
  const cleaned = entries
    .filter((entry) => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (Number.isFinite(limit) && limit > 0) {
    return cleaned.slice(-limit);
  }
  return cleaned;
}

// Load action-history entries from localStorage
export function loadActionHistory({
  key = DEFAULT_ACTION_HISTORY_KEY,
  limit = DEFAULT_ACTION_HISTORY_LIMIT,
} = {}) {
  const storage = getStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const entries = Array.isArray(parsed) ? parsed : parsed?.entries;
    const cleaned = cleanEntries(entries, limit);
    return cleaned.length ? cleaned : null;
  } catch (error) {
    console.warn("Unable to load action history.", error);
    return null;
  }
}

// Save action-history entries to localStorage
export function saveActionHistory({
  key = DEFAULT_ACTION_HISTORY_KEY,
  entries = [],
  limit = DEFAULT_ACTION_HISTORY_LIMIT,
} = {}) {
  const storage = getStorage();
  if (!storage || !Array.isArray(entries)) return;
  try {
    storage.setItem(
      key,
      JSON.stringify({
        entries: cleanEntries(entries, limit),
        updatedAt: Date.now(),
      })
    );
  } catch (error) {
    console.warn("Unable to save action history.", error);
  }
}

// Restore persisted entries through the importer pipeline
export function restoreStoredImports({
  loadStoredImports,
  importer,
  store,
  setStatus,
  saveStoredImports,
}) {
  loadStoredImports().then(async (restored) => {
    if (restored && importer?.loadFromText) {
      const entries = Array.isArray(restored)
        ? restored.filter(
            (entry) => entry && typeof entry.text === "string" && entry.text.trim().length > 0
          )
        : [];
      if (entries.length === 0) {
        if (Array.isArray(restored) && restored.length > 0) {
          setStatus("Saved models are invalid and could not be restored.");
        }
        return;
      }
      setStatus(
        entries.length === 1
          ? "Restoring previous OBJ..."
          : `Restoring ${entries.length} OBJ files...`
      );
      store.mutate((state) => {
        state.isRestoring = true;
        state.storedImports.length = 0;
        state.pendingTransforms = entries.map((entry) => entry?.transform ?? null);
        state.pendingMaterials = entries.map((entry) => entry?.material ?? null);
      });
      entries.forEach((entry) => {
        importer.loadFromText(entry.text, entry.name);
      });

      const state = store.getState();
      for (let i = 0; i < state.importedObjects.length; i++) {
        const object = state.importedObjects[i];
        const materialData = state.pendingMaterials?.[i];
        if (materialData && object) {
          await materialEditor.applySerializedMaterial(materialData, object);
        }
      }

      store.mutate((state) => {
        state.isRestoring = false;
        state.pendingTransforms = [];
        state.pendingMaterials = [];
      });
      saveStoredImports();
    }
  });
}

const exporter = new OBJExporter();

// Returns whether persistable OBJ text
function hasPersistableObjText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

// Runs clone for local OBJ export
function cloneForLocalObjExport(object) {
  if (!object) return null;
  const clone = object.clone(true);
  clone.position.set(0, 0, 0);
  clone.quaternion.identity();
  clone.scale.set(1, 1, 1);
  clone.updateMatrixWorld(true);
  return clone;
}

// Runs export object as OBJ text
function exportObjectAsObjText(object) {
  if (!object) return "";
  try {
    const clone = cloneForLocalObjExport(object);
    if (!clone) return "";
    return exporter.parse(clone);
  } catch (error) {
    console.warn("Unable to serialize object for persistence.", error);
    return "";
  }
}

// Runs fallback name
function fallbackName(object, index) {
  const objectName = typeof object?.name === "string" ? object.name.trim() : "";
  if (objectName) return objectName;
  return `object_${index + 1}`;
}

// Normalize stored entries before writing them back to persistence
export function prepareStoredImportsForSave(storedImports = [], importedObjects = []) {
  const entries = Array.isArray(storedImports) ? storedImports : [];
  const objects = Array.isArray(importedObjects) ? importedObjects : [];
  const total = objects.length;
  const next = [];

  for (let index = 0; index < total; index += 1) {
    const entry = entries[index] ?? null;
    const object = objects[index] ?? null;
    if (!entry && !object) continue;

    const name =
      typeof entry?.name === "string" && entry.name.trim()
        ? entry.name.trim()
        : fallbackName(object, index);

    const text = hasPersistableObjText(entry?.text) ? entry.text : exportObjectAsObjText(object);
    if (!hasPersistableObjText(text)) continue;

    const transform = entry?.transform ?? (object ? serializeTransform(object) : null);
    const material = entry?.material ?? (object ? materialEditor.serializeMaterial(object) : null);
    const unchanged =
      entry &&
      name === entry.name &&
      text === entry.text &&
      transform === entry.transform &&
      material === entry.material;
    if (unchanged) {
      next.push(entry);
      continue;
    }

    next.push({
      ...(entry ?? {}),
      name,
      text,
      transform,
      material,
    });
  }

  return next;
}
