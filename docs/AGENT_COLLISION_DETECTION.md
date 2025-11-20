# Agent Collision Detection

## Overview
Collision detection has been added to the agent placement and movement systems to prevent evader and pursuer (intruder) agents from being placed inside or moving through polygon obstacles.

## Implementation

### Collision Detection Utilities
Both `EvaderService.js` and `IntruderService.js` now include the same collision detection utilities used in `RRTStarService.js`:

- **`pointInPolygon(p, poly)`**: Uses ray casting algorithm to check if a point is inside a polygon
- **`pointToSegmentDistance(p, v1, v2)`**: Calculates minimum distance from point to line segment
- **`robotCollidesWithObstacles(x, y, radius, obstacles)`**: Checks if a circular robot at position (x, y) collides with any obstacle polygons

### Agent Services

#### EvaderService
**New Properties:**
- `this.obstacles = []` - Array of polygon obstacles
- `this.robotRadius = 8.0` - Collision radius (same as RRT service)

**New Methods:**
- `setObstacles(obstacles)` - Updates the obstacle list for collision checking
- `isPositionInCollision(x, y)` - Returns true if position would cause collision

**Updated Methods:**
- `setManualPosition(x, y, heading)` - Now checks for collision before placing evader
  - Returns `false` if collision detected
  - Emits `'evader:placementFailed'` event with collision reason
  - Returns `true` on success

#### IntruderService (Pursuer)
**New Properties:**
- `this.obstacles = []` - Array of polygon obstacles  
- `this.robotRadius = 8.0` - Collision radius (same as RRT service)

**New Methods:**
- `setObstacles(obstacles)` - Updates the obstacle list for collision checking
- `isPositionInCollision(x, y)` - Returns true if position would cause collision

**Updated Methods:**
- `initialize(x, y, heading)` - Now checks for collision before placing pursuer
  - Returns `false` if collision detected
  - Emits `'intruder:placementFailed'` event with collision reason
  - Returns `true` on success

- `setPosition(x, y)` - Now checks for collision before setting position
  - Returns `false` if collision detected
  - Emits `'intruder:placementFailed'` event
  - Returns `true` on success

- `handleMovement()` - Already had collision checking (now uses the shared utility)
  - Checks collision before applying forward/backward movement
  - Movement is blocked if collision would occur

### Application Integration (app.js)

**New Method:**
- `updateObstaclesForAllServices()` - Updates obstacles for both evader and intruder services

**Obstacle Updates Triggered:**
The obstacles are automatically updated in the following scenarios:

1. **On polygon creation:**
   - After completing drawn polygon
   - After creating triangle, rectangle, hexagon, or random shape

2. **On polygon deletion:**
   - After deleting selected polygon
   - After clearing all polygons

3. **On file operations:**
   - After loading saved environment
   - After importing JSON file

4. **On RRT initialization:**
   - When RRT window requests polygons

## Behavior

### Placement Restrictions
- **Evader**: Cannot be placed at position where collision detected
  - Warning logged to console
  - Placement event fails silently
  - User must choose different location

- **Pursuer**: Cannot be placed at position where collision detected
  - Warning logged to console
  - Placement event fails silently
  - User must choose different location

### Movement Restrictions
- **Evader**: Currently moves along medial axis (skeleton), which by design avoids obstacles
- **Pursuer**: Keyboard-controlled movement blocked if next position would cause collision
  - Forward/backward movement prevented
  - Rotation always allowed
  - Agent stays at last valid position

## Collision Parameters

All agents use consistent collision detection parameters:
- **Robot Radius**: 8.0 pixels (configurable via `this.robotRadius`)
- **Detection Method**: Circle-to-polygon collision
  - Checks if robot center is inside polygon
  - Checks if any polygon edge is within robot radius

## Console Messages

### Success Messages
```
EvaderService: 5 obstacles loaded for collision detection
IntruderService: 5 obstacles loaded for collision detection
Updated obstacles for all services: 5 polygons
```

### Warning Messages
```
Cannot place evader at (250.0, 300.0): collision detected
Cannot place pursuer at (400.0, 450.0): collision detected
```

## Events

### New Events Emitted

**Evader:**
- `'evader:placementFailed'` - Emitted when placement fails due to collision
  - Data: `{x, y, reason: 'collision'}`

**Pursuer:**
- `'intruder:placementFailed'` - Emitted when placement fails due to collision
  - Data: `{x, y, reason: 'collision'}`

## Testing

To test collision detection:

1. **Create obstacles**: Draw some polygon obstacles
2. **Try to place agents**: Click inside obstacles to place evader or pursuer
3. **Check console**: Should see collision warnings
4. **Try valid positions**: Place agents in free space (should work)
5. **Try moving pursuer**: Use arrow keys to move pursuer toward obstacle (should stop at boundary)

## Future Enhancements

Potential improvements:
- Visual feedback when placement fails (highlight invalid area)
- Sound effects for collision
- Configurable robot radius per agent
- Warning when agent is near obstacle (proximity detection)
- Collision recovery (push agent to nearest valid position)
