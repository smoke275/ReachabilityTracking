# Real-Time Tracking Bounds Initialization Fix

## Problem
When using Real-Time Tracking, the RRT* tree generation was not working correctly - only showing 1 evader node and 1 pursuer node initially. The trees would only start generating normally after opening the RRT-based tracking window and clicking "Build Once".

## Root Cause
The `RRTStarService` requires workspace bounds to be set in `config.bounds` before it can properly build RRT* trees. These bounds define the sampling space for random node generation.

**The issue was:**
- When the RRT Window's `buildTrees()` method was called, it properly calculated and set the bounds based on the polygons
- However, when Real-Time Tracking or Active Tracking windows were opened, they only set the `obstacles` but **never set the bounds**
- Without proper bounds, the `sampleRandomState()` method in RRTStarService would use default or uninitialized bounds, resulting in very limited tree growth

## Solution
Added workspace bounds calculation to both tracking window initialization methods:

### 1. `showActiveTrackingWindow()` in `app.js`
- Now calculates workspace bounds from polygons
- Sets `rrtStarService.config.bounds` before opening the window

### 2. `showRealTimeTrackingWindow()` in `app.js`
- Now calculates workspace bounds from polygons
- Sets `rrtStarService.config.bounds` before opening the window

### 3. Added `calculateWorkspaceBounds()` utility method
- Calculates bounding box from all polygon vertices
- Includes agent positions if available
- Adds margin for exploration space (20% of size, minimum 200 pixels)
- Returns bounds object: `{x_min, x_max, y_min, y_max}`

## Changes Made
**File: `/src/app.js`**

1. Updated `showActiveTrackingWindow()` to calculate and set bounds
2. Updated `showRealTimeTrackingWindow()` to calculate and set bounds
3. Added new method `calculateWorkspaceBounds(obstacles)` to App class

## Testing
After this fix:
- Real-Time Tracking should generate full RRT* trees immediately upon start
- Active Tracking should also work independently without requiring RRT window initialization
- Both tracking modes now properly initialize the RRT* service with complete configuration

## Technical Details
The bounds calculation logic:
1. Finds min/max X and Y coordinates from all polygon vertices
2. Includes agent positions (pursuer/evader) in the calculation
3. Adds a margin (20% of workspace size, minimum 200px) for exploration
4. Returns bounds that encompass all obstacles and agents with room to explore

This ensures the RRT* sampling has an appropriate workspace to generate nodes that are relevant to the pursuit-evasion problem.
