// Scene setup
import * as THREE from "three";
import { createCamera } from "../camera/camera.js";

// Build renderer, scene, camera, and helper objects
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

  const gridSize = 200;
  const gridDivisions = 100;
  const grid = new THREE.GridHelper(gridSize, gridDivisions, 0x545454, 0x545454);
  grid.material.transparent = true;
  grid.material.opacity = 0.5;
  grid.add(createGridGuides(gridSize));
  scene.add(grid);

  scene.add(new THREE.AmbientLight(0xffffff, 0.7));
  const keyLight = new THREE.DirectionalLight(0xffffff, 0.8);
  keyLight.position.set(5, 6, 4);
  scene.add(keyLight);

  const importRoot = new THREE.Group();
  importRoot.name = "ImportedObjects";
  scene.add(importRoot);

  const selectionHelper = createSelectionHelper(scene);
  const multiSelectionGroup = createMultiSelectionGroup(scene);

  return { renderer, scene, camera, target, importRoot, selectionHelper, multiSelectionGroup };
}

// Creates grid guides
function createGridGuides(size) {
  const half = size / 2;
  const guides = new THREE.Group();
  guides.name = "GridGuides";
  guides.position.y = 0.01;

  const xMaterial = new THREE.LineBasicMaterial({
    color: 0xe06666,
    transparent: true,
    opacity: 0.8,
  });
  const zMaterial = new THREE.LineBasicMaterial({
    color: 0x6aa9ff,
    transparent: true,
    opacity: 0.8,
  });

  const xGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-half, 0, 0),
    new THREE.Vector3(half, 0, 0),
  ]);
  const zGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, -half),
    new THREE.Vector3(0, 0, half),
  ]);

  const xLine = new THREE.Line(xGeometry, xMaterial);
  xLine.name = "GridGuideX";
  const zLine = new THREE.Line(zGeometry, zMaterial);
  zLine.name = "GridGuideZ";

  guides.add(xLine, zLine);
  return guides;
}

// Create a highlighted box helper for selection
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

// Creates multi selection group
function createMultiSelectionGroup(scene) {
  const group = new THREE.Group();
  group.name = "MultiSelectionOutlines";
  group.renderOrder = 1;
  scene.add(group);
  return group;
}
