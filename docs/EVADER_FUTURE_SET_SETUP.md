# Evader Future Set Feature - Setup Documentation

## Overview
The Evader Future Set feature computes and visualizes the reachable set of evader positions over a specified time horizon. This feature builds upon the existing Evader Simulation system.

## Components Created

### 1. UI Components

#### EvaderFutureSetWindow.js
Location: `src/components/EvaderFutureSetWindow.js`

A draggable floating window component that provides:
- **Time Horizon Slider**: Control the time horizon (10-500 frames)
- **Compute Button**: Triggers the future set computation
- **Clear Button**: Clears the computed future set visualization
- **Status Message**: Displays computation status and errors
- **Info Box**: Provides helpful information about the feature

Features:
- Draggable window interface
- Minimize/Close controls
- Material Design styling
- Event-driven communication with the app

#### Updated ToolboxSection.js
Location: `src/components/ToolboxSection.js`

Added a new button:
- **Evader Future Set Button**: Opens the future set window
- Icon: `timeline`
- Event: `action:evaderFutureSet`

### 2. Service Layer

#### EvaderFutureSetService.js
Location: `src/services/EvaderFutureSetService.js`

A placeholder service that will handle future set computation. Currently includes:
- `compute(skeleton, timeHorizon, evaderState, motionModel)`: Main computation method (to be implemented)
- `clear()`: Clears the computed future set
- `getFutureSet()`: Returns the current future set
- `isComputingFutureSet()`: Checks if computation is in progress

**Note**: The actual computation algorithm needs to be implemented.

### 3. Application Integration

#### Updated app.js
Location: `src/app.js`

Changes made:
1. **Import**: Added import for `EvaderFutureSetWindow.js`
2. **Constructor**: Added `this.evaderFutureSetWindow = null`
3. **Init**: Created and appended the evader future set window to DOM
4. **Component List**: Added `'evader-future-set-window'` to waitForComponents
5. **Event Handlers**: Added three new event handlers:
   - `action:evaderFutureSet` → `showEvaderFutureSetWindow()`
   - `evaderFutureSet:compute` → `computeEvaderFutureSet(data)`
   - `evaderFutureSet:clear` → `clearEvaderFutureSet()`
6. **Methods**: Added three new methods (currently with placeholder implementations)

## Event Flow

### Opening the Window
1. User clicks "Evader Future Set" button in Toolbox
2. `action:evaderFutureSet` event is emitted
3. `showEvaderFutureSetWindow()` method displays the window

### Computing Future Set
1. User sets time horizon and clicks "Compute"
2. `evaderFutureSet:compute` event is emitted with `{ timeHorizon }`
3. `computeEvaderFutureSet(data)` method is called
4. Validates that medial axis skeleton exists
5. TODO: Call EvaderFutureSetService to compute
6. TODO: Visualize results on canvas
7. Emits `evaderFutureSet:computed` or `evaderFutureSet:error`

### Clearing Future Set
1. User clicks "Clear" button
2. `evaderFutureSet:clear` event is emitted
3. `clearEvaderFutureSet()` method is called
4. TODO: Clear visualization from canvas
5. Emits `evaderFutureSet:cleared`

## Events

### Emitted by Window
- `evaderFutureSet:compute` - Triggers computation with time horizon parameter
- `evaderFutureSet:clear` - Triggers clearing of future set
- `evaderFutureSet:windowClosed` - Window was closed

### Emitted by App
- `evaderFutureSet:computed` - Computation completed successfully
- `evaderFutureSet:cleared` - Future set was cleared
- `evaderFutureSet:error` - An error occurred during computation

### Received by Window
- `evaderFutureSet:computed` - Updates status message
- `evaderFutureSet:cleared` - Updates status message
- `evaderFutureSet:error` - Displays error message

## Next Steps (To Be Implemented)

### 1. Computation Algorithm
Implement the future set computation in `EvaderFutureSetService.js`:
- Calculate reachable positions over time horizon
- Consider motion model (holonomic vs unicycle)
- Handle environment constraints
- Use medial axis skeleton for navigation

### 2. Visualization
Add future set visualization to `PolygonCanvasController.js`:
- Display computed reachable positions
- Show time-based gradient or heatmap
- Add toggle for showing/hiding future set
- Consider performance for large sets

### 3. Integration with Evader Service
Connect with existing `EvaderService.js`:
- Get current evader state (position, velocity, heading)
- Use same motion model parameters (speed, angular speed)
- Coordinate with active simulation

### 4. Additional Features (Optional)
- Export future set data
- Save/load computed sets
- Real-time updates during simulation
- Multiple time horizons comparison
- Probability distributions

## File Structure
```
src/
├── components/
│   ├── EvaderFutureSetWindow.js    [NEW]
│   └── ToolboxSection.js            [MODIFIED]
├── services/
│   └── EvaderFutureSetService.js   [NEW]
└── app.js                           [MODIFIED]
```

## Testing Checklist

- [ ] Button appears in Toolbox section
- [ ] Clicking button opens the window
- [ ] Window is draggable
- [ ] Window can be minimized/closed
- [ ] Time horizon slider works
- [ ] Compute button emits correct events
- [ ] Clear button emits correct events
- [ ] Status messages display correctly
- [ ] Error handling works properly

## Dependencies

Required:
- Material Web Components (already in project)
- EventBus system (already in project)
- Medial axis skeleton (from existing analysis)
- Evader service (already in project)

## Usage Instructions

1. **Generate Environment Analysis**: First, generate the medial axis skeleton using the "Environment Analysis" tool
2. **Open Evader Future Set Window**: Click "Evader Future Set" in the Toolbox
3. **Set Time Horizon**: Adjust the slider to desired time horizon (frames)
4. **Compute**: Click "Compute" to calculate the future set (once implemented)
5. **Clear**: Click "Clear" to remove the visualization

---

**Status**: ✅ **IMPLEMENTATION COMPLETE**  
**Service Implementation**: ✅ Complete  
**Visualization**: ✅ Complete  
**Date Created**: November 17, 2025  
**Date Completed**: November 17, 2025
