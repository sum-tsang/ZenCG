# ZenCG User Manual

## 1. Introduction

This document is a user manual for Zen Computer Graphics (ZenCG), which is a web-based 3D model editor aimed at introducing beginners to 3D model editing. The program is hosted on the web, allowing for frictionless access. This manual intends to support new users in effectively using the application.

ZenCG allows users to import, view, modify, and export object files (.OBJ) and their associated material files (.MTL). The application is accessible on desktop and laptop systems. It is not recommended for use on tablets or mobile devices, as these platforms are unsupported. This document solely describes how to use the application and does not cover the technical implementation or internal architecture of the web application.

---

## 2. Documentation Conventions

This manual uses consistent definitions and formatting to maintain clarity and consistency throughout the document. This allows users to understand instructions and guidance with ease.

The following conventions are used throughout this manual:

1. Numbered headings (`1`, `1.1`, `1.1.1`) are used to organise sections and subsections.
2. User interface labels are written in bold (for example, **Import OBJ**).
3. File extensions are written in monospace (for example, `.OBJ` and `.MTL`).
4. Procedural content is written as numbered, step-by-step instructions.
5. Each procedure ends with an explicit expected outcome.

User interface elements are supported with screenshots taken from the application. Screenshots are provided for reference purposes only and may not reflect future versions of the interface.

---

## 3. Overview of the Product

ZenCG is a web-based 3D model editor designed with beginners in mind. It aims to act as an introductory platform for users who are new to the 3D creation space. The web-based approach allows for immediate use without installation and is designed to be lightweight. The application aims to reduce the resistance between idea and execution.

ZenCG's core functionalities at a high level include importing object files, model transformation, camera controls, material editing, resizing model components, combining models, exporting models, and an undo and redo system. These essential functions contribute to offering a minimal but functional application.

---

## 4. Intended Audience and User Skills

This user manual is intended for beginner to intermediate users who are unfamiliar with 3D model editing or have limited exposure to the field. The application aims to be as accessible as possible for new users. In addition, ZenCG can serve as an effective tool for educators who wish to introduce students to the core functionalities of 3D model editing without relying on software installation on computers.

The application is designed so that users with limited experience working with computers can still intuitively grasp the controls. The graphical user interface is kept simple to reduce cognitive overload, and controls are designed to mirror real-world tool usage where possible.

Users are expected to understand basic navigation and common controls such as translation, rotation, and scaling. Prior experience with 3D modelling, industry workflows, or best practices is not required.

This user manual aims to guide users in navigating and utilising the application as provided. Advanced tasks such as full 3D modelling, scene composition, or complex workflows are not covered. However, basic tutorials, including importing models, modifying existing OBJ files using the available tools, and exporting models, are included in this documentation.

---

## 5. System Requirements

As ZenCG is a web-based application, no installation is required. To access the application, users must have a computer with an active internet connection. A desktop or laptop computer is recommended. Users can access ZenCG by visiting [https://zencg.onrender.com](https://zencg.onrender.com) or by accessing the editor directly at [https://zencg.onrender.com/editor](https://zencg.onrender.com/editor).

The device GPU must support WebGL 2.0 or later. Application performance depends on the capabilities of the device CPU, GPU, and available memory. The minimum hardware requirements for basic functionality are listed below:

- **CPU:** Any modern dual-core processor (e.g., Intel i3 or equivalent)
- **GPU:** Integrated graphics with WebGL support (e.g., Intel HD Graphics, AMD Vega, or older NVIDIA GPUs)
- **RAM:** 4 GB
- **Display:** 1280 × 720 resolution
- **Input Devices:** Mouse and keyboard

For optimal performance, it is recommended to use an up-to-date web browser that supports modern web standards and hardware-accelerated graphics. A mouse and keyboard are strongly recommended for effective interaction with the 3D editor.

Mobile phones and tablet devices are not supported by ZenCG and will not be supported in future versions.

---

## 6. Accessing ZenCG

ZenCG is accessed through a web browser and does not require any form of installation. Users can open the application by navigating to the ZenCG website using a supported desktop or laptop browser.

To access the application, users may visit [https://zencg.onrender.com](https://zencg.onrender.com). Alternatively, users can access the editor directly by navigating to [https://zencg.onrender.com/editor](https://zencg.onrender.com/editor). Once the page has loaded, users can begin importing and working with 3D models immediately.

A stable internet connection is required to load and use the application.

---

## 7. Getting Started

This section provides a brief introduction to using ZenCG for the first time. It outlines the basic steps required to load the editor, import a 3D model, and begin interacting with the scene.

When the ZenCG editor is launched, users are presented directly with the main interface. From here, users have access to the viewport, control panels, and an environmental gizmo, which aids in navigation within the scene.

To begin, users can import an OBJ file into the scene. Models may be imported either from the local file system or directly from the model library integrated into the main control panel. For demonstration purposes, both methods are used within this section.

Users can orbit, pan, and zoom around the scene using the mouse, and adjust their view using the environmental gizmo, as illustrated in the accompanying images.

The purpose of this section is to help users get started by initialising a project. Individual features and tools will be explored in greater detail in later sections.

ZenCG editor initial view
*Figure 7.1 ZenCG editor at launch.*

---

## 8. User Interface Overview

This section covers the ZenCG user interface. By the end of this section, users should understand how to navigate the application and how the available controls map to their respective functions.

### 8.1 Viewport

The viewport is a three-dimensional environment that allows users to view their imported object files and perform modifications on them. Users can navigate the viewport using camera controls. The environmental gizmo indicates the direction the user is facing within the scene. Environmental X, Y, and Z gridlines provide a reference point for orientation within the scene.

The gridlines are colour-coordinated as follows:

- **X-axis:** Red
- **Y-axis:** Green
- **Z-axis:** Blue

ZenCG viewport with grid and gizmo
*Figure 8.1 Viewport, axes, and scene orientation reference.*

### 8.2 Control Panels

ZenCG contains multiple interface panels that provide access to tools, controls, and status information. These panels are designed to be collapsible where applicable, allowing users to maximise available screen space. The glass-morphism design aims to provide a clean visual experience by prioritising visibility of the viewport, which is particularly beneficial on smaller screens.

#### 8.2.1 Main Control Panel

The main control panel contains two tabs: the **Controls** tab and the **Models** tab, which are selected using the corresponding tab buttons.

**Controls Tab**

The Controls tab serves as the primary management area of the application. It allows users to import and export OBJ files and manage objects within the scene. An object list displays all loaded OBJs in the environment. Selecting an object from the list also selects it within the viewport. A **Delete** button beside each object allows users to remove objects directly from the list.

Selected objects can be renamed using the text field located directly beneath the object list.

Main panel Controls tab
*Figure 8.2.1 Main Control Panel - Controls tab.*

**Models Tab**

The Models tab provides access to the built-in model library. This library allows users to browse and insert pre-existing OBJ files directly into the scene without importing files from the local file system. Models selected from the library are added to the viewport and listed alongside other loaded objects.

The model library is intended to support rapid prototyping and experimentation, allowing users to quickly populate a scene with sample geometry.

Main panel Models tab
*Figure 8.2.2 Main Control Panel - Models tab.*

#### 8.2.2 Transform and Camera Control Panel

The transform and camera control panel provides direct access to transformation and camera-related controls used to manipulate objects and adjust the viewing perspective within the scene.

**Transform Tab**

The Transform tab contains controls for moving, rotating, and scaling selected objects. In addition to interactive manipulation, numerical input fields are provided for the X, Y, and Z axes, allowing users to apply precise transformations. Axis-constrained transforms are supported on X, Y, and Z, and movement is possible in both positive and negative directions.

Transform tab with transform controls
*Figure 8.2.3 Transform and Camera Control Panel - Transform tab controls.*

**Camera Tab**

The Camera tab provides buttons mapped to predefined X, Y, and Z viewpoints, as well as their corresponding negative directions. These controls allow users to quickly align the camera to standard orthographic perspectives, supporting accurate inspection and alignment of objects from multiple orientations.

Transform and Camera panel with Camera tab preset views
*Figure 8.2.4 Transform and Camera Control Panel - Camera tab preset views.*

#### 8.2.3 Footer Panel

The footer panel displays contextual information related to the current state of the application. It includes tool context, recent action status, and direct **Undo/Redo** controls. The panel is designed to remain unobtrusive while still providing useful feedback during interaction.

Footer panel status and undo redo area
*Figure 8.2.5 Footer panel and status controls.*

### 8.3 Navigation and Camera Controls

Navigation and camera controls allow users to move around the 3D scene and adjust their view of the loaded models. Users can orbit, pan, and zoom within the viewport using standard mouse interactions. These controls enable users to inspect models from different angles and distances.

The environmental gizmo complements the camera controls by providing a visual reference for scene orientation and directional awareness.

---

## 9. Core Features and Tasks

This section outlines the main functionalities that can be utilised in ZenCG. Detailed instructions are described in later sections. The purpose of this section is to provide a high-level overview of the available features and their behaviours.

### 9.1 OBJ/MTL Import

ZenCG supports OBJ/MTL import from the user's file system. ZenCG also allows OBJ import from the model library.

### 9.2 OBJ/MTL Export

ZenCG supports OBJ/MTL export. Users can export the entire scene or a specific OBJ file, and scene export produces a single OBJ file with its associated MTL data.

### 9.3 Model and Scene Management

#### 9.3.1 Model Selection and Combination

ZenCG allows users to select models for focused editing tasks. Multi-selection is available, allowing users to combine multiple OBJ models into a single OBJ model.

#### 9.3.2 Model and Scene Naming

ZenCG allows users to rename models. Users can also assign a scene name so exported output can reflect the scene context.

#### 9.3.3 Model Transformation and Reset Option

ZenCG provides transformation tools to edit OBJ files through translation, rotation, and scaling. Users can also reset OBJ files to their original form by reverting applied transformations.

#### 9.3.4 Model Deletion and Clear Scene

ZenCG allows users to delete individual OBJ files from the scene. Users may also clear the full scene, removing all objects and scene context.

#### 9.3.5 Model Colour and Materials

ZenCG provides the ability to colourise and texturise OBJ files. Users can apply material changes to selected models, including colour and texture adjustments.

#### 9.3.6 Model Components

ZenCG allows users to split existing OBJ files into smaller components, creating new standalone OBJ files in the scene. This supports editing and managing specific parts independently.

#### 9.3.7 Model Copy, Paste, and Duplication

ZenCG allows users to copy selected models and create duplicates. This supports faster scene population and reuse of existing geometry.

### 9.4 Camera

ZenCG provides mouse and keyboard camera controls for viewport navigation and scene viewing. Users can orbit, pan, and zoom to inspect models from different perspectives.

### 9.5 Camera Preset Views

ZenCG provides preset axis-based viewpoints for rapid camera reorientation. This supports consistent inspection from standard directional views.

### 9.6 Undo and Redo

ZenCG supports undo and redo operations for reversible editing actions. This enables users to step backward or forward through recent modifications.

### 9.7 Action History

ZenCG maintains an action history of recent edits. This allows users to review the sequence of changes made during a session.

### 9.8 Session Persistence and Recovery

ZenCG supports persistence of scene-related data across sessions. This allows previously loaded work to be restored for continued editing.

---

## 10. Detailed Task Procedures

This section walks through the most common workflows in ZenCG. The steps are written for beginner and intermediate users.

### 10.1 Import an OBJ/MTL File from Local Storage

1. Open ZenCG in a supported web browser.
2. In the **Controls** tab, click **Import OBJ**.
3. In the file picker, select your `.OBJ` file.
4. If you have a matching `.MTL` file, select it at the same time.
5. Confirm the import and wait for it to complete.
6. Check that the model appears in both the viewport and the object list.

**Expected Result:** The model is loaded and ready for editing.

### 10.2 Import a Model from the Model Library

1. Open the **Models** tab in the main panel.
2. Browse the model library.
3. Click the model you want to add.
4. Wait for it to load into the scene.
5. Confirm it appears in the viewport and in the object list.

**Expected Result:** A library model is added to the scene.

### 10.3 Select and Rename a Model

1. In the object list, click the model you want to edit.
2. Confirm the same model is highlighted in the viewport.
3. Enter a new value in the **Selected Name** field.
4. Press Enter, or click outside the field, to apply the change.
5. Confirm the updated name in the object list.

**Expected Result:** The model is selected and renamed.

### 10.4 Move, Rotate, and Scale a Model

1. Select a model from the object list.
2. In the **Transform** tab, choose **Move**, **Rotate**, or **Scale**.
3. Adjust the model with the gizmo, or type precise X, Y, and Z values.
4. Repeat until the model is positioned the way you want.
5. Verify the final position, rotation, and scale in the viewport.

**Expected Result:** The model has the new transform values.

### 10.5 Reset a Model to Its Default Transform

1. Select the model to reset.
2. Open the **Transform** tab.
3. Click **Reset to Default**.
4. Confirm that position, rotation, and scale return to default values.

**Expected Result:** The model returns to its default transform state.

### 10.6 Create a Component from an Existing Model

1. Select the model you want to split.
2. In the **Transform** tab, click **Create Component**.
3. Move and resize the selection box around the part you want to extract.
4. Click **Confirm Component**.
5. Check the object list for the new component entries.

**Expected Result:** The model is split into separate components.

### 10.7 Combine Multiple Models

1. Select one model in the object list, then right-click additional models to add them to the multi-selection.
2. In the **Transform** tab, click **Combine Models**.
3. Wait for the operation to complete.
4. Confirm that a single combined model appears in the object list.
5. Select it and confirm the result in the viewport.

**Expected Result:** The selected models are combined into one model entry.

### 10.8 Apply Colour and Texture to a Model

1. Select the model you want to edit.
2. In the material panel, set a colour using the **Base Color** control.
3. To add a texture, click **Upload Image** and choose an image file.
4. Wait for the material update, then check the result in the viewport.
5. If needed, click **Remove** to clear the texture.

**Expected Result:** The model material is updated with new colour and/or texture.

### 10.9 Copy, Paste, and Duplicate Models

1. Select one or more models in the scene.
2. To copy and paste, press `Ctrl/Cmd + C`, then `Ctrl/Cmd + V`.
3. To duplicate directly, press `D`.
4. Confirm copied models appear in the object list.
5. Confirm they are also visible in the viewport.

**Expected Result:** New copies of the selected model(s) are created.

### 10.10 Delete Models or Clear the Scene

1. Select the model you want to remove.
2. Click **Delete Selected** to remove just that model.
3. To remove everything, click **Clear Scene**.
4. Check the object list after the action.
5. Confirm the viewport matches the new scene state.

**Expected Result:** The selected model, or the full scene, is removed based on what you chose.

### 10.11 Navigate the Camera and Use Preset Views

1. Use the mouse in the viewport to orbit, pan, and zoom.
2. Use arrow keys if you want optional keyboard camera movement.
3. Open the **Camera** tab in the **Transform and Camera** control panel.
4. Select a preset view (`X`, `Y`, `Z`, `-X`, `-Y`, or `-Z`).
5. Confirm the camera snaps to the selected direction.

**Expected Result:** You can move the camera and switch to preset views as needed.

### 10.12 Undo and Redo Changes

1. Perform an edit operation in the scene.
2. Click **Undo**, or press `Ctrl/Cmd + Z`, to reverse the latest action.
3. Click **Redo**, or press `Ctrl/Cmd + Shift + Z` or `Ctrl/Cmd + Y`, to apply it again.
4. Repeat as needed to move backward or forward through recent actions.
5. Check that the scene updates after each command.

**Expected Result:** Recent edits can be undone and redone correctly.

### 10.13 Review Recent Action History

1. Open the **Controls** tab.
2. Locate the **History** section.
3. Review the recent actions in order.
4. Compare the list with the current scene state.

**Expected Result:** You can review recent actions and understand what changed.

### 10.14 Export a Selected Model

1. Select the model to export.
2. In **Export Filename**, enter the output name.
3. Make sure **Export Whole Scene** is unchecked.
4. Click **Export OBJ**.
5. Check your downloads for the exported files.

**Expected Result:** The selected model is exported as `.OBJ`, with `.MTL` data when available.

### 10.15 Export the Full Scene

1. Ensure all required models are loaded in the scene.
2. In **Export Filename**, enter a scene export name.
3. Enable **Export Whole Scene**.
4. Click **Export OBJ**.
5. Check your downloads for the exported scene files.

**Expected Result:** The full scene is exported as one `.OBJ`, with `.MTL` data when available.

### 10.16 Restore the Previous Session

1. Load models and make a few edits in ZenCG.
2. Leave the tab open long enough for autosave to run.
3. Refresh the page, or close and reopen the editor.
4. Wait for the restore process to complete.
5. Check that your previous models and edits are restored.

**Expected Result:** Your previous session content is restored for further editing.

### 10.17 Keyboard Shortcuts

1. Click inside the editor so it can receive keyboard input.
2. Use the shortcut for the action you want to perform.
3. Confirm the result in the viewport and object list.

Common shortcuts:

- `T`: Set transform mode to move.
- `R`: Set transform mode to rotate.
- `S`: Set transform mode to scale.
- `X`, `Y`, `Z`: Start axis-locked transform on the selected axis.
- `Enter`: Confirm the active axis-locked transform.
- `Esc`: Cancel the active axis-locked transform.
- `C`: Combine selected models.
- `D`: Duplicate selected model(s).
- `Ctrl/Cmd + C`: Copy selected model(s).
- `Ctrl/Cmd + V`: Paste copied model(s).
- `Ctrl/Cmd + Z`: Undo the most recent action.
- `Ctrl/Cmd + Shift + Z` or `Ctrl/Cmd + Y`: Redo the most recently undone action.
- `Delete` or `Backspace`: Delete the selected model.
- `Shift + Delete`: Clear the scene.

**Expected Result:** You can do common actions faster by using keyboard shortcuts.

---

## 11. Keyboard Shortcuts and Controls Reference

### 11.1 Keyboard Shortcuts

- Move mode: `T`
- Rotate mode: `R`
- Scale mode: `S`
- Axis lock: `X`, `Y`, `Z`
- Undo: `Ctrl/Cmd + Z`
- Redo: `Ctrl/Cmd + Shift + Z` or `Ctrl/Cmd + Y`
- Copy / Paste: `Ctrl/Cmd + C`, `Ctrl/Cmd + V`
- Duplicate: `D`
- Combine models: `C`
- Delete selected: `Delete` or `Backspace`
- Clear scene: `Shift + Delete`

### 11.2 Mouse Controls

- Orbit camera: Left mouse drag
- Pan camera: Middle mouse drag
- Zoom camera: Mouse wheel

---

## 12. OBJ / MTL File Handling

ZenCG model file support is limited to OBJ/MTL. This section explains how import and export work.

### 12.1 Supported File Types

- Model input: `.OBJ` for model geometry.
- Model input: `.MTL` for material data (if available).
- Texture input: `.png`, `.jpg`, `.jpeg` for texture upload.
- Export output: `.OBJ` for exported model or scene geometry.
- Export output: `.MTL` for exported material data (if available).

### 12.2 Import Reference

ZenCG imports local `.OBJ` files and can apply matching `.MTL` files when they are provided. ZenCG also allows model import from the built-in model library.

### 12.3 Export Reference

ZenCG can export either a selected model or the full scene, depending on **Export Whole Scene**. The value in **Export Filename** is used as the base name for exported files.

### 12.4 Export Output Naming and File Behaviour

ZenCG uses **Export Filename** as the base export name. Invalid filename characters are normalised during export, and file extensions entered in the field are removed before output files are generated.

- Geometry only: `.OBJ`
- Geometry with material data: `.OBJ` and `.MTL`
- Geometry with material data and textures: `.OBJ`, `.MTL`, and texture image files

---

## 13. Troubleshooting and Error Recovery

This section lists common issues users may face in ZenCG and practical ways to fix them.

### 13.1 Import Issues

- Model does not appear after import. Possible cause: invalid or unsupported OBJ content. Recommended action: try a different `.OBJ` file and import again.
- Model imports without material. Possible cause: matching `.MTL` file was not included. Recommended action: import `.OBJ` and `.MTL` together.
- Texture is not visible. Possible cause: texture file is missing or unsupported. Recommended action: reapply texture using `.png`, `.jpg`, or `.jpeg`.

### 13.2 Selection and Editing Issues

- Transform tools are not working. Possible cause: no object is selected. Recommended action: select a model from the object list first.
- Rename field is unavailable. Possible cause: no active model selection. Recommended action: select an object and retry rename.
- Combine option cannot be used. Possible cause: not enough models selected. Recommended action: select one model, then right-click at least one additional model in the object list.
- Undo does not change anything. Possible cause: no recent reversible action. Recommended action: perform an edit and use **Undo** again.

### 13.3 Export Issues

- **Export OBJ** is disabled. Possible cause: no valid export target. Recommended action: select a model or enable **Export Whole Scene**.
- Exported files are not found. Possible cause: browser download location is unclear. Recommended action: check browser downloads/history.
- Expected material file is missing. Possible cause: no material data on exported object(s). Recommended action: confirm material was applied before export.

### 13.4 Session Recovery Issues

- Previous session does not restore. Possible cause: browser storage was cleared. Recommended action: re-import files manually.
- Restored scene is incomplete. Possible cause: some previous data was not saved. Recommended action: reopen editor and continue from the latest available state.
- Restore behaviour is inconsistent. Possible cause: browser privacy/storage settings. Recommended action: use default browser storage settings and retry.

---

## 14. Limitations and Operational Notes

This section outlines current product limitations and usage notes for ZenCG.

### 14.1 File and Format Limits

ZenCG currently supports OBJ/MTL-based workflows. Other model formats are outside scope in this version.

### 14.2 Platform and Device Limits

ZenCG is intended for desktop and laptop usage. Tablet and mobile usage is not supported.

### 14.3 Performance Notes

Performance depends on browser, CPU, GPU, available memory, and model complexity. Large scenes or high-detail models may reduce responsiveness.

### 14.4 Feature Scope Notes

ZenCG focuses on editing imported models rather than full end-to-end 3D content creation workflows. Advanced modelling features are outside the scope of this version.

### 14.5 Session Storage Notes

Session recovery depends on browser storage availability. Clearing browser data may remove stored session state.

---

## 15. Glossary

- OBJ: A text-based 3D geometry file format used for model meshes.
- MTL: A companion material file used with OBJ models.
- Viewport: The main 3D viewing area where models are displayed and edited.
- Gizmo: On-screen transform control used for move, rotate, and scale operations.
- Transform: A change in object position, rotation, or scale.
- Axis: A directional reference (`X`, `Y`, `Z`) used for movement and orientation.
- Model Library: Built-in collection of preset models available for quick insertion.
- Export Whole Scene: Option to export all loaded scene objects as one output.
- Action History: List of recent actions performed in the editor.
- Session Recovery: Process of restoring previously saved scene state from browser storage.

