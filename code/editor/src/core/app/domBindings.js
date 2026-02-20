import {
  setupBinaryTabs,
  setupEdgePanelToggle,
  setupManualModal,
} from "./panels.js";

// Sets up object name input
export function setupObjectNameInput({
  dom,
  store,
  updateStoredName,
  renderObjectList,
  updateExportNameField,
  scheduleSave,
  setStatus,
}) {
  if (!(dom.objectNameInput instanceof HTMLInputElement)) return;

  // Applies rename
  const applyRename = () => {
    const object = store.getState().currentObject;
    if (!object) return;

    const nextName = dom.objectNameInput.value.trim();
    if (!nextName) {
      dom.objectNameInput.value = object.name || "";
      return;
    }
    if (object.name === nextName) return;

    object.name = nextName;
    store.mutate((state) => {
      updateStoredName(object, state, nextName);
    });

    renderObjectList();
    updateExportNameField(object);
    scheduleSave();
    setStatus?.(`Renamed to ${nextName}.`);
  };

  dom.objectNameInput.addEventListener("change", applyRename);
  dom.objectNameInput.addEventListener("blur", applyRename);
  dom.objectNameInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    dom.objectNameInput.blur();
  });
}

// Sets up export controls
export function setupExportControls({
  dom,
  store,
  updateExportAvailability,
  updateExportNameField,
  clearScene,
}) {
  if (dom.exportSceneToggle instanceof HTMLInputElement) {
    dom.exportSceneToggle.addEventListener("change", () => {
      updateExportAvailability();
      updateExportNameField(store.getState().currentObject);
    });
  }

  if (dom.clearSceneButton instanceof HTMLButtonElement) {
    dom.clearSceneButton.addEventListener("click", () => {
      clearScene();
    });
  }
}

// Sets up app panels
export function setupAppPanels({ dom, updateExportAvailability }) {
  setupEdgePanelToggle({
    button: dom.toolsToggle,
    className: "left-panel-collapsed",
    expandedLabel: "Collapse tools panel",
    collapsedLabel: "Expand tools panel",
    expandedIcon: "<",
    collapsedIcon: ">",
  });

  setupEdgePanelToggle({
    button: dom.panelToggle,
    className: "right-panel-collapsed",
    expandedLabel: "Collapse control panel",
    collapsedLabel: "Expand control panel",
    expandedIcon: ">",
    collapsedIcon: "<",
    onToggle: updateExportAvailability,
  });

  setupManualModal({ dom });

  setupBinaryTabs({
    firstTab: dom.panelTabControls,
    secondTab: dom.panelTabModels,
    firstPane: dom.panelPaneControls,
    secondPane: dom.panelPaneModels,
    firstKey: "controls",
    secondKey: "models",
    initialKey: "controls",
  });

  setupBinaryTabs({
    firstTab: dom.toolsTabTransform,
    secondTab: dom.toolsTabCamera,
    firstPane: dom.toolsPaneTransform,
    secondPane: dom.toolsPaneCamera,
    firstKey: "transform",
    secondKey: "camera",
    initialKey: "transform",
  });
}
