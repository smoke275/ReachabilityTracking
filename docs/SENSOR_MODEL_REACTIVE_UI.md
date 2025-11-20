# Sensor Model Reactive UI - Implementation Guide

## Overview
The sensor model controls in the Agents Window now provide real-time, reactive visualization. As you drag the sliders, the sensor visualization on the canvas updates immediately. The detection status is also displayed in the Agents Window for easy monitoring.

## Features

### 1. Reactive Sensor Controls
- Real-time slider updates with instant visual feedback
- Separate sections for Pursuer and Evader sensors
- Live value display with units (px for ranges, ° for FOV)
- **Sync Mode**: Synchronize sensor parameters between agents

### 2. Detection Status Display
- **Live Detection Monitoring**: Shows whether agents can see each other
- **Color-Coded Status**: 
  - Green (✓) = Target detected
  - Red (✗) = Target not detected
  - Orange = Evader detection
- **Distance Display**: Real-time distance between agents
- **Integrated in Window**: No need to look at canvas corner

### 3. Sensor Synchronization
- **Sync Button**: Toggle to link sensor parameters between agents
- **Bidirectional**: Works when adjusting either agent's sliders
- **Visual Feedback**: Purple glow and "SYNCED" status when active
- **Smart Sync**: Automatically copies all parameters when enabled

## Architecture

### 1. **AgentsWindow Component** (`src/components/AgentsWindow.js`)
- **Structure**: Separate sections for agent placement and sensor models
- **Sensor Controls**: Dedicated sections for Pursuer and Evader sensors
  - Max Range (R_max): 50-300px
  - Blind Spot (R_min): 0-100px
  - Field of View (FOV): 30-360°

### 2. **Event Flow** (Real-time Updates)
```
User drags slider
    ↓
AgentsWindow.setupSensorSlider() 'input' event
    ↓
Update display value with units (px or °)
    ↓
Emit 'sensor:updatePursuerParams' or 'sensor:updateEvaderParams'
    ↓
SensorModelService receives event
    ↓
Update sensor parameters
    ↓
Emit 'canvas:requestRedraw'
    ↓
PolygonCanvasController receives event
    ↓
Call redraw()
    ↓
Canvas redraws with new sensor visualization
```

### 3. **Key Event Listeners**

#### AgentsWindow (`src/components/AgentsWindow.js`)
```javascript
setupSensorSlider(displayId, sliderId, agentType, paramName) {
    slider.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        
        // Update display with proper formatting
        if (paramName === 'fov') {
            display.textContent = `${value}°`;
        } else {
            display.textContent = `${value} px`;
        }
        
        // Emit event for immediate update
        const eventName = agentType === 'pursuer' 
            ? 'sensor:updatePursuerParams' 
            : 'sensor:updateEvaderParams';
        
        eventBus.emit(eventName, { [paramName]: value });
    });
}
```

#### SensorModelService (`src/services/SensorModelService.js`)
```javascript
setupEventListeners() {
    eventBus.on('sensor:updatePursuerParams', (params) => {
        Object.assign(this.pursuerSensor, params);
        this.checkVisibility();
        eventBus.emit('sensor:paramsUpdated', { agent: 'pursuer', params: this.pursuerSensor });
        // Immediately request redraw for reactive visualization
        eventBus.emit('canvas:requestRedraw');
    });

    eventBus.on('sensor:updateEvaderParams', (params) => {
        Object.assign(this.evaderSensor, params);
        this.checkVisibility();
        eventBus.emit('sensor:paramsUpdated', { agent: 'evader', params: this.evaderSensor });
        // Immediately request redraw for reactive visualization
        eventBus.emit('canvas:requestRedraw');
    });
}
```

#### PolygonCanvasController (`src/controllers/PolygonCanvasController.js`)
```javascript
setupEventListeners() {
    // Listen for agent position updates to redraw sensor visualization
    eventBus.on('intruder:positionUpdate', (state) => {
        this.intruderState = state;
        this.redraw();
    });

    eventBus.on('evader:positionUpdate', (data) => {
        if (data && data.position) {
            this.evaderState = data;
            this.redraw();
        }
    });

    // Listen for explicit redraw requests (e.g., from sensor model updates)
    eventBus.on('canvas:requestRedraw', () => {
        this.redraw();
    });
}
```

## UI Features

### Visual Design
1. **Section Divider**: Purple gradient divider separates agent controls from sensor models
2. **Color Coding**: 
   - Pursuer controls: Blue theme (#2196F3)
   - Evader controls: Pink theme (#E91E63)
3. **Value Display**: Live-updating badges show current values with units
4. **Interactive Sliders**: Hover effects and smooth transitions
5. **Detection Status Panel**: Dark panel showing real-time visibility status

### Detection Status Panel
- **Pursuer Detection**: Shows if pursuer can see evader (Blue icon)
- **Evader Detection**: Shows if evader can see pursuer (Pink icon)
- **Distance Indicator**: Displays current distance between agents
- **Color-Coded Icons**: 
  - Green check_circle = Detected
  - Red cancel = Not detected

### Sensor Synchronization Control
- **Visual Design**: Gray gradient panel with purple accents
- **Status Indicator**: Shows "SYNCED" or "INDEPENDENT"
- **Toggle Button**: Click to enable/disable synchronization
- **Active State**: Purple glow effect when synced
- **Info Display**: Explains the sync functionality

### Sensor Parameters
- **R_max (Max Range)**: Maximum detection distance
- **R_min (Blind Spot)**: Minimum detection distance (collision zone)
- **FOV (Field of View)**: Angular range of sensor (360° = omni-directional)

## Testing the Feature

1. **Open the Agents Window** from the toolbar
2. **Place both agents** (Pursuer and Evader)
3. **Scroll down to "Sensor Models" section**
4. **Drag any slider**:
   - Value display updates instantly
   - Sensor visualization on canvas updates in real-time
   - Circle radius, blind spot, and FOV cone change immediately
5. **Test Sync Mode**:
   - Click the "Sync" button to enable synchronization
   - Adjust any pursuer slider - evader's matching slider updates automatically
   - Adjust any evader slider - pursuer's matching slider updates automatically
   - Click "Sync" again to disable and control independently
6. **View Detection Status**:
   - Scroll to bottom of window
   - See real-time detection status
   - Watch as status changes when you move agents or adjust sensors

## Troubleshooting

### Sensor visualization not updating?
- Check browser console for errors
- Verify agents are placed on canvas
- Ensure the canvas is visible and not covered

### Slider value display not changing?
- This was fixed by moving the ID to the outer span element
- Check that `setupSensorSlider()` is being called for all sliders

### Canvas not redrawing?
- Verify `canvas:requestRedraw` event is being emitted
- Confirm PolygonCanvasController is listening to the event
- Check that `redraw()` method is being called

## Events Reference

### Emitted by AgentsWindow
- `sensor:updatePursuerParams` - { R_max?, R_min?, fov? }
- `sensor:updateEvaderParams` - { R_max?, R_min?, fov? }

### Emitted by SensorModelService
- `canvas:requestRedraw` - Request immediate canvas redraw
- `sensor:paramsUpdated` - { agent, params } - Confirmation of parameter update

### Emitted by PolygonCanvasController
- `sensor:detectionResult` - { pursuerSeesEvader, evaderSeesPursuer, distance, ... } - Detection status update

### Listened by AgentsWindow
- `sensor:detectionResult` - Updates the detection status display
- `intruder:positionUpdate` - Updates pursuer position info
- `evader:positionUpdate` - Updates evader position info
- `canvas:requestRedraw` - Triggers redraw()
- `intruder:positionUpdate` - Updates pursuer state and redraws
- `evader:positionUpdate` - Updates evader state and redraws

## Benefits

1. **Real-time Feedback**: Immediate visual response to parameter changes
2. **Intuitive Interface**: No need to click "Apply" or "Update" buttons
3. **Separated Concerns**: Clear distinction between agent placement and sensor configuration
4. **Responsive Design**: Smooth animations and hover effects
5. **Professional Look**: Color-coded sections with consistent Material Design styling
