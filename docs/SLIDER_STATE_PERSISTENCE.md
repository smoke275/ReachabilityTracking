# Slider State Persistence

## Overview
All slider values across the application are now automatically saved when you click "Save" and restored when you "Load" or "Import" a file. This ensures your configuration settings persist across sessions.

## Saved Sliders

### 1. RRT Window
- **vMax**: Maximum linear velocity
- **omegaMax**: Maximum angular velocity
- **maxNodes**: Maximum nodes per tree
- **planningTimeLimit**: Max planning time (ms)
- **steerTime**: Time horizon for steering (seconds)
- **dt**: Integration time step (seconds)
- **goalSampleRate**: Goal sampling probability
- **rewireRadius**: Radius for rewiring neighbors
- **robotRadius**: Robot collision radius

### 2. Real-Time Tracking Window
- **maxNodesSlider**: Maximum nodes configuration
- **maxPlanningTimeSlider**: Planning time limit
- **steerTimeSlider**: Steering time horizon
- **dtSlider**: Integration time step
- **goalSampleRateSlider**: Goal sampling rate
- **rewireRadiusSlider**: Rewiring radius
- **robotRadiusSlider**: Robot radius
- **vMaxSlider**: Maximum velocity
- **vMinSlider**: Minimum velocity
- **omegaMaxSlider**: Maximum angular velocity
- **pursuerRMinSlider**: Pursuer sensor minimum range
- **pursuerRMaxSlider**: Pursuer sensor maximum range
- **pursuerFOVSlider**: Pursuer field of view
- **planningFrequencySlider**: Replanning frequency
- **executionTimeStepSlider**: Execution time step

### 3. Active Tracking Window
- **maxNodesSlider**: Maximum nodes
- **maxPlanningTimeSlider**: Planning time limit
- **steerTimeSlider**: Steering time
- **dtSlider**: Integration time step
- **goalSampleRateSlider**: Goal sampling rate
- **rewireRadiusSlider**: Rewiring radius
- **robotRadiusSlider**: Robot radius
- **vMaxSlider**: Maximum velocity
- **omegaMaxSlider**: Maximum angular velocity
- **pursuerRMinSlider**: Pursuer sensor min range
- **pursuerRMaxSlider**: Pursuer sensor max range
- **pursuerFOVSlider**: Pursuer field of view

### 4. Evader Window
- **speedSlider**: Evader movement speed
- **angularSpeedSlider**: Evader angular/turning speed

### 5. Evader Future Set Window
- **timeHorizonSlider**: Time horizon for reachability
- **intruderSpeedSlider**: Speed parameter
- **intruderAngularSpeedSlider**: Angular speed parameter

### 6. Agents Window
- **pursuerRmaxSlider**: Pursuer sensor max range
- **pursuerRminSlider**: Pursuer sensor min range
- **pursuerFovSlider**: Pursuer field of view
- **evaderRmaxSlider**: Evader sensor max range
- **evaderRminSlider**: Evader sensor min range
- **evaderFovSlider**: Evader field of view
- **pursuerSpeedSlider**: Pursuer movement speed
- **pursuerAngularSpeedSlider**: Pursuer angular speed
- **evaderSpeedSlider**: Evader movement speed
- **evaderAngularSpeedSlider**: Evader angular speed

### 7. Analysis Window
- **reductionSlider**: Vertex reduction level for medial axis

### 8. Canvas Toolbar
- **zoomSlider**: Canvas zoom level

## How It Works

### Saving
When you click the **Save** button:
1. All polygon data, camera settings, and agent positions are collected
2. The system scans all windows/components for sliders
3. Current slider values are extracted and organized by component
4. Everything is saved to localStorage (or exported to JSON file)

### Loading/Importing
When you click **Load** or **Import**:
1. All saved data is loaded from localStorage or file
2. Polygons, camera, and agents are restored first
3. After a short delay (500ms) to ensure windows are initialized
4. All slider values are restored to their saved positions
5. Input events are triggered to update displays and configurations

## Data Structure

The saved slider data is organized like this:

```json
{
  "version": "1.0",
  "polygons": [...],
  "camera": {...},
  "agents": {...},
  "sliders": {
    "rrtWindow": {
      "vMax": 10,
      "omegaMax": 1.5,
      "maxNodes": 1000,
      ...
    },
    "realTimeTrackingWindow": {
      "maxNodesSlider": 1000,
      ...
    },
    "activeTrackingWindow": {...},
    "evaderWindow": {...},
    "evaderFutureSetWindow": {...},
    "agentsWindow": {...},
    "analysisWindow": {...},
    "canvasToolbar": {...}
  }
}
```

## Implementation Details

### Methods Added to `app.js`

#### `getAllSliderStates()`
- Scans all windows and components for sliders
- Extracts current values
- Returns organized object with slider states

#### `restoreAllSliderStates(sliders)`
- Takes saved slider states object
- Finds corresponding slider elements in each window
- Sets values and triggers input events
- Uses setTimeout to ensure windows are initialized

### Updates to Existing Methods

#### `handleSave()`
- Now calls `getAllSliderStates()` before saving
- Includes slider data in saved state

#### `handleLoad()`
- Calls `restoreAllSliderStates()` after loading
- Uses 500ms delay to ensure components are ready

#### `handleExport()`
- Includes slider states in exported JSON

#### `handleImport()`
- Restores slider states from imported JSON

## Benefits

1. **Configuration Persistence**: Your carefully tuned parameters survive page reloads
2. **Experiment Reproducibility**: Save complete system configurations for experiments
3. **Quick Setup**: Load preset configurations instantly
4. **Sharing**: Export/import complete setups including all slider values
5. **Workflow Efficiency**: No need to re-adjust dozens of sliders each session

## Usage Tips

1. **Tune Once, Save Often**: After finding good parameters, hit Save!
2. **Create Presets**: Export different configurations for different scenarios
3. **Version Control**: Include exported JSON files in version control for reproducible research
4. **Window State**: Open the relevant windows before loading to see sliders update in real-time
5. **Delay Consideration**: If sliders don't restore, try opening the window first, then reload

## Technical Notes

- Slider restoration happens 500ms after load to ensure Shadow DOM elements are ready
- For Real-Time Tracking and Active Tracking windows, the window elements are created automatically if they don't exist yet (ensuring sliders can be saved/restored even if window was never opened)
- Values are stored as floats/numbers, maintaining precision
- Input events are dispatched to trigger any dependent UI updates
- Missing sliders are gracefully ignored (component not opened yet)
- Works with both Material Design sliders (`md-slider`) and standard HTML range inputs

## Future Enhancements

Potential improvements:
- Add preset management UI
- Support for multiple named configurations
- Real-time sync across open windows
- Validation of slider value ranges on restore
- User notification when sliders are restored
