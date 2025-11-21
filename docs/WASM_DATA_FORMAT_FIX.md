# WASM Data Format Fixes

## Issues Resolved

### 1. Missing `bounds` Field in Config Updates
**Error:** `Failed to parse config: Error(JsValue(Error: missing field 'bounds'`

**Root Cause:** 
- WASM's `RRTConfig` struct requires `bounds` field to always be present
- When updating config via `update_config()`, JavaScript only sent changed parameters
- Rust serde deserialization failed because `bounds` was missing

**Solution:**
- Added `globalBounds` variable to store bounds from initialization
- Modified config update handler to include bounds if not present in update:
```javascript
if (!rrtConfig.bounds && globalBounds) {
  rrtConfig.bounds = globalBounds;
}
```

### 2. Missing `state` Field in Tree Nodes
**Error:** `Failed to parse pursuer tree: Error(JsValue(Error: missing field 'state'`
**Error:** `Failed to parse pursuer tree: Error(JsValue(Error: missing field 'children_idx'`

**Root Cause:**
- WASM planning returns `FlatTree` with `SerializableNode` format: `{x, y, theta, cost}`
- WASM's `compute_visibility_matrix()` expects complete `Vec<RRTNode>` format with full structure
- RRTNode requires: `{state: {x, y, theta}, parent_idx, children_idx, cost}`
- Direct pass-through failed type validation

**Solution:**
- Added complete tree transformation before visibility computation:
```javascript
const transformFlatTree = (flatTree) => {
  const nodes = flatTree.nodes.map((node, idx) => ({
    state: { x: node.x, y: node.y, theta: node.theta },
    parent_idx: null, // Will be filled from edges
    children_idx: [],  // Will be filled from edges
    cost: node.cost
  }));
  
  // Build parent-child relationships from edges
  for (const [parentIdx, childIdx] of flatTree.edges) {
    nodes[childIdx].parent_idx = parentIdx;
    nodes[parentIdx].children_idx.push(childIdx);
  }
  
  return nodes;
};

const pursuerNodes = transformFlatTree(pursuerTree);
const evaderNodes = transformFlatTree(evaderTree);
activeService.compute_visibility_matrix(pursuerNodes, evaderNodes);
```

## Data Format Reference

### JavaScript → WASM Type Mappings

1. **SerializableNode (RRT output)**
```javascript
{
  x: number,
  y: number, 
  theta: number,
  cost: number
}
```

2. **RRTNode (visibility input)**
```javascript
{
  state: {
    x: number,
    y: number,
    theta: number
  },
  parent_idx: number | null,  // Index of parent node (null for root)
  children_idx: number[],     // Array of child node indices
  cost: number
}
```

3. **RRTConfig (must include bounds)**
```javascript
{
  maxNodes: number,
  maxPlanningTime: number,
  steerTime: number,
  dt: number,
  goalSampleRate: number,
  rewireRadius: number,
  robotRadius: number,
  vMax: number,
  vMin: number,
  omegaMax: number,
  bounds: {  // REQUIRED - must always be present
    xMin: number,
    xMax: number,
    yMin: number,
    yMax: number
  }
}
```

## Key Takeaways

1. **WASM requires complete structs** - Rust serde deserialization expects all non-optional fields
2. **Type compatibility** - JavaScript objects must match exact Rust struct shape
3. **Data transformation** - Need explicit mapping between different serialization formats
4. **State persistence** - Store critical config (like bounds) globally for partial updates

## Files Modified

- `/src/workers/plannerWASMWorker.js`:
  - Added `globalBounds` variable
  - Modified init handler to store bounds
  - Modified config handler to include bounds
  - Added `transformNodes()` helper for node format conversion
  - Updated visibility computation to use transformed nodes

## Status
✅ Both errors fixed - WASM worker now handles config updates and visibility computation correctly
