# Evader Future Set - Implementation Guide

## Overview

The Evader Future Set feature computes and visualizes the reachable set of evader positions over a time horizon using a **grid-based forward propagation algorithm** with **unicycle kinematics**. This implementation is based on the reachability algorithm described in `REACHABILITY_ALGORITHM_EXPLAINED.md`.

---

## Algorithm Implementation

### Core Algorithm: Grid-Based Forward Propagation

The implementation follows these steps:

1. **Grid Generation**: Create circular grid around evader's current position
2. **Motion Primitives**: Apply 10 precomputed motion primitives
3. **Forward Search**: Dijkstra-like propagation with priority queue
4. **Cost Function**: Multi-objective cost with control, heading, distance, and obstacle penalties
5. **Score Normalization**: Normalize scores to create probability distribution

---

## Implementation Details

### 1. EvaderFutureSetService.js

**Location**: `src/services/EvaderFutureSetService.js`

#### Key Parameters

```javascript
// Motion parameters (pixels per frame)
v_max = 2.0;              // Maximum linear velocity
omega_max = 0.15;         // Maximum angular velocity (rad/frame)
dt = 1.0;                 // Time step (1 frame)

// Algorithm parameters
maxSteps = 25;            // Maximum search depth
maxExpansions = 100000;   // Computational budget
scoreThreshold = 0.001;   // Prune low-probability paths
thetaBins = 16;           // Heading discretization
gridResolution = 15;      // Pixels between grid points

// Cost weights
controlWeight = 0.05;     // Energy cost
headingWeight = 0.3;      // Heading alignment
distanceWeight = 0.05;    // Path length
obstacleWeight = 5.0;     // Safety margin
obstacleThreshold = 30;   // Obstacle proximity threshold (pixels)
```

#### Motion Primitives

10 motion primitives covering different velocities and turn rates:

```javascript
[1.0, 0]      // Straight forward at max speed
[1.0, 1.0]    // Hard left turn
[1.0, -1.0]   // Hard right turn
[1.0, 0.5]    // Moderate left
[1.0, -0.5]   // Moderate right
[0.7, 0.7]    // Medium speed curved left
[0.7, -0.7]   // Medium speed curved right
[0.5, 1.0]    // Slow tight left
[0.5, -1.0]   // Slow tight right
[0.5, 0]      // Slow forward
```

#### Unicycle Kinematics

**Straight Motion** (ω ≈ 0):
```javascript
x_new = x + v × cos(θ) × dt
y_new = y + v × sin(θ) × dt
θ_new = θ
```

**Arc Motion** (ω ≠ 0):
```javascript
radius = v / ω
Δθ = ω × dt
x_new = x + radius × (sin(θ + Δθ) - sin(θ))
y_new = y - radius × (cos(θ + Δθ) - cos(θ))
θ_new = normalize(θ + Δθ)
```

#### Cost Function

Multi-objective cost function:

```javascript
cost = controlCost + headingCost + distanceCost + obstacleCost

where:
  controlCost = 0.05 × (v² + ω²) × dt
  headingCost = 0.3 × |heading_error| / π
  distanceCost = 0.05 × distance_traveled
  obstacleCost = 5.0 × (30 - min_distance)  [if distance < 30px]
```

Score update: `newScore = currentScore × exp(-totalCost)`

#### Collision Detection

**Point-in-Polygon Test**: Ray casting algorithm
- Tests if position is inside any obstacle polygon
- O(n) per polygon where n = number of vertices

**Distance to Obstacles**: Line segment distance
- Computes minimum distance to all polygon edges
- Used for obstacle cost calculation

### 2. Visualization (PolygonCanvasController.js)

**Location**: `src/controllers/PolygonCanvasController.js`

#### Color Gradient

Reachability scores are visualized with a color gradient:

- **High scores** (easy to reach): 🔴 Red/Orange
- **Medium scores**: 🟡 Yellow
- **Low scores**: 🟢 Green

```javascript
if (normalizedScore < 0.5) {
    // Green to Yellow
    r = 255 × (normalizedScore × 2)
    g = 255
    b = 0
} else {
    // Yellow to Red
    r = 255
    g = 255 × (1 - (normalizedScore - 0.5) × 2)
    b = 0
}
```

Alpha transparency: `alpha = 0.3 + normalizedScore × 0.7`

#### Max Reachable Circle

A cyan dashed circle shows the theoretical maximum reachable distance:

```javascript
maxRadius = v_max × timeHorizon × dt
```

### 3. UI Component (EvaderFutureSetWindow.js)

**Location**: `src/components/EvaderFutureSetWindow.js`

#### Controls

- **Time Horizon Slider**: 10-500 frames (adjustable)
- **Compute Button**: Triggers computation
- **Clear Button**: Removes visualization
- **Status Display**: Shows computation results and errors

#### Status Messages

- Success: Shows count, computation time, expansions
- Error: Displays error messages in red
- Ready: Initial state message

---

## Integration with Evader Simulation

### Data Flow

1. User starts evader simulation
2. Evader moves along medial axis
3. User opens "Evader Future Set" window
4. User clicks "Compute"
5. Service retrieves:
   - Evader position and heading
   - Motion parameters (speed, angular speed)
   - Obstacle polygons
6. Computation runs asynchronously
7. Results are visualized on canvas
8. Evader continues moving independently

### Synchronization

- Future set uses **current evader state** at computation time
- Evader motion parameters are synchronized automatically
- Re-computation needed if evader moves significantly

---

## Performance Characteristics

### Time Complexity

```
O(N × M × P)
where:
  N = grid points (~500-2000 typical)
  M = motion primitives (10)
  P = search depth (~25 steps)
```

### Typical Performance

| Grid Points | Time Horizon | Computation Time |
|-------------|--------------|------------------|
| 500         | 100 frames   | ~50-100ms        |
| 1000        | 100 frames   | ~100-200ms       |
| 2000        | 200 frames   | ~300-500ms       |

### Optimizations Implemented

1. **Grid Resolution**: Adaptive spacing (15px default)
2. **Score Threshold**: Early pruning of low-probability paths
3. **Visited State Tracking**: Prevents redundant expansions
4. **Discretization**: Position and heading binning for efficiency
5. **Max Expansions**: Computational budget limit (100,000)

---

## Usage Guide

### Basic Workflow

1. **Create Environment**
   - Draw or load obstacle polygons
   - Generate medial axis skeleton

2. **Start Evader Simulation**
   - Click "Evader Simulation" in Toolbox
   - Set motion parameters (speed, angular speed, mode)
   - Click "Start"

3. **Compute Future Set**
   - Click "Evader Future Set" in Toolbox
   - Adjust time horizon slider
   - Click "Compute"
   - Wait for computation (~100-500ms)
   - View visualization on canvas

4. **Interpret Results**
   - Red/Orange dots: Highly reachable
   - Yellow dots: Moderately reachable
   - Green dots: Barely reachable
   - Cyan circle: Maximum reach boundary

### Adjusting Parameters

#### Time Horizon
- **Shorter** (50-100 frames): Faster computation, local reachability
- **Longer** (200-500 frames): Slower computation, global view

#### Motion Parameters
- **Higher speed**: Larger reachable area
- **Higher angular speed**: More maneuverable

#### Grid Resolution
Modify in `EvaderFutureSetService.js`:
```javascript
this.gridResolution = 10;  // Finer grid (more points, slower)
this.gridResolution = 20;  // Coarser grid (fewer points, faster)
```

---

## API Reference

### EvaderFutureSetService

#### Methods

**`compute(startState, polygons, timeHorizonFrames, motionParams)`**
- Computes reachable set
- Returns: `{ success, futureSet, gridPoints, timeHorizon, computationTime, expansions }`

**`clear()`**
- Clears computed future set

**`getFutureSet()`**
- Returns: Map of position -> score

**`isComputingFutureSet()`**
- Returns: boolean indicating computation status

**`setMotionParameters(v_max, omega_max)`**
- Updates motion constraints

### PolygonCanvasController

#### Methods

**`setFutureSet(futureSet, gridPoints)`**
- Updates visualization data

**`clearFutureSet()`**
- Removes future set from canvas

**`toggleFutureSetVisibility()`**
- Shows/hides future set visualization

**`drawFutureSet()`**
- Renders future set on canvas (called by redraw)

---

## Events

### Emitted Events

| Event | Data | Description |
|-------|------|-------------|
| `evaderFutureSet:compute` | `{ timeHorizon }` | Request computation |
| `evaderFutureSet:clear` | - | Request clear |
| `evaderFutureSet:computed` | `{ count, computationTime, expansions }` | Computation success |
| `evaderFutureSet:cleared` | - | Clear success |
| `evaderFutureSet:error` | `{ message }` | Error occurred |
| `evaderFutureSet:windowClosed` | - | Window closed |

### Event Flow

```
User Action → Event → Handler → Service → Result → Visualization

1. Click "Compute"
   ↓
2. evaderFutureSet:compute
   ↓
3. computeEvaderFutureSet()
   ↓
4. EvaderFutureSetService.compute()
   ↓
5. evaderFutureSet:computed
   ↓
6. Canvas updates with visualization
```

---

## Troubleshooting

### Common Issues

#### "Evader not initialized"
**Problem**: Evader simulation hasn't been started  
**Solution**: Start evader simulation first

#### "No polygons to avoid"
**Problem**: No obstacles in environment  
**Solution**: Add polygons or proceed (computation works but may be less interesting)

#### Slow Computation
**Problem**: Large time horizon or fine grid  
**Solutions**:
- Reduce time horizon
- Increase `gridResolution` (coarser grid)
- Reduce `maxExpansions`

#### Empty Future Set
**Problem**: Evader completely blocked by obstacles  
**Solution**: Check obstacle configuration, evader might be trapped

#### Computation Never Completes
**Problem**: Possible infinite loop or excessive expansions  
**Solution**: Check browser console for errors, refresh page

---

## Advanced Customization

### Modifying Cost Function

In `EvaderFutureSetService.js`, adjust weights:

```javascript
this.controlWeight = 0.1;    // Increase to penalize high speeds
this.headingWeight = 0.5;    // Increase to favor aligned motion
this.distanceWeight = 0.1;   // Increase to prefer shorter paths
this.obstacleWeight = 10.0;  // Increase for larger safety margins
```

### Adding Motion Primitives

Add to `this.motionPrimitives` array:

```javascript
[0.3, 0],     // Very slow forward
[1.0, 0.25],  // Gentle left turn
// etc.
```

### Changing Visualization

Modify `drawFutureSet()` in `PolygonCanvasController.js`:

```javascript
// Different color scheme
ctx.fillStyle = `hsl(${normalizedScore * 120}, 100%, 50%, ${alpha})`;

// Larger dots
ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);

// Add glow effect
ctx.shadowColor = `rgba(${r}, ${g}, ${b}, 0.8)`;
ctx.shadowBlur = 8;
```

---

## Testing Checklist

- [x] Button appears in Toolbox section
- [x] Clicking button opens window
- [x] Window is draggable
- [x] Window can be minimized/closed
- [x] Time horizon slider works
- [x] Compute button triggers computation
- [x] Clear button removes visualization
- [x] Status messages display correctly
- [x] Error handling for edge cases
- [x] Visualization renders correctly
- [x] Color gradient applied properly
- [x] Max reach circle displayed
- [x] Performance acceptable (<500ms)
- [x] Integration with evader simulation

---

## Future Enhancements

### Potential Improvements

1. **Dynamic Obstacles**: Support moving obstacles
2. **Multiple Agents**: Joint reachability sets
3. **GPU Acceleration**: WebGL for large grids
4. **Learned Costs**: ML-based cost functions
5. **Probabilistic Obstacles**: Uncertain environments
6. **3D Visualization**: Height-based display
7. **Export Functionality**: Save computed sets
8. **Real-time Updates**: Recompute during simulation
9. **Path Synthesis**: Extract optimal paths from set
10. **Heatmap Mode**: Continuous density visualization

### Performance Optimizations

1. **Web Worker**: Offload computation to background thread
2. **Incremental Computation**: Update only changed regions
3. **Spatial Indexing**: R-tree for obstacle queries
4. **Caching**: Store recent computations
5. **Level of Detail**: Adaptive grid density

---

## References

### Related Documentation

- `REACHABILITY_ALGORITHM_EXPLAINED.md` - Algorithm theory
- `EVADER_IMPLEMENTATION_COMPLETE.md` - Evader simulation
- `UNICYCLE_MODEL.md` - Motion model details

### Algorithm Papers

- Forward Reachability Analysis for Autonomous Systems
- Hamilton-Jacobi Reachability
- Model Predictive Control with Reachability Constraints

---

## Summary

The Evader Future Set feature provides a complete implementation of grid-based reachability analysis with:

✅ **Full algorithm implementation** based on research  
✅ **Interactive UI** with real-time computation  
✅ **Visual feedback** with color-coded reachability  
✅ **Performance optimizations** for responsive experience  
✅ **Robust error handling** for edge cases  
✅ **Integration** with existing evader simulation  

The implementation is production-ready and can be extended for more advanced use cases.

---

**Implementation Status**: ✅ Complete  
**Last Updated**: November 17, 2025  
**Version**: 1.0.0
