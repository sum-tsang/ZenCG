# Model Transformation Tool

A complete model transformation system with an interactive 3D gizmo and precise numerical input fields for Translate, Rotate, and Scale operations.

## Features

### 3D Interactive Gizmo
- **Visual Representation**: Color-coded axes (Red=X, Green=Y, Blue=Z)
- **Drag Interactions**: Click and drag axes to perform transformations
- **Real-time Updates**: All transformations update in real-time as you interact
- **Mode Switching**: Easily switch between Translate, Rotate, and Scale modes

### Numerical Input Fields
- **Precise Control**: Enter exact values for each transformation
- **Real-time Binding**: Numerical inputs immediately update the model
- **Live Feedback**: Gizmo updates when you change numerical values
- **Axis-specific Input**: Separate controls for X, Y, and Z axes

### Transformation Modes

#### Translate
- Move objects along X, Y, or Z axes
- Drag along specific axes for constrained movement
- Input values in units

#### Rotate
- Rotate objects around X, Y, or Z axes
- Input values in degrees (0-360)
- Automatic conversion between degrees and radians

#### Scale
- Scale objects uniformly or per-axis
- Input values as multipliers (1.0 = normal size)
- Range: 0.01 to 10.0 per axis

### Reset Functionality
- "Reset to Default" button restores object to original state
- Position: (0, 0, 0)
- Rotation: (0°, 0°, 0°)
- Scale: (1, 1, 1)

## Architecture

### TransformationGizmo (`gizmo.js`)
Core 3D gizmo implementation in Three.js:
- Creates and manages visual arrow indicators
- Handles mouse interactions (mousedown, mousemove, mouseup)
- Performs transformation calculations
- Synchronizes gizmo position with object transforms

**Key Methods:**
- `setObject(object)`: Attach gizmo to a model
- `setMode(mode)`: Switch between translate/rotate/scale
- `onMouseDown/Move/Up()`: Handle mouse interactions
- `setTransform(position, rotation, scale)`: Update from external source

### TransformationPanel (`panel.js`)
UI panel for numerical inputs:
- Creates DOM elements for transformation controls
- Manages input field state
- Converts between radians/degrees as needed
- Updates numerical values from gizmo changes

**Key Methods:**
- `setObject(object)`: Attach panel to a model
- `setGizmo(gizmo)`: Link to gizmo for synchronization
- `updatePanelFromObject()`: Sync UI with current object state
- `updateFromGizmo()`: Update inputs when gizmo is dragged
- `applyTransformation()`: Apply changes to the object

### TransformationManager (`manager.js`)
Orchestrates gizmo and panel interactions:
- Initializes both gizmo and panel
- Manages event listeners
- Synchronizes changes between gizmo and panel
- Provides camera and canvas integration

**Key Methods:**
- `setObject(object)`: Set the object to transform
- `setCamera(camera)`: Set the camera for raycast interactions
- `setMode(mode)`: Change transformation mode

## Usage

### Basic Setup

```javascript
import { TransformationManager } from "./model/transform/manager.js";

// Create manager
const transformationManager = new TransformationManager(
  scene,
  canvas,
  "transformation-panel-container"
);

// Set camera for raycast interactions
transformationManager.setCamera(camera);

// Set object to transform
transformationManager.setObject(myModel);
```

### HTML Structure

```html
<div id="transformation-panel-container"></div>
```

### Changing Modes Programmatically

```javascript
transformationManager.setMode("translate"); // or "rotate" or "scale"
```

## UI Components

The panel is automatically created in the specified container with:

1. **Mode Selector**: Three buttons to switch between Translate, Rotate, and Scale
2. **Position Section**: X, Y, Z input fields for translation
3. **Rotation Section**: X, Y, Z input fields for rotation (in degrees)
4. **Scale Section**: X, Y, Z input fields for scaling (multipliers)
5. **Reset Button**: Restores object to default transformation

## Styling

The panel includes comprehensive CSS styling with:
- Color-coded axis labels (red for X, green for Y, blue for Z)
- Mode-specific button colors
- Hover and focus states
- Responsive input fields
- Visual feedback for active controls

## Real-time Synchronization

The system maintains real-time synchronization through:

1. **Gizmo → Panel**: When dragging axes, the gizmo emits transform events that update numerical inputs
2. **Panel → Gizmo**: When changing numerical inputs, the gizmo position updates immediately
3. **Object Updates**: Changes from either source automatically update the 3D object

## Technical Details

### Coordinate System
- X: Red axis (right)
- Y: Green axis (up)
- Z: Blue axis (toward viewer in typical view)

### Units
- **Position**: Standard 3D space units
- **Rotation**: Degrees (UI), Radians (internal Three.js)
- **Scale**: Multipliers (1.0 = normal size)

### Constraints
- Scale minimum: 0.01 per axis
- Scale maximum: 10.0 per axis
- Rotation: -360 to 360 degrees

## Browser Compatibility

- Modern browsers with WebGL support (Chrome, Firefox, Safari, Edge)
- Requires Three.js 0.160.0 or compatible version

## Performance Considerations

- Uses raycasting for efficient mouse interaction detection
- Updates only occur on actual changes to minimize redraws
- Gizmo visibility can be toggled to reduce scene complexity
- All transformations use efficient vector/quaternion mathematics
