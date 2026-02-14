// Build persistable entries from live scene objects.
import { OBJExporter } from "three/addons/exporters/OBJExporter.js";
import { materialEditor } from "../model/materials/materialEditor.js";
import { serializeTransform } from "../scene/transform.js";

const exporter = new OBJExporter();

function hasObjText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function cloneForLocalObjExport(object) {
  if (!object) return null;
  const clone = object.clone(true);
  clone.position.set(0, 0, 0);
  clone.quaternion.identity();
  clone.scale.set(1, 1, 1);
  clone.updateMatrixWorld(true);
  return clone;
}

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

function fallbackName(object, index) {
  const objectName = typeof object?.name === "string" ? object.name.trim() : "";
  if (objectName) return objectName;
  return `object_${index + 1}`;
}

// Ensure each stored entry has valid text/transform/material for restore.
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

    const text = hasObjText(entry?.text) ? entry.text : exportObjectAsObjText(object);
    if (!hasObjText(text)) continue;

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
