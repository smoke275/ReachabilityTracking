# Fix: Real-Time Tracking No Longer Interferes with Evader Simulation

## Problem
When running Real-Time Tracking alongside Evader Simulation, the evader's position was being reset/overwritten, causing strange behavior in the evader simulation.

## Root Cause

### Issue 1: Emitting Position Updates
The `RealTimeTrackingService` was emitting position updates for **both** the pursuer and evader:

```javascript
// OLD - WRONG
updateAgentServices() {
    eventBus.emit('intruder:positionUpdate', { ... });    // Pursuer
    eventBus.emit('evader:positionUpdate', { ... });      // Evader ❌
}
```

This was overwriting the evader's position that was being controlled by `EvaderService`, causing conflicts.

### Issue 2: Storing References Instead of Copies (CRITICAL)
Even worse, the service was storing **references** to the evader state object instead of making copies:

```javascript
// OLD - WRONG - Stores reference!
this.evaderState = evaderState;  // ❌ Reference to original object
```

**Why this is a problem:**
- When you assign an object in JavaScript, you're assigning a reference, not a copy
- Any modifications to `this.evaderState` would **directly modify** the original evader in EvaderService
- This meant even though we weren't emitting events, we were still corrupting the evader's state through the shared reference!

**JavaScript Reference Example:**
```javascript
const original = { position: { x: 10, y: 20 } };
const reference = original;  // ❌ Just a reference
reference.position.x = 999;  // This modifies original too!
console.log(original.position.x);  // 999 - Original is changed!
```

## Solution
Real-Time Tracking now **only** controls the pursuer and makes **deep copies** of the evader state to avoid reference issues.

### Changes Made:

1. **Removed Evader Position Updates**
   ```javascript
   // NEW - CORRECT
   updateAgentServices() {
       // Only update pursuer
       eventBus.emit('intruder:positionUpdate', { ... });
       
       // DO NOT update evader - it's controlled by EvaderService
   }
   ```

2. **Removed Evader from Control Loop**
   ```javascript
   updateAgents(deltaTime) {
       // Only update pursuer with unicycle feedback
       // Evader is NOT controlled here
   }
   ```

3. **Deep Copy Evader State (CRITICAL FIX)**
   ```javascript
   // NEW - CORRECT - Makes a deep copy
   animate() {
       eventBus.emit('realTimeTracking:requestEvaderState', (evaderState) => {
           if (evaderState && evaderState.position) {
               // Deep copy to avoid reference issues
               this.evaderState = {
                   position: {
                       x: evaderState.position.x,  // Copy values
                       y: evaderState.position.y
                   },
                   heading: evaderState.heading || 0,
                   speed: evaderState.speed,
                   angularSpeed: evaderState.angularSpeed
               };
           }
       });
   }
   ```

4. **Deep Copy Initial States**
   ```javascript
   start(pursuerState, evaderState) {
       // Make copies of states to avoid modifying the originals
       this.pursuerState = {
           position: { x: pursuerState.position.x, y: pursuerState.position.y },
           heading: pursuerState.heading || 0,
           speed: pursuerState.speed,
           angularSpeed: pursuerState.angularSpeed
       };
       
       this.evaderState = {
           position: { x: evaderState.position.x, y: evaderState.position.y },
           heading: evaderState.heading || 0,
           speed: evaderState.speed,
           angularSpeed: evaderState.angularSpeed
       };
   }
   ```

5. **Added Event Handler in App**
   ```javascript
   eventBus.on('realTimeTracking:requestEvaderState', (callback) => {
       callback(this.evaderService.getState());
   });
   ```

## How It Works Now

### Pursuer (Controlled by Real-Time Tracking):
1. Follows planned waypoints using unicycle feedback control
2. Position updated every frame (~60 FPS)
3. Replans path every `updateInterval` seconds

### Evader (Controlled by EvaderService):
1. Runs its own simulation independently
2. Follows skeleton waypoints
3. **Not affected** by Real-Time Tracking

### Interaction:
1. Real-Time Tracking **queries** evader's position each frame
2. Uses evader position for:
   - Building RRT* trees
   - Computing visibility
   - Planning pursuer's path
3. **Does not control** or modify evader's position

## Visual Flow

```
┌─────────────────────────┐
│   EvaderService         │
│   (Independent)         │
│                         │
│   Controls evader       │
│   position & movement   │
└────────┬────────────────┘
         │
         │ position queries
         │ (read only)
         ▼
┌─────────────────────────┐
│  RealTimeTrackingService│
│                         │
│  1. Reads evader pos    │
│  2. Plans pursuer path  │
│  3. Controls pursuer    │
└─────────────────────────┘
```

## Benefits

✅ **No More Conflicts**: Evader simulation runs smoothly  
✅ **Clear Separation**: Each service controls what it should  
✅ **Proper Tracking**: Pursuer tracks moving evader correctly  
✅ **Independent Operation**: Both can run simultaneously  

## Testing

To verify the fix works:

1. **Start Evader Simulation**
   - Open Agents window
   - Start evader simulation
   - Evader should move along skeleton

2. **Start Real-Time Tracking**
   - Open Real-Time Tracking window
   - Start tracking
   - Pursuer should follow evader

3. **Verify**
   - Evader continues moving smoothly (no resets)
   - Pursuer tracks evader's movement
   - Both agents move independently

## Migration

No changes needed - existing configurations will work correctly. The evader simulation will simply work as expected now!
