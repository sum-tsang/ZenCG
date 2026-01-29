import * as THREE from 'three';

// Split a mesh into inside/outside parts based on a Box3.
// Returns the extracted mesh (inside portion) or null if nothing inside.
export function splitMeshByBox(mesh, box3, scene) {
  const geom = mesh.geometry;
  if (!geom || !geom.attributes || !geom.attributes.position) return null;

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

  function pushVertexTo(arrPos, arrNorm, arrUV, vi) {
    arrPos.push(posAttr.getX(vi), posAttr.getY(vi), posAttr.getZ(vi));
    if (normAttr) arrNorm.push(normAttr.getX(vi), normAttr.getY(vi), normAttr.getZ(vi));
    if (uvAttr) arrUV.push(uvAttr.getX(vi), uvAttr.getY(vi));
  }

  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();

  if (index) {
    for (let fi = 0; fi < index.count; fi += 3) {
      const i0 = index.getX(fi);
      const i1 = index.getX(fi + 1);
      const i2 = index.getX(fi + 2);

      a.fromBufferAttribute(posAttr, i0).applyMatrix4(worldMatrix);
      b.fromBufferAttribute(posAttr, i1).applyMatrix4(worldMatrix);
      c.fromBufferAttribute(posAttr, i2).applyMatrix4(worldMatrix);

      const centroid = new THREE.Vector3().addVectors(a, b).add(c).multiplyScalar(1 / 3);

      if (box3.containsPoint(centroid)) {
        pushVertexTo(insidePositions, insideNormals, insideUVs, i0);
        pushVertexTo(insidePositions, insideNormals, insideUVs, i1);
        pushVertexTo(insidePositions, insideNormals, insideUVs, i2);
      } else {
        pushVertexTo(outsidePositions, outsideNormals, outsideUVs, i0);
        pushVertexTo(outsidePositions, outsideNormals, outsideUVs, i1);
        pushVertexTo(outsidePositions, outsideNormals, outsideUVs, i2);
      }
    }
  } else {
    for (let vi = 0; vi < posAttr.count; vi += 3) {
      a.fromBufferAttribute(posAttr, vi).applyMatrix4(worldMatrix);
      b.fromBufferAttribute(posAttr, vi + 1).applyMatrix4(worldMatrix);
      c.fromBufferAttribute(posAttr, vi + 2).applyMatrix4(worldMatrix);
      const centroid = new THREE.Vector3().addVectors(a, b).add(c).multiplyScalar(1 / 3);
      if (box3.containsPoint(centroid)) {
        pushVertexTo(insidePositions, insideNormals, insideUVs, vi);
        pushVertexTo(insidePositions, insideNormals, insideUVs, vi + 1);
        pushVertexTo(insidePositions, insideNormals, insideUVs, vi + 2);
      } else {
        pushVertexTo(outsidePositions, outsideNormals, outsideUVs, vi);
        pushVertexTo(outsidePositions, outsideNormals, outsideUVs, vi + 1);
        pushVertexTo(outsidePositions, outsideNormals, outsideUVs, vi + 2);
      }
    }
  }

  if (insidePositions.length === 0) return null;

  const geomA = new THREE.BufferGeometry();
  geomA.setAttribute('position', new THREE.Float32BufferAttribute(insidePositions, 3));
  if (insideNormals.length) geomA.setAttribute('normal', new THREE.Float32BufferAttribute(insideNormals, 3));
  if (insideUVs.length) geomA.setAttribute('uv', new THREE.Float32BufferAttribute(insideUVs, 2));

  const geomB = new THREE.BufferGeometry();
  if (outsidePositions.length) {
    geomB.setAttribute('position', new THREE.Float32BufferAttribute(outsidePositions, 3));
    if (outsideNormals.length) geomB.setAttribute('normal', new THREE.Float32BufferAttribute(outsideNormals, 3));
    if (outsideUVs.length) geomB.setAttribute('uv', new THREE.Float32BufferAttribute(outsideUVs, 2));
  }

  const mat = mesh.material && mesh.material.clone ? mesh.material.clone() : mesh.material;
  const meshA = new THREE.Mesh(geomA, mat);
  meshA.name = mesh.name + "-part";

  let meshB = null;
  if (geomB.attributes && geomB.attributes.position) {
    meshB = new THREE.Mesh(geomB, mesh.material && mesh.material.clone ? mesh.material.clone() : mesh.material);
    meshB.name = mesh.name + "-rest";
  }

  // Place both meshes into the scene as independent objects with the original
  // mesh's world transform so they behave as separate editable objects.
  const worldPos = new THREE.Vector3();
  const worldQuat = new THREE.Quaternion();
  const worldScale = new THREE.Vector3();
  mesh.getWorldPosition(worldPos);
  mesh.getWorldQuaternion(worldQuat);
  mesh.getWorldScale(worldScale);

  // Assign world transform directly (they will be children of the scene)
  meshA.position.copy(worldPos);
  meshA.quaternion.copy(worldQuat);
  meshA.scale.copy(worldScale);
  scene.add(meshA);

  if (meshB) {
    meshB.position.copy(worldPos);
    meshB.quaternion.copy(worldQuat);
    meshB.scale.copy(worldScale);
    scene.add(meshB);
  }

  // Remove the original mesh from the scene graph and dispose its geometry
  if (mesh.parent) mesh.parent.remove(mesh);
  if (mesh.geometry) mesh.geometry.dispose();

  meshA.updateMatrixWorld(true);
  if (meshB) meshB.updateMatrixWorld(true);

  return { inside: meshA, outside: meshB };
}
