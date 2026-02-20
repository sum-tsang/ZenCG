// Centralized runtime and feature settings
export const appConfig = {
  storageKey: "lastObj",
  dbName: "zencg",
  storeName: "models",
  importGap: 1,
  actionHistoryKey: "zencg_action_history",
  actionHistoryLimit: 24,
};

export const persistenceSettings = {
  autoSaveDebounceMs: 200,
  deleteUndoLimit: 10,
};

export const unitSettings = {
  metersPerUnit: 1,
  baseMeshHeightMeters: 1.8,
};

export const METERS_PER_UNIT = unitSettings.metersPerUnit;
export const UNITS_PER_METER = 1 / METERS_PER_UNIT;
export const BASE_MESH_HEIGHT_METERS = unitSettings.baseMeshHeightMeters;

// Convert scene units to meters
export function unitsToMeters(value) {
  return value * METERS_PER_UNIT;
}

// Convert meters to scene units
export function metersToUnits(value) {
  return value * UNITS_PER_METER;
}

export const cameraControlSettings = {
  rotateSpeed: 0.005,
  orbitMinPolarAngle: 0.01,
  zoomSpeed: 0.0015,
  arrowKeyMoveSpeed: 0.15,
  minDistance: 0.2,
  maxDistance: 1500,
};

export const cameraAxisButtons = [
  { label: "Y", axis: "y", axisKey: "y", slot: "up", negative: false },
  { label: "-X", axis: "-x", axisKey: "x", slot: "left", negative: true },
  { label: "Z", axis: "z", axisKey: "z", slot: "front", negative: false },
  { label: "X", axis: "x", axisKey: "x", slot: "right", negative: false },
  { label: "-Y", axis: "-y", axisKey: "y", slot: "down", negative: true },
  { label: "-Z", axis: "-z", axisKey: "z", slot: "back", negative: true },
];

export const modelLibrarySettings = {
  manifestPath: "./assets/models/library.json",
  preview: {
    width: 640,
    height: 300,
    fov: 32,
    margin: 1.12,
    minRadius: 0.08,
    targetRadius: 0.95,
    lift: 0.04,
    backgroundColor: 0x232323,
  },
};
