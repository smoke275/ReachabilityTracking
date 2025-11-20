# Evader Implementation - Complete

## Overview
The evader system is now fully implemented with two motion models: holonomic and unicycle. The evader travels between random leaf nodes of the medial axis skeleton using shortest path routing.

## Features Implemented

### 1. Path Planning
- **Graph Construction**: Builds adjacency list from skeleton edges
- **Leaf Detection**: Identifies all degree-1 vertices (leaf nodes)
- **Random Target Selection**: Chooses random leaves as destinations
- **Shortest Path**: Uses Dijkstra's algorithm to find optimal routes
- **Path Visualization**: Shows complete path with current segment highlighted

### 2. Motion Models

#### Holonomic Motion
- Direct movement toward waypoints
- Can instantly change direction
- Always moves at maximum speed
- Simple and predictable behavior

#### Unicycle Motion (Differential Drive)
- **Turning Constraints**: Must rotate to face target before moving
- **Feedback Control Law**: 
  - Linear velocity: `v = K_v × distance × max(0, cos(θ_error))`
  - Angular velocity: `ω = K_h × θ_error`
- **Natural Path Deviation**: Robot curves around corners due to turning radius
- **Realistic Behavior**: Slows down when turning, speeds up when aligned

### 3. Control Parameters

#### User-Adjustable (via UI)
- **Linear Speed (v_max)**: 0.5 to 5.0 px/frame
- **Angular Speed (ω_max)**: 0.05 to 0.5 rad/frame (unicycle only)

#### Control Gains (Internal)
- **K_v = 0.3**: Linear velocity gain (lower = slower approach)
- **K_h = 3.0**: Heading error gain (higher = faster turning)

### 4. Visualization

#### Path Display
- **Green**: Traversed segments
- **Amber**: Current segment (glowing effect)
- **Pink**: Upcoming segments
- **Start Marker**: Green circle with "S"
- **End Marker**: Red circle with "E"
- **Current Waypoint**: Amber circle (glowing)

#### Robot Display
- **Pink Circle**: Robot body (12px radius)
- **White Arrow**: Heading direction (18px length)
- **Shadow Effect**: Pink glow around robot

### 5. User Interface

#### Evader Window Controls
- **Motion Type Selector**: Choose Holonomic or Unicycle
- **Linear Speed Slider**: Adjust v_max (always visible)
- **Angular Speed Slider**: Adjust ω_max (unicycle mode only)
- **Start Button**: Begin simulation
- **Stop Button**: Pause simulation
- **Reset Button**: Clear and restart
- **Status Display**: Shows current state and messages

## Technical Details

### Graph Structure
```javascript
graph = Map<string, Array<{key: string, distance: number}>>
keyToPoint = Map<string, {x: number, y: number}>
leaves = Array<string>  // Keys of degree-1 vertices
```

### Path State
```javascript
path = Array<{x: number, y: number}>  // Waypoints
pathEdges = Array<{start: {x,y}, end: {x,y}}>  // For visualization
currentWaypointIndex = number  // Current position in path
```

### Motion State
```javascript
position = {x: number, y: number}
heading = number  // In radians [-π, π]
currentLeaf = string  // Key of current leaf node
targetLeaf = string  // Key of target leaf node
```

## Control Flow

1. **Initialization**
   - Load skeleton data
   - Build graph from edges
   - Find all leaf nodes

2. **Start Simulation**
   - Select random starting leaf
   - Choose random target leaf
   - Compute shortest path
   - Initialize position and heading

3. **Animation Loop**
   - Update position based on motion model
   - Check waypoint proximity
   - Advance to next waypoint or select new target
   - Render current state

4. **Waypoint Tracking**
   - Holonomic: Move directly toward waypoint
   - Unicycle: Use feedback control to approach waypoint
   - Switch waypoints when within tolerance (5px)

5. **Target Completion**
   - When reaching final leaf, select new random target
   - Repeat indefinitely until stopped

## Key Differences: Holonomic vs Unicycle

| Aspect | Holonomic | Unicycle |
|--------|-----------|----------|
| Path Following | Exact | Deviates due to turning |
| Speed | Constant v_max | Variable (slows when turning) |
| Direction Change | Instant | Gradual rotation |
| Controls | 1 parameter (v_max) | 2 parameters (v_max, ω_max) |
| Realism | Low | High (matches real robots) |
| Visual | Simple dot | Arrow showing heading |

## Performance Characteristics

### Holonomic
- **Fast**: Direct paths, constant speed
- **Efficient**: Minimal distance traveled
- **Unrealistic**: No real robot moves this way

### Unicycle
- **Slower**: Must turn before moving
- **Less Efficient**: Curves add distance
- **Realistic**: Matches differential-drive robots
- **More Interesting**: Shows actual robot behavior

## Debug Features

Console logging includes:
- Leaf node detection count
- Path selection with waypoint count
- Heading initialization
- Waypoint arrival notifications
- Periodic state updates (distance, heading error, velocities)

## Future Enhancements (Potential)

- [ ] Multiple evaders with collision avoidance
- [ ] Pursuer agent chasing evader
- [ ] Reachability set computation
- [ ] Capture zones visualization
- [ ] Different path planning strategies
- [ ] Obstacle avoidance during movement
- [ ] Speed profiles (acceleration/deceleration)
- [ ] Path smoothing for unicycle

## Files Modified

1. **src/services/EvaderService.js** - Core logic and control algorithms
2. **src/components/EvaderWindow.js** - UI controls and event handling
3. **src/app.js** - Integration and render loop
4. **src/controllers/PolygonCanvasController.js** - Visualization (already existed)

## Usage Instructions

1. Create polygons in the workspace
2. Click "Environment Analysis" to generate skeleton
3. Click "Evader Simulation" to open control window
4. Select motion model (Holonomic or Unicycle)
5. Adjust speed parameters as desired
6. Click "Start Simulation"
7. Observe evader moving between leaf nodes
8. Compare behaviors between motion models

## Conclusion

The evader system successfully demonstrates:
- ✅ Path planning on medial axis skeleton
- ✅ Random leaf-to-leaf navigation
- ✅ Two distinct motion models
- ✅ Realistic unicycle feedback control
- ✅ Rich visual feedback
- ✅ Interactive parameter adjustment

The implementation provides a solid foundation for reachability analysis and pursuit-evasion games.
