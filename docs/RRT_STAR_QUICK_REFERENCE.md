# RRT* Quick Reference

## Quick Start

1. **Open RRT Window**: Click "RRT Tracking" in the toolbar
2. **Place Agents**: Use Agent Control window to place pursuer and evader
3. **Build Trees**: Click "Build Trees" button
4. **View Trees**: Blue tree (pursuer), Pink tree (evader)
5. **Start Tracking**: Click "Start Tracking" for continuous replanning

## Key Concepts

### Unicycle Dynamics
- **State**: (x, y, θ) - position and heading
- **Control**: (v, ω) - linear and angular velocity
- **Equations**: ẋ = v·cos(θ), ẏ = v·sin(θ), θ̇ = ω

### RRT* Features
- **Random sampling** in free space
- **Nearest neighbor** search
- **Steering** with unicycle dynamics
- **Collision checking** at each step
- **Rewiring** for optimal paths
- **Cost metric**: time (seconds)

## Default Parameters

```javascript
v_max: 10.0,           // Max linear velocity (pixels/sec)
omega_max: 1.5,        // Max angular velocity (rad/sec)
max_nodes: 1000,       // Max nodes per tree
steer_time: 0.5,       // Steering duration (seconds)
dt: 0.05,              // Integration step (seconds)
rewire_radius: 50.0,   // Rewiring radius (pixels)
robot_radius: 10.0,    // Collision radius (pixels)
```

## API Usage

### Initialize
```javascript
import { rrtStarService } from './services/RRTStarService.js';

rrtStarService.initialize({
    bounds: { x_min: 0, x_max: 800, y_min: 0, y_max: 600 },
    obstacles: polygonArray
});
```

### Set States
```javascript
rrtStarService.setPursuerState({ x: 100, y: 100, theta: 0 });
rrtStarService.setEvaderState({ x: 700, y: 500, theta: Math.PI });
```

### Build Trees
```javascript
const result = rrtStarService.planBothAgents();
// Returns: { pursuerTree, evaderTree, stats }
```

### Find Path
```javascript
const path = rrtStarService.findPath(tree, targetState);
// Returns: [{x, y, theta}, ...]
```

## Events

### Emit
- `rrt:treesBuilt` - Trees completed
- `rrt:reset` - Trees cleared

### Listen
- `intruder:positionUpdate` - Pursuer moved
- `evader:positionUpdate` - Evader moved
- `canvas:polygonsUpdated` - Obstacles changed

## Collision Functions

### Point in Polygon
```javascript
pointInPolygon({x, y}, polygon)
// Returns: boolean
```

### Segment-Polygon Intersection
```javascript
segmentIntersectsPolygon({start, end}, polygon)
// Returns: boolean
```

### Robot-Obstacles Collision
```javascript
robotCollidesWithObstacles(x, y, radius, obstacles)
// Returns: boolean
```

## UI Elements

### RRT Window
- **Build Trees** - Single planning iteration
- **Start/Stop Tracking** - Continuous replanning (1 Hz)
- **Reset** - Clear all trees
- **Statistics** - Node counts and timing

### Visualization
- **Blue tree** - Pursuer (goal-directed)
- **Pink tree** - Evader (exploratory)
- **Larger circles** - Root nodes
- **Arrows** - Heading indicators

## Common Tasks

### Adjust Planning Speed
```javascript
rrtStarService.config.max_nodes = 500;  // Fewer nodes = faster
rrtStarService.config.dt = 0.1;         // Larger step = faster
```

### Change Robot Size
```javascript
rrtStarService.config.robot_radius = 15.0;  // Bigger robot
```

### Modify Dynamics
```javascript
rrtStarService.config.v_max = 15.0;      // Faster movement
rrtStarService.config.omega_max = 2.0;   // Sharper turns
```

### Adjust Replanning Rate
```javascript
// In RRTWindow.startTracking():
this.planningInterval = setInterval(() => {
    this.buildTrees();
}, 500);  // Replan every 0.5 seconds instead of 1 second
```

## Performance Tips

1. **Reduce nodes** for real-time performance
2. **Increase dt** for coarser but faster simulation
3. **Smaller rewire_radius** speeds up rewiring
4. **Limit planning time** with `max_planning_time`
5. **Use goal-biased sampling** for pursuer (already implemented)

## Troubleshooting

| Problem | Solution |
|---------|----------|
| No trees appear | Ensure both agents are placed |
| Planning too slow | Reduce `max_nodes` or increase `dt` |
| Trees collide with obstacles | Check `robot_radius` is appropriate |
| Pursuer doesn't reach evader | Increase `max_nodes` or `rewire_radius` |
| Tracking stutters | Reduce replanning frequency |

## File Locations

- **Service**: `src/services/RRTStarService.js`
- **UI**: `src/components/RRTWindow.js`
- **Visualization**: `src/controllers/PolygonCanvasController.js`
- **Documentation**: `docs/RRT_STAR_IMPLEMENTATION.md`

## Related Components

- **Agent Control** - Place and move agents
- **Polygon Canvas** - Draw obstacles
- **Visibility Analysis** - Compute visibility polygons
- **Evader Simulation** - Evader movement on medial axis

## Next Steps

1. ✅ **Basic Implementation** - Complete
2. 🔄 **Path Following** - Execute planned paths
3. 🔄 **Adaptive Replanning** - Smart update triggers
4. 🔄 **Bidirectional Trees** - Connect pursuer/evader
5. 🔄 **Game-Theoretic** - Adversarial planning

---

For detailed information, see `docs/RRT_STAR_IMPLEMENTATION.md`
