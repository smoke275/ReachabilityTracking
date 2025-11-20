# Real-Time Tracking - Complete Independent Configuration

## Overview
Real-Time Tracking now has **100% independent configuration** with ALL RRT* and Sensor parameters directly accessible. No more confusion, no more dependencies on other windows!

## Complete Parameter List

### 🎯 Strategy (1 parameter)
- **Tracking Strategy**: PL or TMA

### 🌳 RRT* Tree Parameters (7 parameters)
- **Max Nodes** (100-2000): Maximum nodes per tree
- **Max Planning Time** (50-500ms): Time limit for tree building
- **Steer Time** (0.1-2.0s): Time horizon for steering each node
- **Integration dt** (0.01-0.2s): Time step for motion integration
- **Goal Sample Rate** (0.0-0.3): Probability of sampling toward goal
- **Rewire Radius** (20-100px): Radius for RRT* optimization
- **Robot Radius** (5-20px): Collision checking radius

### 🚗 Motion Constraints (3 parameters)
- **Max Speed** (5-30 px/s): Maximum linear velocity
- **Min Speed** (0-5 px/s): Minimum linear velocity
- **Max Angular Speed** (0.5-3.0 rad/s): Maximum turning rate

### 👁️ Pursuer Sensor (4 parameters)
- **Enable Pursuer Sensor**: Checkbox to enable/disable
- **Blind Spot** (0-50px): Inner blind zone (R_min)
- **Detection Range** (50-400px): Maximum detection distance (R_max)
- **Field of View** (45-360°): Angular coverage (α)

### 👁️ Evader Sensor (4 parameters)
- **Enable Evader Sensor**: Checkbox to enable/disable
- **Blind Spot** (0-50px): Inner blind zone
- **Detection Range** (50-400px): Maximum detection distance
- **Field of View** (45-360°): Angular coverage

### ⏱️ Tracking Behavior (2 parameters)
- **Replan Frequency** (100-5000ms): How often to rebuild trees
- **Execution Time** (0.05-1.0s): How long to follow each path

**Total: 23 parameters** - all accessible via intuitive sliders and checkboxes!

## How Independence Works

### Configuration Isolation
```javascript
// Real-Time Tracking has its own config object
this.config = {
    maxNodes: 1000,
    // ... all 23 parameters
};

// Stores originals before tracking starts
this.originalRRTConfig = { ... };
this.originalSensorConfig = { ... };
```

### Apply on Start
```javascript
async buildTrees() {
    // Save originals (first time only)
    if (!this.originalRRTConfig) {
        this.originalRRTConfig = { /* save RRT config */ };
    }
    if (!this.originalSensorConfig) {
        this.originalSensorConfig = { /* save Sensor config */ };
    }
    
    // Apply Real-Time Tracking configuration
    rrtStarService.config.max_nodes = this.config.maxNodes;
    rrtStarService.config.steer_time = this.config.steerTime;
    // ... apply all parameters
    
    sensorModelService.pursuerSensor.R_max = this.config.pursuerRMax;
    // ... apply sensor parameters
    
    // Build trees with these settings
    const result = rrtStarService.planBothAgents();
}
```

### Restore on Stop
```javascript
stop() {
    // Restore original RRT configuration
    if (this.originalRRTConfig) {
        rrtStarService.config.max_nodes = this.originalRRTConfig.max_nodes;
        // ... restore all RRT parameters
    }
    
    // Restore original Sensor configuration
    if (this.originalSensorConfig) {
        sensorModelService.pursuerSensor.R_max = this.originalSensorConfig.pursuer.R_max;
        // ... restore all sensor parameters
    }
}
```

## UI Organization

### Clean Section Layout
```
┌─ Real-Time Tracking ──────────────────┐
│                                         │
│  ⚙️ Strategy                           │
│  └─ [PL / TMA ▼]                       │
│                                         │
│  🌳 RRT* Tree Parameters               │
│  ├─ Max Nodes: ━━━●━━━━ 1000          │
│  ├─ Max Planning Time: ━━●━━━ 100ms   │
│  ├─ Steer Time: ━━━●━━━━ 0.5s         │
│  ├─ Integration dt: ━━━●━━━ 0.05s     │
│  ├─ Goal Sample Rate: ●━━━━━ 0.05     │
│  ├─ Rewire Radius: ━━━●━━━ 50px       │
│  └─ Robot Radius: ━━●━━━━ 8px         │
│                                         │
│  🚗 Motion Constraints                 │
│  ├─ Max Speed: ━━━●━━━━ 10.0 px/s    │
│  ├─ Min Speed: ●━━━━━━━ 0.0 px/s     │
│  └─ Max Angular Speed: ━━●━━━ 1.5 r/s │
│                                         │
│  👁️ Pursuer Sensor                     │
│  ├─ [✓] Enable Pursuer Sensor         │
│  ├─ Blind Spot: ━━●━━━━ 20px          │
│  ├─ Detection Range: ━━━●━━ 150px     │
│  └─ Field of View: ━━━━━━━●━ 360°    │
│                                         │
│  👁️ Evader Sensor                      │
│  ├─ [✓] Enable Evader Sensor          │
│  ├─ Blind Spot: ━●━━━━━ 15px          │
│  ├─ Detection Range: ━━●━━━ 120px     │
│  └─ Field of View: ━━━━━●━━ 270°     │
│                                         │
│  ⏱️ Tracking Behavior                  │
│  ├─ Replan Frequency: ━━●━━━ 1000ms  │
│  └─ Execution Time: ━●━━━━━ 0.1s     │
│                                         │
│  [▶ Start Tracking]  [⏹ Stop]         │
│                                         │
│  📊 Live Statistics                    │
│  ├─ Iterations: 5                      │
│  ├─ Planning Time: 123.45 ms           │
│  ├─ Distance: 89.23 px                 │
│  └─ Tree Nodes: P:450 / E:480          │
│                                         │
│  ℹ️ Instructions                        │
│  └─ This window is fully independent!  │
└────────────────────────────────────────┘
```

## Benefits

### 1. **Zero Confusion**
- Every parameter is visible and adjustable
- No hidden dependencies on other windows
- Clear labels and units for every slider

### 2. **Complete Control**
- Adjust RRT* tree building behavior
- Fine-tune motion constraints
- Configure sensor models independently
- Change tracking frequency and execution time

### 3. **True Independence**
- RRT Window settings are preserved
- Sensor Window settings are preserved
- Changes only affect Real-Time Tracking
- Original configs restored when tracking stops

### 4. **Better Experimentation**
- Try different sensor ranges without affecting other features
- Test various RRT* parameters for tracking
- Compare strategies with different motion constraints
- All without touching other windows!

## Use Cases

### Use Case 1: Limited Sensor Tracking
```
Goal: Track with short-range sensors
Settings:
- Pursuer Detection Range: 100px
- Evader Detection Range: 80px
- Pursuer FOV: 180°
- Evader FOV: 270°
- Max Nodes: 500 (faster planning)
```

### Use Case 2: High-Precision Tracking
```
Goal: Dense trees for optimal paths
Settings:
- Max Nodes: 2000
- Steer Time: 1.0s
- Goal Sample Rate: 0.10
- Rewire Radius: 80px
- Integration dt: 0.02s (finer control)
```

### Use Case 3: Fast-Response Tracking
```
Goal: Quick replanning for dynamic scenarios
Settings:
- Max Nodes: 300
- Max Planning Time: 50ms
- Replan Frequency: 500ms
- Execution Time: 0.05s
```

### Use Case 4: Omni-Directional vs Directional
```
Goal: Compare sensor configurations
Pursuer: 360° FOV, 150px range (omni)
Evader: 90° FOV, 200px range (directional)
```

## Testing Guide

1. **Open Real-Time Tracking Window**
   - Click the button in Toolbox
   - Notice all 23 parameters are visible

2. **Modify Parameters**
   - Drag sliders to see live value updates
   - Check/uncheck sensor enable boxes
   - Watch values change instantly

3. **Start Tracking**
   - Place both agents
   - Click "Start Tracking"
   - See trees with your exact configuration

4. **Verify Independence**
   - While tracking is running, open RRT Window
   - Check that its "Max Nodes" still shows original value
   - Open Sensor config - original ranges intact

5. **Stop and Verify Restoration**
   - Stop tracking
   - Open RRT Window - settings unchanged
   - Open Sensor config - settings unchanged
   - ✓ Confirmed: Completely independent!

## Technical Implementation

### Files Modified
1. `RealTimeTrackingService.js`:
   - Added 23 config parameters
   - Added originalSensorConfig storage
   - Updated buildTrees() to apply all configs
   - Updated stop() to restore all configs

2. `RealTimeTrackingWindow.js`:
   - Added 7 RRT* sliders
   - Added 3 motion sliders
   - Added 4 pursuer sensor controls
   - Added 4 evader sensor controls
   - Added 2 tracking behavior sliders
   - Added 2 sensor enable checkboxes
   - Updated attachEventHandlers for all controls
   - Updated updateConfig to read all values

### Default Values
Match the original RRT and Sensor defaults:
- RRT*: 1000 nodes, 0.5s steer time, 50px rewire radius
- Motion: 10 px/s max speed, 1.5 rad/s angular
- Pursuer: 20px blind spot, 150px range, 360° FOV
- Evader: 15px blind spot, 120px range, 270° FOV

## Notes

- **Dynamic Import**: SensorModelService is imported only when needed
- **Lazy Initialization**: Original configs saved on first buildTrees() call
- **Graceful Fallback**: If sensor service unavailable, RRT still works
- **Clear Instructions**: UI includes note about independence

## Future Enhancements

Possible additions:
1. Preset configurations (save/load parameter sets)
2. Export configuration as JSON
3. Randomize parameters for experimentation
4. Performance profiling per parameter set
5. Parameter sensitivity analysis
