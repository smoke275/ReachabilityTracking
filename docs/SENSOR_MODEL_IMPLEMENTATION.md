# Sensor Model Implementation

This document describes the sensor model implementation for pursuer and evader agents, including range detection, field of view (FOV), and line-of-sight (LOS) checking.

## Overview

The sensor model follows the surveillance and collision-free tracking formulation with:

1. **Upper range (R_max)**: Maximum detection distance
2. **Lower range (R_min)**: Blind spot / collision zone
3. **Field of View (FOV)**: Angular coverage (α degrees, 360° for omni-directional)
4. **Line-of-Sight (LOS)**: Ray-casting for obstacle occlusion

## Mathematical Model

### Sensor Parameters

For an agent with pose `x_p = (x_p, y_p, θ_p)` and sensor orientation `φ`:

- **R_max**: Upper range (pixels)
- **R_min**: Lower range / blind spot (pixels)
- **FOV**: Field of view angle α (degrees)
- **φ**: Sensor orientation offset from heading (radians)

### Detection Conditions

For a target at position `x_e = (x_e, y_e)`:

#### 1. Distance Check

```
d = ||x_e - x_p|| = sqrt((x_e - x_p)² + (y_e - y_p)²)
```

**Conditions:**
- In outer range: `R_min < d ≤ R_max`
- Inside blind spot: `d ≤ R_min` (NOT detected)
- Beyond range: `d > R_max` (NOT detected)

#### 2. Angular Check (FOV)

If FOV < 360°:

```
ψ = atan2(y_e - y_p, x_e - x_p)  // Angle to target
sensor_axis = θ_p + φ             // Sensor orientation
angle_diff = wrap(ψ - sensor_axis) // Wrapped to [-π, π]
```

**Condition:**
```
|angle_diff| ≤ α/2  (where α is in radians)
```

#### 3. Line-of-Sight Check

The line segment from pursuer to evader must not intersect any obstacle edges.

```javascript
function checkLineOfSight(p1, p2, obstacles) {
    for each obstacle in obstacles:
        for each edge (v1, v2) in obstacle:
            if segmentsIntersect(p1, p2, v1, v2):
                return false
    return true
}
```

## Service API

### SensorModelService

```javascript
import { SensorModelService } from './services/SensorModelService.js';

const sensorService = new SensorModelService();
```

#### Methods

**`canSee(pursuerState, evaderState, sensorParams, obstacles)`**

Main detection function.

- **Parameters:**
  - `pursuerState`: `{position: {x, y}, heading: angle}`
  - `evaderState`: `{position: {x, y}}`
  - `sensorParams`: `{R_min, R_max, fov, orientation}`
  - `obstacles`: Array of polygon obstacles
- **Returns:** `boolean` - True if target is visible

**`computeVisibility(pursuerState, evaderState)`**

Computes mutual visibility between pursuer and evader.

- **Returns:** 
```javascript
{
    pursuerSeesEvader: boolean,
    evaderSeesPursuer: boolean,
    pursuerLOS: {from: {x, y}, to: {x, y}} | null,
    evaderLOS: {from: {x, y}, to: {x, y}} | null,
    distance: number
}
```

**`setObstacles(obstacles)`**

Set obstacles for LOS checking.

**`getSensorParams(agentType)`**

Get sensor parameters for 'pursuer' or 'evader'.

**`drawSensorRange(ctx, agentState, sensorParams, color)`**

Draw sensor visualization on canvas.

## UI Controls

### Agent Window Integration

The sensor controls are integrated into the `AgentsWindow` component with sliders for:

1. **R_max**: Maximum detection range (50-300 pixels)
2. **R_min**: Blind spot radius (0-100 pixels)
3. **FOV**: Field of view (30-360 degrees)

### Event Bus

**Events Emitted:**
- `sensor:updatePursuerParams` - Update pursuer sensor parameters
- `sensor:updateEvaderParams` - Update evader sensor parameters
- `sensor:toggleVisualization` - Toggle visualization elements
- `sensor:paramsUpdated` - Notification of parameter change

**Events Listened:**
- `intruder:positionUpdate` - Recompute visibility
- `evader:positionUpdate` - Recompute visibility

## Visualization

The sensor model is visualized on the canvas with:

### 1. Range Circles
- **R_max**: Dashed circle showing maximum range
- **R_min**: Filled circle showing blind spot

### 2. FOV Cone
- Arc at R_max showing angular coverage
- Boundary lines from agent to arc endpoints
- Semi-transparent fill

### 3. Line-of-Sight Indicators
- **Detected**: Solid/dashed line (green for pursuer, orange for evader)
- **Not detected**: Faint dashed line

### 4. Detection Status Box
- Top-right corner display
- Shows detection status for both agents
- Distance between agents

## Default Parameters

### Pursuer (Intruder)
```javascript
{
    enabled: true,
    R_min: 20,    // 20px blind spot
    R_max: 150,   // 150px max range
    fov: 360,     // Omni-directional
    orientation: 0
}
```

### Evader
```javascript
{
    enabled: true,
    R_min: 15,    // 15px blind spot
    R_max: 120,   // 120px max range
    fov: 270,     // Limited FOV
    orientation: 0
}
```

## Usage Example

```javascript
// In app.js
this.sensorModelService = new SensorModelService();
this.sensorModelService.setObstacles(polygons);
this.canvasController.setSensorModelService(this.sensorModelService);

// Update sensor parameters
eventBus.emit('sensor:updatePursuerParams', {
    R_max: 200,
    fov: 180
});

// Check visibility
const result = this.sensorModelService.computeVisibility(
    pursuerState,
    evaderState
);

if (result.pursuerSeesEvader) {
    console.log('Pursuer detected evader!');
}
```

## Integration with RRT Tracking

The sensor model is designed to be used **before** RRT tracking:

1. **Setup Phase**: Place agents and configure sensors
2. **Sensor Verification**: Visualize and verify sensor ranges/FOV
3. **RRT Tracking**: Use validated sensor model in pursuit algorithm

This allows for proper testing and validation of sensor parameters before running expensive RRT computations.

## Performance Considerations

- Line-of-sight checking is O(n×m) where n = obstacles, m = edges per obstacle
- Optimizations:
  - Early exit on first intersection found
  - Bounding box pre-checks (future enhancement)
  - Spatial indexing for obstacles (future enhancement)

## Future Enhancements

1. **Multiple pursuers**: Coordinate multiple sensor models
2. **Sensor noise**: Add Gaussian noise to detection
3. **Partial occlusion**: Handle partial visibility
4. **Dynamic FOV**: Adjust FOV based on agent behavior
5. **3D sensing**: Extend to 3D environments
