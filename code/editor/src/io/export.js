import { OBJExporter } from "three/addons/exporters/OBJExporter.js";

export function setupObjExport({ button, getObject, setStatus }) {
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error("OBJ export button not found.");
  }

  const exporter = new OBJExporter();

  button.addEventListener("click", () => {
    const object = getObject?.();
    if (!object) {
      setStatus?.("No model to export.");
      return;
    }

    const output = exporter.parse(object);
    const blob = new Blob([output], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "zencg-export.obj";
    link.click();
    URL.revokeObjectURL(url);
    setStatus?.("Exported OBJ.");
  });
}
