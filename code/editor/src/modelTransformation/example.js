/**
 * Example usage of the TransformationManager
 * This demonstrates how to use the transformation tool in your application
 */

import * as THREE from "three";
import { TransformationManager } from "./manager.js";

// Example setup (you would have a scene, camera, and canvas already)
export function setupTransformationExample(scene, camera, canvas) {
  // Create a test object to transform
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshStandardMaterial({ color: 0x0088ff });
  const testObject = new THREE.Mesh(geometry, material);
  scene.add(testObject);

  // Initialize the transformation manager
  const transformationManager = new TransformationManager(
    scene,
    canvas,
    "transformation-panel-container"
  );

  // Set the camera for raycast interactions
  transformationManager.setCamera(camera);

  // Set the object to be transformed
  transformationManager.setObject(testObject);

  // You can listen to transformation changes
  transformationManager.panel.onTransform((transform) => {
    console.log("Transform changed:", {
      position: transform.position,
      rotation: transform.rotation,
      scale: transform.scale,
    });
  });

  // You can programmatically change the mode
  // transformationManager.setMode("translate");
  // transformationManager.setMode("rotate");
  // transformationManager.setMode("scale");

  return transformationManager;
}

/**
 * Advanced usage with multiple objects
 */
export function setupMultipleObjects(scene, camera, canvas) {
  const objects = [];

  // Create multiple objects
  const geometries = [
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.SphereGeometry(0.5, 32, 32),
    new THREE.ConeGeometry(0.5, 1, 32),
  ];

  geometries.forEach((geometry, index) => {
    const material = new THREE.MeshStandardMaterial({
      color: Math.random() * 0xffffff,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.x = index * 2 - 2;
    scene.add(mesh);
    objects.push(mesh);
  });

  // Initialize transformation manager
  const transformationManager = new TransformationManager(
    scene,
    canvas,
    "transformation-panel-container"
  );
  transformationManager.setCamera(camera);

  // Set initial object
  let currentIndex = 0;
  transformationManager.setObject(objects[currentIndex]);

  // Example: Switch selected object with keyboard
  document.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") {
      currentIndex = (currentIndex - 1 + objects.length) % objects.length;
      transformationManager.setObject(objects[currentIndex]);
    } else if (event.key === "ArrowRight") {
      currentIndex = (currentIndex + 1) % objects.length;
      transformationManager.setObject(objects[currentIndex]);
    }
  });

  return transformationManager;
}

/**
 * Programmatic transformation example
 */
export function setProgrammaticTransform(transformationManager) {
  // You can set transforms programmatically
  const position = new THREE.Vector3(5, 2, 0);
  const rotation = new THREE.Euler(
    Math.PI / 4,
    Math.PI / 6,
    0
  ); // 45°, 30°, 0°
  const scale = new THREE.Vector3(1.5, 1.5, 1.5);

  transformationManager.gizmo.setTransform(position, rotation, scale);
  transformationManager.panel.updatePanelFromObject();
}

/**
 * Export transformed object
 */
export function exportTransformedObject(object) {
  const data = {
    position: object.position.toArray(),
    rotation: object.rotation.toArray(),
    scale: object.scale.toArray(),
    quaternion: object.quaternion.toArray(),
  };

  console.log("Transformed object data:", data);
  return data;
}
