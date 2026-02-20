import * as THREE from "three";
// Handles generate box projection uvs
export function generateBoxProjectionUVs(mesh) {
  const geometry = mesh.geometry;
  if (!geometry) return;

  const existingUV = geometry.attributes.uv;
  if (existingUV && existingUV.count > 0) {
    let hasValidUVs = false;
    for (let i = 0; i < Math.min(existingUV.count, 10); i += 1) {
      const u = existingUV.getX(i);
      const v = existingUV.getY(i);
      if (!isNaN(u) && !isNaN(v) && (u !== 0 || v !== 0)) {
        hasValidUVs = true;
        break;
      }
    }
    if (hasValidUVs) return;
  }

  geometry.computeBoundingBox();
  const bbox = geometry.boundingBox;
  const size = new THREE.Vector3();
  bbox.getSize(size);
  if (size.x === 0) size.x = 1;
  if (size.y === 0) size.y = 1;
  if (size.z === 0) size.z = 1;

  const position = geometry.attributes.position;
  const normal = geometry.attributes.normal;
  const uvArray = new Float32Array(position.count * 2);
  const tempPos = new THREE.Vector3();
  const tempNormal = new THREE.Vector3();

  for (let i = 0; i < position.count; i += 1) {
    tempPos.fromBufferAttribute(position, i);
    if (normal) {
      tempNormal.fromBufferAttribute(normal, i);
    } else {
      tempNormal.copy(tempPos).normalize();
    }

    const absX = Math.abs(tempNormal.x);
    const absY = Math.abs(tempNormal.y);
    const absZ = Math.abs(tempNormal.z);
    let u;
    let v;

    if (absX >= absY && absX >= absZ) {
      u = (tempPos.z - bbox.min.z) / size.z;
      v = (tempPos.y - bbox.min.y) / size.y;
    } else if (absY >= absX && absY >= absZ) {
      u = (tempPos.x - bbox.min.x) / size.x;
      v = (tempPos.z - bbox.min.z) / size.z;
    } else {
      u = (tempPos.x - bbox.min.x) / size.x;
      v = (tempPos.y - bbox.min.y) / size.y;
    }

    uvArray[i * 2] = u;
    uvArray[i * 2 + 1] = v;
  }

  geometry.setAttribute("uv", new THREE.BufferAttribute(uvArray, 2));
  geometry.attributes.uv.needsUpdate = true;
}
// Handles collect materials
export function collectMaterials(object) {
  const materials = new Set();
  object.traverse((child) => {
    if (!child.isMesh || !child.material) return;
    if (Array.isArray(child.material)) {
      child.material.forEach((mat) => materials.add(mat));
    } else {
      materials.add(child.material);
    }
  });
  return Array.from(materials);
}
// Handles for each mesh material
export function forEachMeshMaterial(
  object,
  {
    ensureUniqueMaterial,
    ensureUvProjection = false,
    onMaterial,
  } = {}
) {
  if (!object) return;

  object.traverse((child) => {
    if (!child.isMesh || !child.material) return;
    if (ensureUvProjection) {
      generateBoxProjectionUVs(child);
    }

    if (typeof ensureUniqueMaterial === "function") {
      if (Array.isArray(child.material)) {
        child.material = child.material.map((mat) => ensureUniqueMaterial(mat));
      } else {
        child.material = ensureUniqueMaterial(child.material);
      }
    }

    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material, index) => {
      // Sets material
      const setMaterial = (nextMaterial) => {
        if (Array.isArray(child.material)) {
          child.material[index] = nextMaterial;
        } else {
          child.material = nextMaterial;
        }
      };
      onMaterial?.({ child, material, index, setMaterial });
    });
  });
}
