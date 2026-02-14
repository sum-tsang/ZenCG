// Model library loader with runtime 3D preview tiles.
import * as THREE from "three";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";

const PREVIEW_WIDTH = 640;
const PREVIEW_HEIGHT = 300;
const PREVIEW_FOV = 32;
const PREVIEW_MARGIN = 1.12;
const PREVIEW_MIN_RADIUS = 0.08;
const PREVIEW_TARGET_RADIUS = 0.95;
const PREVIEW_LIFT = 0.04;
const PREVIEW_BACKGROUND_COLOR = 0x232323;

const yieldToMainThread = () =>
  new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });

function getResourcePath(filePath) {
  if (typeof filePath !== "string") {
    return "";
  }
  const slashIndex = filePath.lastIndexOf("/");
  if (slashIndex < 0) {
    return "";
  }
  return filePath.slice(0, slashIndex + 1);
}

function createPreviewContext() {
  try {
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(PREVIEW_WIDTH, PREVIEW_HEIGHT, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(PREVIEW_BACKGROUND_COLOR, 1);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      PREVIEW_FOV,
      PREVIEW_WIDTH / PREVIEW_HEIGHT,
      0.01,
      100
    );

    const hemisphere = new THREE.HemisphereLight(0xf8fafc, 0x1f2937, 1.0);
    const key = new THREE.DirectionalLight(0xffffff, 1.15);
    key.position.set(2.8, 4.0, 3.8);

    const fill = new THREE.DirectionalLight(0x93c5fd, 0.45);
    fill.position.set(-2.4, 1.8, -1.6);

    const rim = new THREE.DirectionalLight(0xffffff, 0.24);
    rim.position.set(-1.6, 1.2, 2.1);

    scene.add(hemisphere, key, fill, rim);

    return { renderer, scene, camera };
  } catch (error) {
    console.warn("Preview renderer unavailable:", error);
    return null;
  }
}

function buildPreviewMaterials(object) {
  object.traverse((child) => {
    if (!child.isMesh) {
      return;
    }

    const source = Array.isArray(child.material) ? child.material : [child.material];
    const converted = source.map((material) => {
      if (material?.isMeshStandardMaterial) {
        const cloned = material.clone();
        cloned.side = THREE.DoubleSide;
        return cloned;
      }

      const color =
        material?.color instanceof THREE.Color
          ? material.color.clone()
          : new THREE.Color(0xc9d3e3);

      return new THREE.MeshStandardMaterial({
        color,
        roughness: 0.58,
        metalness: 0.04,
        map: material?.map ?? null,
        transparent: Boolean(material?.transparent),
        opacity: material?.opacity ?? 1,
        side: THREE.DoubleSide,
      });
    });

    child.material = Array.isArray(child.material) ? converted : converted[0];
  });
}

function fitObjectToPreviewSpace(object) {
  const initialBounds = new THREE.Box3().setFromObject(object);
  if (initialBounds.isEmpty()) {
    return;
  }

  const center = initialBounds.getCenter(new THREE.Vector3());
  object.position.sub(center);

  const centeredBounds = new THREE.Box3().setFromObject(object);
  const centeredSphere = centeredBounds.getBoundingSphere(new THREE.Sphere());
  const centeredRadius = Math.max(centeredSphere.radius, PREVIEW_MIN_RADIUS);
  const scale = PREVIEW_TARGET_RADIUS / centeredRadius;
  object.scale.setScalar(scale);

  const scaledBounds = new THREE.Box3().setFromObject(object);
  object.position.y -= scaledBounds.min.y;
  object.position.y += PREVIEW_LIFT;
}

function framePreviewCamera(camera, object) {
  const bounds = new THREE.Box3().setFromObject(object);
  if (bounds.isEmpty()) {
    camera.position.set(2.2, 1.6, 2.6);
    camera.lookAt(0, 0.5, 0);
    camera.updateProjectionMatrix();
    return;
  }

  const sphere = bounds.getBoundingSphere(new THREE.Sphere());
  const center = sphere.center;
  const radius = Math.max(sphere.radius, PREVIEW_MIN_RADIUS);

  const verticalFov = THREE.MathUtils.degToRad(camera.fov);
  const horizontalFov =
    2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect);
  const distanceVertical = radius / Math.tan(verticalFov / 2);
  const distanceHorizontal = radius / Math.tan(horizontalFov / 2);
  const distance = Math.max(distanceVertical, distanceHorizontal) * PREVIEW_MARGIN;

  const direction = new THREE.Vector3(1.2, 1.2, 1.4).normalize();
  camera.position.copy(center).addScaledVector(direction, distance);
  camera.near = Math.max(0.01, distance / 120);
  camera.far = Math.max(25, distance * 14);
  camera.lookAt(center.x, center.y + radius * 0.03, center.z);
  camera.updateProjectionMatrix();
}

function disposePreviewObject(object) {
  object.traverse((child) => {
    if (!child.isMesh) {
      return;
    }

    child.geometry?.dispose?.();
    const materials = Array.isArray(child.material)
      ? child.material
      : [child.material];
    materials.forEach((material) => {
      material?.map?.dispose?.();
      material?.dispose?.();
    });
  });
}

function createGalleryTile(entry, onClick) {
  const label = entry.name ?? entry.id;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "library-tile";
  button.setAttribute("role", "listitem");

  const preview = document.createElement("div");
  preview.className = "library-tile-preview";

  const image = document.createElement("img");
  image.className = "library-tile-image";
  image.alt = `${label} model preview`;
  image.loading = "lazy";
  image.decoding = "async";
  image.hidden = true;
  preview.append(image);

  const name = document.createElement("span");
  name.className = "library-tile-name";
  name.textContent = label;

  button.append(preview, name);
  button.addEventListener("click", onClick);

  return { button, image };
}

// Wire up the model library UI and loading flow.
export function setupLibraryImport({ dom, importer, setStatus }) {
  const galleryList = dom.libraryGalleryList;

  if (!(galleryList instanceof HTMLDivElement)) {
    return;
  }

  const canImport = typeof importer?.loadFromText === "function";
  const canLoadMtl = typeof importer?.loadMtlFromText === "function";
  const previewContext = createPreviewContext();
  const state = {
    models: [],
    importingId: "",
    modelTextRequests: new Map(),
    modelMtlRequests: new Map(),
    tilesById: new Map(),
  };

  const renderGalleryMessage = (message) => {
    galleryList.innerHTML = "";
    const empty = document.createElement("p");
    empty.className = "library-gallery-empty";
    empty.textContent = message;
    galleryList.append(empty);
  };

  const setTilePreviewError = (entryId) => {
    const tile = state.tilesById.get(entryId);
    if (!tile) {
      return;
    }
    tile.image.removeAttribute("src");
    tile.image.hidden = true;
  };

  const setTilePreviewImage = (entryId, imageUrl) => {
    const tile = state.tilesById.get(entryId);
    if (!tile) {
      return;
    }
    tile.image.src = imageUrl;
    tile.image.hidden = false;
  };

  const updateTileInteractivity = () => {
    const busy = state.importingId !== "";
    state.tilesById.forEach(({ button }, modelId) => {
      const isActiveImport = busy && modelId === state.importingId;
      button.disabled = !canImport || busy;
      button.classList.toggle("is-importing", isActiveImport);
    });
  };

  const getObjText = async (entry) => {
    let request = state.modelTextRequests.get(entry.id);
    if (!request) {
      request = (async () => {
        const response = await fetch(entry.objPath);
        if (!response.ok) {
          throw new Error(`Model fetch failed: ${response.status}`);
        }
        return response.text();
      })();
      state.modelTextRequests.set(entry.id, request);
    }

    try {
      return await request;
    } catch (error) {
      state.modelTextRequests.delete(entry.id);
      throw error;
    }
  };

  const getMtlText = async (entry) => {
    if (!entry?.mtlPath) {
      return "";
    }

    let request = state.modelMtlRequests.get(entry.id);
    if (!request) {
      request = (async () => {
        const response = await fetch(entry.mtlPath);
        if (!response.ok) {
          throw new Error(`Material fetch failed: ${response.status}`);
        }
        return response.text();
      })();
      state.modelMtlRequests.set(entry.id, request);
    }

    try {
      return await request;
    } catch (error) {
      state.modelMtlRequests.delete(entry.id);
      throw error;
    }
  };

  const getMtlMaterials = async (entry) => {
    if (!entry?.mtlPath || !canLoadMtl) {
      return null;
    }
    try {
      const text = await getMtlText(entry);
      if (!text.trim()) {
        return null;
      }
      return importer.loadMtlFromText(text, {
        stripTextures: false,
        resourcePath: getResourcePath(entry.mtlPath),
      });
    } catch (error) {
      console.warn(`Unable to load materials for ${entry.id}`, error);
      return null;
    }
  };

  const importFromEntry = async (entry) => {
    if (!canImport || state.importingId) {
      return;
    }

    state.importingId = entry.id;
    updateTileInteractivity();

    const label = entry.name ?? entry.id;
    setStatus?.(`Loading ${label}...`);

    try {
      const [text, materials] = await Promise.all([
        getObjText(entry),
        getMtlMaterials(entry),
      ]);
      await yieldToMainThread();
      importer.loadFromText(
        text,
        entry.filename ?? `${entry.id}.obj`,
        materials
      );
    } catch (error) {
      console.error(error);
      setStatus?.(`Unable to load ${label}.`);
    } finally {
      state.importingId = "";
      updateTileInteractivity();
    }
  };

  const renderGalleryTiles = () => {
    galleryList.innerHTML = "";
    state.tilesById.clear();

    state.models.forEach((entry) => {
      const tile = createGalleryTile(entry, () => {
        importFromEntry(entry);
      });
      state.tilesById.set(entry.id, tile);
      galleryList.append(tile.button);
    });

    updateTileInteractivity();
  };

  const renderPreviewImage = async (entry) => {
    if (!previewContext) {
      throw new Error("Preview rendering unavailable.");
    }

    const [text, materials] = await Promise.all([
      getObjText(entry),
      getMtlMaterials(entry),
    ]);
    const loader = new OBJLoader();
    if (materials) {
      loader.setMaterials(materials);
    }
    const object = loader.parse(text);
    buildPreviewMaterials(object);
    fitObjectToPreviewSpace(object);
    framePreviewCamera(previewContext.camera, object);

    previewContext.scene.add(object);
    previewContext.renderer.render(previewContext.scene, previewContext.camera);
    const imageUrl = previewContext.renderer.domElement.toDataURL("image/png");
    previewContext.scene.remove(object);
    disposePreviewObject(object);

    return imageUrl;
  };

  const loadPreviewImages = async () => {
    if (!previewContext) {
      state.models.forEach((entry) => {
        setTilePreviewError(entry.id);
      });
      return;
    }

    for (const entry of state.models) {
      try {
        await yieldToMainThread();
        const imageUrl = await renderPreviewImage(entry);
        setTilePreviewImage(entry.id, imageUrl);
      } catch (error) {
        console.warn(`Unable to build preview for ${entry.id}`, error);
        setTilePreviewError(entry.id);
      }
    }
  };

  const normalizeManifestEntry = (entry) => {
    if (!entry || typeof entry.id !== "string" || typeof entry.objPath !== "string") {
      return null;
    }
    const id = entry.id.trim();
    const objPath = entry.objPath.trim();
    if (!id || !objPath) {
      return null;
    }

    const name = typeof entry.name === "string" && entry.name.trim()
      ? entry.name.trim()
      : id;
    const filename = typeof entry.filename === "string" && entry.filename.trim()
      ? entry.filename.trim()
      : `${id}.obj`;
    const mtlPath = typeof entry.mtlPath === "string" && entry.mtlPath.trim()
      ? entry.mtlPath.trim()
      : "";

    return {
      id,
      name,
      filename,
      objPath,
      ...(mtlPath ? { mtlPath } : {}),
    };
  };

  async function loadLibrary() {
    renderGalleryMessage("Loading models...");

    try {
      const response = await fetch("./assets/models/library.json");
      if (!response.ok) {
        throw new Error(`Library fetch failed: ${response.status}`);
      }

      const data = await response.json();
      const models = Array.isArray(data)
        ? data.map((entry) => normalizeManifestEntry(entry)).filter(Boolean)
        : [];

      state.models = models;

      if (models.length === 0) {
        renderGalleryMessage("No library models.");
        return;
      }

      renderGalleryTiles();
      loadPreviewImages();
    } catch (error) {
      console.error(error);
      renderGalleryMessage("Library unavailable.");
      setStatus?.("Unable to load model library.");
    }
  }

  loadLibrary();
}
