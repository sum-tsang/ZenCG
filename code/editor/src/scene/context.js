import * as THREE from "three";
import { createCamera } from "../camera/camera.js";

// Build renderer, scene, camera, and helper objects.
export function createSceneContext(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const { camera, target } = createCamera();

  const grid = new THREE.GridHelper(200, 20, 0x545454, 0x545454);
  grid.material.transparent = true;
  grid.material.opacity = 0.5;
  scene.add(grid);

  scene.add(new THREE.AmbientLight(0xffffff, 0.7));
  const keyLight = new THREE.DirectionalLight(0xffffff, 0.8);
  keyLight.position.set(5, 6, 4);
  scene.add(keyLight);

  const importRoot = new THREE.Group();
  importRoot.name = "ImportedObjects";
  scene.add(importRoot);

  const selectionHelper = createSelectionHelper(scene);

  return { renderer, scene, camera, target, importRoot, selectionHelper };
}

// Create a highlighted box helper for selection.
function createSelectionHelper(scene) {
  const helper = new THREE.BoxHelper(new THREE.Object3D(), 0x7fefff);
  helper.name = "SelectionOutline";
  helper.visible = false;
  helper.renderOrder = 1;
  const materials = Array.isArray(helper.material)
    ? helper.material
    : [helper.material];
  materials.forEach((material) => {
    if (!material) return;
    material.depthTest = false;
    material.transparent = true;
    material.opacity = 0.8;
  });
  scene.add(helper);
  return helper;
}
