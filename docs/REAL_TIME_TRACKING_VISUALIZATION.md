# Real-Time Tracking Visualization

## Overview
The real-time tracking feature now includes full visualization of RRT* trees and highlights the winning nodes selected by the chosen strategy (PL or TMA).

## Features

### 1. **RRT* Tree Visualization**
- **Pursuer Tree**: Displayed in blue (#2196F3)
- **Evader Tree**: Displayed in pink/magenta (#C2185B)
- Trees are automatically shown when tracking starts
- Trees update continuously as the agents move

### 2. **Winning Node Highlights**
Both the pursuer and evader target nodes are highlighted with:
- **Pulsating outer circle**: Animated ring that pulses for visual attention
- **Solid inner circle**: Clear marker of the exact node position
- **White border**: High contrast outline for visibility
- **Text label**: 
  - Pursuer: Shows strategy name (e.g., "TMA P" or "PL P")
  - Evader: Shows "EVADER TARGET"

### 3. **Visual Distinctions**
- **Pursuer winning node**: Blue color, label on the right
- **Evader winning node**: Pink/magenta color, offset pulse animation, label on the right
- Pulsing animations are phase-shifted so they don't pulse together

## Implementation Details

### Service Changes (`RealTimeTrackingService.js`)
```javascript
// Now emits winning node data in the update event
eventBus.emit('realTimeTracking:update', {
    pursuerState: this.pursuerState,
    evaderState: this.evaderState,
    pursuerPath: this.pursuerPath,
    evaderPath: this.evaderPath,
    pursuerTree: this.pursuerTree,        // RRT* tree
    evaderTree: this.evaderTree,          // RRT* tree
    pursuerWinningNode: pursuerWinningNode, // Target node
    evaderWinningNode: evaderWinningNode,   // Target node
    strategy: this.config.strategy,         // 'pl' or 'tma'
    stats: this.stats
});
```

### Canvas Controller Changes (`PolygonCanvasController.js`)

**New Data Structure:**
```javascript
this.realTimeTrackingData = {
    pursuerWinningNode: null,
    evaderWinningNode: null,
    strategy: null
};
```

**New Method:**
- `drawRealTimeTrackingWinningNodes()`: Draws both pursuer and evader winning nodes with pulsating animations and labels

**Event Handlers:**
- `realTimeTracking:update`: Updates trees and winning node data, triggers redraw
- `realTimeTracking:stopped`: Clears visualization data

## Visual Elements

### Tree Rendering
- **Edges**: Semi-transparent lines connecting nodes (40% opacity)
- **Nodes**: Small circles (2px radius) at each tree node (80% opacity)
- **Colors**: Blue for pursuer, Pink for evader

### Winning Node Markers
- **Outer Circle**: 
  - Radius: 15px + 5px sine wave (pulsates between 10-20px)
  - Fill: Semi-transparent color (30% opacity)
- **Inner Circle**:
  - Radius: 10px
  - Fill: Solid color
  - Stroke: White, 3px width
- **Label**:
  - Position: 20px offset to the right of the node
  - Style: Pill-shaped background with text

## User Experience

### During Tracking
1. User places pursuer and evader agents
2. User clicks "Start Tracking"
3. Trees appear immediately in blue (pursuer) and pink (evader)
4. Winning nodes are highlighted with pulsating circles
5. Trees and highlights update every planning cycle (default: 1000ms)

### When Tracking Stops
1. User clicks "Stop Tracking"
2. Trees remain visible on canvas
3. Winning node highlights are cleared
4. Final tree state shows the last planned paths

## Strategy Visualization

### PL (Pursuer Leader)
- Pursuer winning node shows: "PL P"
- Indicates the pursuer's chosen interception point
- Evader typically stays at root (no highlight if index = 0)

### TMA (Two Moves Ahead)
- Pursuer winning node shows: "TMA P"
- Indicates the pursuer's counter-move to evader's predicted escape
- More sophisticated planning is visible in the tree structure

## Performance Considerations

- Trees are redrawn every frame but computation only happens at planning frequency
- Pulsing animation uses `performance.now()` for smooth 60fps animation
- Tree rendering uses BFS traversal with visited set to avoid duplicates
- Winning node highlights are drawn after trees for proper layering

## Future Enhancements

1. **Path Visualization**: Draw the extracted paths from root to winning nodes
2. **Visibility Lines**: Show visibility connections between pursuer and evader nodes
3. **Cost Coloring**: Color nodes by their cost value (gradient from low to high)
4. **Node Tooltips**: Show node information on hover (position, cost, parent)
5. **Trajectory Preview**: Animate the planned motion along the path
6. **Strategy Comparison**: Side-by-side visualization of different strategies

## Code References

- **Service**: `/src/services/RealTimeTrackingService.js` (lines 133-172)
- **Canvas Controller**: `/src/controllers/PolygonCanvasController.js`
  - Event handlers: lines 219-241
  - Draw method: lines 768-775
  - Winning nodes visualization: `drawRealTimeTrackingWinningNodes()`
- **Data structures**: Canvas controller constructor (lines 75-80)
