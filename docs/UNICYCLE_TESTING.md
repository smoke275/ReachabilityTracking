# Testing Unicycle Model Behavior

## What to Look For

The unicycle model should exhibit **different behavior** from holonomic mode:

### Holonomic Mode (Direct Movement)
- ✓ Moves in a **straight line** from waypoint to waypoint
- ✓ Always takes the **shortest path**
- ✓ Can change direction **instantly**
- ✓ Path overlay matches actual movement exactly

### Unicycle Mode (Turning Constraints)
- ✓ **Curves around corners** instead of sharp turns
- ✓ **Slows down** before turns (when not facing target)
- ✓ **Deviates from the path overlay** (path shows ideal route, robot shows realistic motion)
- ✓ Large **white arrow** shows current heading direction
- ✓ Arrow direction may **differ from movement direction** during turns

## Key Differences to Observe

### 1. **Path Deviation**
- **Holonomic**: Robot stays exactly on the pink/amber path lines
- **Unicycle**: Robot **curves away** from sharp corners, creating smooth arcs

### 2. **Speed Variation**
- **Holonomic**: Constant speed along path
- **Unicycle**: 
  - **Slows down** when heading error is large (when not facing target)
  - **Speeds up** when aligned with target
  - May even **stop momentarily** to turn in place at sharp corners

### 3. **Visual Indicators**
- **Holonomic**: Small white dot (no specific heading)
- **Unicycle**: Large **white arrow** clearly showing which way robot is facing
  - Arrow rotates smoothly as robot turns
  - Arrow may point away from the path during curves

### 4. **Corner Behavior**
- **Holonomic**: Instant 90° turns at corners
- **Unicycle**: 
  - Approaches corner
  - Slows down significantly
  - Gradually rotates toward new direction
  - Accelerates once aligned

## Testing Steps

1. **Draw polygons** (use rectangles for clear corners)
2. **Generate Medial Axis** (Environment Analysis)
3. **Open Evader Simulation**
4. **Test Holonomic First**:
   - Select "Holonomic (Direct)"
   - Start simulation
   - Observe: straight-line movement, instant direction changes
   - Stop simulation

5. **Test Unicycle**:
   - Select "Unicycle (Turning)"
   - Adjust sliders:
     - Linear Speed (v_max): Try 1.0-2.0 px/frame
     - Angular Speed (ω_max): Try 0.15 rad/frame
   - Start simulation
   - Observe: curved paths, gradual turning, speed variations

## Console Output

Watch the browser console for debug messages:

### Unicycle Mode Logs:
```
Evader simulation started in unicycle mode
Initial heading set to: X.XX rad
Unicycle: dist=XXXpx, heading_error=XX.X°, v=X.XXpx/f, ω=X.XXXrad/f, alignment=X.XX
Unicycle reached waypoint N
```

### What the values mean:
- **dist**: Distance to current waypoint (should decrease)
- **heading_error**: Angle difference in degrees (large = needs turning)
- **v**: Current linear velocity (low when turning, high when aligned)
- **ω**: Current angular velocity (high when turning, low when aligned)
- **alignment**: cos(heading_error) - closer to 1.0 = better aligned

## Expected Behavior Differences

| Aspect | Holonomic | Unicycle |
|--------|-----------|----------|
| Path following | Exact | Approximate (with deviation) |
| Corner navigation | Sharp 90° | Smooth curves |
| Speed at corners | Constant | Slows down |
| Direction changes | Instant | Gradual rotation |
| Visual heading | Small dot | Large arrow |
| Console output | Minimal | Shows control values |

## Troubleshooting

### "Still looks like holonomic"
Check:
1. Did you select "Unicycle (Turning)" mode?
2. Is the white arrow visible on the robot?
3. Check console - should see "Evader simulation started in unicycle mode"
4. Try increasing Angular Speed to 0.3-0.5 for more dramatic turning

### "Robot barely moves"
- Increase Linear Speed (v_max) to 2.0-3.0
- Check console for v values - should be > 0

### "Robot spins in place"
- This is **correct behavior** when heading error is large!
- The cos(heading_error) term reduces forward velocity when not facing target
- Robot must turn to face waypoint before moving forward

### "Path doesn't show curves"
- **This is correct!** The pink/amber path shows the *ideal* skeleton path
- The unicycle robot **should deviate** from this ideal path
- The deviation IS the correct unicycle behavior

## Performance Parameters

### Default Settings (Balanced):
- K_v = 0.3 (linear gain)
- K_h = 3.0 (angular gain)
- v_max = 1.0 px/frame
- ω_max = 0.15 rad/frame

### For More Dramatic Turning:
- Increase ω_max to 0.3-0.5 rad/frame
- Decrease K_v to 0.2 (slower approach to corners)

### For Smoother Motion:
- Increase v_max to 2.0-3.0 px/frame
- Increase K_v to 0.5 (less slowdown at corners)

## Success Criteria

You've successfully implemented unicycle motion if you see:
1. ✅ Robot **curves around corners** instead of sharp turns
2. ✅ White **arrow rotates** smoothly
3. ✅ Robot **slows or stops** before sharp turns
4. ✅ Console shows varying v and ω values
5. ✅ Actual path **deviates** from ideal path overlay
