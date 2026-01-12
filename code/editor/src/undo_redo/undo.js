const DEFAULT_LIMIT = 16;

export function createTransformSnapshot(object) {
  if (!object) return null;
  return {
    object,
    position: object.position.clone(),
    quaternion: object.quaternion.clone(),
    scale: object.scale.clone(),
  };
}

export function applyTransformSnapshot(snapshot) {
  if (!snapshot?.object) return false;
  snapshot.object.position.copy(snapshot.position);
  snapshot.object.quaternion.copy(snapshot.quaternion);
  snapshot.object.scale.copy(snapshot.scale);
  return true;
}

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
    if (!snapshot) return;

    if (this.index < this.stack.length - 1) {
      this.stack = this.stack.slice(0, this.index + 1);
    }

    this.stack.push(snapshot);

    if (this.stack.length > this.limit) {
      this.stack.shift();
    }

    this.index = this.stack.length - 1;
  }

  undo() {
    if (this.index <= 0) return null;
    this.index -= 1;
    return this.stack[this.index];
  }
}
