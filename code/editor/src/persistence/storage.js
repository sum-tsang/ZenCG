// IndexedDB persistence.
let cachedDbPromise = null;
let cachedDbKey = "";

function getDbKey(config) {
  return `${config.dbName}::${config.storeName}`;
}

function clearCachedDb() {
  cachedDbPromise = null;
  cachedDbKey = "";
}

// Open or create the IndexedDB database.
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

function hasObjText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeName(value, fallback = "restored.obj") {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  return fallback;
}

// Persist imported OBJ entries to IndexedDB.
export function saveStoredImports(config, storedImports) {
  const sourceEntries = Array.isArray(storedImports) ? storedImports : [];
  const entries = sourceEntries
    .map((entry) => ({
      name: entry?.name,
      text: entry?.text,
      transform: entry?.transform ?? null,
      material: entry?.material ?? null,
    }))
    .filter((entry) => hasObjText(entry.text));

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

// Load persisted OBJ entries from IndexedDB.
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
                .filter((entry) => entry && hasObjText(entry.text))
                .map((entry, index) => ({
                  ...entry,
                  name: normalizeName(entry.name, `restored_${index + 1}.obj`),
                }));
              resolve(validEntries);
              return;
            }
            if (result && hasObjText(result.text)) {
              resolve(
                [{
                  name: normalizeName(result.name),
                  text: result.text,
                }]
              );
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
