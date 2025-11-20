# Intruder Agent - User Guide

## Overview

The **Intruder Agent** is a manually-controlled agent that serves as the reference point for computing future reachability sets. Unlike the evader which moves autonomously along the medial axis, the intruder is fully controlled by the user with keyboard input.

## Purpose

- **Independent Control**: Evader continues its autonomous simulation
- **Future Set Computation**: Reachability analysis centered on intruder position
- **Interactive Exploration**: Manually explore different strategic positions
- **Pursuit-Evasion Analysis**: Understand what areas the intruder can reach

---

## How to Use

### 1. Place the Intruder

**Ctrl + Click** on the canvas to place the intruder at the clicked position.

- The intruder appears as a **blue circle** with a white arrow
- Arrow shows the current heading direction
- Can be placed anywhere on the canvas
- Placing it again moves it to the new location

### 2. Control the Intruder

Use **Arrow Keys** to move the intruder:

| Key | Action |
|-----|--------|
| ↑ (Up Arrow) | Move forward in current heading direction |
| ↓ (Down Arrow) | Move backward (reverse) |
| ← (Left Arrow) | Turn left (counterclockwise) |
| → (Right Arrow) | Turn right (clockwise) |

**Movement Details:**
- **Speed**: 2 pixels per key press (configurable)
- **Turn Rate**: 0.15 radians per key press (configurable)
- **Control**: Unicycle-style (moves in heading direction)
- **Instant Response**: No momentum or acceleration

### 3. Compute Future Set

1. Open **"Evader Future Set"** window from Toolbox
2. Ensure intruder is placed (Ctrl+Click)
3. Adjust **Time Horizon** slider (10-500 frames)
4. Click **"Compute"**
5. Future set visualizes reachable positions from intruder's location

### 4. Visual Indicators

**Intruder Appearance:**
- 🔵 **Blue circle**: Main body
- ⬆️ **White arrow**: Heading direction
- **Glow effect**: Blue shadow for visibility

**Future Set:**
- 🟢 **Green dots**: Barely reachable positions
- 🟡 **Yellow dots**: Moderately reachable
- 🔴 **Red/Orange dots**: Highly reachable
- **Cyan circle**: Maximum reach boundary (centered on intruder)

---

## Workflow Example

### Typical Usage:

1. **Setup Environment**
   - Draw/load obstacle polygons
   - Generate medial axis skeleton
   - Start evader simulation (optional)

2. **Place Intruder**
   - Press **Ctrl** and **click** on canvas
   - Intruder appears at clicked position

3. **Move to Strategic Position**
   - Use **arrow keys** to navigate
   - Position intruder where you want to analyze reachability

4. **Compute Reachability**
   - Open "Evader Future Set" window
   - Click "Compute"
   - View color-coded reachable positions

5. **Explore Different Positions**
   - Move intruder to new location
   - Click "Compute" again to see updated reachability
   - Compare different strategic positions

---

## Keyboard Controls Summary

```
Intruder Placement:
  Ctrl + Click ............ Place/move intruder at mouse position

Intruder Movement:
  ↑ (Up Arrow) ............ Move forward
  ↓ (Down Arrow) .......... Move backward
  ← (Left Arrow) .......... Turn left
  → (Right Arrow) ......... Turn right

Future Set:
  (Use UI window) ......... Compute/Clear reachability
```

---

## Differences: Evader vs. Intruder

| Feature | Evader | Intruder |
|---------|--------|----------|
| **Control** | Autonomous (algorithm) | Manual (arrow keys) |
| **Movement** | Follows medial axis skeleton | Free movement anywhere |
| **Purpose** | Simulate agent behavior | Interactive analysis |
| **Color** | 🔴 Pink/Red | 🔵 Blue |
| **Required For** | Evader simulation window | Future set computation |
| **Dependency** | Needs medial axis skeleton | No dependencies |

---

## Technical Details

### IntruderService

**Location**: `src/services/IntruderService.js`

**Key Features:**
- Keyboard event listening (global)
- Position and heading state management
- Speed and angular speed configuration
- Event emission for visualization updates

**Events:**
- `intruder:initialized` - Intruder placed on canvas
- `intruder:positionUpdate` - Position/heading changed
- `intruder:activated` - Intruder control enabled
- `intruder:deactivated` - Intruder control disabled
- `intruder:reset` - Intruder removed

### Motion Parameters

```javascript
speed = 2.0;           // Linear velocity (pixels per key press)
angularSpeed = 0.15;   // Angular velocity (radians per key press)
```

These match the evader's motion parameters by default, ensuring consistent reachability analysis.

### Control Scheme

**Unicycle Model:**
- Forward/backward motion along heading direction
- Independent rotation controls
- Instantaneous response (no physics simulation)
- Can move through obstacles (no collision checking)

---

## Use Cases

### 1. **Strategic Position Analysis**
- Place intruder at different locations
- Compute reachability from each position
- Compare which positions offer better coverage

### 2. **Pursuit Planning**
- Position intruder as "pursuer"
- See what areas it can reach
- Plan interception strategies

### 3. **Coverage Analysis**
- Move intruder around environment
- Identify areas with good/poor reachability
- Find strategic bottlenecks

### 4. **Escape Route Testing**
- Place intruder at entry points
- See how far it can penetrate
- Identify vulnerable areas

### 5. **Interactive Teaching**
- Demonstrate reachability concepts
- Show how position affects reach
- Explain motion constraints visually

---

## Tips & Best Practices

💡 **Quick Positioning**: Use Ctrl+Click for fast placement instead of arrow keys

💡 **Smooth Movement**: Hold arrow keys for continuous movement

💡 **Precise Heading**: Tap left/right arrows for fine heading adjustments

💡 **Recompute Often**: Recompute future set after significant position changes

💡 **Clear Before Move**: Clear old future set before moving to avoid confusion

💡 **Compare Positions**: Keep notes on different strategic positions

---

## Troubleshooting

### Intruder Not Responding to Arrow Keys
**Problem**: Arrow keys don't move intruder  
**Solution**: Ensure intruder is placed (Ctrl+Click first)

### Can't Place Intruder
**Problem**: Ctrl+Click doesn't work  
**Solution**: Make sure you're clicking on the canvas, not a UI element

### Future Set Doesn't Match Intruder
**Problem**: Future set is centered elsewhere  
**Solution**: Recompute after moving intruder

### Intruder Disappears
**Problem**: Can't see intruder after placement  
**Solution**: Check zoom level and pan to find it

---

## Integration with Evader

The intruder and evader can coexist:

✅ **Evader**: Runs autonomously, follows medial axis  
✅ **Intruder**: Controlled manually, used for analysis  
✅ **Both visible**: Different colors for easy distinction  
✅ **Independent**: Don't interfere with each other  

**Typical Scenario:**
1. Evader simulates agent movement
2. Place intruder to represent "pursuer" or "second agent"
3. Compute reachability from intruder position
4. Analyze potential intersections or coverage

---

## Future Enhancements

Potential improvements:
- Mouse drag to move intruder
- Speed/turn rate sliders in UI
- Click-to-face direction
- Path recording/playback
- Multiple intruders
- Collision detection option
- WASD alternative controls

---

## Files Modified/Created

### New Files
- `src/services/IntruderService.js` - Intruder control service

### Modified Files
- `src/app.js` - Integration and event handling
- `src/controllers/PolygonCanvasController.js` - Visualization and click handling
- `src/services/EvaderFutureSetService.js` - Uses intruder instead of evader
- `src/components/EvaderFutureSetWindow.js` - Updated instructions

---

## Quick Reference Card

```
╔══════════════════════════════════════╗
║      INTRUDER CONTROLS               ║
╠══════════════════════════════════════╣
║ Ctrl + Click .... Place/Move        ║
║ ↑ ............... Forward           ║
║ ↓ ............... Backward          ║
║ ← ............... Turn Left         ║
║ → ............... Turn Right        ║
╠══════════════════════════════════════╣
║ Blue Circle ..... Intruder Body     ║
║ White Arrow ..... Heading Direction ║
╚══════════════════════════════════════╝
```

---

**Last Updated**: November 17, 2025  
**Status**: ✅ Complete and tested
