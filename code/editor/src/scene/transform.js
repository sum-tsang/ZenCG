// Transform serialization helpers.
import { materialEditor } from "../modelMaterial/materialEditor.js";

// Serialize an object's transform to plain arrays.
export function serializeTransform(object) {
  return {
    position: object.position.toArray(),
    quaternion: object.quaternion.toArray(),
    scale: object.scale.toArray(),
  };
}

// Apply a serialized transform to an object.
export function applyTransform(object, transform) {
  if (!transform) return;
  if (Array.isArray(transform.position) && transform.position.length === 3) {
    object.position.fromArray(transform.position);
  }
  if (Array.isArray(transform.quaternion) && transform.quaternion.length === 4) {
    object.quaternion.fromArray(transform.quaternion);
  }
  if (Array.isArray(transform.scale) && transform.scale.length === 3) {
    object.scale.fromArray(transform.scale);
  }
}

// Update the saved transform for an object in state.
export function updateStoredTransform(object, state) {
  const index = state.importedObjects.indexOf(object);
  if (index === -1) return;
  const entry = state.storedImports[index];
  if (!entry) return;
  entry.transform = serializeTransform(object);
}

// Update the saved material for an object in state.
export function updateStoredMaterial(object, state) {
  const index = state.importedObjects.indexOf(object);
  if (index === -1) return;
  const entry = state.storedImports[index];
  if (!entry) return;
  entry.material = materialEditor.serializeMaterial(object);
}

// Update the saved name for an object in state.
export function updateStoredName(object, state, name) {
  const index = state.importedObjects.indexOf(object);
  if (index === -1) return;
  const entry = state.storedImports[index];
  if (!entry) return;
  if (typeof name === "string" && name.trim()) {
    entry.name = name.trim();
  }
}
