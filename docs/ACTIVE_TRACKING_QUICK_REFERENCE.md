# Active Tracking - Quick Reference

## What is Active Tracking?

Active Tracking implements visibility-based pursuit-evasion tracking using RRT* trees and sensor models. It computes which evader nodes are visible/hidden from each pursuer node.

## Key Concepts

### Ne (Non-visible Set)
`Ne[i]` = Evader nodes that pursuer node `i` **cannot** see

### Np (Tracking Set)  
`Np[j]` = Pursuer nodes that **can** see evader node `j`

## Quick Start

1. **Place Agents**: Put pursuer and evader on canvas
2. **Build Trees**: Open RRT window → Click "Build Trees"
3. **Compute Visibility**: Open Active Tracking window → Click "Compute Visibility Matrix"
4. **Query**: Enter node index → Click "Query Ne" or "Query Np"

## Main Features

✅ Compute visibility matrix for all node pairs  
✅ Query non-visible evader nodes (Ne)  
✅ Query tracking pursuer nodes (Np)  
✅ Real-time statistics and metrics  
✅ Export visibility data for analysis  

## Statistics Tracked

- **Visibility Ratio**: % of node pairs with line-of-sight
- **Compute Time**: Processing time in milliseconds
- **Average Ne Size**: Avg blind spots per pursuer node
- **Average Np Size**: Avg trackers per evader node

## Files Added

```
src/services/ActiveTrackingService.js    - Core visibility computation
src/components/ActiveTrackingWindow.js   - UI component
docs/ACTIVE_TRACKING.md                  - Full documentation
```

## Integration Points

- **RRTStarService**: Provides RRT* trees
- **SensorModelService**: Visibility checking with FOV/range/LOS
- **App**: Coordinates all services
- **ToolboxSection**: Added "Active Tracking" button

## Algorithm

```
For each pursuer node i:
    For each evader node j:
        if canSee(i, j):
            Np[j].add(i)      // j is visible from i
        else:
            Ne[i].add(j)      // j is not visible from i
```

## Use Cases

1. **Optimal Tracking**: Find paths where pursuer maintains visibility
2. **Evasion Planning**: Identify blind spots for evader
3. **Coverage Analysis**: Measure surveillance effectiveness
4. **Strategy Validation**: Test pursuit-evasion strategies

## Example Query Results

```
Ne[15] = [3, 7, 12, 45, 89, ...] (127 nodes)
→ From pursuer node 15, these 127 evader nodes are hidden

Np[42] = [1, 5, 18, 23, ...] (34 nodes)  
→ These 34 pursuer nodes can see evader node 42
```

## Performance

- **Small trees** (100 nodes): ~100ms
- **Medium trees** (500 nodes): ~1-2s
- **Large trees** (1000 nodes): ~5-10s

## Tips

💡 Build trees with obstacles for realistic visibility constraints  
💡 Adjust sensor parameters (R_max, FOV) before computing visibility  
💡 Use query tools to explore visibility relationships  
💡 Export data for offline analysis and visualization  

## Next Steps

After computing visibility:
1. Analyze blind spots for evasion strategies
2. Plan optimal tracking paths using Np sets
3. Validate pursuit-evasion game strategies
4. Export data for further research

---

**Full Documentation**: See `docs/ACTIVE_TRACKING.md`
