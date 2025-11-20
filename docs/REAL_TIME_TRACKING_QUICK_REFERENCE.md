# Real-Time Tracking Quick Reference

## 🚀 Quick Start

1. **Open Toolbox** → Click "Real-Time Tracking"
2. **Place Agents** using Agents window (both Pursuer & Evader required)
3. **Configure** parameters (or use defaults)
4. **Click "Start Tracking"**
5. **Watch** autonomous pursuit-evasion unfold!

## ⚙️ Default Configuration

```javascript
RRT* Iterations:      500
Execution Time:       0.1 seconds
Replan Frequency:     1000 ms (1 second)
Strategy:             EL (Evader as Leader)
```

## 🎯 Strategies Explained

| Strategy | Description | When to Use |
|----------|-------------|-------------|
| **PL** | Pursuer as Leader | Aggressive pursuit |
| **EL** | Evader as Leader | Default - balanced |
| **ELST** | Evader Shortest Time | Quick escape focus |
| **TMA** | Two Moves Ahead | Game-theoretic |

## 📊 Key Statistics

- **Iterations**: Number of planning cycles completed
- **Planning Time**: Milliseconds per planning cycle
- **Distance**: Current distance between agents (pixels)
- **Positions**: Real-time (x, y) coordinates

## 🔧 Parameter Tuning

### For Better Paths
- ↑ Increase RRT* Iterations (500 → 1000)
- Watch planning time doesn't exceed replan frequency

### For Faster Response
- ↓ Decrease Execution Time (0.1 → 0.05)
- ↓ Decrease Replan Frequency (1000 → 500)
- ↓ Decrease RRT* Iterations (500 → 300)

### For Complex Environments
- ↑ Increase RRT* Iterations (500 → 1500)
- ↑ Increase Replan Frequency (1000 → 2000)

## 🎮 Controls

| Button | Action |
|--------|--------|
| **Start Tracking** | Begin autonomous tracking |
| **Stop Tracking** | Halt tracking loop |
| **Close (×)** | Hide window (tracking continues if active) |

## ⚡ Performance Tips

1. **Start Simple**: Test with few obstacles first
2. **Monitor Planning Time**: Should be < Replan Frequency
3. **Adjust Parameters**: Based on environment complexity
4. **Use Defaults**: Good starting point for most cases

## 🐛 Troubleshooting

**"Please place both agents first"**
- Use Agents window to place Pursuer and Evader

**Planning time too high**
- Decrease RRT* iterations
- Increase replan frequency
- Simplify environment

**Agents move too fast/slow**
- Adjust execution time step
- Check agent speed settings in Agents window

**No movement**
- Verify both agents are placed
- Check console for errors
- Ensure obstacles are valid polygons

## 📖 Related Features

- **Agents Window**: Place and configure agents
- **Active Tracking**: Compute visibility matrix manually
- **RRT-Based Tracking**: Build and visualize RRT* trees
- **Environment Analysis**: Generate medial axis skeleton

## 💡 Pro Tips

1. **Pre-build Trees**: Open RRT window first to visualize trees
2. **Test Strategies**: Try different strategies to compare behaviors
3. **Save Configurations**: Use browser localStorage (auto-saves parameters)
4. **Complex Scenarios**: Use 1000+ iterations for multi-room environments

## 🔗 Quick Links

- Full Documentation: `docs/REAL_TIME_TRACKING.md`
- Architecture: `docs/ARCHITECTURE.md`
- Event Flow: `docs/EVENT_FLOW.md`
- RRT Guide: `docs/RRT_QUICKSTART.md`

---

**Quick Access**: Toolbox → Real-Time Tracking → Start
