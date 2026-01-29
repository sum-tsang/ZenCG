// Open or create the IndexedDB database.
function openDb(config) {
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

// Persist imported OBJ entries to IndexedDB.
export function saveStoredImports(config, storedImports) {
  const entries = storedImports.map((entry) => ({
    name: entry.name,
    text: entry.text,
    transform: entry.transform ?? null,
  }));

  openDb(config)
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

// Load persisted OBJ entries from IndexedDB.
export function loadStoredImports(config) {
  return openDb(config)
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
