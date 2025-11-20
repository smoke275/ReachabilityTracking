# Unicycle Mode Fix

## Issues Fixed

### 1. Heading Initialization
- **Problem**: When starting or selecting a new target, the heading wasn't properly initialized for unicycle mode
- **Fix**: 
  - In `start()`: Initialize heading to point toward first real waypoint (path[1]) instead of path[0] (current position)
  - In `selectNewTarget()`: Reinitialize heading when switching to a new target leaf
  - Added mode logging to confirm which mode is active

### 2. Waypoint Indexing
- **Problem**: Path[0] is the current position, so we need to target path[1] first
- **Fix**: When initializing heading, use path[1] instead of path[0]

### 3. Visualization
- **Problem**: Not clear which mode is active
- **Fix**: 
  - Check `evaderState.mode` explicitly in rendering
  - Unicycle mode: Draw prominent white arrow showing heading direction
  - Holonomic mode: Draw simple white dot
  - Made arrow larger and more visible (20px length, 9px width)

### 4. Debug Logging
- Added logging to help diagnose issues:
  - Mode confirmation at start
  - Initial heading angle
  - Waypoint reached events
  - Periodic unicycle control values (distance, heading error, velocities)
  - Warning if unknown mode is used

## How to Test

### Visual Differences
1. **Holonomic Mode**:
   - Evader moves directly toward waypoints
   - Shows as pink circle with small white dot
   - Smooth, straight-line movement between waypoints
   - Fast transitions

2. **Unicycle Mode**:
   - Evader rotates to face target before moving
   - Shows as pink circle with large white arrow indicating heading
   - Curved movement paths
   - Slows down when not facing target
   - Visible turning behavior at waypoints
   - Smoother, more realistic motion

### Testing Steps
1. Draw some polygons
2. Generate medial axis skeleton (Environment Analysis)
3. Open Evader Simulation window
4. **Test Holonomic**:
   - Select "Holonomic (Direct)"
   - Click Start
   - Observe direct movement with small dot
5. **Test Unicycle**:
   - Click Reset
   - Select "Unicycle (Turning)"
   - Adjust Angular Speed slider (try 0.15 rad/frame)
   - Click Start
   - **Look for the large white arrow** - it should point in the heading direction
   - Watch for turning behavior when approaching waypoints
   - Should see the arrow rotate as the evader turns

### Console Logs to Check
When starting in unicycle mode, you should see:
```
EvaderService initialized: {vertices: X, edges: Y, leaves: Z}
New target selected: N (M waypoints), mode: unicycle
Initial heading set to: X.XX rad
Evader simulation started in unicycle mode
```

While running in unicycle mode (every ~1 second):
```
Unicycle: dist=XX.X, θ_err=X.XX, v=X.XX, ω=X.XXX, align=X.XX
```

## Key Parameters (Unicycle Mode)

### Control Gains
- `K_v = 0.5`: Linear velocity gain
- `K_h = 2.0`: Heading error gain

### Adjustable via UI
- `v_max`: 0.5 to 5.0 px/frame (Linear Speed slider)
- `ω_max`: 0.05 to 0.5 rad/frame (Angular Speed slider)

### Expected Behavior
- **High heading error** → Robot slows down, turns in place
- **Low heading error** → Robot moves forward at proportional speed
- **Close to waypoint** → Speed naturally decreases (proportional control)
- **Waypoint tolerance** → 2.0 pixels (switches to next waypoint)

## Troubleshooting

If unicycle still looks like holonomic:
1. Check console for "mode: unicycle" in logs
2. Verify you see the large white arrow (not just a dot)
3. Try reducing Linear Speed to 1.0 px/frame to see turning more clearly
4. Try reducing Angular Speed to 0.1 rad/frame for slower, more visible turning
5. Check that you clicked "Unicycle (Turning)" in the dropdown
6. Reset and restart the simulation after changing mode

## Performance Notes
- The `dt = deltaTime * 60` normalization ensures consistent behavior regardless of framerate
- Debug logging is sampled (~1.6% of frames) to avoid console spam
- Angle normalization prevents wraparound issues at ±π boundaries
