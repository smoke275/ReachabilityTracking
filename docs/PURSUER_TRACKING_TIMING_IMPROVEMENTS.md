# Pursuer Tracking: Unicycle Feedback Control

## Overview
Updated the Real-Time Tracking Service to use **continuous unicycle feedback control** (like the evader simulation) instead of fixed-time execution. This provides smooth, natural movement with efficient replanning.

## Key Changes

### 1. Continuous Animation Loop
**File:** `src/services/RealTimeTrackingService.js`

- **Before:** Fixed-time execution (`executeAlongPaths()`) - agent moved for X seconds then stopped
- **After:** Continuous animation loop (`animate()`) - agent continuously follows waypoints using feedback controller

### 2. Unicycle Feedback Controller
Agents now use the same control law as the evader simulation:

```javascript
// Linear velocity: v = K_v * distance * cos(heading_error)
// - Proportional to distance to target
// - Scaled by heading alignment
// - Slows down when not facing target

// Angular velocity: ω = K_h * heading_error  
// - Proportional to heading error
// - Turns to face target
```

**Control Gains:**
- `K_v = 0.3` - Linear velocity gain
- `K_h = 3.0` - Heading error gain

### 3. Time-Based Replanning
**File:** `src/services/RealTimeTrackingService.js`

- **Update Interval**: Single parameter controls when to replan
- Agent continuously follows current path using feedback control
- System replans every `updateInterval` seconds (default: 2.0s)
- No wasted queries - only replans at specified intervals

### 4. Simplified Configuration

**Old parameters (removed):**
```javascript
planningFrequency: 2000     // milliseconds
executionTimeStep: 2.0      // seconds  
```

**New parameter:**
```javascript
updateInterval: 2.0         // seconds - replan interval
```

## How It Works

### Continuous Tracking Flow:

```
┌─────────────────────────────────────────────┐
│  Initial Plan                               │
│  - Build RRT* trees                         │
│  - Compute visibility                       │
│  - Select target waypoints                  │
└──────────────┬──────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────┐
│  Continuous Animation Loop (~60 FPS)        │
│  ┌────────────────────────────────────────┐ │
│  │ Update Agents:                         │ │
│  │ - Follow waypoints with feedback ctrl  │ │
│  │ - Smooth unicycle motion               │ │
│  │ - Update visualization                 │ │
│  └────────────────────────────────────────┘ │
│                                             │
│  ┌────────────────────────────────────────┐ │
│  │ Check Timer:                           │ │
│  │ - If updateInterval elapsed → Replan  │ │
│  │ - Otherwise → Continue following path  │ │
│  └────────────────────────────────────────┘ │
└──────────────┬──────────────────────────────┘
               │
               └─────────── Loop ──────────────┘
```

### Example Timeline (2.0s update interval):

```
0.0s        Plan new path (100ms)
0.1s - 2.0s Follow waypoints smoothly with feedback controller
2.0s        Plan new path (100ms)
2.1s - 4.0s Follow new waypoints smoothly
4.0s        Plan new path (100ms)
...
```

## Benefits

### 1. Smooth Natural Movement
✅ Continuous motion (no start/stop behavior)  
✅ Gradual speed changes based on distance  
✅ Natural turning towards targets  
✅ Same control as evader simulation

### 2. Efficient Planning
✅ Only replans at specified intervals  
✅ No wasted queries  
✅ Consistent timing regardless of path length  
✅ Planning happens in background while agent moves

### 3. Better Tracking Behavior
✅ Agent follows complete paths (doesn't stop mid-path)  
✅ Waypoint-to-waypoint progression  
✅ Smooth transitions between waypoints  
✅ Responsive to obstacles (via path planning)

### 4. Simpler Configuration
✅ One parameter: "Update Interval"  
✅ Clear meaning: "How often to replan"  
✅ Easy to understand and tune  
✅ Impossible to misconfigure

## Configuration Guidelines

### Update Interval Settings:

- **0.5-1.0s**: Very responsive, frequent replanning
  - Best for dynamic environments
  - Higher computational load
  - Quick reactions to evader

- **2.0-3.0s**: Balanced (Recommended)
  - Good responsiveness
  - Reasonable computation
  - Smooth tracking behavior

- **5.0-10.0s**: Strategic, infrequent replanning
  - Lower computational load
  - More predictable behavior
  - Best for testing/analysis

### Control Gains:

You can adjust the unicycle controller gains in the config:

- **K_v** (Linear velocity gain): Higher = faster approach speed
- **K_h** (Heading error gain): Higher = faster turning response

## IMPORTANT: Evader Control

### The Real-Time Tracking Service ONLY controls the Pursuer

**Key Point:** Real-time tracking is designed to track the evader, not control it.

- ✅ **Pursuer**: Controlled by Real-Time Tracking (follows planned paths)
- ❌ **Evader**: NOT controlled by Real-Time Tracking

### How Evader State is Used:

1. **For Planning Only:** The evader's position is queried each frame to:
   - Build RRT* trees from evader's current position
   - Compute visibility between pursuer and evader
   - Plan pursuer's path to track/intercept evader

2. **Evader Runs Independently:** The evader should be controlled by:
   - EvaderService (automatic simulation)
   - Manual keyboard control
   - Or placed statically

3. **No Interference:** Real-time tracking does NOT emit `evader:positionUpdate` events, ensuring the evader simulation runs without interference.

### Typical Usage:

```
1. Start Evader Simulation (Agents Window)
   → Evader moves along skeleton

2. Start Real-Time Tracking (Real-Time Tracking Window)
   → Pursuer tracks the moving evader
   → Replans paths as evader moves

3. Both run simultaneously:
   - Evader: Controlled by EvaderService
   - Pursuer: Controlled by Real-Time Tracking
```

### What Gets Updated:

**Every Frame (~60 FPS):**
- Pursuer position updated via unicycle feedback control
- Evader state queried from EvaderService (for planning only)
- Distance statistics computed
- Visualization updated (pursuer only)

**Every `updateInterval` seconds:**
- RRT* trees built from current positions
- Visibility matrix computed
- Pursuer path replanned
- Evader path computed (but NOT used for control)

## Comparison

### Old Approach (Fixed-Time Execution):
```
Plan → Execute 2.0s → Stop → Plan → Execute 2.0s → Stop → ...
       ^^^^^^^^
       Rigid, stop-start motion
```

### New Approach (Continuous Feedback):
```
Plan → ╭────────────────────────────────╮ → Plan → ...
       │ Smooth continuous following   │
       │ at ~60 FPS with feedback ctrl │
       ╰────────────────────────────────╯
```

## Technical Details

### Waypoint Following:
- **Tolerance**: 5.0 pixels - switch to next waypoint when within this distance
- **Update Rate**: ~60 FPS via `requestAnimationFrame`
- **Time Step**: Delta time calculated each frame
- **Frame Normalization**: `dt * 60` for consistent speed regardless of frame rate

### Unicycle Model:
```javascript
x' = v * cos(θ)  // Linear motion in heading direction
y' = v * sin(θ)  // 
θ' = ω           // Angular velocity
```

### Feedback Control:
```javascript
v = K_v * distance * max(0, cos(heading_error))
ω = K_h * heading_error (clamped to ±ω_max)
```

This ensures:
- Agent slows when far from aligned with target
- Agent turns to face target before moving
- Smooth, stable convergence to waypoints

## Migration Note

If you have saved configurations with the old `planningFrequency` and `executionTimeStep` parameters, they will be ignored. The system now uses only `updateInterval`.
