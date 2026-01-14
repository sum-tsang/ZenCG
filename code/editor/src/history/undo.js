// Config
const DEFAULT_LIMIT = 16;
const DEFAULT_EPSILON = 1e-6;

// Float compare
function nearlyEqual(a, b, epsilon = DEFAULT_EPSILON) {
  return Math.abs(a - b) <= epsilon;
}

// Vector compare
function vectorEqual(a, b, epsilon = DEFAULT_EPSILON) {
  return (
    nearlyEqual(a.x, b.x, epsilon) &&
    nearlyEqual(a.y, b.y, epsilon) &&
    nearlyEqual(a.z, b.z, epsilon)
  );
}

// Quaternion compare
function quaternionEqual(a, b, epsilon = DEFAULT_EPSILON) {
  return (
    nearlyEqual(a.x, b.x, epsilon) &&
    nearlyEqual(a.y, b.y, epsilon) &&
    nearlyEqual(a.z, b.z, epsilon) &&
    nearlyEqual(a.w, b.w, epsilon)
  );
}

// Snapshot compare
function snapshotEqual(a, b, epsilon = DEFAULT_EPSILON) {
  if (!a || !b) return false;
  if (a.object !== b.object) return false;
  return (
    vectorEqual(a.position, b.position, epsilon) &&
    quaternionEqual(a.quaternion, b.quaternion, epsilon) &&
    vectorEqual(a.scale, b.scale, epsilon)
  );
}

// Snapshot capture
export function createTransformSnapshot(object) {
  if (!object) return null;
  return {
    object,
    position: object.position.clone(),
    quaternion: object.quaternion.clone(),
    scale: object.scale.clone(),
  };
}

// Snapshot apply
export function applyTransformSnapshot(snapshot) {
  if (!snapshot?.object) return false;
  snapshot.object.position.copy(snapshot.position);
  snapshot.object.quaternion.copy(snapshot.quaternion);
  snapshot.object.scale.copy(snapshot.scale);
  return true;
}

// History stack
export class UndoHistory {
  constructor({ limit = DEFAULT_LIMIT } = {}) {
    this.limit = limit;
    this.stack = [];
    this.index = -1;
  }

  clear() {
    this.stack = [];
    this.index = -1;
  }

  record(snapshot) {
    if (!snapshot) return false;

    const current = this.stack[this.index];
    if (snapshotEqual(current, snapshot)) {
      return false;
    }

    if (this.index < this.stack.length - 1) {
      this.stack = this.stack.slice(0, this.index + 1);
    }

    this.stack.push(snapshot);

    if (this.stack.length > this.limit) {
      this.stack.shift();
      this.index -= 1;
    }

    this.index = this.stack.length - 1;
    return true;
  }

  undo() {
    if (this.index <= 0) return null;
    this.index -= 1;
    return this.stack[this.index];
  }
}
