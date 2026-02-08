// OBJ export pipeline.
import { OBJExporter } from "three/addons/exporters/OBJExporter.js";

const INVALID_FILENAME_CHARS = /[<>:"/\\|?*\x00-\x1F]/g;

function normalizeExportBaseName(name, fallback = "zencg-export") {
  const raw = typeof name === "string" ? name.trim() : "";
  if (!raw) return fallback;
  const cleaned = raw.replace(INVALID_FILENAME_CHARS, "-").replace(/\s+/g, " ").trim();
  const withoutExtension = cleaned.replace(/\.(obj|mtl|zip)$/i, "");
  return withoutExtension || fallback;
}

// Generate MTL content from an object's materials
function generateMtlContent(object, textures) {
  const materials = new Map();
  let materialIndex = 0;

  // Collect unique materials
  object.traverse((child) => {
    if (child.isMesh && child.material) {
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach((mat) => {
        if (!materials.has(mat.uuid)) {
          const name = mat.name || `material_${materialIndex++}`;
          materials.set(mat.uuid, { material: mat, name });
        }
      });
    }
  });

  if (materials.size === 0) return { mtl: null, materialMap: new Map() };

  let mtlContent = "# ZenCG Material Export\n\n";
  const materialMap = new Map(); // uuid -> name

  materials.forEach(({ material, name }) => {
    materialMap.set(material.uuid, name);
    mtlContent += `newmtl ${name}\n`;

    // Ambient color (Ka)
    mtlContent += "Ka 0.2 0.2 0.2\n";

    // Diffuse color (Kd)
    if (material.color) {
      const c = material.color;
      mtlContent += `Kd ${c.r.toFixed(6)} ${c.g.toFixed(6)} ${c.b.toFixed(6)}\n`;
    } else {
      mtlContent += "Kd 0.8 0.8 0.8\n";
    }

    // Specular color (Ks)
    if (material.specular) {
      const s = material.specular;
      mtlContent += `Ks ${s.r.toFixed(6)} ${s.g.toFixed(6)} ${s.b.toFixed(6)}\n`;
    } else {
      mtlContent += "Ks 0.0 0.0 0.0\n";
    }

    // Shininess/specular exponent (Ns) - derived from roughness
    const roughness = material.roughness ?? 0.5;
    const shininess = Math.max(1, (1 - roughness) * 100);
    mtlContent += `Ns ${shininess.toFixed(6)}\n`;

    // Opacity (d)
    const opacity = material.opacity ?? 1.0;
    mtlContent += `d ${opacity.toFixed(6)}\n`;

    // Illumination model
    mtlContent += "illum 2\n";

    // Texture map (map_Kd)
    if (material.map && material.map.image) {
      const textureName = `${name}_diffuse.png`;
      textures.push({ name: textureName, texture: material.map });
      mtlContent += `map_Kd ${textureName}\n`;
    }

    mtlContent += "\n";
  });

  return { mtl: mtlContent, materialMap };
}

// Update OBJ content to reference materials
function addMaterialReferencesToObj(objContent, object, materialMap, mtlFilename) {
  // Add mtllib reference at the top
  const mtllibName = mtlFilename || "zencg-export.mtl";
  let updatedObj = `mtllib ${mtllibName}\n` + objContent;

  // The OBJExporter already includes usemtl directives if materials have names
  // But we need to ensure material names match our MTL file
  object.traverse((child) => {
    if (child.isMesh && child.material) {
      const mat = Array.isArray(child.material) ? child.material[0] : child.material;
      const mtlName = materialMap.get(mat.uuid);
      if (mtlName && mat.name !== mtlName) {
        // Update material name so OBJExporter uses it
        mat.name = mtlName;
      }
    }
  });

  return updatedObj;
}

// Convert texture to blob
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
    } catch (e) {
      console.warn("Could not export texture:", e);
      resolve(null);
    }
  });
}

// Wire up OBJ export button handling.
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

    const baseName = normalizeExportBaseName(
      typeof getFilename === "function" ? getFilename() : "",
      normalizeExportBaseName(object?.name || "")
    );
    const objFilename = `${baseName}.obj`;
    const mtlFilename = `${baseName}.mtl`;

    const textures = [];
    const { mtl, materialMap } = generateMtlContent(object, textures);

    // Assign material names before export
    object.traverse((child) => {
      if (child.isMesh && child.material) {
        const mat = Array.isArray(child.material) ? child.material[0] : child.material;
        const mtlName = materialMap.get(mat.uuid);
        if (mtlName) {
          mat.name = mtlName;
        }
      }
    });

    let objOutput = exporter.parse(object);

    // Add mtllib reference if we have materials
    if (mtl) {
      objOutput = `mtllib ${mtlFilename}\n` + objOutput;
    }

    // If there are textures, we need to export as a zip
    if (textures.length > 0) {
      setStatus?.("Exporting with textures...");
      await exportAsZip(objOutput, mtl, textures, setStatus, baseName);
    } else if (mtl) {
      // Export both OBJ and MTL files
      downloadFile(objOutput, objFilename, "text/plain");
      downloadFile(mtl, mtlFilename, "text/plain");
      setStatus?.("Exported OBJ + MTL.");
    } else {
      // No materials, just export OBJ
      downloadFile(objOutput, objFilename, "text/plain");
      setStatus?.("Exported OBJ.");
    }
  });
}

// Helper to download a file
function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

// Export OBJ, MTL, and textures as a zip file
async function exportAsZip(objContent, mtlContent, textures, setStatus, baseName) {
  const safeBaseName = normalizeExportBaseName(baseName);
  const objFilename = `${safeBaseName}.obj`;
  const mtlFilename = `${safeBaseName}.mtl`;
  // Simple zip implementation without external library
  // We'll just download files sequentially instead
  
  // Download OBJ
  downloadFile(objContent, objFilename, "text/plain");
  
  // Download MTL
  if (mtlContent) {
    downloadFile(mtlContent, mtlFilename, "text/plain");
  }
  
  // Download textures
  for (const { name, texture } of textures) {
    const blob = await textureToBlob(texture);
    if (blob) {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = name;
      link.click();
      URL.revokeObjectURL(url);
    }
  }
  
  setStatus?.(`Exported OBJ + MTL + ${textures.length} texture(s).`);
}
