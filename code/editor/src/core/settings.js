// App/runtime settings and unit conversions.

// App configuration defaults.
export const config = {
  storageKey: "lastObj",
  dbName: "zencg",
  storeName: "models",
  importGap: 1,
  actionHistoryKey: "zencg_action_history",
  actionHistoryLimit: 24,
};

// Unit conversions.
export const METERS_PER_UNIT = 1;
export const UNITS_PER_METER = 1 / METERS_PER_UNIT;
export const BASE_MESH_HEIGHT_METERS = 1.8;

export function unitsToMeters(value) {
  return value * METERS_PER_UNIT;
}

export function metersToUnits(value) {
  return value * UNITS_PER_METER;
}
