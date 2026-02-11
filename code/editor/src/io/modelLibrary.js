// Model library loader.
// Wire up the model library UI and loading flow.
export function setupLibraryImport({ dom, importer, setStatus }) {
  const select = dom.librarySelect;
  const button = dom.libraryImportButton;
  if (!(select instanceof HTMLSelectElement)) {
    return;
  }
  if (!(button instanceof HTMLButtonElement)) {
    return;
  }

  const libraryState = { models: [] };
  const yieldToMainThread = () =>
    new Promise((resolve) => {
      requestAnimationFrame(() => resolve());
    });

  // Render a single-message placeholder in the select.
  const setSelectMessage = (message) => {
    select.innerHTML = "";
    const option = document.createElement("option");
    option.value = "";
    option.textContent = message;
    select.append(option);
  };

  // Render model options into the select element.
  const renderOptions = () => {
    select.innerHTML = "";
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Select a model...";
    select.append(placeholder);

    libraryState.models.forEach((entry) => {
      const option = document.createElement("option");
      option.value = entry.id;
      option.textContent = entry.name ?? entry.id;
      select.append(option);
    });
  };

  // Fetch and load the library manifest.
  async function loadLibrary() {
    select.disabled = true;
    button.disabled = true;
    setSelectMessage("Loading library...");

    try {
      const response = await fetch("./assets/models/library.json");
      if (!response.ok) {
        throw new Error(`Library fetch failed: ${response.status}`);
      }
      const data = await response.json();
      const models = Array.isArray(data)
        ? data.filter(
            (entry) =>
              entry &&
              typeof entry.id === "string" &&
              typeof entry.objPath === "string"
          )
        : [];

      libraryState.models = models;

      if (models.length === 0) {
        setSelectMessage("No library models.");
        return;
      }

      renderOptions();
      select.disabled = false;
    } catch (error) {
      console.error(error);
      setSelectMessage("Library unavailable.");
      setStatus("Unable to load model library.");
    }
  }

  // Fetch and import the currently selected model.
  async function importSelectedModel() {
    const selectedId = select.value;
    const entry = libraryState.models.find((model) => model.id === selectedId);
    if (!entry || !importer?.loadFromText) {
      return;
    }

    button.disabled = true;
    select.disabled = true;
    const label = entry.name ?? entry.id;
    setStatus(`Loading ${label}...`);

    try {
      const response = await fetch(entry.objPath);
      if (!response.ok) {
        throw new Error(`Model fetch failed: ${response.status}`);
      }
      const text = await response.text();
      const filename =
        typeof entry.filename === "string" && entry.filename
          ? entry.filename
          : `${label}.obj`;
      await yieldToMainThread();
      importer.loadFromText(text, filename);
    } catch (error) {
      console.error(error);
      setStatus(`Unable to load ${label}.`);
    } finally {
      select.disabled = false;
      button.disabled = select.value === "";
    }
  }

  select.addEventListener("change", () => {
    button.disabled = select.value === "";
  });

  button.addEventListener("click", () => {
    importSelectedModel();
  });

  loadLibrary();
}
