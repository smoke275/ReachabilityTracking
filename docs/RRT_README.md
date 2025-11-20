# RRT* Unicycle Dynamics Implementation

Complete implementation of RRT* (Rapidly-exploring Random Tree Star) with unicycle dynamics for pursuit-evasion scenarios.

## 🎯 Features

### Core Algorithm
- ✅ RRT* with optimality guarantees (rewiring)
- ✅ Unicycle (differential drive) dynamics
- ✅ Collision detection with polygon obstacles
- ✅ Time-based cost metric
- ✅ Dual-tree planning (pursuer & evader)

### Dynamics Model
```
State: (x, y, θ)
Control: (v, ω)
Kinematics:
  ẋ = v·cos(θ)
  ẏ = v·sin(θ)  
  θ̇ = ω
```

### Collision Checking
- Point-in-polygon (ray casting)
- Segment-polygon intersection
- Robot-obstacle collision (circular footprint)
- Workspace bounds enforcement

## 📚 Documentation

1. **[Quick Start Guide](RRT_QUICKSTART.md)** - Get started in 3 steps
2. **[Troubleshooting](RRT_TROUBLESHOOTING.md)** - Common issues and solutions
3. **[Implementation Summary](RRT_SUMMARY.md)** - Complete technical overview

## 🚀 Quick Start

```bash
# 1. Start the application
npm run dev

# 2. In the browser:
#    - Click "Agents" → Place Pursuer → Click canvas
#    - Click "Agents" → Place Evader → Click canvas
#    - Click "RRT Tracking" → Build Trees

# 3. Watch the trees grow!
```

## 🎮 Usage

### Basic Flow
1. Draw polygon obstacles (optional)
2. Place pursuer agent
3. Place evader agent
4. Build RRT* trees
5. Optionally enable continuous tracking

### Keyboard Controls
- After selecting an agent, use arrow keys:
  - ↑ Forward
  - ↓ Backward
  - ← Turn left
  - → Turn right

## ⚙️ Configuration

Edit `src/services/RRTStarService.js`:

```javascript
this.config = {
    v_max: 10.0,            // Max linear velocity
    omega_max: 1.5,         // Max angular velocity
    max_nodes: 1000,        // Nodes per tree
    max_planning_time: 100, // Planning time limit (ms)
    steer_time: 0.5,        // Steering time horizon
    dt: 0.05,               // Integration time step
    robot_radius: 10.0,     // Collision radius
    rewire_radius: 50.0     // RRT* rewire radius
};
```

## 📊 Performance

| Nodes | Planning Time |
|-------|---------------|
| 300   | ~40 ms        |
| 500   | ~65 ms        |
| 1000  | ~120 ms       |
| 2000  | ~250 ms       |

*Tested on modern CPU, may vary with obstacles*

## 🎨 Visualization

- **Blue tree**: Pursuer (biased toward evader)
- **Pink tree**: Evader (random exploration)
- Semi-transparent edges and nodes
- Root nodes highlighted with heading arrows

## 🔧 Files

### Core Implementation
- `src/services/RRTStarService.js` - Main RRT* service
- `src/components/RRTWindow.js` - UI component
- `src/controllers/PolygonCanvasController.js` - Visualization

### Documentation
- `docs/RRT_QUICKSTART.md` - Getting started
- `docs/RRT_TROUBLESHOOTING.md` - Problem solving  
- `docs/RRT_SUMMARY.md` - Technical details

## 🐛 Troubleshooting

### Trees not building?
- Check console for "Pursuer state set" and "Evader state set"
- Ensure both agents are placed
- Try refreshing the page

### Trees not visible?
- Check if trees are enabled in settings
- Try zooming out on the canvas
- Disable other visualization overlays

### Planning too slow?
- Reduce `max_nodes` (try 500 or 300)
- Reduce number of obstacles
- Increase `dt` time step

See [RRT_TROUBLESHOOTING.md](RRT_TROUBLESHOOTING.md) for more help.

## 📖 References

### Algorithm
- Karaman, S., & Frazzoli, E. (2011). "Sampling-based algorithms for optimal motion planning." IJRR.
- LaValle, S. M. (2006). "Planning Algorithms." Cambridge University Press.

### Unicycle Model
- Also known as "Differential Drive Robot" (DDR)
- Common kinematic model in mobile robotics

### Implementation
- JavaScript/ES6 modules
- Web Components (custom elements)
- Material Design 3
- Event-driven architecture

## ✨ Future Work

- [ ] Path smoothing
- [ ] Velocity profiling
- [ ] Capture/escape detection
- [ ] Multi-agent scenarios
- [ ] Dynamic obstacles
- [ ] GPU acceleration

## 📝 License

Part of the ReachabilityTracking project.

## 🙏 Acknowledgments

Implements algorithms from pursuit-evasion and motion planning literature, adapted for web-based visualization.

---

**Happy Planning!** 🌳🤖
