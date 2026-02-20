// Creates initial state
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

// Creates store
export function createStore(initialState = {}) {
  const state = { ...initialState };
  const listeners = new Set();

  // Handles notify
  const notify = () => {
    listeners.forEach((listener) => listener(state));
  };

  // Gets state
  const getState = () => state;

  // Sets state
  const setState = (patch) => {
    if (!patch || typeof patch !== "object") return;
    Object.assign(state, patch);
    notify();
  };

  // Handles mutate
  const mutate = (mutator) => {
    if (typeof mutator !== "function") return;
    mutator(state);
    notify();
  };

  // Handles subscribe
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
