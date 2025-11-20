# Real-Time Tracking - Simplified Configuration

## Changes Made

### Complete UI Redesign
Replaced confusing number inputs with **intuitive sliders** organized into logical sections:

#### 1. **Strategy Section**
- Strategy selector (PL / TMA)

#### 2. **RRT* Tree Parameters**
- **Max Nodes**: 100-2000 (controls tree density)
- **Steer Time**: 0.1-2.0s (controls how far ahead each node looks)
- **Rewire Radius**: 20-100px (controls RRT* optimization range)

#### 3. **Motion Constraints**
- **Max Speed**: 5-30 px/s (how fast agents can move)
- **Max Angular Speed**: 0.5-3.0 rad/s (how fast agents can turn)

#### 4. **Tracking Behavior**
- **Replan Frequency**: 100-5000ms (how often to recompute paths)
- **Execution Time**: 0.05-1.0s (how long to follow each path)

#### 5. **Live Statistics**
- Iterations count
- Planning time (ms)
- Distance between agents
- **Tree Nodes** (shows P:xxx / E:xxx for pursuer/evader node counts)

### Independent Configuration System

**Problem Fixed:**
- Old system: "samplingIterations" parameter existed but didn't do anything
- Real-Time Tracking was using RRT Window's global configuration
- Confusing and misleading for users

**New System:**
- Real-Time Tracking has its **own complete configuration**
- Temporarily overrides RRTStarService config during tracking
- **Restores original RRT config** when tracking stops
- No interference between RRT Window and Real-Time Tracking

### Service Changes (`RealTimeTrackingService.js`)

**New Configuration Structure:**
```javascript
this.config = {
    // RRT* Tree Building
    maxNodes: 1000,
    steerTime: 0.5,
    rewireRadius: 50.0,
    
    // Agent Motion Constraints
    vMax: 10.0,
    omegaMax: 1.5,
    
    // Tracking Behavior
    strategy: 'tma',
    planningFrequency: 1000,
    executionTimeStep: 0.1
};
```

**Configuration Isolation:**
```javascript
// Before building trees: Apply Real-Time Tracking config
rrtStarService.config.max_nodes = this.config.maxNodes;
rrtStarService.config.steer_time = this.config.steerTime;
// ... etc

// After stopping: Restore original config
rrtStarService.config.max_nodes = this.originalRRTConfig.max_nodes;
// ... etc
```

### Window Changes (`RealTimeTrackingWindow.js`)

**Removed:**
- ❌ Confusing "RRT* Iterations" input (didn't actually work)
- ❌ "Sensor Config" (not relevant for tracking)
- ❌ Individual agent position stats (cluttered UI)

**Added:**
- ✅ All relevant RRT* parameters with sliders
- ✅ Motion constraint sliders
- ✅ Live value display next to each slider
- ✅ Tree node count statistics
- ✅ Better organized sections

**Slider Features:**
- Real-time value updates as you drag
- Configuration applies immediately on release
- Clear units displayed (px, s, ms, rad/s)
- Sensible min/max ranges

## User Experience

### Before:
```
Configuration
├── RRT* Iterations: [500]  ← didn't work
├── Execution Time: [0.1]
├── Replan Frequency: [1000]
└── Strategy: [TMA ▼]
```

### After:
```
Strategy
└── Tracking Strategy: [TMA ▼]

RRT* Tree Parameters
├── Max Nodes: [slider] 1000
├── Steer Time: [slider] 0.5s
└── Rewire Radius: [slider] 50px

Motion Constraints
├── Max Speed: [slider] 10.0 px/s
└── Max Angular Speed: [slider] 1.5 rad/s

Tracking Behavior
├── Replan Frequency: [slider] 1000ms
└── Execution Time: [slider] 0.1s
```

## Benefits

1. **No More Confusion**: Every parameter actually does what it says
2. **Complete Control**: All RRT* parameters accessible in one place
3. **Visual Feedback**: Sliders with live values are more intuitive
4. **Independence**: Doesn't interfere with RRT Window settings
5. **Clean Stats**: Focus on what matters (distance, nodes, time)

## Testing

1. Refresh the page
2. Open "Real-Time Tracking" window
3. Notice the new slider interface
4. Try adjusting parameters and see live value updates
5. Place agents and start tracking
6. Verify RRT Window parameters aren't affected
7. Stop tracking and check RRT Window still works independently

## Technical Notes

- Original RRT config is saved on first `buildTrees()` call
- Config is restored when `stop()` is called
- All parameters are properly validated and typed
- Slider ranges are based on sensible operational limits
- Tree node counting uses recursive traversal for accuracy
