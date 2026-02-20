import * as THREE from "three";

// Handles clone stored entry
function cloneStoredEntry(entry) {
  if (!entry) return null;
  if (typeof structuredClone === "function") {
    return structuredClone(entry);
  }
  try {
    return JSON.parse(JSON.stringify(entry));
  } catch {
    return { ...entry };
  }
}

// Handles clone object materials
function cloneObjectMaterials(object) {
  if (!object) return;
  object.traverse((child) => {
    if (!child?.isMesh || !child.material) return;
    if (Array.isArray(child.material)) {
      child.material = child.material.map((material) =>
        material?.clone ? material.clone() : material
      );
      return;
    }
    if (child.material?.clone) {
      child.material = child.material.clone();
    }
  });
}

// Gets safe object name
function getSafeObjectName(baseName) {
  if (typeof baseName === "string" && baseName.trim()) {
    return baseName.trim();
  }
  return "object";
}

// Handles format count message
function formatCountMessage(count, singularLabel, pluralPrefix) {
  return count === 1 ? singularLabel : `${pluralPrefix} ${count} models.`;
}

// Gets selection for clipboard
function getSelectionForClipboard(state) {
  const selected =
    Array.isArray(state.selectedObjects) && state.selectedObjects.length
      ? state.selectedObjects
      : state.currentObject
        ? [state.currentObject]
        : [];
  if (!selected.length) return [];

  const selectedSet = new Set(selected);
  return state.importedObjects.filter((object) => selectedSet.has(object));
}

// Handles build clipboard items
function buildClipboardItems(selection, state) {
  const indexByObject = new Map(
    state.importedObjects.map((object, index) => [object, index])
  );

  return selection
    .map((object) => {
      const index = indexByObject.get(object);
      if (index === undefined) return null;

      const template = object.clone(true);
      template.updateMatrixWorld(true);

      return {
        template,
        sourceName: object.name,
        storedEntry: cloneStoredEntry(state.storedImports[index]),
      };
    })
    .filter(Boolean);
}

// Creates pasted model
function createPastedModel(item, offset, serializeTransform) {
  const object = item.template.clone(true);
  cloneObjectMaterials(object);

  object.position.add(offset);
  object.name = getSafeObjectName(item.sourceName || item.storedEntry?.name);
  object.updateMatrixWorld(true);

  const entry = cloneStoredEntry(item.storedEntry) ?? {};
  entry.name = object.name;
  entry.text = typeof entry.text === "string" ? entry.text : "";
  entry.transform = serializeTransform(object);
  entry.material = entry.material ?? null;

  return { object, entry };
}

// Applies pasted selection
function applyPastedSelection(manager, pastedObjects, selectObject) {
  if (manager && pastedObjects.length > 0) {
    manager.selectObject(pastedObjects[0]);
    for (let index = 1; index < pastedObjects.length; index += 1) {
      manager.toggleSelection(pastedObjects[index]);
    }
    return;
  }

  selectObject(pastedObjects[pastedObjects.length - 1] ?? null);
}

// Creates clipboard actions
export function createClipboardActions({
  store,
  importRoot,
  importGap,
  serializeTransform,
  getTransformationManager,
  selectObject,
  renderObjectList,
  scheduleSave,
  setStatus,
}) {
  const clipboard = {
    items: [],
    pasteIteration: 0,
  };

  const copySelectionToClipboard = ({ silent = false } = {}) => {
    const state = store.getState();
    const selection = getSelectionForClipboard(state);

    if (!selection.length) {
      if (!silent) {
        setStatus?.("Select at least one model to copy.");
      }
      return false;
    }

    const items = buildClipboardItems(selection, state);
    if (!items.length) {
      if (!silent) {
        setStatus?.("No copyable model selected.");
      }
      return false;
    }

    clipboard.items = items;
    clipboard.pasteIteration = 0;

    if (!silent) {
      setStatus?.(
        items.length === 1 ? "Copied 1 model." : `Copied ${items.length} models.`
      );
    }

    return true;
  };

  const pasteClipboardSelection = ({
    statusVerb = "Pasted",
    showEmptyStatus = true,
  } = {}) => {
    if (!clipboard.items.length) {
      if (showEmptyStatus) {
        setStatus?.("Copy a model first.");
      }
      return false;
    }

    clipboard.pasteIteration += 1;
    const offsetAmount = Math.max(importGap, 0.5) * clipboard.pasteIteration;
    const offset = new THREE.Vector3(offsetAmount, 0, offsetAmount * 0.25);

    const pastedObjects = [];
    const pastedEntries = [];

    clipboard.items.forEach((item) => {
      const pasted = createPastedModel(item, offset, serializeTransform);
      importRoot.add(pasted.object);
      pastedObjects.push(pasted.object);
      pastedEntries.push(pasted.entry);
    });

    if (!pastedObjects.length) {
      if (showEmptyStatus) {
        setStatus?.("Unable to paste copied model.");
      }
      return false;
    }

    store.mutate((state) => {
      state.importedObjects.push(...pastedObjects);
      state.storedImports.push(...pastedEntries);
    });

    const manager = getTransformationManager?.();
    applyPastedSelection(manager, pastedObjects, selectObject);

    renderObjectList();
    scheduleSave();
    setStatus?.(
      formatCountMessage(pastedObjects.length, `${statusVerb} 1 model.`, statusVerb)
    );

    return true;
  };

  // Handles duplicate selection instant
  const duplicateSelectionInstant = () => {
    const copied = copySelectionToClipboard({ silent: true });
    if (!copied) {
      setStatus?.("Select at least one model to duplicate.");
      return false;
    }

    return pasteClipboardSelection({
      statusVerb: "Duplicated",
      showEmptyStatus: false,
    });
  };

  return {
    copySelectionToClipboard,
    pasteClipboardSelection,
    duplicateSelectionInstant,
  };
}
