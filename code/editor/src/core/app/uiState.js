import { normalizeExportBaseName } from "../config/exportFilename.js";

const TOOL_LABELS = {
  translate: "Move",
  rotate: "Rotate",
  scale: "Scale",
};

// Creates app ui state
export function createAppUiState({ dom, store }) {
  let lastAutoExportName = "";

  const updateRecentActionIndicator = (entries = []) => {
    if (!(dom.recentAction instanceof HTMLElement)) return;
    const latest = Array.isArray(entries) && entries.length
      ? entries[entries.length - 1]
      : null;
    dom.recentAction.textContent = latest || "No actions yet";
  };

  const updateFooterToolIndicator = (toolState = {}) => {
    const modeKey =
      typeof toolState?.mode === "string" ? toolState.mode.toLowerCase() : "translate";
    const normalizedMode = Object.prototype.hasOwnProperty.call(TOOL_LABELS, modeKey)
      ? modeKey
      : "translate";
    const activeAxis =
      typeof toolState?.axis === "string" ? toolState.axis.toLowerCase() : "";

    if (dom.footerToolValue instanceof HTMLElement) {
      dom.footerToolValue.textContent = TOOL_LABELS[normalizedMode];
    }

    const axisElements = {
      x: dom.footerAxisX,
      y: dom.footerAxisY,
      z: dom.footerAxisZ,
    };

    Object.entries(axisElements).forEach(([axis, element]) => {
      if (!(element instanceof HTMLElement)) return;
      element.classList.toggle("is-active", axis === activeAxis);
    });
  };

  const renderHistoryList = (entries = []) => {
    updateRecentActionIndicator(entries);
    if (!(dom.historyList instanceof HTMLUListElement)) return;
    dom.historyList.innerHTML = "";
    const orderedEntries = Array.isArray(entries) ? [...entries].reverse() : [];

    if (!orderedEntries.length) {
      const empty = document.createElement("li");
      empty.className = "history-item history-empty";
      empty.textContent = "No actions yet";
      dom.historyList.appendChild(empty);
      return;
    }

    orderedEntries.forEach((entry) => {
      const item = document.createElement("li");
      item.className = "history-item";
      item.textContent = entry;
      dom.historyList.appendChild(item);
    });
  };

  // Updates object name field
  const updateObjectNameField = (object) => {
    if (!(dom.objectNameInput instanceof HTMLInputElement)) return;
    if (!object) {
      dom.objectNameInput.value = "";
      dom.objectNameInput.placeholder = "Select an object";
      dom.objectNameInput.disabled = true;
      return;
    }
    dom.objectNameInput.disabled = false;
    dom.objectNameInput.value =
      typeof object.name === "string" && object.name ? object.name : "";
  };

  // Updates export name field
  const updateExportNameField = (object) => {
    if (!(dom.exportNameInput instanceof HTMLInputElement)) return;
    const exportWholeScene = Boolean(dom.exportSceneToggle?.checked);
    const base = normalizeExportBaseName(
      exportWholeScene ? "scene" : object?.name || "",
      "zencg-export"
    );
    if (!dom.exportNameInput.value || dom.exportNameInput.value === lastAutoExportName) {
      dom.exportNameInput.value = base;
      lastAutoExportName = base;
    }
  };

  // Updates export availability
  const updateExportAvailability = () => {
    if (!(dom.exportButton instanceof HTMLButtonElement)) return;
    const state = store.getState();
    const exportWholeScene = Boolean(dom.exportSceneToggle?.checked);
    const hasScene = state.importedObjects.length > 0;
    dom.exportButton.disabled = exportWholeScene ? !hasScene : !state.currentObject;
    if (dom.clearSceneButton instanceof HTMLButtonElement) {
      dom.clearSceneButton.disabled = !hasScene;
    }
  };

  return {
    updateFooterToolIndicator,
    renderHistoryList,
    updateObjectNameField,
    updateExportNameField,
    updateExportAvailability,
  };
}
