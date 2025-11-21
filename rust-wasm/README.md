# ReachabilityTracking Rust/WASM Module

High-performance Rust implementation of RRT*, sensor models, and active tracking algorithms compiled to WebAssembly.

## Quick Start

### Prerequisites

```bash
# Install Rust (if not already installed)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install wasm-pack
curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh

# Add wasm32 target
rustup target add wasm32-unknown-unknown
```

### Build

```bash
# Development build (with debug info)
wasm-pack build --dev --target web --out-dir ../pkg

# Production build (optimized)
wasm-pack build --release --target web --out-dir ../pkg
```

### Test

```bash
# Run Rust unit tests
cargo test

# Run WASM tests in browser
wasm-pack test --headless --firefox
```

### Usage in JavaScript

```javascript
import init, { RRTStarService } from './pkg/reachability_wasm.js';

// Initialize WASM module
await init();

// Create service
const rrt = new RRTStarService();

// Initialize with obstacles and config
await rrt.initialize(obstacles, config);

// Set agent states
rrt.set_pursuer_state(100, 100, 0);
rrt.set_evader_state(700, 500, Math.PI);

// Plan
const result = rrt.plan_both_agents();
console.log(result.stats);
```

## Project Structure

```
rust-wasm/
├── src/
│   ├── lib.rs              # Main module exports
│   ├── types.rs            # Common data structures
│   ├── geometry.rs         # Collision detection utilities
│   ├── utils.rs            # Helper functions
│   ├── rrt_star.rs         # RRT* implementation (Phase 1)
│   ├── sensor_model.rs     # Sensor/visibility (Phase 2)
│   └── active_tracking.rs  # Strategy computation (Phase 3)
├── Cargo.toml              # Dependencies
├── CONVERSION_PLAN.md      # Detailed porting strategy
└── README.md               # This file
```

## Current Status

- ✅ Phase 1: RRTStarService (COMPLETE)
  - RRT* tree building
  - Unicycle dynamics
  - Collision detection
  - Dual-tree planning
- ✅ Phase 2: SensorModelService (COMPLETE)
  - Visibility checks with FOV & range
  - Line-of-sight occlusion detection
  - Dynamic sensor parameter updates
- ⏳ Phase 3: ActiveTrackingService (TODO)

## Performance Targets

- **RRT* tree building**: 5-10x faster than JavaScript
- **Visibility matrix**: 20-50x faster than JavaScript
- **Overall planning**: 10-20x faster than JavaScript

## Development

### Adding Dependencies

```bash
cargo add <dependency-name>
```

### Rebuilding on Changes

```bash
# Watch mode (requires cargo-watch)
cargo install cargo-watch
cargo watch -x 'build --target wasm32-unknown-unknown'
```

### Debugging

Enable console logging:

```rust
web_sys::console::log_1(&JsValue::from_str("Debug message"));
```

## API Documentation

See [CONVERSION_PLAN.md](./CONVERSION_PLAN.md) for detailed API and conversion strategy.

## License

Same as main project.
