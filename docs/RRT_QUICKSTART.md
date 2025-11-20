# RRT* Tracking - Quick Start Guide

## 🚀 Quick Start (3 Steps)

### Step 1: Place Agents
1. Click the **"Agents"** button in the toolbar
2. In the Agent Control window:
   - Click **"Place Pursuer"** → Click anywhere on canvas
   - Click **"Place Evader"** → Click anywhere on canvas
3. You should see two agents appear on the canvas

### Step 2: Build Trees
1. Click the **"RRT Tracking"** button in the toolbar
2. In the RRT* Tracking window:
   - Click **"Build Trees"**
3. Wait 100-200ms for trees to build
4. You should see:
   - Blue tree from pursuer (with many branches)
   - Pink tree from evader (with many branches)
   - Statistics showing node counts

### Step 3: Track (Optional)
1. Click **"Start Tracking"** to continuously replan
2. Move agents with arrow keys:
   - In Agent Control window, click **"Select Pursuer"** or **"Select Evader"**
   - Use arrow keys to move selected agent
   - Trees will rebuild every 1 second

## 📋 Expected Console Output

When everything works correctly, you should see:

```
Pursuer state set: {x: 300, y: 200, theta: 0}
Evader state set: {x: 500, y: 400, theta: 0}
buildTrees called
Pursuer state: {x: 300, y: 200, theta: 0}
Evader state: {x: 500, y: 400, theta: 0}
Canvas bounds set: {x_min: 0, x_max: 800, y_min: 0, y_max: 600}
RRT: Updated obstacles, count: 0
Obstacles: 0
Building pursuer RRT*...
Built RRT* tree: 487 nodes in 45.20ms
Building evader RRT*...
Built RRT* tree: 512 nodes in 48.35ms
Planning complete: {pursuerNodes: 487, evaderNodes: 512, planningTime: 93.55}
```

## 🎨 What You Should See

### On Canvas:
- **Pursuer (Blue):**
  - Blue circular agent with white arrow showing heading
  - Label: "PURSUER"
  - Blue RRT* tree with many branches

- **Evader (Pink):**
  - Pink/magenta circular agent with white arrow
  - Label: "EVADER"
  - Pink RRT* tree with many branches

- **Trees:**
  - Semi-transparent edges connecting nodes
  - Small dots at each node
  - Larger dot at root (agent position)
  - Arrow showing agent heading direction

### In RRT Window:
- Statistics showing:
  - Pursuer Nodes: ~500
  - Evader Nodes: ~500
  - Planning Time: ~100ms

## 🎯 Features

### Unicycle Dynamics
- Agents respect differential drive robot (DDR) kinematics
- Cannot turn in place
- Smooth curved trajectories

### Collision Avoidance
- Trees avoid polygon obstacles
- Agents stay within canvas bounds
- Configurable robot radius (default: 10 pixels)

### RRT* Optimality
- Rewiring for better paths
- Cost metric: minimum time
- Biased sampling toward goal (pursuer only)

## 🛠️ Configuration

### Fast Planning (Testing)
Edit `src/services/RRTStarService.js`, constructor:

```javascript
max_nodes: 300,          // Fewer nodes → faster
max_planning_time: 50,   // Less time → faster
```

### High Quality (Production)
```javascript
max_nodes: 2000,         // More nodes → better coverage
max_planning_time: 200,  // More time → more optimality
```

### Agent Speed
```javascript
v_max: 10.0,    // Linear velocity (pixels/sec)
omega_max: 1.5, // Angular velocity (rad/sec)
```

## 🐛 Troubleshooting

### "Failed to build trees"
- **Cause:** Agents not placed
- **Fix:** Use Agent Control window to place both agents

### Trees not visible
- **Cause:** Trees outside viewport or behind other viz
- **Fix:** Pan/zoom canvas, or disable other overlays

### Planning too slow
- **Cause:** Too many nodes or obstacles
- **Fix:** Reduce `max_nodes` in RRTStarService.js

### Console error "has already been declared"
- **Cause:** Duplicate import fixed
- **Fix:** Refresh page (Ctrl+Shift+R)

## 📚 Documentation

- **Full Implementation:** `docs/RRT_IMPLEMENTATION.md`
- **API Reference:** `docs/RRT_QUICK_REFERENCE.md`
- **Troubleshooting:** `docs/RRT_TROUBLESHOOTING.md`

## 🎮 Keyboard Controls

After selecting an agent in Agent Control window:
- **↑ Up Arrow:** Move forward
- **↓ Down Arrow:** Move backward
- **← Left Arrow:** Turn left
- **→ Right Arrow:** Turn right

## ⚡ Performance Tips

1. **Start without obstacles** - Test basic functionality first
2. **Use "Build Trees" first** - Don't immediately use "Start Tracking"
3. **Watch console** - Check for errors or warnings
4. **Reduce nodes if slow** - 300-500 nodes is usually sufficient
5. **Stop tracking before moving** - Pause auto-replanning when testing

## 🌟 Advanced Usage

### Adding Obstacles
1. Click "Start Drawing" in toolbar
2. Click points to create polygon
3. Press Enter to complete
4. Rebuild trees to avoid new obstacles

### Biased Sampling
- Pursuer tree samples toward evader 10% of the time
- Evader tree explores randomly (no goal)
- Adjust `goal_sample_rate` in config (0.0 to 1.0)

### Path Extraction
```javascript
// Get path from pursuer to evader
const path = rrtStarService.findPath(
    rrtStarService.pursuerTree,
    rrtStarService.evaderState
);
console.log('Path:', path); // Array of {x, y, theta}
```

---

**Enjoy your RRT* pursuit-evasion simulation!** 🎉
