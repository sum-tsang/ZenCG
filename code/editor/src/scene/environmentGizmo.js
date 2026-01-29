import * as THREE from "three";

// Create a small axis gizmo renderer synced to the main camera.
export function createEnvironmentGizmo(canvas, mainCamera) {
  if (!(canvas instanceof HTMLCanvasElement)) {
    return null;
  }

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 10);
  camera.position.set(0, 0, 3);

  const axesGroup = new THREE.Group();
  const origin = new THREE.Vector3(0, 0, 0);
  const arrowLength = 0.9;
  const headLength = 0.25;
  const headWidth = 0.16;
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
      new THREE.Vector3(0, 0, 1),
      origin,
      arrowLength,
      0x0a84ff,
      headLength,
      headWidth
    )
  );
  scene.add(axesGroup);

  // Resize the gizmo renderer to match its canvas.
  const resize = () => {
    const width = Math.max(1, canvas.clientWidth);
    const height = Math.max(1, canvas.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };

  // Render the gizmo with inverse camera rotation.
  const render = () => {
    if (!mainCamera) return;
    axesGroup.quaternion.copy(mainCamera.quaternion).invert();
    renderer.render(scene, camera);
  };

  resize();

  return { resize, render };
}
