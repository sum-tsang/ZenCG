
import * as THREE from "three";
import { updateMultiSelectionOutlines } from "./objects.js";

// Start resize handling and the main render loop
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
  // Runs resize
  const resize = () => {
    const width = Math.max(1, dom.canvas.clientWidth);
    const height = Math.max(1, dom.canvas.clientHeight);

    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    envGizmo?.resize();
  };

  // Renders the target state
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

// Build and render the small orientation gizmo in the corner
export function createEnvironmentGizmo(canvas, mainCamera) {
  if (!(canvas instanceof HTMLCanvasElement)) {
    return null;
  }

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 10);
  camera.position.set(0, 0, 3.8);

  const axesGroup = new THREE.Group();
  const origin = new THREE.Vector3(0, 0, 0);
  const arrowLength = 1.1;
  const headLength = 0.32;
  const headWidth = 0.22;
  const labelOffset = arrowLength + 0.18;

  // Creates axis label
  const createAxisLabel = (text, color, scale = 0.35) => {
    const size = 128;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    if (!context) return null;

    context.clearRect(0, 0, size, size);
    context.font = "bold 72px system-ui, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.lineWidth = 10;
    context.strokeStyle = "rgba(0, 0, 0, 0.85)";
    context.strokeText(text, size / 2, size / 2);
    context.fillStyle = color;
    context.fillText(text, size / 2, size / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(scale, scale, scale);
    return sprite;
  };
  axesGroup.add(
    new THREE.ArrowHelper(
      new THREE.Vector3(1, 0, 0),
      origin,
      arrowLength,
      0xff3b30,
      headLength,
      headWidth
    )
  );
  axesGroup.add(
    new THREE.ArrowHelper(
      new THREE.Vector3(-1, 0, 0),
      origin,
      arrowLength,
      0xff3b30,
      headLength,
      headWidth
    )
  );
  axesGroup.add(
    new THREE.ArrowHelper(
      new THREE.Vector3(0, 1, 0),
      origin,
      arrowLength,
      0x34c759,
      headLength,
      headWidth
    )
  );
  axesGroup.add(
    new THREE.ArrowHelper(
      new THREE.Vector3(0, -1, 0),
      origin,
      arrowLength,
      0x34c759,
      headLength,
      headWidth
    )
  );
  axesGroup.add(
    new THREE.ArrowHelper(
      new THREE.Vector3(0, 0, 1),
      origin,
      arrowLength,
      0x0a84ff,
      headLength,
      headWidth
    )
  );
  axesGroup.add(
    new THREE.ArrowHelper(
      new THREE.Vector3(0, 0, -1),
      origin,
      arrowLength,
      0x0a84ff,
      headLength,
      headWidth
    )
  );

  const xLabel = createAxisLabel("X", "#ff3b30");
  const yLabel = createAxisLabel("Y", "#34c759");
  const zLabel = createAxisLabel("Z", "#0a84ff");
  const xNegLabel = createAxisLabel("-X", "#ff3b30", 0.35);
  const yNegLabel = createAxisLabel("-Y", "#34c759", 0.35);
  const zNegLabel = createAxisLabel("-Z", "#0a84ff", 0.35);
  if (xLabel) {
    xLabel.position.set(labelOffset, 0, 0);
    axesGroup.add(xLabel);
  }
  if (xNegLabel) {
    xNegLabel.position.set(-labelOffset, 0, 0);
    axesGroup.add(xNegLabel);
  }
  if (yLabel) {
    yLabel.position.set(0, labelOffset, 0);
    axesGroup.add(yLabel);
  }
  if (yNegLabel) {
    yNegLabel.position.set(0, -labelOffset, 0);
    axesGroup.add(yNegLabel);
  }
  if (zLabel) {
    zLabel.position.set(0, 0, labelOffset);
    axesGroup.add(zLabel);
  }
  if (zNegLabel) {
    zNegLabel.position.set(0, 0, -labelOffset);
    axesGroup.add(zNegLabel);
  }
  axesGroup.scale.setScalar(1.05);
  scene.add(axesGroup);

  // Runs resize
  const resize = () => {
    const width = Math.max(1, canvas.clientWidth);
    const height = Math.max(1, canvas.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };

  // Renders the target state
  const render = () => {
    if (!mainCamera) return;
    axesGroup.quaternion.copy(mainCamera.quaternion).invert();
    renderer.render(scene, camera);
  };

  resize();

  return { resize, render };
}
