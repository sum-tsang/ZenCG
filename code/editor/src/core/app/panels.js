// Updates edge toggle button
function updateEdgeToggleButton(
  button,
  collapsed,
  expandedLabel,
  collapsedLabel,
  expandedIcon,
  collapsedIcon
) {
  if (!(button instanceof HTMLButtonElement)) return;

  button.setAttribute("aria-pressed", collapsed ? "true" : "false");
  button.setAttribute("aria-label", collapsed ? collapsedLabel : expandedLabel);
  button.title = collapsed ? collapsedLabel : expandedLabel;

  const icon = button.querySelector(".edge-toggle-icon");
  if (icon) {
    icon.textContent = collapsed ? collapsedIcon : expandedIcon;
  }
}

// Sets up binary tabs
export function setupBinaryTabs({
  firstTab,
  secondTab,
  firstPane,
  secondPane,
  firstKey,
  secondKey,
  initialKey,
}) {
  if (!(firstTab instanceof HTMLButtonElement)) return;
  if (!(secondTab instanceof HTMLButtonElement)) return;
  if (!(firstPane instanceof HTMLElement)) return;
  if (!(secondPane instanceof HTMLElement)) return;

  // Handles activate tab
  const activateTab = (key) => {
    const showingSecond = key === secondKey;
    firstPane.hidden = showingSecond;
    secondPane.hidden = !showingSecond;

    firstTab.classList.toggle("is-active", !showingSecond);
    secondTab.classList.toggle("is-active", showingSecond);
    firstTab.setAttribute("aria-selected", showingSecond ? "false" : "true");
    secondTab.setAttribute("aria-selected", showingSecond ? "true" : "false");
  };

  firstTab.addEventListener("click", () => {
    activateTab(firstKey);
  });

  secondTab.addEventListener("click", () => {
    activateTab(secondKey);
  });

  activateTab(initialKey);
}

// Sets up edge panel toggle
export function setupEdgePanelToggle({
  button,
  className,
  expandedLabel,
  collapsedLabel,
  expandedIcon,
  collapsedIcon,
  onToggle,
}) {
  if (!(button instanceof HTMLButtonElement)) return;

  // Handles sync toggle state
  const syncToggleState = () => {
    const collapsed = document.body.classList.contains(className);
    updateEdgeToggleButton(
      button,
      collapsed,
      expandedLabel,
      collapsedLabel,
      expandedIcon,
      collapsedIcon
    );
  };

  button.addEventListener("click", () => {
    document.body.classList.toggle(className);
    syncToggleState();
    onToggle?.();
  });

  syncToggleState();
}

// Sets up manual modal
export function setupManualModal({ dom }) {
  const { manualButton, manualModal } = dom;
  if (!(manualButton instanceof HTMLButtonElement)) return;
  if (!(manualModal instanceof HTMLElement)) return;

  const closeButtons = manualModal.querySelectorAll("[data-manual-close]");
  let lastFocusedElement = null;

  // Handles is open
  const isOpen = () => document.body.classList.contains("manual-open");

  // Sets open
  const setOpen = (open) => {
    document.body.classList.toggle("manual-open", open);
    manualModal.setAttribute("aria-hidden", open ? "false" : "true");
    manualButton.setAttribute("aria-expanded", open ? "true" : "false");
  };

  // Handles open manual
  const openManual = () => {
    if (isOpen()) return;
    lastFocusedElement = document.activeElement;
    setOpen(true);
    const closeButton = manualModal.querySelector("[data-manual-close]");
    if (closeButton instanceof HTMLButtonElement) {
      closeButton.focus();
    }
  };

  // Handles close manual
  const closeManual = () => {
    if (!isOpen()) return;
    setOpen(false);
    if (lastFocusedElement instanceof HTMLElement) {
      lastFocusedElement.focus();
    }
  };

  manualButton.addEventListener("click", openManual);
  closeButtons.forEach((button) => {
    button.addEventListener("click", closeManual);
  });

  manualModal.addEventListener("click", (event) => {
    if (event.target === manualModal) {
      closeManual();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (!isOpen()) return;

    event.preventDefault();
    closeManual();
  });
}

// Sets up footer controls
export function setupFooterControls({
  dom,
  store,
  getTransformationManager,
  undoDelete,
  hasUndoDelete,
}) {
  if (dom.undoButton instanceof HTMLButtonElement) {
    dom.undoButton.addEventListener("click", () => {
      const canUndoDelete = typeof hasUndoDelete === "function"
        && hasUndoDelete();
      if (canUndoDelete && store.getState().currentObject === null) {
        undoDelete?.();
        return;
      }
      const didUndo = getTransformationManager?.()?.undo?.();
      if (!didUndo && typeof undoDelete === "function") {
        undoDelete();
      }
    });
  }

  if (dom.redoButton instanceof HTMLButtonElement) {
    dom.redoButton.addEventListener("click", () => {
      getTransformationManager?.()?.redo?.();
    });
  }
}
