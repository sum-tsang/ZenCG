import * as THREE from "three";
import { createCamera, frameObject, attachPanControls } from "./camera_controls/index.js";
import { setupObjImport } from "./import_export/index.js";

const canvas = document.getElementById("viewport-canvas");
const fileInput = document.getElementById("obj-input");
const status = document.getElementById("status");

if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error("Viewport canvas not found.");
}

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setClearColor(0x111111, 1);

const scene = new THREE.Scene();
const { camera, target } = createCamera();

scene.add(new THREE.AmbientLight(0xffffff, 0.7));
const keyLight = new THREE.DirectionalLight(0xffffff, 0.8);
keyLight.position.set(5, 6, 4);
scene.add(keyLight);

function setStatus(message) {
  if (status) {
    status.textContent = message;
  }
}

setupObjImport({
  fileInput,
  scene,
  frameObject: (object) => frameObject(object, camera, target),
  setStatus,
});

attachPanControls({ canvas, camera, target, renderer });

function resize() {
  const width = Math.max(1, canvas.clientWidth);
  const height = Math.max(1, canvas.clientHeight);

  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}

function render() {
  camera.lookAt(target);
  renderer.render(scene, camera);
  requestAnimationFrame(render);
}

window.addEventListener("resize", resize);
setStatus("Waiting for OBJ file...");
resize();
render();
