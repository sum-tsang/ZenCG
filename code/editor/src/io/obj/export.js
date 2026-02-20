import { OBJExporter } from "three/addons/exporters/OBJExporter.js";
import { normalizeExportBaseName } from "../../core/config/exportFilename.js";
// Handles resolve export base name
function resolveExportBaseName(object, getFilename) {
  const requestedName =
    typeof getFilename === "function" ? getFilename() : "";
  const fallbackName = normalizeExportBaseName(object?.name || "");
  return normalizeExportBaseName(requestedName, fallbackName);
}
// Handles generate mtl content
function generateMtlContent(object, textures) {
  const materials = new Map();
  let materialIndex = 0;

  object.traverse((child) => {
    if (!child.isMesh || !child.material) return;

    const childMaterials = Array.isArray(child.material)
      ? child.material
      : [child.material];

    childMaterials.forEach((material) => {
      if (materials.has(material.uuid)) return;
      const name = material.name || `material_${materialIndex++}`;
      materials.set(material.uuid, { material, name });
    });
  });

  if (materials.size === 0) {
    return { mtl: null, materialMap: new Map() };
  }

  let mtlContent = "# ZenCG Material Export\n\n";
  const materialMap = new Map();

  materials.forEach(({ material, name }) => {
    materialMap.set(material.uuid, name);
    mtlContent += `newmtl ${name}\n`;
    mtlContent += "Ka 0.2 0.2 0.2\n";

    if (material.color) {
      const color = material.color;
      mtlContent += `Kd ${color.r.toFixed(6)} ${color.g.toFixed(6)} ${color.b.toFixed(6)}\n`;
    } else {
      mtlContent += "Kd 0.8 0.8 0.8\n";
    }

    if (material.specular) {
      const specular = material.specular;
      mtlContent += `Ks ${specular.r.toFixed(6)} ${specular.g.toFixed(6)} ${specular.b.toFixed(6)}\n`;
    } else {
      mtlContent += "Ks 0.0 0.0 0.0\n";
    }

    const roughness = material.roughness ?? 0.5;
    const shininess = Math.max(1, (1 - roughness) * 100);
    mtlContent += `Ns ${shininess.toFixed(6)}\n`;

    const opacity = material.opacity ?? 1.0;
    mtlContent += `d ${opacity.toFixed(6)}\n`;
    mtlContent += "illum 2\n";

    if (material.map && material.map.image) {
      const textureName = `${name}_diffuse.png`;
      textures.push({ name: textureName, texture: material.map });
      mtlContent += `map_Kd ${textureName}\n`;
    }

    mtlContent += "\n";
  });

  return { mtl: mtlContent, materialMap };
}
// Applies export material names
function applyExportMaterialNames(object, materialMap) {
  if (!materialMap.size) return;

  object.traverse((child) => {
    if (!child.isMesh || !child.material) return;
    const material = Array.isArray(child.material) ? child.material[0] : child.material;
    const exportedName = materialMap.get(material.uuid);
    if (exportedName) {
      material.name = exportedName;
    }
  });
}
// Creates obj output
function createObjOutput(exporter, object, mtlFilename, hasMtl) {
  const objContent = exporter.parse(object);
  if (!hasMtl) return objContent;
  return `mtllib ${mtlFilename}\n${objContent}`;
}
// Handles texture to blob
function textureToBlob(texture) {
  return new Promise((resolve) => {
    if (!texture.image) {
      resolve(null);
      return;
    }

    const canvas = document.createElement("canvas");
    const img = texture.image;
    canvas.width = img.width || 256;
    canvas.height = img.height || 256;
    const ctx = canvas.getContext("2d");

    try {
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((blob) => resolve(blob), "image/png");
    } catch (error) {
      console.warn("Could not export texture:", error);
      resolve(null);
    }
  });
}
// Handles trigger blob download
function triggerBlobDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
// Handles download text file
function downloadTextFile(content, filename) {
  const blob = new Blob([content], { type: "text/plain" });
  triggerBlobDownload(blob, filename);
}
async function downloadTextures(textures) {
  for (const { name, texture } of textures) {
    const blob = await textureToBlob(texture);
    if (!blob) continue;
    triggerBlobDownload(blob, name);
  }
}
async function downloadExportFiles({
  objContent,
  mtlContent,
  textures,
  objFilename,
  mtlFilename,
  setStatus,
}) {
  downloadTextFile(objContent, objFilename);

  if (mtlContent) {
    downloadTextFile(mtlContent, mtlFilename);
  }

  if (!textures.length) {
    if (mtlContent) {
      setStatus?.("Exported OBJ + MTL.");
    } else {
      setStatus?.("Exported OBJ.");
    }
    return;
  }

  setStatus?.("Exporting with textures...");
  await downloadTextures(textures);
  setStatus?.(`Exported OBJ + MTL + ${textures.length} texture(s).`);
}
// Sets up obj export
export function setupObjExport({ button, getObject, getFilename, setStatus }) {
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error("OBJ export button not found.");
  }

  const exporter = new OBJExporter();

  button.addEventListener("click", async () => {
    const object = getObject?.();
    if (!object) {
      setStatus?.("No model to export.");
      return;
    }

    const baseName = resolveExportBaseName(object, getFilename);
    const objFilename = `${baseName}.obj`;
    const mtlFilename = `${baseName}.mtl`;

    const textures = [];
    const { mtl, materialMap } = generateMtlContent(object, textures);
    applyExportMaterialNames(object, materialMap);

    const objContent = createObjOutput(exporter, object, mtlFilename, Boolean(mtl));

    await downloadExportFiles({
      objContent,
      mtlContent: mtl,
      textures,
      objFilename,
      mtlFilename,
      setStatus,
    });
  });
}
