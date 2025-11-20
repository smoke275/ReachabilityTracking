# Real-Time Tracking Implementation

## Overview

A new **Real-Time Tracking** feature has been added to enable autonomous pursuit-evasion tracking using RRT* planning and active tracking strategies. This feature allows you to start/stop tracking where the pursuer automatically tracks the evader using online replanning.

## Architecture

### New Components

1. **RealTimeTrackingService** (`src/services/RealTimeTrackingService.js`)
   - Core service implementing the tracking loop
   - Manages the iterative planning-execution cycle
   - Configurable parameters for sampling, execution, and strategy

2. **RealTimeTrackingWindow** (`src/components/RealTimeTrackingWindow.js`)
   - UI window for tracking control and visualization
   - Configuration panel for parameters
   - Live statistics display
   - Start/Stop controls

### Integration Points

- **ToolboxSection**: Added "Real-Time Tracking" button after "Active Tracking"
- **App.js**: Wired up the window and service with event handlers
- **RRTStarService**: Used for building trees from current states
- **ActiveTrackingService**: Used for visibility computation and strategy selection
- **IntruderService & EvaderService**: Provide current agent states

## Algorithm Flow

The tracking loop implements the following steps automatically:

```
Loop (while tracking is active):
  1. Build RRT* trees from current pursuer and evader states
     - nodes_p = build_rrt_star(pursuer_state, iterations)
     - nodes_e = build_rrt_star(evader_state, iterations)
  
  2. Compute visibility matrix & Ne/Np sets
     - visible_p_e, Ne, Np = compute_visibility(nodes_p, nodes_e)
  
  3. Choose strategy (EL, PL, ELST, or TMA)
     - pursuer_target_idx, evader_target_idx = choose_targets(strategy)
  
  4. Reconstruct paths from root to target nodes
     - path_p = reconstruct_path(nodes_p, pursuer_target_idx)
     - path_e = reconstruct_path(nodes_e, evader_target_idx)
  
  5. Execute simulation along paths
     - pursuer_state = simulate_along_path(path_p, dt_exec)
     - evader_state = simulate_along_path(path_e, dt_exec)
  
  6. Wait for planning frequency, then repeat
```

## Configuration Parameters

### RRT* Iterations
- **Default**: 500
- **Range**: 100-2000
- **Description**: Number of RRT* sampling iterations per planning cycle
- **Higher values**: Better paths but slower planning

### Execution Time Step (dt_exec)
- **Default**: 0.1 seconds
- **Range**: 0.05-1.0 seconds
- **Description**: Time duration to execute along computed paths before replanning
- **Lower values**: More reactive but more frequent replanning

### Replan Frequency
- **Default**: 1000 ms (1 second)
- **Range**: 100-5000 ms
- **Description**: Time between planning iterations
- **Lower values**: More responsive but higher computational load

### Strategy Selection
- **PL (Pursuer as Leader)**: Pursuer selects best node, evader responds
- **EL (Evader as Leader)**: Evader selects best escape node, pursuer responds (default)
- **ELST (Evader Shortest Time)**: Evader minimizes time to escape
- **TMA (Two Moves Ahead)**: Game-theoretic two-step lookahead

## Usage Instructions

### Setup
1. **Draw Environment**: Create polygon obstacles using the drawing tools
2. **Place Agents**: Use the "Agents" window to place both Pursuer and Evader
3. **Build RRT Trees** (optional): Pre-build trees in RRT window for visualization
4. **Open Real-Time Tracking**: Click "Real-Time Tracking" button in Toolbox

### Starting Tracking
1. Configure parameters (or use defaults)
2. Select desired strategy
3. Click "Start Tracking"
4. Watch agents move autonomously

### During Tracking
- **Live Statistics** update in real-time:
  - Iterations completed
  - Planning time per iteration
  - Distance between agents
  - Current positions
- **Stop anytime**: Click "Stop Tracking" button

## Technical Details

### Event Flow

```
User clicks "Start Tracking"
  ↓
realTimeTrackingService.start(pursuerState, evaderState)
  ↓
runTrackingIteration() [loop]
  ↓
  ├─ buildTrees() → RRTStarService
  ├─ computeVisibility() → ActiveTrackingService
  ├─ chooseTargets() → ActiveTrackingService.computeStrategies()
  ├─ reconstructPath() → Extract path from tree
  ├─ executeAlongPaths() → Update agent states
  └─ emit 'realTimeTracking:update' → Update UI
  ↓
Schedule next iteration after planningFrequency
```

### State Management

**RealTimeTrackingService maintains:**
- `isTracking`: Boolean tracking status
- `config`: Configuration parameters
- `pursuerState`: Current pursuer state {position, heading}
- `evaderState`: Current evader state {position, heading}
- `pursuerTree`, `evaderTree`: Current RRT* trees
- `pursuerPath`, `evaderPath`: Current planned paths
- `stats`: Real-time statistics

### Event API

**Emitted Events:**
- `realTimeTracking:started` - Tracking has begun
- `realTimeTracking:stopped` - Tracking has stopped
- `realTimeTracking:update` - New iteration completed (with data)
- `realTimeTracking:error` - Error occurred

**Listened Events:**
- `action:realTimeTracking` - Open window
- `realTimeTracking:requestStates` - Request current agent states

## Future Enhancements

### Potential Improvements:
1. **Better Path Execution**: Implement proper control to follow paths smoothly over dt_exec
2. **Collision Avoidance**: Add real-time collision checking during execution
3. **Adaptive Parameters**: Automatically adjust parameters based on situation
4. **Path Visualization**: Show planned paths on canvas
5. **Performance Metrics**: Track capture/escape statistics
6. **Multiple Strategies**: Allow switching strategies mid-tracking
7. **Recording/Playback**: Save tracking sessions for analysis

### Known Limitations:
1. Path execution is simplified (just moves to next waypoint)
2. No interpolation between planning cycles
3. Trees are rebuilt from scratch each iteration (not incremental)
4. No guaranteed real-time performance for large iterations

## File Structure

```
src/
├── services/
│   ├── RealTimeTrackingService.js     [NEW - Core tracking loop]
│   ├── ActiveTrackingService.js       [USED - Visibility & strategies]
│   ├── RRTStarService.js              [USED - Tree building]
│   ├── IntruderService.js             [USED - Pursuer state]
│   └── EvaderService.js               [USED - Evader state]
├── components/
│   ├── RealTimeTrackingWindow.js      [NEW - UI window]
│   └── ToolboxSection.js              [MODIFIED - Added button]
└── app.js                              [MODIFIED - Wiring]
```

## Testing

### Basic Test:
1. Create simple environment (few obstacles)
2. Place pursuer and evader far apart
3. Use default parameters
4. Start tracking
5. Verify agents move toward/away from each other

### Advanced Test:
1. Create complex environment (many obstacles)
2. Increase RRT iterations to 1000
3. Try different strategies
4. Compare performance metrics

## API Reference

### RealTimeTrackingService

**Methods:**
- `configure(config)` - Update configuration
- `start(pursuerState, evaderState)` - Start tracking
- `stop()` - Stop tracking
- `getState()` - Get current state

**Configuration Object:**
```javascript
{
    samplingIterations: 500,      // RRT* iterations
    executionTimeStep: 0.1,        // Execution time (seconds)
    planningFrequency: 1000,       // Replan interval (ms)
    strategy: 'el'                 // Strategy: 'pl', 'el', 'elst', 'tma'
}
```

### RealTimeTrackingWindow

**Methods:**
- `open()` - Show window
- `close()` - Hide window
- `toggle()` - Toggle visibility
- `destroy()` - Remove from DOM

## Notes

- Ensure both agents are placed before starting tracking
- Higher RRT iterations provide better quality but slower planning
- Strategy choice significantly affects behavior
- Monitor planning time to ensure it's less than replan frequency
- System assumes obstacles don't change during tracking

---

**Created**: 2025
**Version**: 1.0
**Status**: Functional - Ready for testing and enhancement
