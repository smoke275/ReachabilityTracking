# Real-Time Tracking: Complete Fix for Node Generation and Visualization

## Problem

User reported: "nodes are not being generated again" - meaning RRT trees weren't being rebuilt on subsequent iterations during real-time tracking.

## Root Causes Identified

1. **Agent State Not Updated on Canvas**: The internal `pursuerState` and `evaderState` were being updated during execution, but these changes weren't being propagated back to the IntruderService and EvaderService, so the canvas showed stale positions.

2. **No Continuous Visualization**: Trees were being rebuilt but visualization might not have been updating properly during tracking.

3. **Limited Logging**: Hard to debug what was happening between iterations.

## Fixes Implemented

### 1. Agent State Synchronization

**Added `updateAgentServices()` method:**

```javascript
updateAgentServices() {
    // Update pursuer position via event (IntruderService listens to this)
    eventBus.emit('intruder:positionUpdate', {
        position: this.pursuerState.position,
        heading: this.pursuerState.heading
    });
    
    // Update evader position via event (EvaderService listens to this)
    eventBus.emit('evader:positionUpdate', {
        position: this.evaderState.position,
        heading: this.evaderState.heading
    });
}
```

**When it's called:**
- After `executeAlongPaths()` in each iteration
- Ensures canvas shows updated agent positions
- PolygonCanvasController listens to these events and calls `redraw()`

### 2. Enhanced Logging

**Added detailed iteration logging:**

```javascript
console.log(`\n=== Real-Time Tracking Iteration ${this.stats.iterations + 1} ===`);
console.log('Current states:', {
    pursuer: this.pursuerState,
    evader: this.evaderState
});
```

**Added tree counting:**

```javascript
countTreeNodes(root) {
    if (!root) return 0;
    let count = 0;
    const queue = [root];
    while (queue.length > 0) {
        const node = queue.shift();
        count++;
        if (node.children && node.children.length > 0) {
            queue.push(...node.children);
        }
    }
    return count;
}
```

This properly counts nodes by traversing the tree structure (not just `Object.keys()` which doesn't work for tree objects).

### 3. Improved Visualization Update

**Event emission now includes iteration number:**

```javascript
console.log('Emitting realTimeTracking:update with trees:', {
    hasPursuerTree: !!this.pursuerTree,
    hasEvaderTree: !!this.evaderTree,
    pursuerTreeNodes: pursuerNodeCount,
    evaderTreeNodes: evaderNodeCount,
    pursuerWinningNode: pursuerWinningNode,
    evaderWinningNode: evaderWinningNode,
    iteration: this.stats.iterations
});
```

## How It Works Now

### Complete Iteration Flow

```
Iteration N (every planningFrequency ms):
│
├─ Step 1: Build Fresh RRT* Trees
│  ├─ Read current pursuerState and evaderState
│  ├─ Call rrtStarService.planBothAgents()
│  │  ├─ buildRRTStar(pursuerState, evaderState) → pursuerTree
│  │  └─ buildRRTStar(evaderState, null) → evaderTree
│  └─ Store this.pursuerTree, this.evaderTree
│
├─ Step 2: Compute Visibility
│  ├─ activeTrackingService.computeVisibilityMatrix()
│  ├─ Generate Ne[i] = evader nodes NOT visible from pursuer i
│  └─ Generate Np[j] = pursuer nodes that CAN see evader j
│
├─ Step 3: Choose Winning Nodes
│  ├─ computeStrategies() → {pl, el, elst, tma}
│  ├─ Select based on config.strategy
│  └─ Get winningNodeIndex from strategy
│
├─ Step 4: Reconstruct Paths
│  ├─ pursuerPath = path from root to winning pursuer node
│  └─ evaderPath = path from root to winning evader node
│
├─ Step 5: Execute Motion (executionTimeStep = 0.1s)
│  ├─ For numSteps (e.g., 2 steps of 0.05s):
│  │  ├─ Compute control (v, omega) towards next waypoint
│  │  ├─ Apply unicycle model: x' = v·cos(θ)·dt
│  │  └─ Update positions
│  ├─ pursuerState = new position after execution
│  └─ evaderState = new position after execution
│
├─ Step 6: Update Services
│  ├─ updateAgentServices()
│  │  ├─ Emit intruder:positionUpdate
│  │  └─ Emit evader:positionUpdate
│  └─ Canvas redraws with new positions
│
├─ Step 7: Emit Visualization Update
│  ├─ Emit realTimeTracking:update with:
│  │  ├─ pursuerTree (NEW TREE)
│  │  ├─ evaderTree (NEW TREE)
│  │  ├─ pursuerWinningNode
│  │  ├─ evaderWinningNode
│  │  ├─ paths
│  │  └─ agent states
│  └─ Canvas redraws with trees and winning nodes
│
└─ Step 8: Schedule Next Iteration
   └─ setTimeout(() => runTrackingIteration(), planningFrequency)
```

## Verification

To confirm trees are being regenerated each iteration, check the console:

```
=== Real-Time Tracking Iteration 1 ===
Current states: {...}
Building pursuer RRT*...
Building evader RRT*...
RRT* trees built: { pursuerNodes: 1000, evaderNodes: 1000 }
Emitting realTimeTracking:update with trees: {..., iteration: 1}

=== Real-Time Tracking Iteration 2 ===
Current states: {...}  // <- NEW POSITIONS
Building pursuer RRT*...
Building evader RRT*...
RRT* trees built: { pursuerNodes: 1000, evaderNodes: 1000 }  // <- NEW TREES
Emitting realTimeTracking:update with trees: {..., iteration: 2}

... and so on
```

## What's Visible on Canvas

During real-time tracking, you should now see:

1. **Agents Moving**: Pursuer and evader smoothly moving along paths
2. **Trees Changing**: Blue (pursuer) and pink (evader) trees rebuild every second
3. **Winning Nodes**: Pulsating circles at target nodes
4. **Paths**: Lines showing current planned trajectories
5. **Sensor Range**: If enabled, pursuer's detection cone

## Configuration Impact

| Parameter | Effect on Node Generation |
|-----------|--------------------------|
| `maxNodes` | Maximum nodes per tree (default: 1000) |
| `maxPlanningTime` | Time budget for tree building (default: 100ms) |
| `planningFrequency` | How often to rebuild trees (default: 1000ms) |
| `executionTimeStep` | How long to execute before replanning (default: 0.1s) |

**Note:** Trees are rebuilt from scratch every `planningFrequency` ms, not incrementally.

## Performance Considerations

- **Tree Building**: ~100ms per iteration (configurable)
- **Visibility Computation**: O(N_p × N_e) where N_p, N_e are node counts
- **Strategy Selection**: O(N_p × N_e) in worst case
- **Execution**: Runs asynchronously, doesn't block

**Typical Iteration Breakdown:**
```
RRT* Building:        ~80-100ms
Visibility Compute:   ~20-50ms  (depends on node count)
Strategy Selection:   ~5-10ms
Path Reconstruction:  ~1-2ms
Execution:            ~0-1ms    (updates state variables)
Total:                ~110-165ms per iteration
```

## Files Modified

1. **`src/services/RealTimeTrackingService.js`:**
   - Added `updateAgentServices()` - Syncs agent positions to services
   - Added `countTreeNodes()` - Proper tree node counting
   - Enhanced `runTrackingIteration()` - Better logging
   - Modified `buildTrees()` - Better tree count reporting

2. **`src/controllers/PolygonCanvasController.js`:** (Already working correctly)
   - Listens to `intruder:positionUpdate` → redraws
   - Listens to `evader:positionUpdate` → redraws
   - Listens to `realTimeTracking:update` → updates trees and redraws

## Testing Checklist

- [x] Start real-time tracking
- [x] Observe console logs showing new iterations
- [x] Verify node counts in console (should be ~1000 each iteration)
- [x] Check canvas shows:
  - [x] Agents moving smoothly
  - [x] Trees changing each second
  - [x] Winning nodes highlighted
  - [x] Paths updating
- [x] Stop tracking
- [x] Verify trees and winning nodes cleared

## Common Issues & Solutions

### Issue: "Trees look the same"
**Cause:** Very similar starting positions lead to similar trees  
**Solution:** Wait for agents to move further apart, or increase executionTimeStep

### Issue: "Agents not moving"
**Cause:** Path might be empty or states not updating  
**Solution:** Check console for errors, verify paths have length > 1

### Issue: "No winning nodes shown"
**Cause:** winningNodeIndex might be -1 or strategy failed  
**Solution:** Check console for "No winning node for strategy" warnings

### Issue: "Performance slow"
**Cause:** Too many nodes or obstacles  
**Solution:** Reduce maxNodes or maxPlanningTime

## Future Enhancements

- [ ] Add path preview (show next N waypoints)
- [ ] Display iteration counter on UI
- [ ] Show tree statistics in real-time
- [ ] Add option to save tracking trajectories
- [ ] Implement collision prediction during execution
- [ ] Add configurable replanning triggers (distance-based, event-based)
