# Active Tracking Implementation

## Overview

The Active Tracking module implements the visibility-based tracking algorithm from the paper "Surveillance and Collision-Free Tracking" for pursuit-evasion games. It computes visibility relationships between RRT* nodes of the pursuer and evader agents using sensor model constraints.

## Mathematical Foundation

### Visibility Sets

The algorithm computes two key sets based on the RRT* trees:

1. **Ne(n_i^p)**: Set of evader nodes NOT visible from pursuer node i
   ```
   Ne(n_i^p) = {n_j^e ∈ RRT_e* ∖ V(n_i^p)}
   ```
   where V(n_i^p) is the visibility region of pursuer node i.

2. **Np(n_j^e)**: Set of pursuer nodes that CAN see evader node j
   ```
   Np(n_j^e) = {n_i^p ∈ RRT_p* | n_j^e ∈ V(n_i^p)}
   ```

### Visibility Checking

For each pair of pursuer and evader nodes, visibility is determined by:

1. **Distance constraints**: Target must be within sensor range (R_min < distance < R_max)
2. **Field of view (FOV)**: Target must be within sensor's angular coverage
3. **Line-of-sight (LOS)**: No obstacles block the direct line between agents

## Implementation

### Core Components

#### 1. ActiveTrackingService (`src/services/ActiveTrackingService.js`)

Main service that computes and manages visibility relationships.

**Key Methods:**

- `computeVisibilityMatrix(pursuerTree, evaderTree)`: Computes visibility for all node pairs
- `getNonVisibleEvaderNodes(pursuerNodeIndex)`: Returns Ne[i]
- `getTrackingPursuerNodes(evaderNodeIndex)`: Returns Np[j]
- `canTrack(pursuerNodeIndex, evaderNodeIndex)`: Checks if specific pair is visible
- `findNearestTrackingNode(evaderState)`: Finds closest pursuer node that can see evader

**Data Structures:**

```javascript
// Visibility matrix: visible_p_e[i][j] = can pursuer i see evader j
this.visibilityMatrix = Array(numPursuer).fill(null).map(() => 
    Array(numEvader).fill(false)
);

// Ne[i] = array of evader node indices not visible from pursuer node i
this.Ne = Array(numPursuer).fill(null).map(() => []);

// Np[j] = array of pursuer node indices that can see evader node j
this.Np = Array(numEvader).fill(null).map(() => []);
```

#### 2. ActiveTrackingWindow (`src/components/ActiveTrackingWindow.js`)

UI component for visualization and control.

**Features:**

- Compute visibility matrix button
- Real-time statistics display
- Query tools for Ne and Np sets
- Visualization toggles
- Export functionality for analysis

### Integration

The Active Tracking service integrates with:

1. **RRTStarService**: Uses RRT* trees for node information
2. **SensorModelService**: Uses sensor parameters and visibility checking
3. **App**: Coordinates with main application and canvas

## Usage

### Step 1: Build RRT Trees

1. Place pursuer and evader agents on canvas
2. Open "RRT-Based Tracking" window
3. Click "Build Trees" to generate RRT* trees

### Step 2: Compute Visibility Matrix

1. Open "Active Tracking" window from Toolbox
2. Click "Compute Visibility Matrix"
3. Wait for computation to complete

The service will:
- Extract all nodes from both trees
- Check visibility for each node pair
- Build Ne and Np sets
- Display statistics

### Step 3: Query Visibility

**Query Ne (non-visible evader nodes):**
1. Enter pursuer node index
2. Click "Query Ne"
3. View list of evader nodes not visible from that pursuer node

**Query Np (tracking pursuer nodes):**
1. Enter evader node index
2. Click "Query Np"
3. View list of pursuer nodes that can see that evader node

### Step 4: Export Data

Click "Export Visibility Data" to save:
- Visibility matrix
- Ne and Np sets
- Node states
- Statistics

## Statistics

The service tracks:

- **Total Pursuer Nodes**: Number of nodes in pursuer tree
- **Total Evader Nodes**: Number of nodes in evader tree
- **Total Pairs**: Total node combinations checked
- **Visible Pairs**: Number of visible node pairs
- **Visibility Ratio**: Percentage of visible pairs
- **Compute Time**: Time taken for visibility computation (ms)
- **Avg Non-Visible Evader Nodes**: Average size of Ne sets
- **Avg Tracking Pursuer Nodes**: Average size of Np sets

## Algorithm Details

### Visibility Matrix Computation

```javascript
// For each pursuer node i
for (let i = 0; i < numPursuer; i++) {
    // For each evader node j
    for (let j = 0; j < numEvader; j++) {
        // Check visibility using sensor model
        const isVisible = canSeeNode(pursuerNodes[i], evaderNodes[j]);
        visibilityMatrix[i][j] = isVisible;
        
        if (isVisible) {
            // j is visible from i, add i to Np[j]
            Np[j].push(i);
        } else {
            // j is not visible from i, add j to Ne[i]
            Ne[i].push(j);
        }
    }
}
```

### Complexity

- **Time**: O(n_p × n_e × c) where:
  - n_p = number of pursuer nodes
  - n_e = number of evader nodes
  - c = cost of visibility check (O(obstacles))
  
- **Space**: O(n_p × n_e) for visibility matrix

### Performance Optimization

For large trees (1000+ nodes each):
- Progress logging every 100 pursuer nodes
- Efficient obstacle checking via ray casting
- Reusable sensor model service

## Applications

### 1. Optimal Tracking Path Planning

Use Np sets to find paths where pursuer maintains visibility:
```javascript
// Find pursuer nodes that can track evader's current position
const trackingNodes = findNearestTrackingNode(evaderState);
```

### 2. Evasion Strategy

Use Ne sets to identify blind spots:
```javascript
// For pursuer at node i, find evader nodes it cannot see
const blindSpots = getNonVisibleEvaderNodes(pursuerNodeIndex);
```

### 3. Coverage Analysis

Analyze visibility coverage:
```javascript
const stats = getStats();
console.log(`Visibility coverage: ${stats.visibilityRatio * 100}%`);
```

## Event System

The service emits:

```javascript
eventBus.emit('activeTracking:visibilityComputed', {
    visibilityMatrix,
    Ne,
    Np,
    pursuerNodes,
    evaderNodes,
    stats
});
```

Listen for:
```javascript
eventBus.on('rrt:requestTrees', callback);
eventBus.on('activeTracking:highlightNode', data);
eventBus.on('activeTracking:toggleVisualization', settings);
```

## Example Output

```
Computing visibility matrix: 500 pursuer nodes × 500 evader nodes
Visibility computation: 100/500 pursuer nodes processed
Visibility computation: 200/500 pursuer nodes processed
...
Visibility computation complete: {
    totalPursuerNodes: 500,
    totalEvaderNodes: 500,
    totalPairs: 250000,
    visiblePairs: 45000,
    visibilityRatio: 0.18,
    visibilityComputeTime: 1234.56,
    averageNonVisibleEvaderNodes: 410,
    averageTrackingPursuerNodes: 90
}
```

## Troubleshooting

### "RRT trees not available"
- Ensure both pursuer and evader are placed
- Build RRT trees before computing visibility

### Slow computation
- Reduce `max_nodes` in RRT configuration
- Simplify obstacle environment
- Consider sparse sampling

### High visibility ratio (>50%)
- Check sensor range parameters (R_max may be too large)
- Verify FOV settings
- Ensure obstacles are properly loaded

## Future Enhancements

1. **Incremental Updates**: Update visibility only for changed nodes
2. **Spatial Indexing**: Use kd-tree for faster nearest neighbor queries
3. **Visualization**: Draw visibility lines and highlight visible pairs on canvas
4. **Real-time Tracking**: Use visibility data for active pursuer control
5. **Multi-Agent**: Extend to multiple pursuers/evaders

## References

- Paper: "Surveillance and Collision-Free Tracking"
- RRT*: "Sampling-based algorithms for optimal motion planning"
- Sensor Model: Field of view and line-of-sight constraints
