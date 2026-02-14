// Core app state primitives.

// Initial state shape.
// Create the initial application state snapshot.
export function createInitialState() {
  return {
    currentObject: null,
    importedObjects: [],
    storedImports: [],
    selectedObjects: [],
    nextOffsetX: 0,
    isRestoring: false,
    pendingTransforms: [],
    pendingMaterials: [],
  };
}

// Lightweight state store.
// Create a tiny state container with mutation helpers.
export function createStore(initialState = {}) {
  const state = { ...initialState };
  const listeners = new Set();

  // Notify all subscribers of state changes.
  const notify = () => {
    listeners.forEach((listener) => listener(state));
  };

  // Read the current state object.
  const getState = () => state;

  // Shallow-merge a patch into state and notify listeners.
  const setState = (patch) => {
    if (patch && typeof patch === "object") {
      Object.assign(state, patch);
    }
    notify();
  };

  // Apply an in-place mutation function and notify listeners.
  const mutate = (mutator) => {
    if (typeof mutator === "function") {
      mutator(state);
    }
    notify();
  };

  // Subscribe to state updates and return an unsubscribe function.
  const subscribe = (listener) => {
    if (typeof listener !== "function") {
      return () => {};
    }
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  return {
    getState,
    setState,
    mutate,
    subscribe,
    notify,
  };
}
