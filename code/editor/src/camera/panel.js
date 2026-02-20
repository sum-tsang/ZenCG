import { cameraAxisButtons } from "../core/config/settings.js";

// Sets up camera panel
export function setupCameraPanel({ containerId, onAxisView }) {
  const container = document.getElementById(containerId);
  if (!container) {
    throw new Error(`Camera panel container with id "${containerId}" not found.`);
  }

  container.innerHTML = "";

  const panel = document.createElement("div");
  panel.className = "camera-panel";

  const viewsSection = document.createElement("div");
  viewsSection.className = "camera-section";

  const viewsTitle = document.createElement("h3");
  viewsTitle.className = "section-title";
  viewsTitle.textContent = "View Presets";
  viewsSection.appendChild(viewsTitle);

  const axisGrid = document.createElement("div");
  axisGrid.className = "camera-axis-grid";

  for (const { label, axis, axisKey, slot, negative } of cameraAxisButtons) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `camera-axis-btn axis-${axisKey}`;
    if (negative) {
      button.classList.add("is-negative");
    }

    button.dataset.axis = axis;
    button.dataset.slot = slot;
    button.style.gridArea = slot;
    button.textContent = label;
    button.title = `View from ${label}`;
    button.setAttribute("aria-label", `View from ${label}`);
    button.addEventListener("click", () => {
      onAxisView?.(axis);
    });

    axisGrid.appendChild(button);
  }

  viewsSection.appendChild(axisGrid);
  panel.append(viewsSection);
  container.appendChild(panel);

  return {
    // Handles dispose
    dispose() {
      container.innerHTML = "";
    },
  };
}
