//! ReachabilityTracking WASM Module
//! 
//! High-performance Rust implementation of RRT*, sensor models, and active tracking
//! algorithms for pursuit-evasion games.

use wasm_bindgen::prelude::*;

mod types;
mod geometry;
mod rrt_star;
mod sensor_model;
mod active_tracking;
mod utils;

// Re-export main API
pub use rrt_star::RRTStarService;
pub use sensor_model::SensorModelService;
pub use active_tracking::ActiveTrackingService;

/// Initialize the WASM module
/// This sets up panic hooks for better error messages in the browser console
#[wasm_bindgen(start)]
pub fn init() {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

/// Get the version of the WASM module
#[wasm_bindgen]
pub fn version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_version() {
        assert!(!version().is_empty());
    }
}
