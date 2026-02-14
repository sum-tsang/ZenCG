// Object list rendering.
// Render the imported object list UI.
export function renderObjectList({ dom, state, onSelect, onDelete, onToggleSelect }) {
  if (!(dom.objectList instanceof HTMLUListElement)) {
    return;
  }

  const hasObjects = state.importedObjects.length > 0;

  if (dom.objectListEmpty instanceof HTMLElement) {
    dom.objectListEmpty.hidden = hasObjects;
  }

  if (!hasObjects) {
    dom.objectList.replaceChildren();
    return;
  }

  const selectedSet = Array.isArray(state.selectedObjects)
    ? new Set(state.selectedObjects)
    : null;
  const fragment = document.createDocumentFragment();

  state.importedObjects.forEach((object, index) => {
    const item = document.createElement("li");
    item.className = "object-item";
    const row = document.createElement("div");
    row.className = "object-row";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "object-button";
    const label =
      typeof object?.name === "string" && object.name
        ? object.name
        : `Object ${index + 1}`;
    button.textContent = label;
    if (object === state.currentObject) {
      button.classList.add("active");
    }
    if (
      selectedSet?.has(object) &&
      object !== state.currentObject
    ) {
      row.classList.add("multi-selected");
    }
    button.addEventListener("click", () => {
      onSelect?.(object);
    });
    row.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      onToggleSelect?.(object);
    });
    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "object-delete";
    removeButton.textContent = "Delete";
    removeButton.addEventListener("click", (event) => {
      event.stopPropagation();
      onDelete?.(object);
    });
    row.append(button, removeButton);
    item.append(row);
    fragment.append(item);
  });

  dom.objectList.replaceChildren(fragment);
}
