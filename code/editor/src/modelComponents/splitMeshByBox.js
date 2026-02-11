// Mesh split utility.
import * as THREE from "three";
import { disposeObject } from "../scene/dispose.js";

function collectMeshes(root) {
  if (!root) return [];
  if (root.isMesh && root.geometry) return [root];
  const meshes = [];
  root.traverse((child) => {
    if (child.isMesh && child.geometry) {
      meshes.push(child);
    }
  });
  return meshes;
}

function cloneMaterial(material) {
  if (!material) {
    return new THREE.MeshStandardMaterial({ color: 0x888888 });
  }
  if (Array.isArray(material)) {
    return material.map((mat) => (mat?.clone ? mat.clone() : mat));
  }
  return material.clone ? material.clone() : material;
}

function buildMeshFromGeometry(geometry, material, worldPos, worldQuat, worldScale, name) {
  const mesh = new THREE.Mesh(geometry, cloneMaterial(material));
  if (name) mesh.name = name;
  mesh.position.copy(worldPos);
  mesh.quaternion.copy(worldQuat);
  mesh.scale.copy(worldScale);
  return mesh;
}

function splitSingleMesh(mesh, box3) {
  if (!mesh?.geometry) return null;
  const geom = mesh.geometry;
  const posAttr = geom.getAttribute("position");
  if (!posAttr) return null;

  const normAttr = geom.getAttribute("normal");
  const uvAttr = geom.getAttribute("uv");
  const index = geom.index;

  mesh.updateMatrixWorld(true);

  const insidePositions = [];
  const insideNormals = [];
  const insideUVs = [];
  const outsidePositions = [];
  const outsideNormals = [];
  const outsideUVs = [];

  const pushVertex = (arrPos, arrNorm, arrUV, vi) => {
    arrPos.push(posAttr.getX(vi), posAttr.getY(vi), posAttr.getZ(vi));
    if (normAttr) arrNorm.push(normAttr.getX(vi), normAttr.getY(vi), normAttr.getZ(vi));
    if (uvAttr) arrUV.push(uvAttr.getX(vi), uvAttr.getY(vi));
  };

  const v0 = new THREE.Vector3();
  const v1 = new THREE.Vector3();
  const v2 = new THREE.Vector3();
  const centroid = new THREE.Vector3();

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

    v0.fromBufferAttribute(posAttr, i0).applyMatrix4(mesh.matrixWorld);
    v1.fromBufferAttribute(posAttr, i1).applyMatrix4(mesh.matrixWorld);
    v2.fromBufferAttribute(posAttr, i2).applyMatrix4(mesh.matrixWorld);

    centroid.copy(v0).add(v1).add(v2).divideScalar(3);
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

  const insideCount = insidePositions.length;
  const outsideCount = outsidePositions.length;

  const worldPos = new THREE.Vector3();
  const worldQuat = new THREE.Quaternion();
  const worldScale = new THREE.Vector3();
  mesh.getWorldPosition(worldPos);
  mesh.getWorldQuaternion(worldQuat);
  mesh.getWorldScale(worldScale);

  if (!insideCount || !outsideCount) {
    const fullSide = insideCount ? "inside" : "outside";
    return {
      mesh,
      fullSide,
      worldPos,
      worldQuat,
      worldScale,
      material: mesh.material,
      geometry: mesh.geometry,
    };
  }

  return {
    mesh,
    fullSide: null,
    worldPos,
    worldQuat,
    worldScale,
    material: mesh.material,
    insidePositions,
    insideNormals,
    insideUVs,
    outsidePositions,
    outsideNormals,
    outsideUVs,
  };
}

function createGeometryFromParts(positions, normals, uvs) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  if (normals?.length) {
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  }
  if (uvs?.length) {
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  }
  geometry.computeBoundingSphere();
  return geometry;
}

function recenterGroup(group) {
  if (!group || group.children.length === 0) return;
  const box = new THREE.Box3().setFromObject(group);
  if (box.isEmpty()) return;
  const center = box.getCenter(new THREE.Vector3());
  group.children.forEach((child) => {
    child.position.sub(center);
  });
  group.position.copy(center);
}

/**
 * Split a mesh or group into two separate objects based on a Box3.
 * Triangles whose centroids fall inside the box go to "inside"; the rest to "outside".
 * Returns null if the selection box does not split the target into both sides.
 *
 * @param {THREE.Mesh|THREE.Object3D} meshOrGroup - The mesh or group to split
 * @param {THREE.Box3} box3 - The selection box in world space
 * @param {THREE.Object3D} parentForNewMeshes - The parent to add new meshes to (e.g., importRoot)
 * @returns {{ inside: THREE.Object3D|null, outside: THREE.Object3D|null }|null}
 */
export function splitMeshByBox(meshOrGroup, box3, parentForNewMeshes) {
  if (!meshOrGroup) return null;

  const meshes = collectMeshes(meshOrGroup);
  if (!meshes.length) return null;

  const results = meshes
    .map((mesh) => splitSingleMesh(mesh, box3))
    .filter(Boolean);

  if (!results.length) return null;

  let insideCount = 0;
  let outsideCount = 0;
  results.forEach((result) => {
    if (result.fullSide === "inside") insideCount += 1;
    else if (result.fullSide === "outside") outsideCount += 1;
    else {
      insideCount += 1;
      outsideCount += 1;
    }
  });

  if (insideCount === 0 || outsideCount === 0) {
    return null;
  }

  const baseName = meshOrGroup.name || "component";
  const insideGroup = new THREE.Group();
  insideGroup.name = `${baseName}_inside`;
  const outsideGroup = new THREE.Group();
  outsideGroup.name = `${baseName}_outside`;

  results.forEach((result) => {
    const meshName = result.mesh?.name || baseName;
    if (result.fullSide === "inside") {
      const geometry = result.geometry.clone();
      const insideMesh = buildMeshFromGeometry(
        geometry,
        result.material,
        result.worldPos,
        result.worldQuat,
        result.worldScale,
        `${meshName}_inside`
      );
      insideGroup.add(insideMesh);
      return;
    }
    if (result.fullSide === "outside") {
      const geometry = result.geometry.clone();
      const outsideMesh = buildMeshFromGeometry(
        geometry,
        result.material,
        result.worldPos,
        result.worldQuat,
        result.worldScale,
        `${meshName}_outside`
      );
      outsideGroup.add(outsideMesh);
      return;
    }

    const insideGeometry = createGeometryFromParts(
      result.insidePositions,
      result.insideNormals,
      result.insideUVs
    );
    const outsideGeometry = createGeometryFromParts(
      result.outsidePositions,
      result.outsideNormals,
      result.outsideUVs
    );

    const insideMesh = buildMeshFromGeometry(
      insideGeometry,
      result.material,
      result.worldPos,
      result.worldQuat,
      result.worldScale,
      `${meshName}_inside`
    );
    const outsideMesh = buildMeshFromGeometry(
      outsideGeometry,
      result.material,
      result.worldPos,
      result.worldQuat,
      result.worldScale,
      `${meshName}_outside`
    );

    insideGroup.add(insideMesh);
    outsideGroup.add(outsideMesh);
  });

  const targetParent = parentForNewMeshes || meshOrGroup.parent;
  if (!targetParent) return null;

  recenterGroup(insideGroup);
  recenterGroup(outsideGroup);

  targetParent.add(insideGroup);
  targetParent.add(outsideGroup);

  if (meshOrGroup.parent) {
    meshOrGroup.parent.remove(meshOrGroup);
  }
  disposeObject(meshOrGroup);

  insideGroup.updateMatrixWorld(true);
  outsideGroup.updateMatrixWorld(true);

  return { inside: insideGroup, outside: outsideGroup };
}
