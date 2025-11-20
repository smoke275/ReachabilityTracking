# Unicycle Model Implementation

## Overview
The evader can now move using two different motion models:
1. **Holonomic** - Direct movement to target (can move in any direction instantly)
2. **Unicycle** - Differential-drive robot with turning constraints

## Unicycle Model Details

### State Variables
- **Position**: `(x, y)` in pixels
- **Heading**: `θ` in radians (orientation angle)
- **Linear velocity**: `v` in px/frame
- **Angular velocity**: `ω` in rad/frame

### Control Parameters

#### User-Adjustable
- **v_max**: Maximum linear speed (0.5 to 5.0 px/frame)
- **ω_max**: Maximum angular speed (0.05 to 0.5 rad/frame)

#### Control Gains (Fixed)
- **K_v = 0.5**: Linear velocity gain
- **K_h = 2.0**: Heading error gain

### Feedback Control Law

The unicycle uses a proportional feedback controller for waypoint tracking:

#### Linear Velocity Control
```
v = K_v × distance × max(0, cos(θ_error))
```
- **Proportional to distance**: Robot slows down as it approaches waypoint
- **Heading alignment**: `cos(θ_error)` term causes robot to slow when not facing target
- **Clamped to [0, v_max]**: Respects maximum speed limit

#### Angular Velocity Control
```
ω = K_h × θ_error
```
- **Proportional to heading error**: Larger errors produce faster turning
- **Clamped to [-ω_max, ω_max]**: Respects maximum turning rate

### Control Strategy

1. **Heading Alignment First**: The `cos(θ_error)` term means the robot slows down significantly when not facing the target, encouraging it to rotate toward the waypoint before moving forward.

2. **Proportional Heading Correction**: The angular velocity is directly proportional to the heading error, causing the robot to turn smoothly toward the target.

3. **Smooth Approach**: As the robot gets closer to the waypoint, the linear velocity naturally decreases (proportional to distance).

### Waypoint Tolerance
- **2.0 pixels**: Robot switches to next waypoint when within this distance
- This prevents oscillation around waypoints

### Angle Normalization
All angles are normalized to the range [-π, π] to ensure proper heading error calculation and prevent angle wraparound issues.

## Implementation Files

### EvaderService.js
- `updateUnicycle()`: Main unicycle update function with feedback control law
- `updateHolonomic()`: Holonomic motion update (for comparison)
- Control parameters: `K_v`, `K_h`, `speed`, `angularSpeed`

### EvaderWindow.js
- UI slider for Linear Speed (v_max): 0.5 to 5.0 px/frame
- UI slider for Angular Speed (ω_max): 0.05 to 0.5 rad/frame (shown only in unicycle mode)
- Motion mode selector (Holonomic/Unicycle)

## Usage

1. Draw polygons and generate medial axis skeleton
2. Open Evader Simulation window
3. Select "Unicycle (Turning)" motion mode
4. Adjust Linear Speed (v_max) slider
5. Adjust Angular Speed (ω_max) slider (appears when Unicycle is selected)
6. Click "Start Simulation"

## Visualization

In unicycle mode, the evader is rendered with:
- Pink circle representing the robot body
- White arrow showing the current heading direction
- This clearly shows the turning behavior and orientation constraints

## References

This controller is based on common mobile robotics feedback control techniques:
- Sometimes called "pose-to-pose" or "move-to-goal" controller
- Used in differential-drive and unicycle-model mobile robots
- Proportional control ensures smooth, stable motion
