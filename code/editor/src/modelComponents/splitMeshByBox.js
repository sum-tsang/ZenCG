// Mesh split utility.
import * as THREE from 'three';

/**
 * Split a mesh into two separate meshes based on a Box3.
 * Triangles whose centroids fall inside the box go to "inside" mesh,
 * the rest go to "outside" mesh.
 * 
 * @param {THREE.Mesh|THREE.Object3D} meshOrGroup - The mesh or group to split
 * @param {THREE.Box3} box3 - The selection box in world space
 * @param {THREE.Object3D} parentForNewMeshes - The parent to add new meshes to (e.g., importRoot)
 * @returns {{ inside: THREE.Mesh|null, outside: THREE.Mesh|null }} The two resulting meshes
 */
export function splitMeshByBox(meshOrGroup, box3, parentForNewMeshes) {
  // If the object is a Group, find the first Mesh inside it
  let mesh = meshOrGroup;
  if (!mesh) {
    console.warn('splitMeshByBox: null object');
    return null;
  }
  
  // If this is not a Mesh, try to find a Mesh child
  if (!mesh.isMesh) {
    console.log('splitMeshByBox: object is not a Mesh, searching for child meshes...');
    let foundMesh = null;
    mesh.traverse((child) => {
      if (!foundMesh && child.isMesh && child.geometry) {
        foundMesh = child;
      }
    });
    if (foundMesh) {
      console.log('splitMeshByBox: found child mesh:', foundMesh.name || '<unnamed>');
      mesh = foundMesh;
    } else {
      console.warn('splitMeshByBox: no mesh found in object hierarchy');
      return null;
    }
  }

  if (!mesh.geometry) {
    console.warn('splitMeshByBox: mesh has no geometry');
    return null;
  }

  const geom = mesh.geometry;
  if (!geom.attributes || !geom.attributes.position) {
    console.warn('splitMeshByBox: mesh has no position attribute');
    return null;
  }

  // Ensure world matrix is current
  mesh.updateMatrixWorld(true);

  const posAttr = geom.getAttribute('position');
  const normAttr = geom.getAttribute('normal');
  const uvAttr = geom.getAttribute('uv');
  const index = geom.index;
  const worldMatrix = mesh.matrixWorld;

  const insidePositions = [];
  const insideNormals = [];
  const insideUVs = [];
  const outsidePositions = [];
  const outsideNormals = [];
  const outsideUVs = [];

  // Helper to push a vertex's data to arrays
  function pushVertex(arrPos, arrNorm, arrUV, vi) {
    arrPos.push(posAttr.getX(vi), posAttr.getY(vi), posAttr.getZ(vi));
    if (normAttr) arrNorm.push(normAttr.getX(vi), normAttr.getY(vi), normAttr.getZ(vi));
    if (uvAttr) arrUV.push(uvAttr.getX(vi), uvAttr.getY(vi));
  }

  const v0 = new THREE.Vector3();
  const v1 = new THREE.Vector3();
  const v2 = new THREE.Vector3();
  const centroid = new THREE.Vector3();

  // Process triangles
  const triCount = index ? index.count / 3 : posAttr.count / 3;
  
  for (let t = 0; t < triCount; t++) {
    let i0, i1, i2;
    
    if (index) {
      i0 = index.getX(t * 3);
      i1 = index.getX(t * 3 + 1);
      i2 = index.getX(t * 3 + 2);
    } else {
      i0 = t * 3;
      i1 = t * 3 + 1;
      i2 = t * 3 + 2;
    }

    // Get vertices in world space
    v0.fromBufferAttribute(posAttr, i0).applyMatrix4(worldMatrix);
    v1.fromBufferAttribute(posAttr, i1).applyMatrix4(worldMatrix);
    v2.fromBufferAttribute(posAttr, i2).applyMatrix4(worldMatrix);

    // Calculate centroid
    centroid.copy(v0).add(v1).add(v2).divideScalar(3);

    // Classify triangle based on centroid
    if (box3.containsPoint(centroid)) {
      pushVertex(insidePositions, insideNormals, insideUVs, i0);
      pushVertex(insidePositions, insideNormals, insideUVs, i1);
      pushVertex(insidePositions, insideNormals, insideUVs, i2);
    } else {
      pushVertex(outsidePositions, outsideNormals, outsideUVs, i0);
      pushVertex(outsidePositions, outsideNormals, outsideUVs, i1);
      pushVertex(outsidePositions, outsideNormals, outsideUVs, i2);
    }
  }

  console.log(`splitMeshByBox: ${mesh.name || 'unnamed'} -> inside: ${insidePositions.length / 3} verts, outside: ${outsidePositions.length / 3} verts`);
  console.log('Box min:', box3.min.toArray(), 'max:', box3.max.toArray());

  // Debug: log a few centroids to see where they fall
  if (triCount > 0) {
    const debugCount = Math.min(5, triCount);
    console.log(`First ${debugCount} triangle centroids (world space):`);
    for (let t = 0; t < debugCount; t++) {
      let i0, i1, i2;
      if (index) {
        i0 = index.getX(t * 3);
        i1 = index.getX(t * 3 + 1);
        i2 = index.getX(t * 3 + 2);
      } else {
        i0 = t * 3;
        i1 = t * 3 + 1;
        i2 = t * 3 + 2;
      }
      const dv0 = new THREE.Vector3().fromBufferAttribute(posAttr, i0).applyMatrix4(worldMatrix);
      const dv1 = new THREE.Vector3().fromBufferAttribute(posAttr, i1).applyMatrix4(worldMatrix);
      const dv2 = new THREE.Vector3().fromBufferAttribute(posAttr, i2).applyMatrix4(worldMatrix);
      const dc = new THREE.Vector3().copy(dv0).add(dv1).add(dv2).divideScalar(3);
      console.log(`  tri ${t}: centroid`, dc.toArray(), 'containsPoint:', box3.containsPoint(dc));
    }
  }

  // Need at least some triangles on each side for a meaningful split
  if (insidePositions.length === 0 || outsidePositions.length === 0) {
    console.warn('splitMeshByBox: all triangles on one side, no split possible');
    return null;
  }

  // Create inside mesh
  const insideGeom = new THREE.BufferGeometry();
  insideGeom.setAttribute('position', new THREE.Float32BufferAttribute(insidePositions, 3));
  if (insideNormals.length) insideGeom.setAttribute('normal', new THREE.Float32BufferAttribute(insideNormals, 3));
  if (insideUVs.length) insideGeom.setAttribute('uv', new THREE.Float32BufferAttribute(insideUVs, 2));
  insideGeom.computeBoundingSphere();

  // Create outside mesh
  const outsideGeom = new THREE.BufferGeometry();
  outsideGeom.setAttribute('position', new THREE.Float32BufferAttribute(outsidePositions, 3));
  if (outsideNormals.length) outsideGeom.setAttribute('normal', new THREE.Float32BufferAttribute(outsideNormals, 3));
  if (outsideUVs.length) outsideGeom.setAttribute('uv', new THREE.Float32BufferAttribute(outsideUVs, 2));
  outsideGeom.computeBoundingSphere();

  // Clone material for each new mesh
  const cloneMaterial = (mat) => {
    if (!mat) return new THREE.MeshStandardMaterial({ color: 0x888888 });
    return mat.clone ? mat.clone() : mat;
  };

  const insideMesh = new THREE.Mesh(insideGeom, cloneMaterial(mesh.material));
  insideMesh.name = (mesh.name || 'mesh') + '_inside';

  const outsideMesh = new THREE.Mesh(outsideGeom, cloneMaterial(mesh.material));
  outsideMesh.name = (mesh.name || 'mesh') + '_outside';

  // Get the original mesh's world transform
  const worldPos = new THREE.Vector3();
  const worldQuat = new THREE.Quaternion();
  const worldScale = new THREE.Vector3();
  mesh.getWorldPosition(worldPos);
  mesh.getWorldQuaternion(worldQuat);
  mesh.getWorldScale(worldScale);

  // Apply transforms to new meshes
  insideMesh.position.copy(worldPos);
  insideMesh.quaternion.copy(worldQuat);
  insideMesh.scale.copy(worldScale);

  outsideMesh.position.copy(worldPos);
  outsideMesh.quaternion.copy(worldQuat);
  outsideMesh.scale.copy(worldScale);

  // Add new meshes to the specified parent
  const targetParent = parentForNewMeshes || mesh.parent;
  if (targetParent) {
    targetParent.add(insideMesh);
    targetParent.add(outsideMesh);
  }

  // Remove and dispose original mesh and its parent group if applicable
  const originalParent = mesh.parent;
  if (originalParent) {
    originalParent.remove(mesh);
  }
  if (mesh.geometry) {
    mesh.geometry.dispose();
  }
  
  // If the original mesh was inside a group (like an imported model),
  // and that group is now empty, remove it too
  if (originalParent && originalParent !== targetParent && originalParent.children.length === 0) {
    if (originalParent.parent) {
      originalParent.parent.remove(originalParent);
    }
  }

  // Update matrices
  insideMesh.updateMatrixWorld(true);
  outsideMesh.updateMatrixWorld(true);

  console.log('splitMeshByBox: created', insideMesh.name, 'and', outsideMesh.name);

  return { inside: insideMesh, outside: outsideMesh };
}
