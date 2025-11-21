# Rust/WASM Conversion Plan

## Overview
This document outlines the strategy for porting the ReachabilityTracking JavaScript codebase to Rust/WASM for improved performance.

## Conversion Order

### Phase 1: RRTStarService (CURRENT)
**Priority: HIGH** - Core algorithm, most self-contained, biggest performance gain

#### What to Port
1. **Data Structures**
   - `RRTNode` class → Rust struct
   - Tree structure with parent/children relationships
   - State representation `{x, y, theta}`

2. **Collision Detection Utilities**
   - `segmentIntersectsPolygon()`
   - `pointInPolygon()` - Ray casting algorithm
   - `segmentsIntersect()`
   - `robotCollidesWithObstacles()`
   - `pointToSegmentDistance()`

3. **Unicycle Dynamics**
   - `wrapToPi()` - Angle normalization
   - `integrateDDR()` - Differential drive robot integration

4. **RRT* Algorithm**
   - `buildRRTStar()` - Main tree building loop
   - `sampleRandomState()` - Random sampling in workspace
   - `findNearest()` - Nearest neighbor search
   - `findNearby()` - Radius-based neighbor search
   - `steer()` - Unicycle motion primitive
   - `rewire()` - RRT* optimization
   - `planBothAgents()` - Dual-tree planning

#### What to Skip/Remove
- **EventBus imports** - Line 14: `import { eventBus } from '../utils/EventBus.js';`
- **EventBus emit** - Line 636-640: `eventBus.emit('rrt:treesBuilt', {...})`
- Keep the logic, just remove event emissions

#### Performance Targets
- 5-10x faster tree building
- Handle 2000+ nodes efficiently (current: 1000 max)
- Reduce planning time from ~100ms to ~10-20ms

---

### Phase 2: SensorModelService (COMPLETE ✅)
**Priority: MEDIUM** - Used by ActiveTrackingService, performance critical

#### What to Port ✅
1. **Geometry Utilities** ✅
   - `segmentsIntersect()` (reused from Phase 1) ✅
   - `wrapAngle()` ✅
   - `direction()`, `onSegment()` ✅

2. **Core Visibility Logic** ✅
   - `canSee()` - Main sensor check (range, FOV, LOS) ✅
   - `checkLineOfSight()` - Ray-obstacle intersection ✅

#### What Was Skipped ✅
- Constructor event listeners (lines 111-137) - Not needed in WASM
- All visualization methods (`drawSensorRange`, `drawLOS`) - UI only
- Event emissions - Handled in JS wrapper
- `checkVisibility()`, `computeVisibility()` - Can be handled in JS wrapper

#### Performance Targets
- 10-20x faster visibility checks
- Enable larger visibility matrices

---

### Phase 3: ActiveTrackingService (COMPLETE ✅)
**Priority: MEDIUM-LOW** - Depends on Phases 1 & 2

#### What to Port ✅
1. **Visibility Matrix Computation** ✅
   - `computeVisibilityMatrix()` - O(n²) nested loops ✅
   - `treeToArray()` - Tree flattening (handled in tree conversion) ✅
   - `canSeeNode()` - Wrapper for sensor checks ✅

2. **Strategy Algorithms** ✅
   - `computeStrategies()` ✅
   - `_computePL()` - Pursuer as Leader ✅
   - `_computeEL()` - Evader as Leader ✅
   - `_computeELST()` - Evader with Shortest-Time Escape ✅
   - `_computeTMA()` - Two Moves Ahead ✅

#### What Was Skipped ✅
- Event emissions (lines 224, 365) - Not needed in WASM
- Initialization/setup methods - Handled differently in WASM
- Utility methods that are UI-focused - Not relevant for computation
- `findNearestTrackingNode()` - Can be added if needed

#### Performance Targets
- 20-50x faster visibility matrix computation
- Handle 1000x1000 matrices efficiently

---

## Technical Architecture

### WASM Module Structure
```
rust-wasm/
├── Cargo.toml
├── src/
│   ├── lib.rs              # WASM exports & public API
│   ├── rrt_star.rs         # Phase 1: RRT* implementation
│   ├── sensor_model.rs     # Phase 2: Sensor/visibility
│   ├── active_tracking.rs  # Phase 3: Strategy computation
│   ├── geometry.rs         # Shared geometry utilities
│   ├── types.rs            # Shared data structures
│   └── utils.rs            # Helper functions
└── tests/
    └── integration_tests.rs
```

### JavaScript Integration
```
src/workers/plannerWorker.js
  → Calls WASM module instead of JS services
  → Serializes/deserializes data
  → Same message protocol
```

---

## Data Serialization Strategy

### Use serde for JSON interop
```rust
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct State {
    x: f64,
    y: f64,
    theta: f64,
}
```

### Use wasm-bindgen for direct JS types
```rust
#[wasm_bindgen]
pub struct RRTStarService {
    // Internal implementation
}

#[wasm_bindgen]
impl RRTStarService {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self { ... }
    
    pub fn plan_both_agents(&mut self, ...) -> JsValue { ... }
}
```

---

## Development Process

### For Each Phase:
1. **Create Rust module** with data structures
2. **Port utility functions** (geometry, math)
3. **Port core algorithm** (main logic)
4. **Add WASM bindings** with wasm-bindgen
5. **Create JS wrapper** for seamless integration
6. **Write tests** (Rust unit tests + JS integration tests)
7. **Benchmark** against JS implementation
8. **Optimize** if needed
9. **Document** API and performance gains

---

## Testing Strategy

### Rust Unit Tests
- Test each utility function in isolation
- Test collision detection with known polygons
- Test tree building with fixed random seed
- Verify correctness against known solutions

### JavaScript Integration Tests
- Compare WASM output with JS implementation
- Ensure same results for identical inputs
- Validate serialization/deserialization
- Performance benchmarks

---

## Performance Monitoring

### Metrics to Track:
- Tree building time (ms)
- Number of nodes generated
- Visibility computation time (ms)
- Strategy computation time (ms)
- Memory usage
- WASM binary size

### Target Improvements:
- **RRT* tree building**: 5-10x faster
- **Visibility matrix**: 20-50x faster
- **Overall planning**: 10-20x faster
- **Memory**: 30-50% reduction

---

## Quick Win Alternative

If immediate performance gains are needed, start with just the visibility matrix computation in `ActiveTrackingService.computeVisibilityMatrix()`:
- Most expensive operation (O(n²))
- Self-contained double loop
- Clear input/output
- Can keep RRT* in JS initially

---

## Notes

### EventBus Handling
- All `eventBus.emit()` calls are removed in WASM
- Worker will handle event emissions in JS layer
- No event listeners in WASM (worker context doesn't need them)

### Random Number Generation
- Use `rand` crate with `getrandom` for WASM-compatible RNG
- Seed for reproducible testing

### Floating Point
- Use `f64` for all coordinates and angles
- Be aware of precision differences between JS and Rust

### Memory Management
- WASM linear memory is separate from JS heap
- Minimize data copying across boundary
- Reuse buffers where possible
- Consider using `wasm-bindgen`'s `RefCell` for stateful objects

---

## Current Status

- [x] Project structure created
- [x] Dependencies configured
- [x] Phase 1: RRTStarService (COMPLETE)
- [x] Phase 2: SensorModelService (COMPLETE)
- [x] Phase 3: ActiveTrackingService (COMPLETE)
- [ ] Integration with plannerWorker.js
- [ ] Performance benchmarking
- [ ] Documentation

---

## Building & Running

```bash
# Install wasm-pack
curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh

# Build the WASM module
cd rust-wasm
wasm-pack build --target web --out-dir ../pkg

# Or for development with debugging
wasm-pack build --dev --target web --out-dir ../pkg

# Run tests
cargo test
wasm-pack test --node
```

---

## Integration Example

```javascript
// Load WASM module
import init, { RRTStarService } from './pkg/reachability_wasm.js';

await init();

// Use in worker
const rrt = new RRTStarService();
rrt.initialize(obstacles, bounds);
const result = rrt.plan_both_agents(pursuerState, evaderState);
```

---

## Resources

- [wasm-bindgen documentation](https://rustwasm.github.io/wasm-bindgen/)
- [Rust and WebAssembly book](https://rustwasm.github.io/docs/book/)
- [serde documentation](https://serde.rs/)
