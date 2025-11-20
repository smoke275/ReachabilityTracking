# RRT* Debugging Guide

## Issue: Pursuer Tree Only Has One Node

### Symptoms
- Evader tree builds successfully with many nodes
- Pursuer tree only shows root node (single dot)
- Console shows something like: "Pursuer 1 nodes, Evader 500 nodes"

### Root Causes

#### 1. Agent Starting Inside Obstacle
**Check console for:**
```
Pursuer is starting inside an obstacle! {x: ..., y: ..., theta: ...}
```

**Why this happens:**
- Pursuer was placed directly on/inside a polygon obstacle
- Robot radius is too large relative to free space

**Solution:**
- Place pursuer in open space away from obstacles
- Or reduce `robot_radius` in `RRTStarService.js`:
  ```javascript
  robot_radius: 5.0,  // Smaller radius
  ```

#### 2. All Steering Attempts Failing
**Check console for:**
```
Stopped due to time limit. Nodes: 1, Iterations: 1000, Failed: 999
Steering failed: {from: {...}, to: {...}, nodes: 1, failedAttempts: 1}
Collision detected at step X
```

**Common reasons:**
- **Dense obstacles:** Free space is very limited
- **Bounds too small:** Robot hits workspace boundaries
- **Goal sampling too high:** Always trying to reach unreachable evader
- **Robot radius too large:** Can't fit through gaps

**Solutions:**

1. **Reduce obstacle density:**
   - Delete some polygons
   - Make polygons smaller
   - Ensure there's clear path between agents

2. **Check workspace bounds:**
   ```javascript
   // In console, check:
   Canvas bounds set: {x_min: 0, x_max: 800, y_min: 0, y_max: 600}
   ```
   - Make sure canvas is large enough
   - Ensure agents aren't near edges

3. **Reduce goal sampling rate:**
   ```javascript
   // In RRTStarService.js (already adjusted):
   goal_sample_rate: 0.05,  // Was 0.1
   ```

4. **Reduce robot radius:**
   ```javascript
   // In RRTStarService.js:
   robot_radius: 5.0,  // Smaller = easier to navigate
   ```

5. **Adjust unicycle parameters:**
   ```javascript
   v_max: 15.0,        // Faster = covers more distance
   steer_time: 0.4,    // Shorter = more flexible steering
   dt: 0.08,           // Larger = faster simulation
   ```

#### 3. Out of Bounds Issues
**Check console for:**
```
Out of bounds at step X nextState: {x: -5, y: 200, ...} bounds: {x_min: 0, ...}
```

**Why this happens:**
- Agent placed near edge of canvas
- Steering causes robot to leave workspace
- Negative coordinates or exceeding canvas size

**Solution:**
- Place agents more centrally on canvas
- Ensure canvas bounds are correctly set
- Add padding to placement:
  ```javascript
  // When placing agents, stay away from edges:
  const padding = 50;
  // Place between (padding, padding) and (width-padding, height-padding)
  ```

### Debugging Workflow

#### Step 1: Check Console Output
After clicking "Build Trees", look for:

```javascript
// Good output:
buildTrees called
Pursuer state: {x: 300, y: 250, theta: 0}
Evader state: {x: 500, y: 400, theta: 0}
Canvas bounds set: {x_min: 0, x_max: 800, y_min: 0, y_max: 600}
Obstacles: 3
Planning with states: {...}
Building pursuer RRT*...
Built RRT* tree: 450 nodes in 85ms  // ✅ Good
Building evader RRT*...
Built RRT* tree: 520 nodes in 92ms  // ✅ Good

// Bad output:
Building pursuer RRT*...
Steering failed: {from: {...}, to: {...}, nodes: 1, failedAttempts: 1}
Collision detected at step 2
Stopped due to time limit. Nodes: 1, Iterations: 547, Failed: 546  // ❌ Problem!
Built RRT* tree: 1 nodes in 100ms
```

#### Step 2: Identify the Failure Mode

| Console Message | Problem | Fix |
|----------------|---------|-----|
| "Pursuer is starting inside an obstacle!" | Bad placement | Reposition pursuer |
| "Collision detected at step X" | Too many/large obstacles | Reduce obstacles or robot_radius |
| "Out of bounds at step X" | Near edge | Place more centrally |
| "Failed: 99%" of attempts | Can't expand | Adjust parameters below |

#### Step 3: Try Quick Fixes (in order)

1. **Reposition agents** (easiest)
   - Reset RRT window
   - Delete and replace both agents
   - Place in open areas

2. **Reduce robot radius** (quick parameter change)
   ```javascript
   // RRTStarService.js line ~235
   robot_radius: 5.0,  // Down from 8.0
   ```

3. **Reduce goal sampling** (already done)
   ```javascript
   goal_sample_rate: 0.02,  // Down from 0.05
   ```

4. **Simplify environment** (easy to test)
   - Delete all obstacles temporarily
   - If it works, add obstacles back slowly
   - Identifies if obstacle density is the issue

5. **Adjust steering parameters** (advanced)
   ```javascript
   steer_time: 0.3,    // Shorter
   v_max: 20.0,        // Faster
   dt: 0.1,            // Larger steps
   ```

### Advanced Debugging

#### Enable Detailed Logging

In `RRTStarService.js`, modify `buildRRTStar`:

```javascript
// Change this line:
const enableDebug = (failedAttempts < 3 && nodes.length === 1);

// To this (logs more):
const enableDebug = (failedAttempts < 10);
```

This will show first 10 steering failures with details.

#### Test Without Obstacles

Temporarily disable collision checking:

```javascript
// In RRTStarService.js, modify isStateInCollision:
isStateInCollision(state) {
    return false;  // Disable collision checking
    // return robotCollidesWithObstacles(...);  // Original
}
```

If trees build successfully, obstacle density is the problem.

#### Test Without Goal Bias

Force pure exploration:

```javascript
// In buildRRTStar, change:
goal_sample_rate: 0.0,  // No goal bias
```

If pursuer tree builds now, the evader position is unreachable.

### Configuration Presets

#### Preset 1: Dense Obstacles
```javascript
config = {
    v_max: 20.0,
    omega_max: 2.0,
    max_nodes: 1500,
    max_planning_time: 150,
    steer_time: 0.3,
    dt: 0.08,
    goal_sample_rate: 0.02,
    rewire_radius: 40.0,
    robot_radius: 5.0,
};
```

#### Preset 2: Open Environment
```javascript
config = {
    v_max: 15.0,
    omega_max: 1.5,
    max_nodes: 800,
    max_planning_time: 80,
    steer_time: 0.4,
    dt: 0.05,
    goal_sample_rate: 0.1,
    rewire_radius: 60.0,
    robot_radius: 8.0,
};
```

#### Preset 3: Fast Testing
```javascript
config = {
    v_max: 25.0,
    omega_max: 2.5,
    max_nodes: 300,
    max_planning_time: 50,
    steer_time: 0.2,
    dt: 0.1,
    goal_sample_rate: 0.0,  // No goal bias
    rewire_radius: 30.0,
    robot_radius: 6.0,
};
```

### Validation Checklist

Before building trees:
- [ ] Both agents placed in open space (not on obstacles)
- [ ] Agents are not near canvas edges (>50px padding)
- [ ] At least 100px distance between agents
- [ ] Obstacles cover less than 50% of workspace
- [ ] Console shows no "starting inside obstacle" warnings
- [ ] Canvas bounds correctly detected

After first build attempt:
- [ ] Console shows "Building pursuer RRT*..."
- [ ] No "Collision detected" in first 3 attempts
- [ ] "Failed" attempts < 80% of iterations
- [ ] Both trees have > 100 nodes
- [ ] Planning time < 200ms total

### Still Having Issues?

1. **Start fresh:**
   - Reload page (F5)
   - Draw ONE simple rectangular obstacle
   - Place agents far apart in open space
   - Build trees

2. **Check browser console for errors:**
   - F12 → Console tab
   - Look for red error messages
   - Screenshot and report

3. **Try default configuration:**
   - Restore all default values in `RRTStarService.js`
   - Use the original parameters

4. **Verify the implementation:**
   - Check `docs/RRT_TROUBLESHOOTING.md` for common issues
   - Review expected console output
   - Compare with working screenshots
