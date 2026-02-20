const INVALID_FILENAME_CHARS = /[<>:"/\\|?*\x00-\x1F]/g;

// Normalizes export base name
export function normalizeExportBaseName(name, fallback = "zencg-export") {
  const raw = typeof name === "string" ? name.trim() : "";
  if (!raw) return fallback;

  const cleaned = raw.replace(INVALID_FILENAME_CHARS, "-").replace(/\s+/g, " ").trim();
  const withoutExtension = cleaned.replace(/\.(obj|mtl|zip)$/i, "");
  return withoutExtension || fallback;
}
