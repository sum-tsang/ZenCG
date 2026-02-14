// Resource disposal helpers.
// Dispose geometry and materials for an object tree.
export function disposeObject(object) {
  object.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    const material = child.material;
    if (Array.isArray(material)) {
      material.forEach((mat) => mat.dispose());
    } else if (material) {
      material.dispose();
    }
  });
}
