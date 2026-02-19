# Overview

ZenCG is a web-based 3D modelling application that runs on your browser. It lets you import, edit and export 3D models of your choice. You can upload OBJ files and make adjustments to them from your browser. ZenCG is designed to be lightweight so it can run on many systems no matter what hardware they contain. This website focuses on quick editing and small tweaks rather than creating a whole new OBJ model from scratch with very basic tools that anyone can use no matter what 3D modelling skills they have. After editing, you can export your modified OBJ to your computer storage.

# Definitions

- OBJ: Standard 3D model file  
- Viewport: 3D rendering area  
- Mesh: Collection of faces and vertices of a 3D object  
- Transformation: Translation, rotation or scaling of a 3D object  

# Background

ZenCG came to mind for us as a very easy and convenient way to make quick edits to 3D models without too much of a learning curve,

# System Overview

ZenCG is a web application that loads and renders OBJ files. It allows for transformations of the 3D models loaded and for them to exported onto your storage

# Overall Description

## Product Perspective

ZenCG is a standalone web application hosted online.  
No installation required  
No user authentication is required.  
The app runs entirely in the browser.

## System Interfaces

### User Interfaces:
- 3D viewport  
- Toolbar  
- Navigation controls  

### Hardware Interfaces:
- Mouse  
- Keyboard  
- Monitor  

### Software Interfaces:
- Web browser  
- WebGL  
- Three.js  

### Communication Interfaces:
- HTTPS  

### Memory Constraints:
Recommended for models under 50MB due to browser limitations

### Design Constraints:
- Must run in a browser  
- Must support OBJ, MTL and image files  
- Must run without installation  

### Operations:
- User uploads model  
- User edits model  
- User exports model  

### Site Adaptation Requirements:
Internet connection required

# Product Functions

- Upload OBJ files  
- Render OBJ models  
- Allow model transformation  
- Allow for MTL files to be mapped to OBJ files  
- Allow for textures to be uploaded  
- Allow camera controls  
- Export edited model as OBJ (with its companion MTL/texture files if any)  

# User Characteristics

## Target Users:
- Beginner 3D model editors  
- People who need to edit 3D models but don’t know how (e.g interior designers)  

## User Skill Level:
- No 3D modelling experience required  
- Basic computer skills required  

# Constraints, Assumptions and Dependencies

## Constraints:
- Browser memory limitations  

## Assumptions:
- User provides OBJ file  
- User has internet  

## Dependencies:
- Web browser compatibility  
- Three.js  

# Requirements

## External Interface Requirements:
- Interactive 3D canvas  

## Performance Requirements:
- Models load within 5 seconds  
- Real-time transformations without too much lag  
- UI response time less than 1 second  

## Logical Database Requirements:
- Database of example OBJ models in program  

## Software System Attributes:

### Reliability:
System should not crash

### Availability:
24/7

### Security:
- No server side file storage  
- No user authentication  
- Secure HTTPS connection  

### Maintainability:
Javascript architecture

### Portability:
Compatible with every operating system

# Functional Requirements

- REQ-1: The system allows users to import OBJ files.  
- REQ-2: The system parses all geometry from the OBJ file.  
- REQ-3: The system detects and loads MTL files when referenced by the OBJ file.  
- REQ-4: The system displays the model in a 3D viewport.  
- REQ-5: The system displays a warning message if a referenced MTL file is not found.  
- REQ-6: The system displays an error message if the OBJ file is corrupted/unreadable.  
- REQ-7: The system displays an error message if the file is not of OBJ format.  
- REQ-8: The system shall prompt the user to manually select any texture images (PNG or JPG) referenced in the loaded MTL file.  
- REQ-9: The system allows users to translate the model along the axes.  
- REQ-10: The system allows users to rotate the models on all axes.  
- REQ-11: The system allows users to scale models uniformly/non-uniformly.  
- REQ-12: The system updates the model in the 3D viewport in real time.  
- REQ-13: The system provides transformation controls.  
- REQ-14: The system allows input of numeric transform values.  
- REQ-15: The system shall allow the model to snap to the grid.  
- REQ-16: The system allows users to orbit a model around a focal point.  
- REQ-17: The system allows users to zoom in and out.  
- REQ-18: The system allows users to pan the camera.  
- REQ-19: The system shall have a reset camera function.  
- REQ-20: The system shall update camera movement smoothly.  
- REQ-21: The system displays material settings when a model is selected.  
- REQ-22: The system allows users to change a model's base colour.  
- REQ-23: The system allows users to assign textures.  
- REQ-24: The system shall render changes of material in real time.  
- REQ-25: The system shall show a warning if a texture fails to load.  
- REQ-26: The system shall retain model proportions while mapping textures/colours.  
- REQ-27: The system allows users to scale objects or groups of an OBJ file.  
- REQ-28: The system visually indicates selected parts of the model.  
- REQ-29: The system supports numeric input for dimensions.  
- REQ-30: The system shall maintain mesh integrity during resizing.  
- REQ-31: The system supports multiple OBJ files in the same scene.  
- REQ-32: The system allows users to save the multiple model scene as one OBJ file.  
- REQ-33: The system shall maintain the geometry and materials of each model when combining.  
- REQ-34: The system exports the model as an OBJ file.  
- REQ-35: The system shall notify the user when the exporting is complete.  
- REQ-36: The system shall maintain the geometry and materials of each model when exporting.  
- REQ-37: The system shall support Undo for any edit made.  
- REQ-38: The system shall support Redo for any undone action.  
- REQ-39: The system shall maintain an internal action history stack.

# Environment Characteristics

## Hardware
- Computer  
- GPU supporting WebGL  

## Peripherals
- Mouse  
- Keyboard  

## Users
- Single user environment  

## Other
- Stable internet  
- Modern browser  