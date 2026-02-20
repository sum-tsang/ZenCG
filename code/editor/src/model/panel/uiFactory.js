const SVG_NS = "http://www.w3.org/2000/svg";
// Creates mode icon
function createModeIcon(mode) {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.classList.add("mode-icon");

  const path = document.createElementNS(SVG_NS, "path");
  if (mode === "translate") {
    path.setAttribute(
      "d",
      "M12 2l3 3h-2v4h-2V5H9l3-3zm0 20l-3-3h2v-4h2v4h2l-3 3zm10-10l-3 3v-2h-4v-2h4V9l3 3zM2 12l3-3v2h4v2H5v2l-3-3z"
    );
  } else if (mode === "rotate") {
    path.setAttribute(
      "d",
      "M12 4a8 8 0 1 1-7.45 5H6a6 6 0 1 0 6-4V4zM5 9V5h4l-1.6 1.6A8 8 0 0 1 12 4"
    );
  } else {
    path.setAttribute(
      "d",
      "M5 5h5v2H7v3H5V5zm14 14h-5v-2h3v-3h2v5zM14 5h5v5h-2V7h-3V5zM5 14h2v3h3v2H5v-5z"
    );
  }

  svg.appendChild(path);
  return svg;
}
// Creates section
function createSection(title) {
  const section = document.createElement("div");
  section.className = "transform-section";

  const titleEl = document.createElement("h3");
  titleEl.textContent = title;
  titleEl.className = "section-title";
  section.appendChild(titleEl);

  return section;
}
// Creates transform section
function createTransformSection({ title, property, state, onInputChange }) {
  const section = createSection(title);
  section.className = "transform-section expanded";

  const contentDiv = document.createElement("div");
  contentDiv.className = "transform-content";

  ["x", "y", "z"].forEach((axis) => {
    const row = document.createElement("div");
    row.className = "input-row";

    const labelEl = document.createElement("label");
    labelEl.textContent = axis.toUpperCase();
    labelEl.className = `label-${axis}`;

    const input = document.createElement("input");
    input.type = "number";
    input.className = `input-${property}-${axis}`;
    input.dataset.property = property;
    input.dataset.axis = axis;
    input.step = property === "rotation" ? "1" : "0.01";
    input.value = state[property][axis];

    if (property === "scale") {
      input.value = "1";
      input.min = "0.01";
      input.max = "10";
    } else if (property === "rotation") {
      input.value = "0";
      input.min = "-360";
      input.max = "360";
    } else {
      input.value = "0";
    }

    input.addEventListener("input", (e) => onInputChange(e.target, false));
    input.addEventListener("change", (e) => onInputChange(e.target, true));

    const unit = document.createElement("span");
    unit.className = "input-unit";
    unit.textContent = property === "rotation" ? "°" : property === "scale" ? "x" : "m";

    row.appendChild(labelEl);
    row.appendChild(input);
    row.appendChild(unit);
    contentDiv.appendChild(row);
  });

  section.appendChild(contentDiv);
  return section;
}
// Handles build transformation panel ui
export function buildTransformationPanelUI({
  container,
  state,
  onSetMode,
  onSplit,
  onCancelSplit,
  onCombine,
  onReset,
  onInputChange,
}) {
  container.innerHTML = "";

  const panel = document.createElement("div");
  panel.id = "transformation-panel";
  panel.className = "transform-panel";

  const modeGroup = createSection("Tools");
  const modeButtons = document.createElement("div");
  modeButtons.className = "mode-buttons";

  [
    { name: "Translate", value: "translate" },
    { name: "Rotate", value: "rotate" },
    { name: "Scale", value: "scale" },
  ].forEach((mode) => {
    const button = document.createElement("button");
    button.setAttribute("aria-label", mode.name);
    button.setAttribute("title", mode.name);
    button.setAttribute("aria-pressed", mode.value === "translate" ? "true" : "false");
    button.className = `mode-btn ${mode.value}`;
    if (mode.value === "translate") button.classList.add("active");
    button.dataset.mode = mode.value;
    button.addEventListener("click", (e) => onSetMode(e.currentTarget.dataset.mode));
    button.appendChild(createModeIcon(mode.value));
    modeButtons.appendChild(button);
  });
  modeGroup.appendChild(modeButtons);
  panel.appendChild(modeGroup);

  const splitRow = document.createElement("div");
  splitRow.className = "split-row";
  const splitBtn = document.createElement("button");
  splitBtn.className = "split-btn";
  const splitLabel = document.createElement("span");
  splitLabel.className = "split-label";
  splitLabel.textContent = "Create Component";
  const splitHint = document.createElement("span");
  splitHint.className = "split-hint";
  splitHint.textContent = "click mesh";
  splitBtn.append(splitLabel, splitHint);
  splitRow.appendChild(splitBtn);

  const cancelBtn = document.createElement("button");
  cancelBtn.textContent = "Cancel";
  cancelBtn.className = "cancel-split-btn";
  cancelBtn.style.display = "none";
  splitRow.appendChild(cancelBtn);

  splitBtn.addEventListener("click", onSplit);
  cancelBtn.addEventListener("click", onCancelSplit);
  panel.appendChild(splitRow);

  const combineRow = document.createElement("div");
  combineRow.className = "split-row";
  const combineBtn = document.createElement("button");
  combineBtn.type = "button";
  combineBtn.className = "combine-btn";
  combineBtn.textContent = "Combine Models";
  combineBtn.disabled = true;
  combineBtn.addEventListener("click", onCombine);
  combineRow.appendChild(combineBtn);
  panel.appendChild(combineRow);

  const unitIndicator = document.createElement("p");
  unitIndicator.className = "unit-indicator";
  unitIndicator.textContent = "Units: m";
  panel.appendChild(unitIndicator);

  const positionSection = createTransformSection({
    title: "Position",
    property: "position",
    state,
    onInputChange,
  });
  panel.appendChild(positionSection);

  const rotationSection = createTransformSection({
    title: "Rotation",
    property: "rotation",
    state,
    onInputChange,
  });
  rotationSection.style.display = "none";
  panel.appendChild(rotationSection);

  const scaleSection = createTransformSection({
    title: "Scale",
    property: "scale",
    state,
    onInputChange,
  });
  scaleSection.style.display = "none";
  panel.appendChild(scaleSection);

  const resetSection = createSection("Reset");
  const resetBtn = document.createElement("button");
  resetBtn.textContent = "Reset to Default";
  resetBtn.className = "reset-btn";
  resetBtn.addEventListener("click", onReset);
  resetSection.appendChild(resetBtn);
  panel.appendChild(resetSection);

  container.appendChild(panel);
  return { positionSection, rotationSection, scaleSection };
}
