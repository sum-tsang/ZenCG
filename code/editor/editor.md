# Editor File Structure

Entry points:
- `index.html` loads the editor UI shell
- `src/core/app/index.js` boots the app and wires modules together

Main folders:
- `src/core/` app startup, config, and shared state/ui wiring
- `src/camera/` camera creation, controls, framing, and camera panel UI
- `src/scene/` Three.js scene setup, object helpers, and render loop helpers
- `src/model/` transform/material systems (gizmo, manager, panel, history, split/combine)
- `src/io/` import/export flows, OBJ readers/writers, and model library loading
- `src/persistence/` save/load and history persistence
- `src/ui/` DOM refs, UI helpers, shortcuts, and layout wiring
- `assets/models/` built-in OBJ assets and the library manifest

Styling:
- `style.css` editor CSS (top level of `code/editor/`)

`src/core/` subfolders:
- `app/` main app wiring and DOM bindings
- `config/` shared settings and filename helpers

`src/model/` subfolders:
- `combine/` combine selected models
- `gizmo/` transform gizmo visuals and pointer behavior
- `history/` undo/redo and action history
- `manager/` selection and transform orchestration
- `material/` material editing and material panel
- `panel/` transform panel UI construction
- `split/` split mesh logic
- `tools/` top-level transform tool setup

`src/io/` subfolders:
- `library/` model library loading and preview flow
- `obj/` OBJ import/export implementations
- `workflows/` app-level import/export wiring
