import * as THREE from "three";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";

const canvas = document.getElementById("viewport-canvas");
const fileInput = document.getElementById("obj-input");
const status = document.getElementById("status");

if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error("Viewport canvas not found.");
}

if (!(fileInput instanceof HTMLInputElement)) {
  throw new Error("OBJ input not found.");
}

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setClearColor(0x111111, 1);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);

scene.add(new THREE.AmbientLight(0xffffff, 0.7));
const keyLight = new THREE.DirectionalLight(0xffffff, 0.8);
keyLight.position.set(5, 6, 4);
scene.add(keyLight);

const loader = new OBJLoader();
let currentObject = null;

function setStatus(message) {
  if (status) {
    status.textContent = message;
  }
}

function frameObject(object) {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  object.position.sub(center);

  const maxDim = Math.max(size.x, size.y, size.z, 1);
  const distance = maxDim * 1.8;
  camera.position.set(distance, distance * 0.9, distance);
  camera.near = maxDim / 100;
  camera.far = maxDim * 100;
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
}

function loadObjFromText(text, filename) {
  let object;

  try {
    object = loader.parse(text);
  } catch (error) {
    console.error(error);
    setStatus("Failed to parse OBJ file.");
    return;
  }

  if (currentObject) {
    scene.remove(currentObject);
  }

  currentObject = object;
  scene.add(object);
  frameObject(object);
  setStatus(`Loaded ${filename}`);
}

function handleFile(file) {
  if (!file) {
    return;
  }

  if (!file.name.toLowerCase().endsWith(".obj")) {
    setStatus("Please select a .obj file.");
    fileInput.value = "";
    return;
  }

  setStatus("Loading OBJ...");
  const reader = new FileReader();

  reader.onload = () => {
    const text = reader.result;
    if (typeof text === "string") {
      loadObjFromText(text, file.name);
    } else {
      setStatus("Unable to read OBJ file.");
    }
    fileInput.value = "";
  };

  reader.onerror = () => {
    setStatus("Error reading OBJ file.");
    fileInput.value = "";
  };

  reader.readAsText(file);
}

function resize() {
  const width = Math.max(1, canvas.clientWidth);
  const height = Math.max(1, canvas.clientHeight);

  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}

function render() {
  renderer.render(scene, camera);
  requestAnimationFrame(render);
}

fileInput.addEventListener("change", (event) => {
  const input = event.target;
  if (input instanceof HTMLInputElement) {
    handleFile(input.files?.[0] ?? null);
  }
});

window.addEventListener("resize", resize);
setStatus("Waiting for OBJ file...");
resize();
render();
