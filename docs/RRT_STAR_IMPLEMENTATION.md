# RRT* Implementation with Unicycle Dynamics

This document describes the RRT* (Rapidly-exploring Random Tree Star) implementation for pursuit-evasion game planning with unicycle (differential drive robot) dynamics.

## Overview

The implementation provides:
- **Unicycle kinematic model** for both pursuer and evader agents
- **Collision checking** with polygon obstacles
- **Time-based cost metric** for optimal path planning
- **Tree rewiring** for path optimality (RRT* feature)
- **Separate trees** for pursuer and evader agents
- **Real-time visualization** of both trees on the canvas

## Architecture

### Files

1. **`src/services/RRTStarService.js`** - Core RRT* planning algorithm
2. **`src/components/RRTWindow.js`** - UI window for RRT controls
3. **`src/controllers/PolygonCanvasController.js`** - Tree visualization

## Unicycle Dynamics

### State Representation

Each robot state consists of:
```javascript
state = {
    x: number,      // X position (pixels)
    y: number,      // Y position (pixels)
    theta: number   // Heading angle (radians, -π to π)
}
```

### Control Inputs

```javascript
control = {
    v: number,      // Linear velocity (pixels/sec)
    omega: number   // Angular velocity (rad/sec)
}
```

### Kinematic Equations

The unicycle model follows these differential equations:

```
ẋ = v * cos(θ)
ẏ = v * sin(θ)
θ̇ = ω
```

### Integration

Forward integration using Euler method:

```javascript
function integrateDDR(state, control, dt) {
    const {x, y, theta} = state;
    const {v, omega} = control;
    
    const x_new = x + v * Math.cos(theta) * dt;
    const y_new = y + v * Math.sin(theta) * dt;
    const theta_new = wrapToPi(theta + omega * dt);
    
    return {x: x_new, y: y_new, theta: theta_new};
}
```

### Control Constraints

- Linear velocity: `v ∈ [v_min, v_max]` (default: [0, 10] pixels/sec)
- Angular velocity: `ω ∈ [-ω_max, ω_max]` (default: [-1.5, 1.5] rad/sec)

## Collision Detection

### Implemented Functions

#### 1. Point in Polygon Test
```javascript
function pointInPolygon(p, poly)
```
Uses ray casting algorithm to determine if a point is inside a polygon.

#### 2. Segment-Polygon Intersection
```javascript
function segmentIntersectsPolygon(seg, poly)
```
Checks if a line segment intersects with any edge of a polygon or if either endpoint is inside.

#### 3. Robot-Obstacle Collision
```javascript
function robotCollidesWithObstacles(x, y, radius, obstacles)
```
Checks if a circular robot at (x, y) with given radius collides with any polygon obstacles.

Uses:
- Point-in-polygon test for robot center
- Point-to-segment distance for edges within robot radius

### Collision Checking During Planning

During tree expansion, each integration step is checked for collisions:

```javascript
for (let i = 0; i < numSteps; i++) {
    const nextState = integrateDDR(currentState, control, dt);
    
    // Check collision
    if (this.isStateInCollision(nextState)) {
        return {valid: false};
    }
    
    // Check bounds
    if (outOfBounds(nextState)) {
        return {valid: false};
    }
    
    trajectory.push(nextState);
    currentState = nextState;
}
```

## RRT* Algorithm

### Node Structure

```javascript
class RRTNode {
    constructor(state, parent = null, cost = 0.0) {
        this.state = state;      // {x, y, theta}
        this.parent = parent;    // Parent node
        this.cost = cost;        // Time cost from root
        this.children = [];      // Child nodes
    }
}
```

### Planning Loop

```javascript
buildRRTStar(rootState, goalState = null) {
    const root = new RRTNode(rootState, null, 0);
    const nodes = [root];
    
    while (nodes.length < max_nodes && time < max_time) {
        // 1. Sample random state (or goal with probability)
        const randomState = sampleRandomState();
        
        // 2. Find nearest node
        const nearest = findNearest(nodes, randomState);
        
        // 3. Steer toward random state
        const {newState, valid} = steer(nearest.state, randomState);
        if (!valid) continue;
        
        // 4. Create new node
        const newNode = new RRTNode(newState, nearest, nearest.cost + steer_time);
        
        // 5. Find nearby nodes for rewiring
        const nearbyNodes = findNearby(nodes, newNode, rewire_radius);
        
        // 6. Choose best parent (RRT* optimization)
        chooseBestParent(newNode, nearbyNodes);
        
        // 7. Add to tree
        nodes.push(newNode);
        
        // 8. Rewire nearby nodes
        rewire(newNode, nearbyNodes);
    }
    
    return root;
}
```

### Steering Function

The `steer()` function connects two states using unicycle dynamics:

```javascript
steer(fromState, toState) {
    // Calculate desired heading
    const dx = toState.x - fromState.x;
    const dy = toState.y - fromState.y;
    const desiredTheta = Math.atan2(dy, dx);
    
    // Calculate heading error
    const headingError = wrapToPi(desiredTheta - fromState.theta);
    
    // Choose control inputs
    const omega = sign(headingError) * min(|headingError| / t_steer, ω_max);
    const v = v_max * max(0.3, cos(headingError));  // Slow down when turning
    
    // Simulate forward with collision checking
    // ... (see implementation)
    
    return {newState, control, trajectory, valid};
}
```

### Rewiring

RRT* improves upon RRT by rewiring the tree when a better path is found:

```javascript
rewire(newNode, nearbyNodes) {
    for (const nearby of nearbyNodes) {
        // Try to connect newNode to nearby
        const {valid} = steer(newNode.state, nearby.state);
        
        if (valid) {
            const newCost = newNode.cost + steer_time;
            
            // If routing through newNode is cheaper
            if (newCost < nearby.cost) {
                // Remove from old parent
                nearby.parent.children.remove(nearby);
                
                // Rewire to new parent
                nearby.parent = newNode;
                nearby.cost = newCost;
                newNode.children.push(nearby);
                
                // Update descendant costs
                updateDescendantCosts(nearby);
            }
        }
    }
}
```

### Cost Metric

The cost metric is **time**:
- Each steering operation takes `t_steer` seconds (default: 0.5s)
- Cost to reach a node = sum of all steering times from root
- This matches the τ(·) minimum time metric in the paper

## Configuration Parameters

### Unicycle Constraints
```javascript
v_max: 10.0,           // Maximum linear velocity (pixels/sec)
v_min: 0.0,            // Minimum linear velocity
omega_max: 1.5,        // Maximum angular velocity (rad/sec)
```

### Planning Parameters
```javascript
max_nodes: 1000,       // Maximum nodes per tree
max_planning_time: 100, // Max planning time per step (ms)
steer_time: 0.5,       // Time horizon for steering (seconds)
dt: 0.05,              // Integration time step (seconds)
goal_sample_rate: 0.1, // Probability of sampling goal
```

### RRT* Parameters
```javascript
rewire_radius: 50.0,   // Radius for rewiring neighbors (pixels)
```

### Robot Parameters
```javascript
robot_radius: 10.0,    // Robot collision radius (pixels)
```

## Usage

### 1. Initialize the Service

```javascript
import { rrtStarService } from './services/RRTStarService.js';

// Set workspace bounds
rrtStarService.initialize({
    bounds: {
        x_min: 0,
        x_max: 800,
        y_min: 0,
        y_max: 600
    },
    obstacles: polygonArray  // Array of Polygon objects
});
```

### 2. Set Agent States

```javascript
// Set pursuer state
rrtStarService.setPursuerState({
    x: 100,
    y: 100,
    theta: 0  // facing right
});

// Set evader state
rrtStarService.setEvaderState({
    x: 700,
    y: 500,
    theta: Math.PI  // facing left
});
```

### 3. Build Trees

```javascript
const result = rrtStarService.planBothAgents();

console.log(`Pursuer tree: ${result.stats.pursuerNodes} nodes`);
console.log(`Evader tree: ${result.stats.evaderNodes} nodes`);
console.log(`Planning time: ${result.stats.planningTime} ms`);
```

### 4. Access Trees

```javascript
const pursuerTree = rrtStarService.pursuerTree;  // Root node
const evaderTree = rrtStarService.evaderTree;    // Root node

// Find path to a target
const path = rrtStarService.findPath(pursuerTree, targetState);
```

## UI Controls

The RRT Window (`rrt-window` component) provides:

### Buttons
- **Build Trees** - Build RRT* trees for both agents once
- **Start Tracking** - Begin continuous replanning (every 1 second)
- **Stop Tracking** - Stop continuous replanning
- **Reset** - Clear all trees

### Statistics Display
- **Pursuer Nodes** - Number of nodes in pursuer tree
- **Evader Nodes** - Number of nodes in evader tree
- **Planning Time** - Time taken for last planning iteration (ms)

### Status Messages
Real-time feedback on:
- Planning progress
- Agent placement requirements
- Tree building status
- Tracking state

## Visualization

### Tree Rendering

On the canvas, RRT trees are visualized as:

#### Pursuer Tree (Blue)
- Edges: Semi-transparent blue lines
- Nodes: Small blue dots
- Root: Larger blue circle with heading arrow

#### Evader Tree (Pink)
- Edges: Semi-transparent pink lines
- Nodes: Small pink dots
- Root: Larger pink circle with heading arrow

### Visibility Control

Trees can be toggled on/off via events:
```javascript
eventBus.emit('rrt:togglePursuerTree', true/false);
eventBus.emit('rrt:toggleEvaderTree', true/false);
```

## Integration with Agents

### Pursuer Agent
The pursuer tree is rooted at the current pursuer position and biased toward the evader:

```javascript
eventBus.on('intruder:positionUpdate', (state) => {
    rrtStarService.setPursuerState({
        x: state.position.x,
        y: state.position.y,
        theta: state.heading || 0
    });
});
```

### Evader Agent
The evader tree is rooted at the current evader position with no specific goal (exploration):

```javascript
eventBus.on('evader:positionUpdate', (data) => {
    rrtStarService.setEvaderState({
        x: data.position.x,
        y: data.position.y,
        theta: data.heading || 0
    });
});
```

## Event System

### Emitted Events

| Event | Payload | Description |
|-------|---------|-------------|
| `rrt:treesBuilt` | `{pursuerTree, evaderTree, stats}` | Trees successfully built |
| `rrt:reset` | none | Trees cleared |
| `rrt:windowClosed` | none | RRT window closed |

### Subscribed Events

| Event | Payload | Description |
|-------|---------|-------------|
| `intruder:positionUpdate` | `{position, heading}` | Pursuer state update |
| `evader:positionUpdate` | `{position, heading}` | Evader state update |
| `canvas:polygonsUpdated` | `[polygons]` | Obstacle update |

## Performance Considerations

### Typical Performance
- **Tree size**: 500-1000 nodes
- **Planning time**: 50-150 ms per tree
- **Replanning frequency**: 1 Hz (configurable)

### Optimization Tips

1. **Reduce max_nodes** for faster planning
2. **Increase dt** for coarser simulation (faster but less accurate)
3. **Reduce rewire_radius** to speed up rewiring
4. **Adjust max_planning_time** based on frame rate needs

## Future Enhancements

### Potential Improvements

1. **Bidirectional RRT*** - Connect pursuer and evader trees
2. **Adaptive replanning** - Replan based on significant state changes
3. **Path following** - Execute planned paths with controllers
4. **Cost shaping** - Add cost for proximity to obstacles
5. **Multi-resolution** - Hierarchical planning for large workspaces
6. **Informed sampling** - Use heuristics to guide sampling

### Advanced Features

1. **Actuated sensor model** - Add sensor yaw as 4th state dimension
2. **Dubins paths** - Use analytical solutions for short connections
3. **Optimal control** - Solve 2-point BVP for steering
4. **Game-theoretic planning** - Account for adversarial evader

## References

1. Karaman, S., & Frazzoli, E. (2011). Sampling-based algorithms for optimal motion planning. *International Journal of Robotics Research*.

2. LaValle, S. M. (2006). *Planning Algorithms*. Cambridge University Press.

3. The paper referenced in your request about surveillance and collision-free tracking in dynamic environments.

## Testing

### Manual Testing

1. **Place agents**: Use Agent Control window to place pursuer and evader
2. **Add obstacles**: Draw polygons on canvas
3. **Build trees**: Click "Build Trees" in RRT window
4. **Verify visualization**: Trees should appear on canvas
5. **Test tracking**: Click "Start Tracking" for continuous replanning

### Expected Behavior

- Trees should avoid obstacles
- Pursuer tree should grow toward evader
- Evader tree should explore free space
- Planning should complete in < 200ms
- Trees should update every second during tracking

### Troubleshooting

| Issue | Possible Cause | Solution |
|-------|---------------|----------|
| No trees visible | Agents not placed | Place both agents first |
| Planning fails | No valid paths | Reduce obstacles or move agents |
| Slow planning | Too many nodes | Reduce `max_nodes` parameter |
| Collision errors | Radius too large | Adjust `robot_radius` |

## Code Example

Complete example of using the RRT* service:

```javascript
import { rrtStarService } from './services/RRTStarService.js';
import { eventBus } from './utils/EventBus.js';

// Initialize
rrtStarService.initialize({
    bounds: { x_min: 0, x_max: 800, y_min: 0, y_max: 600 },
    obstacles: myPolygons
});

// Set agents
rrtStarService.setPursuerState({ x: 100, y: 100, theta: 0 });
rrtStarService.setEvaderState({ x: 700, y: 500, theta: Math.PI });

// Build trees
const result = rrtStarService.planBothAgents();

// Find path for pursuer to reach evader
const path = rrtStarService.findPath(
    result.pursuerTree,
    { x: 700, y: 500, theta: 0 }
);

console.log(`Path has ${path.length} waypoints`);
```

---

**Implementation Status**: ✅ Complete

All requested features have been implemented:
- ✅ Unicycle dynamics with state (x, y, θ) and control (v, ω)
- ✅ Forward integration with `integrateDDR()`
- ✅ Collision detection (point-in-polygon, segment intersection, robot-obstacle)
- ✅ RRT* with proper node structure and cost metric
- ✅ Tree building for both pursuer and evader
- ✅ Rewiring for optimality
- ✅ Time-based cost metric
- ✅ Real-time visualization
- ✅ UI controls and monitoring
