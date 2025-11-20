# Evader Simulation Feature

## Overview
The Evader Simulation is a new feature that adds an autonomous agent (evader) that moves along the medial axis skeleton of the environment. The evader chooses random source and destination vertices and navigates between them using either holonomic or unicycle motion models.

## Components Added

### 1. EvaderWindow.js (`src/components/EvaderWindow.js`)
A draggable floating window that provides the user interface for controlling the evader simulation:
- **Controls:**
  - Motion mode selector (Holonomic/Unicycle)
  - Speed slider (0.5x to 5x)
  - Start, Stop, and Reset buttons
- **Status display:** Shows current simulation state and messages
- **Design:** Uses pink/magenta color scheme to distinguish from the analysis window

### 2. EvaderService.js (`src/services/EvaderService.js`)
The core service that manages the evader simulation logic:
- **Motion Models:**
  - **Holonomic:** Direct movement to target (can move in any direction instantly)
  - **Unicycle:** Realistic turning constraints (must rotate before moving in a new direction)
- **Features:**
  - Random vertex selection from medial axis skeleton
  - Path following along skeleton edges
  - Automatic target switching when destination is reached
  - Configurable speed multiplier
  - Real-time position updates via event bus

### 3. Integration Updates

#### ToolboxSection.js
- Added "Evader Simulation" button with running person icon

#### app.js
- Imported and initialized `EvaderService` and `EvaderWindow`
- Added event handlers for evader control:
  - `action:evaderSimulation` - Opens the evader window
  - `evader:start` - Starts simulation with selected mode
  - `evader:stop` - Stops the simulation
  - `evader:reset` - Resets the evader state
  - `evader:setSpeed` - Updates movement speed
  - `evader:positionUpdate` - Updates visualization

#### PolygonCanvasController.js
- Added evader state management
- Implemented evader visualization:
  - Pink circular agent with shadow effect
  - Direction indicator (arrow for unicycle, dot for holonomic)
  - Dashed line to current target
  - Target marker at destination vertex

## How to Use

### Prerequisites
1. Create some polygons on the canvas
2. Click "Environment Analysis" button
3. Generate the medial axis skeleton

### Starting the Simulation
1. Click the "Evader Simulation" button in the Toolbox
2. The Evader Simulation window will open
3. Select motion mode:
   - **Holonomic**: Agent moves directly toward target
   - **Unicycle**: Agent must rotate toward target before moving
4. Adjust speed slider if desired (default: 1x)
5. Click "Start Simulation"

### Controls
- **Start Simulation**: Begins the evader movement
- **Stop**: Pauses the simulation
- **Reset**: Stops and clears the evader state

### Visualization
- **Pink circle with shadow**: The evader agent
- **White arrow** (unicycle mode): Shows current heading direction
- **White dot** (holonomic mode): Simple center indicator
- **Dashed pink line**: Path to current destination
- **Pink circle** (transparent): Destination marker

## Technical Details

### Motion Models

#### Holonomic Motion
```javascript
// Direct movement toward target
velocity = normalize(target - position) * speed
position += velocity
```

#### Unicycle Motion
```javascript
// Calculate desired heading
desiredHeading = atan2(target.y - position.y, target.x - position.x)

// Turn toward target with limited angular velocity
angleDiff = normalizeAngle(desiredHeading - heading)
heading += clamp(angleDiff, -maxAngularVelocity, maxAngularVelocity)

// Move forward in current heading
position.x += cos(heading) * speed
position.y += sin(heading) * speed
```

### Event Flow
1. User clicks "Start Simulation"
2. `evader:start` event fired with motion mode
3. EvaderService initializes with skeleton data
4. Service selects random source and destination vertices
5. Animation loop begins:
   - Update evader position based on motion model
   - Emit `evader:positionUpdate` event
   - PolygonCanvasController receives update and redraws
6. When destination reached:
   - Emit `evader:reachedDestination`
   - Choose new random destination
   - Continue movement

### Performance
- Uses `requestAnimationFrame` for smooth animation
- Speed multiplier range: 0.5x to 5x
- Base speed: 2 pixels per frame
- Angular velocity (unicycle): 0.05 to 0.1 radians per frame

## Future Enhancements
Possible improvements for future versions:
- Multiple evaders simultaneously
- Path planning algorithms (A*, Dijkstra)
- Obstacle avoidance
- Formation control
- Pursuit-evasion scenarios
- Recording and playback of trajectories
- Export trajectory data
- Collision detection with polygons
- Energy/battery constraints
- Velocity and acceleration profiles

## Color Scheme
The evader window uses a distinct pink/magenta palette:
- Primary: `#C2185B` (pink)
- Surface: `#FCE4EC` (light pink)
- On Primary: `#FFFFFF` (white)
- Accent: `#880E4F` (dark pink)

This differentiates it from the teal-colored analysis window.
