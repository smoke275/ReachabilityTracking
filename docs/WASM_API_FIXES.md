# WASM API Compatibility Fixes

## Problem
The WASM worker was calling JavaScript-style methods that don't exist in the Rust/WASM bindings, causing initialization failures.

## Root Cause
JavaScript services use `initialize(obstacles, config)` methods, but WASM services use different APIs:

### WASM API (Rust)
```rust
// RRTStarService
let service = RRTStarService::new();
service.initialize(obstacles_json, config_json); // ✅ Has initialize()
service.update_config(config_json);
service.update_obstacles(obstacles_json);

// SensorModelService  
let sensor = SensorModelService::new();
sensor.set_obstacles(obstacles_json);           // ⚠️ set_obstacles, not update_obstacles
sensor.update_pursuer_sensor(params_json);      // ⚠️ update_pursuer_sensor, not initialize
sensor.update_evader_sensor(params_json);

// ActiveTrackingService
let active = ActiveTrackingService::new();
active.set_obstacles(obstacles_json);           // ⚠️ set_obstacles, not initialize
active.update_sensor_params(params_json);       // ⚠️ update_sensor_params, not initialize
```

### JavaScript API
```javascript
// All services have initialize()
rrtService.initialize(obstacles, config);
sensorService.initialize(obstacles, params);
activeService.initialize(obstacles);
```

## Fixes Applied

### 1. SensorModelService Initialization (Line ~67)
**Before:**
```javascript
sensorService.initialize(obstaclesJS, pursuerSensorParams || {});
```

**After:**
```javascript
if (obstaclesJS && obstaclesJS.length > 0) {
  sensorService.set_obstacles(obstaclesJS);
}
if (pursuerSensorParams) {
  sensorService.update_pursuer_sensor(pursuerSensorParams);
}
```

### 2. ActiveTrackingService Initialization (Line ~75)
**Before:**
```javascript
activeService.initialize(obstaclesJS);
```

**After:**
```javascript
if (obstaclesJS && obstaclesJS.length > 0) {
  activeService.set_obstacles(obstaclesJS);
}
if (pursuerSensorParams) {
  activeService.update_sensor_params(pursuerSensorParams);
}
```

### 3. Config Update Handler (Line ~95)
**Before:**
```javascript
if (pursuerSensorParams) {
  sensorService.update_sensor_params(pursuerSensorParams);
}
```

**After:**
```javascript
if (pursuerSensorParams) {
  sensorService.update_pursuer_sensor(pursuerSensorParams);
  activeService.update_sensor_params(pursuerSensorParams);
}
```

### 4. Obstacles Update Handler (Line ~115)
**Before:**
```javascript
sensorService.update_obstacles(obstacles);
activeService.update_obstacles(obstacles);
```

**After:**
```javascript
sensorService.set_obstacles(obstacles);
activeService.set_obstacles(obstacles);
```

## API Mapping Table

| Service | JavaScript Method | WASM Method |
|---------|------------------|-------------|
| **RRTStarService** | `initialize(obstacles, config)` | `initialize(obstacles, config)` ✅ Same |
| | `update_config(config)` | `update_config(config)` ✅ Same |
| | `update_obstacles(obstacles)` | `update_obstacles(obstacles)` ✅ Same |
| **SensorModelService** | `initialize(obstacles, params)` | `set_obstacles(obstacles)` + `update_pursuer_sensor(params)` ⚠️ Different |
| | `update_sensor_params(params)` | `update_pursuer_sensor(params)` ⚠️ Different name |
| | `update_obstacles(obstacles)` | `set_obstacles(obstacles)` ⚠️ Different name |
| **ActiveTrackingService** | `initialize(obstacles)` | `set_obstacles(obstacles)` ⚠️ Different |
| | - | `update_sensor_params(params)` 🆕 New |
| | `update_obstacles(obstacles)` | `set_obstacles(obstacles)` ⚠️ Different name |

## Status
✅ **FIXED** - All WASM API calls now match the Rust bindings

## Testing
1. Start dev server: `npm run dev`
2. Open Real-Time Tracking window
3. Place pursuer and evader
4. Click "Start Tracking"
5. Verify:
   - Console shows "✅ Using WASM worker for high-performance planning"
   - Worker indicator shows "🚀 WASM" in green
   - Planning times are 2-5ms (instead of 80-120ms)
   - Trees build correctly
   - Agents move smoothly

## Fallback
If WASM fails for any reason:
- Console shows "⚠️ WASM initialization failed: [error]"
- Automatically falls back to JavaScript worker
- Worker indicator shows "📦 JavaScript" in orange
- Planning times are 80-120ms (slower but reliable)
- Tracking continues without interruption

## Related Files
- `/src/workers/plannerWASMWorker.js` - WASM worker implementation
- `/src/workers/plannerWorker.js` - JavaScript fallback (unchanged)
- `/rust-wasm/src/rrt_star.rs` - RRT* WASM bindings
- `/rust-wasm/src/sensor_model.rs` - Sensor WASM bindings
- `/rust-wasm/src/active_tracking.rs` - Active tracking WASM bindings
