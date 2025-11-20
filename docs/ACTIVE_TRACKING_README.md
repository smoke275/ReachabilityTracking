# Active Tracking Feature

## 🎯 Overview

The **Active Tracking** feature implements visibility-based pursuit-evasion tracking using RRT* trees and sensor models. Based on the paper "Surveillance and Collision-Free Tracking", it computes which evader nodes are visible or hidden from each pursuer node, enabling optimal tracking and evasion strategies.

## 📋 Key Concepts

### Ne (Non-visible Evader Set)
Set of evader nodes that a pursuer node **cannot** see:
```
Ne(n_i^p) = {n_j^e ∈ RRT_e* ∖ V(n_i^p)}
```

### Np (Tracking Pursuer Set)
Set of pursuer nodes that **can** see an evader node:
```
Np(n_j^e) = {n_i^p ∈ RRT_p* | n_j^e ∈ V(n_i^p)}
```

## 🚀 Quick Start

### 1. Setup
- Draw obstacles on canvas
- Place pursuer agent (👮)
- Place evader agent (🏃)

### 2. Build RRT Trees
- Open **"RRT-Based Tracking"** window
- Click **"Build Trees"**
- Wait for tree construction to complete

### 3. Compute Visibility
- Open **"Active Tracking"** window from Toolbox
- Click **"Compute Visibility Matrix"**
- View progress and statistics

### 4. Query & Analyze
- **Query Ne**: Find blind spots for any pursuer node
- **Query Np**: Find trackers for any evader node
- **Export**: Save visibility data for analysis

## ✨ Features

✅ **Visibility Matrix Computation** - Check all pursuer-evader node pairs  
✅ **Ne/Np Set Generation** - Build non-visible and tracking sets  
✅ **Real-time Statistics** - Monitor computation progress and results  
✅ **Interactive Queries** - Explore visibility relationships  
✅ **Data Export** - Save results for offline analysis  
✅ **Sensor Integration** - Uses FOV, range, and line-of-sight constraints  

## 📊 Statistics Tracked

| Metric | Description |
|--------|-------------|
| **Visibility Ratio** | Percentage of visible node pairs |
| **Compute Time** | Time to compute full matrix (ms) |
| **Avg Ne Size** | Average blind spots per pursuer |
| **Avg Np Size** | Average trackers per evader |
| **Total Pairs** | Total node combinations checked |

## 🏗️ Architecture

```
User Interface (ActiveTrackingWindow)
            ↓
   Event Bus (eventBus)
            ↓
  Core Service (ActiveTrackingService)
            ↓
  ┌─────────────────────────┐
  │  RRTStarService         │  → Provides trees
  │  SensorModelService     │  → Visibility checking
  │  Obstacles              │  → Collision detection
  └─────────────────────────┘
```

## 📁 Files

### Core Implementation
- **`src/services/ActiveTrackingService.js`** - Visibility computation engine
- **`src/components/ActiveTrackingWindow.js`** - User interface

### Integration
- **`src/app.js`** - Service coordination
- **`src/components/ToolboxSection.js`** - UI button
- **`src/styles.css`** - Window styling

### Documentation
- **`docs/ACTIVE_TRACKING.md`** - Full documentation
- **`docs/ACTIVE_TRACKING_QUICK_REFERENCE.md`** - Quick guide
- **`docs/ACTIVE_TRACKING_SUMMARY.md`** - Implementation summary
- **`docs/ACTIVE_TRACKING_ARCHITECTURE.md`** - System architecture

## 🔍 Usage Examples

### Example 1: Find Blind Spots
```javascript
// Query pursuer node 15
Ne[15] = [3, 7, 12, 45, 89, ...] (127 nodes)
// Result: 127 evader nodes are hidden from pursuer node 15
```

### Example 2: Find Trackers
```javascript
// Query evader node 42
Np[42] = [1, 5, 18, 23, ...] (34 nodes)
// Result: 34 pursuer nodes can see evader node 42
```

### Example 3: Analyze Coverage
```javascript
Statistics: {
    visibilityRatio: 0.18  // 18% of pairs are visible
    // → 82% of positions offer hiding spots
}
```

## ⚡ Performance

| Tree Size | Computation Time | Memory Usage |
|-----------|------------------|--------------|
| 100 nodes | ~100 ms | < 1 MB |
| 500 nodes | ~1-2 sec | < 10 MB |
| 1000 nodes | ~5-10 sec | < 50 MB |

**Complexity**: O(n_p × n_e × k) where k = number of obstacles

## 🎓 Applications

### 1. Optimal Tracking
Use Np sets to plan pursuer paths that maintain visibility of evader.

### 2. Evasion Planning
Use Ne sets to identify blind spots where evader can hide from pursuer.

### 3. Coverage Analysis
Measure surveillance effectiveness and identify gaps in coverage.

### 4. Strategy Validation
Test and validate pursuit-evasion game strategies with realistic constraints.

## 🛠️ Technical Details

### Visibility Criteria
A pursuer can see an evader if:
1. **Distance**: R_min < distance < R_max
2. **FOV**: Target within field of view angle
3. **LOS**: No obstacles block the line of sight

### Data Structures
```javascript
visibilityMatrix[i][j]: boolean  // Can pursuer i see evader j?
Ne[i]: Array<number>             // Evader indices not visible from i
Np[j]: Array<number>             // Pursuer indices that can see j
```

## 📖 Documentation

- **[Full Documentation](docs/ACTIVE_TRACKING.md)** - Complete guide with algorithm details
- **[Quick Reference](docs/ACTIVE_TRACKING_QUICK_REFERENCE.md)** - Fast lookup guide
- **[Architecture](docs/ACTIVE_TRACKING_ARCHITECTURE.md)** - System design diagrams
- **[Summary](docs/ACTIVE_TRACKING_SUMMARY.md)** - Implementation overview

## 🧪 Testing

### Basic Test
1. Create simple environment with 1-2 obstacles
2. Place agents with clear line of sight
3. Build small trees (100 nodes)
4. Compute visibility and verify high visibility ratio

### Advanced Test
1. Create complex environment with many obstacles
2. Place agents with obstructed view
3. Build large trees (500-1000 nodes)
4. Query Ne/Np and verify results make sense

## 🚧 Future Enhancements

- [ ] Canvas visualization of visibility lines
- [ ] Interactive node selection and highlighting
- [ ] Real-time tracking using visibility data
- [ ] Multi-agent support (multiple pursuers/evaders)
- [ ] Incremental visibility updates
- [ ] Spatial indexing for faster queries
- [ ] Strategy synthesis algorithms

## 🤝 Integration with Other Features

| Feature | Integration |
|---------|-------------|
| **RRT Tracking** | Provides tree structures |
| **Sensor Model** | Visibility checking logic |
| **Agents** | Pursuer/evader placement |
| **Canvas** | Obstacle information |
| **Analysis** | Environment understanding |

## 💡 Tips

- 💡 Build trees with realistic obstacles for meaningful results
- 💡 Adjust sensor parameters (R_max, FOV) before computing
- 💡 Use query tools to understand visibility patterns
- 💡 Export data for offline analysis and visualization
- 💡 Start with small trees to understand the feature

## ⚠️ Troubleshooting

**"RRT trees not available"**
→ Build RRT trees first before computing visibility

**Computation is slow**
→ Reduce max_nodes in RRT settings or simplify obstacles

**Visibility ratio is very high (>50%)**
→ Check sensor range parameters, may be too permissive

## 📝 License

Part of the Reachability Tracking project.

## 📧 Support

See main project README for support information.

---

**Ready to Track?** Open the Active Tracking window and start exploring visibility relationships! 🎯
