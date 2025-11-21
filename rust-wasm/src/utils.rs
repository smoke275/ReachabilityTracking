//! Utility functions for the WASM module

use crate::types::{State, Control};
use crate::geometry::wrap_to_pi;

/// Integrate unicycle dynamics for one time step using Euler integration
pub fn integrate_unicycle(state: &State, control: &Control, dt: f64) -> State {
    let x_new = state.x + control.v * state.theta.cos() * dt;
    let y_new = state.y + control.v * state.theta.sin() * dt;
    let theta_new = wrap_to_pi(state.theta + control.omega * dt);
    
    State::new(x_new, y_new, theta_new)
}

/// Calculate distance between two states (Euclidean + weighted angular)
pub fn state_distance(s1: &State, s2: &State, angular_weight: f64) -> f64 {
    let dx = s1.x - s2.x;
    let dy = s1.y - s2.y;
    let position_dist = (dx * dx + dy * dy).sqrt();
    
    let angle_diff = wrap_to_pi(s1.theta - s2.theta).abs();
    
    position_dist + angular_weight * angle_diff
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::f64::consts::PI;

    #[test]
    fn test_integrate_unicycle() {
        let state = State::new(0.0, 0.0, 0.0);
        let control = Control { v: 10.0, omega: 0.0 };
        let dt = 0.1;
        
        let new_state = integrate_unicycle(&state, &control, dt);
        
        assert!((new_state.x - 1.0).abs() < 1e-10);
        assert!((new_state.y - 0.0).abs() < 1e-10);
        assert!((new_state.theta - 0.0).abs() < 1e-10);
    }

    #[test]
    fn test_integrate_unicycle_with_rotation() {
        let state = State::new(0.0, 0.0, 0.0);
        let control = Control { v: 10.0, omega: PI };
        let dt = 0.1;
        
        let new_state = integrate_unicycle(&state, &control, dt);
        
        assert!(new_state.x > 0.0);
        assert!((new_state.y - 0.0).abs() < 1e-10);
        assert!((new_state.theta - 0.1 * PI).abs() < 1e-10);
    }

    #[test]
    fn test_state_distance() {
        let s1 = State::new(0.0, 0.0, 0.0);
        let s2 = State::new(3.0, 4.0, 0.0);
        
        let dist = state_distance(&s1, &s2, 0.0);
        assert!((dist - 5.0).abs() < 1e-10);
    }
}
