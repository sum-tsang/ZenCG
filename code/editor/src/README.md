# Editor Source Map

This folder is organized by responsibility so you can follow features end-to-end.

## Start Here

1. `app.js`: application bootstrap and module wiring
2. `core/`: app-level config and state primitives
3. `scene/`: Three.js scene setup, selection, render loop, object lifecycle
4. `model/transform/`: interactive gizmo + numeric transform tooling
5. `io/` and `persistence/`: import/export and saved state flows

## Directory Roles

- `core/`
  - `index.js`: initial state and store helpers
  - `settings.js`: runtime config and unit conversion helpers
- `ui/`
  - `dom.js`: DOM lookups and guard checks
  - `layout.js`: responsive panel/layout behavior
  - `shortcuts.js`: keyboard shortcuts
  - `status.js`: status line updates
- `camera/`
  - camera creation, framing, orbit/pan/zoom controls
- `scene/`
  - scene/context, selection, list rendering, deletion, transform serialization
- `model/`
  - `operations/`: model combine/split operations
  - `materials/`: material editing and material panel UI
  - `transform/`: gizmo, transform manager, transform panel, undo/history
- `io/`
  - OBJ/MTL import and export pipelines
  - model library loading hooks
- `persistence/`
  - IndexedDB storage, restore flow, and save scheduling

## Practical Navigation Tips

- If a bug starts from user input, trace from `ui/` -> `app.js` -> feature module.
- If a bug is visual, trace from `scene/` and `model/transform/`.
- If a bug is data-loss/state mismatch, trace through `persistence/`, `core/index.js`, and `core/settings.js`.
