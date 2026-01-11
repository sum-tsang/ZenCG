import { createPan } from "./pan.js";
import { createOrbit } from "./orbit.js";
import { createZoom } from "./zoom.js";

export function attachControls({ canvas, camera, target, renderer }) {
  const pan = createPan({ camera, target, renderer });
  const orbit = createOrbit({ camera, target });
  const zoom = createZoom({ camera, target });
  let mode = null;
  let lastPointerX = 0;
  let lastPointerY = 0;

  function onPointerDown(event) {
    if (event.button === 1 || (event.button === 0 && event.shiftKey)) {
      mode = "pan";
    } else if (event.button === 0) {
      mode = "orbit";
    } else {
      mode = null;
    }

    if (mode) {
      lastPointerX = event.clientX;
      lastPointerY = event.clientY;
      canvas.setPointerCapture(event.pointerId);
    }
  }

  function onPointerMove(event) {
    if (!mode) {
      return;
    }

    const deltaX = event.clientX - lastPointerX;
    const deltaY = event.clientY - lastPointerY;
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;

    if (mode === "pan") {
      pan(deltaX, deltaY);
    } else if (mode === "orbit") {
      orbit(deltaX, deltaY);
    }
  }

  function onPointerUp(event) {
    if (mode) {
      mode = null;
      canvas.releasePointerCapture(event.pointerId);
    }
  }

  function onPointerLeave() {
    mode = null;
  }

  function onContextMenu(event) {
    event.preventDefault();
  }

  function onWheel(event) {
    event.preventDefault();
    zoom(event.deltaY);
  }

  canvas.addEventListener("contextmenu", onContextMenu);
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointerleave", onPointerLeave);
  canvas.addEventListener("wheel", onWheel, { passive: false });

  return () => {
    canvas.removeEventListener("contextmenu", onContextMenu);
    canvas.removeEventListener("pointerdown", onPointerDown);
    canvas.removeEventListener("pointermove", onPointerMove);
    canvas.removeEventListener("pointerup", onPointerUp);
    canvas.removeEventListener("pointerleave", onPointerLeave);
    canvas.removeEventListener("wheel", onWheel);
  };
}
