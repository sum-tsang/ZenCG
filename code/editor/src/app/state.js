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
