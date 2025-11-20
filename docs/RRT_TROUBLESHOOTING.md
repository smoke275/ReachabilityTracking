# RRT* Tracking - Troubleshooting Guide

## Common Issues and Solutions

### Issue: "Failed to build trees. Ensure both agents are placed."

**Symptoms:**
- Error message appears when clicking "Build Trees"
- Trees don't appear on canvas

**Causes & Solutions:**

1. **Agents Not Properly Placed**
   - **Check:** Open browser console (F12) and look for logs when placing agents
   - **Expected logs:**
     ```
     Pursuer state set: {x: ..., y: ..., theta: 0}
     Evader state set: {x: ..., y: ..., theta: 0}
     ```
   - **Solution:** Click "Place Pursuer" button, then click on canvas. Repeat for evader.

2. **Agent States Not Captured**
   - **Check:** When you click "Build Trees", console should show:
     ```
     buildTrees called
     Pursuer state: {x: ..., y: ..., theta: 0}
     Evader state: {x: ..., y: ..., theta: 0}
     ```
   - **If you see `null`:** The event listeners aren't capturing placement
   - **Solution:** 
     - Try using the Agents Window to place agents (recommended)
     - Ensure you're clicking on the canvas, not outside it

3. **Obstacles Not Loading**
   - **Check:** Console should show:
     ```
     RRT: Updated obstacles, count: X
     Obstacles: X
     ```
   - **Solution:** Draw some polygon obstacles first before building trees

### Issue: Trees Built But Not Visible

**Symptoms:**
- Success message appears
- Node counts shown
- No visual trees on canvas

**Causes & Solutions:**

1. **Trees Outside Viewport**
   - **Solution:** Use zoom/pan to navigate canvas

2. **Trees Behind Other Visualizations**
   - **Solution:** Disable other overlays (Visibility, Future Set, etc.)

3. **Tree Opacity Too Low**
   - **Location:** `PolygonCanvasController.js` - `drawRRTTree()` method
   - **Adjust:** Change `alpha` parameter (default 0.6) to 1.0 for full opacity

### Issue: Planning Takes Too Long

**Symptoms:**
- Browser freezes
- Trees take more than 2-3 seconds to build

**Causes & Solutions:**

1. **Too Many Nodes**
   - **Location:** `RRTStarService.js` - `config.max_nodes`
   - **Default:** 1000 nodes
   - **Reduce to:** 500 nodes for faster planning

2. **Collision Checking Overhead**
   - **Solution:** Reduce number of obstacles
   - **Or:** Increase `config.robot_radius` to reduce granularity

3. **Small Integration Step**
   - **Location:** `RRTStarService.js` - `config.dt`
   - **Default:** 0.05 seconds
   - **Increase to:** 0.1 seconds (faster but less accurate)

## Debugging Checklist

### Before Building Trees:

1. ✅ Open Browser Console (F12)
2. ✅ Draw at least one polygon obstacle (optional, but recommended)
3. ✅ Open "Agent Control" window
4. ✅ Click "Place Pursuer" → Click on canvas
5. ✅ Check console for: `Pursuer state set: {...}`
6. ✅ Click "Place Evader" → Click on canvas  
7. ✅ Check console for: `Evader state set: {...}`
8. ✅ Open "RRT* Tracking" window
9. ✅ Click "Build Trees"

### Expected Console Output:

```
Pursuer state set: {x: 300, y: 200, theta: 0}
Evader state set: {x: 500, y: 400, theta: 0}
buildTrees called
Pursuer state: {x: 300, y: 200, theta: 0}
Evader state: {x: 500, y: 400, theta: 0}
Canvas bounds set: {x_min: 0, x_max: 800, y_min: 0, y_max: 600}
RRT: Updated obstacles, count: 3
Obstacles: 3
Building pursuer RRT*...
Built RRT* tree: 487 nodes in 45.20ms
Building evader RRT*...
Built RRT* tree: 512 nodes in 48.35ms
Planning complete: {pursuerNodes: 487, evaderNodes: 512, planningTime: 93.55}
```

## Configuration Tuning

### Fast Planning (Good for Testing)

```javascript
// In RRTStarService.js constructor
this.config = {
    max_nodes: 300,           // Fewer nodes
    max_planning_time: 50,    // Less time
    steer_time: 0.3,         // Shorter steering
    dt: 0.1,                 // Larger time step
    rewire_radius: 30.0      // Smaller rewire radius
};
```

### High Quality Planning (For Final Results)

```javascript
// In RRTStarService.js constructor
this.config = {
    max_nodes: 2000,          // More nodes
    max_planning_time: 200,   // More time
    steer_time: 0.5,         // Default steering
    dt: 0.02,                // Smaller time step (more accurate)
    rewire_radius: 70.0      // Larger rewire radius (more optimization)
};
```

## Visual Customization

### Tree Colors

**Location:** `PolygonCanvasController.js` - `redraw()` method

```javascript
// Pursuer tree - currently blue
this.drawRRTTree(this.rrtTrees.pursuer, '#2196F3', 0.6);

// Evader tree - currently pink
this.drawRRTTree(this.rrtTrees.evader, '#C2185B', 0.6);
```

**Change to:**
- Green pursuer: `'#4CAF50'`
- Red evader: `'#F44336'`
- Increase opacity: `1.0` (last parameter)

### Node and Edge Sizes

**Location:** `PolygonCanvasController.js` - `drawRRTTree()` method

```javascript
// Edge width (currently 1.5)
ctx.lineWidth = 1.5;

// Node radius (currently 2)
ctx.arc(node.state.x, node.state.y, 2, 0, Math.PI * 2);

// Root node radius (currently 5)
ctx.arc(root.state.x, root.state.y, 5, 0, Math.PI * 2);
```

## Performance Tips

1. **Build trees ONCE** - Don't rebuild continuously unless tracking
2. **Start with few obstacles** - Add complexity gradually
3. **Use "Build Trees" button** - Don't use "Start Tracking" immediately
4. **Monitor console** - Watch for performance warnings
5. **Reduce max_nodes** - If planning takes > 200ms

## Contact & Support

- Check `docs/RRT_IMPLEMENTATION.md` for technical details
- Check `docs/RRT_QUICK_REFERENCE.md` for API usage
- Check GitHub issues for known problems
