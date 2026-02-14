// Render loop wiring.
// Register resize handling and start the render loop.
import { updateMultiSelectionOutlines } from "./selection.js";

export function setupResizeAndRender({
  dom,
  camera,
  renderer,
  scene,
  target,
  selectionHelper,
  multiSelectionGroup,
  getCurrentObject,
  getSelectedObjects,
  transformationManager,
  envGizmo,
  setStatus,
}) {
  // Resize renderer and camera to match canvas.
  const resize = () => {
    const width = Math.max(1, dom.canvas.clientWidth);
    const height = Math.max(1, dom.canvas.clientHeight);

    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    envGizmo?.resize();
  };

  // Render the main scene and helper gizmos.
  const render = () => {
    camera.lookAt(target);
    const currentObject = getCurrentObject?.();
    if (currentObject && selectionHelper?.visible) {
      selectionHelper.setFromObject(currentObject);
    }
    if (multiSelectionGroup) {
      const selectedObjects = getSelectedObjects?.() ?? [];
      updateMultiSelectionOutlines(multiSelectionGroup, selectedObjects, currentObject);
    }
    if (currentObject && transformationManager?.gizmo) {
      transformationManager.gizmo.updateGizmoPosition();
    }
    renderer.render(scene, camera);
    envGizmo?.render();
    requestAnimationFrame(render);
  };

  window.addEventListener("resize", resize);
  setStatus?.("Waiting for OBJ file...");
  resize();
  render();

  return () => {
    window.removeEventListener("resize", resize);
  };
}
