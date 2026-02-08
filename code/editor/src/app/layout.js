// Layout sync helpers.
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function setupUiLayout() {
  const toolsIsland = document.getElementById("tools-island");
  const gizmo = document.getElementById("viewport-tools");
  if (!toolsIsland || !gizmo) return;

  const gap = 12;
  let rafId = 0;

  const update = () => {
    const toolsRect = toolsIsland.getBoundingClientRect();
    gizmo.style.width = `${Math.round(toolsRect.width)}px`;

    const gizmoRect = gizmo.getBoundingClientRect();
    const top = clamp(toolsRect.top - gizmoRect.height - gap, gap, window.innerHeight - gap);
    gizmo.style.left = `${Math.round(toolsRect.left)}px`;
    gizmo.style.top = `${Math.round(top)}px`;

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
    ro.observe(toolsIsland);
    ro.observe(gizmo);
  }

  schedule();
}
