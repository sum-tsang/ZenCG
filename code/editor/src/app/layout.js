// Layout sync helpers.
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function setupUiLayout() {
  const gizmo = document.getElementById("viewport-tools");
  const toolsIsland = document.getElementById("tools-island");
  const toolsToggle = document.getElementById("tools-toggle");
  if (!gizmo && !(toolsIsland && toolsToggle)) return;

  let rafId = 0;

  const update = () => {
    const rootStyles = getComputedStyle(document.documentElement);
    const edgeGap = parseFloat(rootStyles.getPropertyValue("--edge-gap"));
    const islandGap = parseFloat(rootStyles.getPropertyValue("--island-gap"));
    const toolsWidth = parseFloat(rootStyles.getPropertyValue("--tools-width"));

    const left = Number.isFinite(edgeGap) ? edgeGap : 0;
    const top = Number.isFinite(islandGap) ? islandGap : 12;
    const width = Number.isFinite(toolsWidth) ? toolsWidth : 225;
    const maxWidth = Math.max(140, window.innerWidth - (left * 2));

    if (gizmo) {
      gizmo.style.left = `${Math.round(left)}px`;
      gizmo.style.top = `${Math.round(top)}px`;
      gizmo.style.width = `${Math.round(clamp(width, 140, maxWidth))}px`;
    }

    // Keep the left toggle centered to the tools island, not the viewport.
    if (toolsIsland instanceof HTMLElement && toolsToggle instanceof HTMLElement) {
      const islandRect = toolsIsland.getBoundingClientRect();
      const centerY = islandRect.top + islandRect.height / 2;
      if (Number.isFinite(centerY) && islandRect.height > 0) {
        toolsToggle.style.top = `${Math.round(centerY)}px`;
        toolsToggle.style.bottom = "auto";
        toolsToggle.style.transform = "translateY(-50%)";
      }
    }
  };

  const schedule = () => {
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      rafId = 0;
      update();
    });
  };

  window.addEventListener("resize", schedule);

  if ("ResizeObserver" in window) {
    const ro = new ResizeObserver(schedule);
    if (gizmo) {
      ro.observe(gizmo);
    }
    if (toolsIsland) {
      ro.observe(toolsIsland);
    }
  }

  schedule();
}
