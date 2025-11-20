# Active Tracking System Architecture

## Component Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Interface                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────────────┐      ┌──────────────────────────┐     │
│  │  ToolboxSection     │      │  ActiveTrackingWindow     │     │
│  │                     │      │                           │     │
│  │  [Active Tracking]  │─────▶│  • Compute Visibility    │     │
│  │      Button         │      │  • Query Ne / Np         │     │
│  └─────────────────────┘      │  • Statistics Display    │     │
│                                │  • Export Data           │     │
│                                └───────────┬──────────────┘     │
└────────────────────────────────────────────┼────────────────────┘
                                              │
                    ┌─────────────────────────┼─────────────────────────┐
                    │         Event Bus       │                         │
                    │    (eventBus.emit)      │                         │
                    └─────────────────────────┼─────────────────────────┘
                                              │
┌─────────────────────────────────────────────┼────────────────────────┐
│                      App.js (Coordinator)   │                        │
├─────────────────────────────────────────────┼────────────────────────┤
│                                             │                        │
│  • showActiveTrackingWindow()               │                        │
│  • updateObstaclesForAllServices()          │                        │
│  • Event Handlers                           │                        │
│                                             │                        │
└─────────────────────────────────────────────┼────────────────────────┘
                                              │
        ┌─────────────────────────────────────┼──────────────────────┐
        │                                     │                      │
        ▼                                     ▼                      ▼
┌──────────────────┐              ┌──────────────────────┐  ┌──────────────┐
│ RRTStarService   │              │ ActiveTrackingService │  │ SensorModel  │
│                  │              │                       │  │   Service    │
│ • pursuerTree    │─────────────▶│ • visibilityMatrix   │◀─│              │
│ • evaderTree     │  Provides    │ • Ne[] (non-visible) │  │ • canSee()   │
│ • planBothAgents │   Trees      │ • Np[] (tracking)    │  │ • R_min/max  │
│                  │              │                       │  │ • FOV        │
└──────────────────┘              │ • computeVisibility  │  │ • LOS check  │
                                  │ • getNonVisibleNodes │  │              │
                                  │ • getTrackingNodes   │  └──────────────┘
                                  │ • exportData         │
                                  └──────────────────────┘
```

## Data Flow

### 1. Initialization Phase

```
User → [Active Tracking Button] → eventBus.emit('action:activeTracking')
                                         ↓
                              app.showActiveTrackingWindow()
                                         ↓
                              ActiveTrackingWindow.open()
                                         ↓
                        activeTrackingService.setObstacles(polygons)
```

### 2. Visibility Computation Phase

```
User → [Compute Visibility Button] → eventBus.emit('rrt:requestTrees', callback)
                                              ↓
                                    app handles and provides trees
                                              ↓
                          activeTrackingService.computeVisibilityMatrix(
                              pursuerTree, 
                              evaderTree
                          )
                                              ↓
                        ┌─────────────────────┴──────────────────────┐
                        ▼                                            ▼
              treeToArray()                            For each node pair (i,j):
              pursuerNodes[]                                      ↓
              evaderNodes[]                      canSeeNode(pursuer_i, evader_j)
                        │                                          │
                        └──────────────┬─────────────────────────┘
                                       ↓
                        Build visibilityMatrix[i][j]
                        Build Ne[i] and Np[j]
                                       ↓
                        Calculate statistics
                                       ↓
              eventBus.emit('activeTracking:visibilityComputed', {
                  visibilityMatrix, Ne, Np, stats
              })
                                       ↓
                          Update UI with results
```

### 3. Query Phase

```
User → [Query Ne Button] → getNonVisibleEvaderNodes(pursuerIndex)
                                      ↓
                          Return Ne[pursuerIndex]
                                      ↓
                          Display evader nodes not visible

User → [Query Np Button] → getTrackingPursuerNodes(evaderIndex)
                                      ↓
                          Return Np[evaderIndex]
                                      ↓
                          Display pursuer nodes that can see
```

### 4. Export Phase

```
User → [Export Button] → exportVisibilityData()
                                ↓
                         Serialize {
                             visibilityMatrix,
                             Ne,
                             Np,
                             pursuerNodes (states),
                             evaderNodes (states),
                             stats
                         }
                                ↓
                         Download JSON file
```

## Visibility Check Algorithm

```
┌─────────────────────────────────────────────────┐
│ canSeeNode(pursuerNode, evaderNode)             │
├─────────────────────────────────────────────────┤
│                                                  │
│  1. Convert to sensor model format:             │
│     pursuerState = {                            │
│         position: {x, y},                       │
│         heading: theta                          │
│     }                                           │
│     evaderState = {                             │
│         position: {x, y}                        │
│     }                                           │
│                                                  │
│  2. Call sensorModelService.canSee():           │
│     ┌─────────────────────────────────────┐    │
│     │ • Distance Check:                   │    │
│     │   R_min < distance < R_max         │    │
│     │                                     │    │
│     │ • FOV Check:                        │    │
│     │   angle_diff < FOV/2               │    │
│     │                                     │    │
│     │ • Line-of-Sight Check:             │    │
│     │   No obstacles intersect ray       │    │
│     └─────────────────────────────────────┘    │
│                                                  │
│  3. Return boolean result                       │
│                                                  │
└─────────────────────────────────────────────────┘
```

## Class Relationships

```
┌──────────────────────────┐
│ ActiveTrackingService     │
├──────────────────────────┤
│ - visibilityMatrix[][]   │
│ - Ne[]                   │
│ - Np[]                   │
│ - pursuerNodes[]         │
│ - evaderNodes[]          │
│ - obstacles[]            │
│ - stats{}                │
├──────────────────────────┤
│ + initialize()           │
│ + setObstacles()         │
│ + computeVisibility()    │
│ + getNonVisibleNodes()   │
│ + getTrackingNodes()     │
│ + canTrack()             │
│ + findNearestTracking()  │
│ + exportData()           │
│ + reset()                │
└──────────────┬───────────┘
               │ uses
               ▼
┌──────────────────────────┐
│ SensorModelService       │
├──────────────────────────┤
│ - pursuerSensor{}        │
│ - evaderSensor{}         │
│ - obstacles[]            │
├──────────────────────────┤
│ + canSee()               │
│ + checkLineOfSight()     │
│ + getPursuerSensorParams()│
│ + getEvaderSensorParams()│
└──────────────────────────┘
```

## State Machine

```
┌─────────────┐
│   Initial   │
│   (Empty)   │
└──────┬──────┘
       │ initialize()
       ▼
┌─────────────────┐
│  Initialized    │
│ (Obstacles Set) │
└────────┬────────┘
         │ computeVisibilityMatrix()
         ▼
┌────────────────────┐
│   Computing        │
│ (Progress updates) │
└─────────┬──────────┘
          │ Complete
          ▼
┌────────────────────────┐
│      Computed          │
│ (Matrix, Ne, Np ready) │◀──────┐
└────────┬───────────────┘        │
         │                        │
         │ Query operations       │
         ├─ getNonVisibleNodes() ─┤
         ├─ getTrackingNodes() ───┤
         ├─ canTrack() ───────────┤
         │                        │
         │ Export                 │
         └─ exportData()          │
                                  │
         reset()                  │
         └────────────────────────┘
```

## Memory Layout

```
For n_p pursuer nodes and n_e evader nodes:

visibilityMatrix: n_p × n_e booleans
                 ┌─────────────────────┐
                 │ [0][0] ... [0][n_e] │
                 │   ...         ...    │
                 │ [n_p][0] ... [n_p][n_e] │
                 └─────────────────────┘
                 Size: n_p × n_e bytes

Ne: Array of n_p arrays
   ┌─────────────────────────┐
   │ Ne[0]: [j1, j2, ...]    │  // evader indices
   │ Ne[1]: [j3, j4, ...]    │
   │ ...                      │
   │ Ne[n_p]: [jx, jy, ...]  │
   └─────────────────────────┘
   Size: Variable, avg = n_p × avg_non_visible × 4 bytes

Np: Array of n_e arrays
   ┌─────────────────────────┐
   │ Np[0]: [i1, i2, ...]    │  // pursuer indices
   │ Np[1]: [i3, i4, ...]    │
   │ ...                      │
   │ Np[n_e]: [ix, iy, ...]  │
   └─────────────────────────┘
   Size: Variable, avg = n_e × avg_tracking × 4 bytes

Total Memory: O(n_p × n_e)
```

## Integration Points

```
┌─────────────────────────────────────────────────────────┐
│                  Reachability Tracking App               │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Canvas ──┐                                             │
│           │                                             │
│  RRT ─────┼──▶ [Active Tracking] ◀─── Sensor Model     │
│           │                                             │
│  Agents ──┘                                             │
│                                                          │
└─────────────────────────────────────────────────────────┘

Dependencies:
• RRTStarService: Provides trees
• SensorModelService: Visibility logic
• PolygonCanvas: Obstacle data
• IntruderService: Pursuer state
• EvaderService: Evader state
```

## Performance Characteristics

```
Operation              | Time Complexity | Space Complexity
-----------------------|-----------------|------------------
Initialize             | O(1)            | O(1)
Set Obstacles          | O(1)            | O(k) k=obstacles
Tree to Array          | O(n)            | O(n)
Compute Matrix         | O(n_p × n_e × k)| O(n_p × n_e)
Query Ne/Np            | O(1)            | O(1)
Find Nearest Tracker   | O(n_p × k)      | O(1)
Export Data            | O(n_p × n_e)    | O(n_p × n_e)

where:
  n_p = pursuer nodes
  n_e = evader nodes
  k = number of obstacles
```

---

This architecture ensures:
✅ **Modularity**: Clear separation of concerns  
✅ **Scalability**: O(n²) but handles 1000+ nodes  
✅ **Maintainability**: Well-structured code  
✅ **Extensibility**: Easy to add features  
✅ **Testability**: Independent components  
