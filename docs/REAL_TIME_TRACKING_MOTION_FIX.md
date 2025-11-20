# Real-Time Tracking Motion Control Fix

## Issues Fixed

### 1. Winning Node Visualization Bug
**Problem:** Winning nodes weren't being displayed during real-time tracking.

**Root Cause:** In `chooseTargets()`, the code was trying to access `selectedStrategy.winningNode.index`, but RRT nodes don't have an `.index` property. The strategy returns `winningNodeIndex` as a separate property.

**Fix:** Changed to use `selectedStrategy.winningNodeIndex` directly.

```javascript
// Before (WRONG):
pursuerIndex: selectedStrategy.winningNode.index

// After (CORRECT):
pursuerIndex: selectedStrategy.winningNodeIndex
```

### 2. Agent Motion Execution
**Problem:** Agents were teleporting to the next waypoint instead of smoothly moving along the path using proper control.

**Root Cause:** The `executeAlongPaths()` method was just setting the state to the next waypoint, ignoring the control dynamics and time steps.

**Fix:** Implemented proper unicycle model simulation with control law.

## New Implementation

### Execution Flow

```
For executionTimeStep (e.g., 0.1s):
  1. Divide into integration steps (dt = 0.05s) → numSteps = 2
  2. For each step:
     a. Compute control inputs (v, omega) to move towards next waypoint
     b. Apply unicycle model:
        - x' = v * cos(theta) * dt
        - y' = v * sin(theta) * dt
        - theta' = omega * dt
     c. If reached waypoint, advance to next one
  3. Return updated state after all steps
```

### Control Law

The `computeControl()` method implements a simple proportional controller:

1. **Direction Tracking:**
   - Compute desired heading towards target: `θ_desired = atan2(dy, dx)`
   - Heading error: `θ_error = θ_desired - θ_current`

2. **Angular Velocity (ω):**
   - Proportional control: `ω = k_omega * θ_error`
   - Clamped to `[-omegaMax, omegaMax]`

3. **Linear Velocity (v):**
   - Reduces with heading error: `v = vMax * cos(θ_error)`
   - Clamped to `[vMin, vMax]`
   - This ensures the agent slows down when turning

### Benefits

✅ **Smooth Motion:** Agents follow paths using proper dynamics, not teleporting  
✅ **Respects Constraints:** Uses configured `vMax`, `vMin`, `omegaMax`  
✅ **Time-Accurate:** Motion duration matches `executionTimeStep`  
✅ **Realistic:** Uses unicycle model consistent with RRT* planning  
✅ **Winning Nodes Visible:** Pulsating circles show target nodes on canvas

## Configuration Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `executionTimeStep` | 0.1s | How long to execute along path before replanning |
| `dt` | 0.05s | Integration time step for simulation |
| `vMax` | 10 px/s | Maximum linear velocity |
| `vMin` | 0 px/s | Minimum linear velocity |
| `omegaMax` | 1.5 rad/s | Maximum angular velocity |
| `planningFrequency` | 1000ms | How often to replan (build new RRT trees) |

## Example Execution

```
Iteration 1:
- Build RRT* trees (1000 nodes each)
- Compute Ne/Np visibility sets
- Strategy (TMA) chooses winning nodes
- Extract paths from root to winning nodes
- Execute for 0.1s along paths (2 steps of 0.05s each)
- Wait until planningFrequency (1s total)

Iteration 2:
- Repeat from current positions...
```

## Visualization

The canvas now shows:

1. **RRT Trees:** Blue (pursuer) and pink (evader) tree edges
2. **Winning Nodes:** 
   - Pulsating outer circle (animated)
   - Solid inner circle with white border
   - Label showing strategy (e.g., "TMA P" for pursuer target)
3. **Agent States:** Current positions of pursuer and evader
4. **Paths:** Lines showing planned trajectories

## Code Files Modified

1. **`src/services/RealTimeTrackingService.js`:**
   - Fixed `chooseTargets()` to use `winningNodeIndex`
   - Replaced `executeAlongPaths()` with proper simulation
   - Added `executeAgentAlongPath()` - path following with unicycle model
   - Added `computeControl()` - proportional controller
   - Added `normalizeAngle()` - angle normalization utility

2. **`src/controllers/PolygonCanvasController.js`:** (Already correct)
   - Event listener for `realTimeTracking:update`
   - Stores `pursuerWinningNode` and `evaderWinningNode`
   - Draws pulsating circles at winning node positions

## Testing

To test the fix:

1. Place pursuer and evader agents
2. Open Real-Time Tracking window
3. Select strategy (PL or TMA)
4. Click "Start Tracking"
5. Observe:
   - Agents move smoothly along paths (not teleporting)
   - Winning nodes are highlighted with pulsating circles
   - Trees are redrawn every planning cycle
   - Motion respects velocity constraints

## Future Improvements

- [ ] Add path preview visualization
- [ ] Implement MPC (Model Predictive Control) for better tracking
- [ ] Add collision avoidance in execution phase
- [ ] Show velocity/control vectors on agents
- [ ] Add configurable controller gains
