//! Sensor model implementation with FOV, range, and line-of-sight
//! Based on surveillance model with upper/lower range, FOV, and LOS checks

use wasm_bindgen::prelude::*;
use std::f64::consts::PI;

use crate::types::{Point, Polygon, SensorParams};
use crate::geometry::{segments_intersect, wrap_to_pi};

/// Sensor model service for visibility checks
#[wasm_bindgen]
pub struct SensorModelService {
    pursuer_sensor: SensorParams,
    evader_sensor: SensorParams,
    obstacles: Vec<Polygon>,
}

#[wasm_bindgen]
impl SensorModelService {
    /// Create a new sensor model service with default parameters
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            pursuer_sensor: SensorParams::default(),
            evader_sensor: SensorParams {
                enabled: true,
                r_min: 15.0,
                r_max: 120.0,
                fov: 270.0,
                orientation: 0.0,
            },
            obstacles: Vec::new(),
        }
    }
    
    /// Set obstacles for line-of-sight checking
    pub fn set_obstacles(&mut self, obstacles_json: JsValue) -> Result<(), JsValue> {
        let obstacles: Vec<Polygon> = serde_wasm_bindgen::from_value(obstacles_json)
            .map_err(|e| JsValue::from_str(&format!("Failed to parse obstacles: {:?}", e)))?;
        self.obstacles = obstacles;
        Ok(())
    }
    
    /// Update pursuer sensor parameters
    pub fn update_pursuer_sensor(&mut self, params_json: JsValue) -> Result<(), JsValue> {
        let params: SensorParams = serde_wasm_bindgen::from_value(params_json)
            .map_err(|e| JsValue::from_str(&format!("Failed to parse sensor params: {:?}", e)))?;
        self.pursuer_sensor = params;
        Ok(())
    }
    
    /// Update evader sensor parameters
    pub fn update_evader_sensor(&mut self, params_json: JsValue) -> Result<(), JsValue> {
        let params: SensorParams = serde_wasm_bindgen::from_value(params_json)
            .map_err(|e| JsValue::from_str(&format!("Failed to parse sensor params: {:?}", e)))?;
        self.evader_sensor = params;
        Ok(())
    }
    
    /// Get current pursuer sensor parameters
    pub fn get_pursuer_sensor(&self) -> Result<JsValue, JsValue> {
        serde_wasm_bindgen::to_value(&self.pursuer_sensor)
            .map_err(|e| JsValue::from_str(&format!("Failed to serialize sensor params: {:?}", e)))
    }
    
    /// Get current evader sensor parameters
    pub fn get_evader_sensor(&self) -> Result<JsValue, JsValue> {
        serde_wasm_bindgen::to_value(&self.evader_sensor)
            .map_err(|e| JsValue::from_str(&format!("Failed to serialize sensor params: {:?}", e)))
    }
    
    /// Main sensor check: can pursuer see evader?
    /// 
    /// # Arguments
    /// * `p_x`, `p_y` - Pursuer position
    /// * `p_theta` - Pursuer heading (radians)
    /// * `e_x`, `e_y` - Evader position
    /// * `use_pursuer_sensor` - If true, use pursuer sensor params; else use evader sensor params
    /// 
    /// # Returns
    /// Boolean indicating if target is visible
    pub fn can_see(
        &self,
        p_x: f64,
        p_y: f64,
        p_theta: f64,
        e_x: f64,
        e_y: f64,
        use_pursuer_sensor: bool,
    ) -> bool {
        let sensor_params = if use_pursuer_sensor {
            &self.pursuer_sensor
        } else {
            &self.evader_sensor
        };
        
        if !sensor_params.enabled {
            return false;
        }
        
        self.can_see_with_params(p_x, p_y, p_theta, e_x, e_y, sensor_params)
    }
    
    /// Check line-of-sight between two points
    pub fn check_line_of_sight(&self, x1: f64, y1: f64, x2: f64, y2: f64) -> bool {
        let p1 = Point::new(x1, y1);
        let p2 = Point::new(x2, y2);
        self.line_of_sight_clear(&p1, &p2)
    }
}

// Internal implementation
impl SensorModelService {
    /// Check visibility with specific sensor parameters
    fn can_see_with_params(
        &self,
        p_x: f64,
        p_y: f64,
        p_theta: f64,
        e_x: f64,
        e_y: f64,
        sensor_params: &SensorParams,
    ) -> bool {
        // 1. Distance check
        let dx = e_x - p_x;
        let dy = e_y - p_y;
        let distance = (dx * dx + dy * dy).sqrt();
        
        // Check if in valid range (not in blind spot and within max range)
        if distance <= sensor_params.r_min || distance > sensor_params.r_max {
            return false;
        }
        
        // 2. FOV check (if not omni-directional)
        if sensor_params.fov < 360.0 {
            // Angle to evader
            let psi = dy.atan2(dx);
            
            // Sensor axis direction
            let phi = p_theta + sensor_params.orientation;
            
            // Angular difference
            let angle_diff = wrap_to_pi(psi - phi).abs();
            
            // Convert FOV to radians and check
            let fov_rad = (sensor_params.fov * PI) / 180.0;
            if angle_diff > fov_rad / 2.0 {
                return false;
            }
        }
        
        // 3. Line-of-sight check
        let p1 = Point::new(p_x, p_y);
        let p2 = Point::new(e_x, e_y);
        self.line_of_sight_clear(&p1, &p2)
    }
    
    /// Check if line-of-sight is clear between two points
    fn line_of_sight_clear(&self, p1: &Point, p2: &Point) -> bool {
        if self.obstacles.is_empty() {
            return true;
        }
        
        // Check against each obstacle edge
        for obstacle in &self.obstacles {
            let vertices = &obstacle.vertices;
            if vertices.len() < 2 {
                continue;
            }
            
            for i in 0..vertices.len() {
                let v1 = &vertices[i];
                let v2 = &vertices[(i + 1) % vertices.len()];
                
                if segments_intersect(p1, p2, v1, v2) {
                    return false;
                }
            }
        }
        
        true
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_can_see_within_range() {
        let mut sensor = SensorModelService::new();
        sensor.obstacles = Vec::new();
        
        // Pursuer at origin, evader at (100, 0)
        let can_see = sensor.can_see(0.0, 0.0, 0.0, 100.0, 0.0, true);
        assert!(can_see, "Should see target within range");
    }

    #[test]
    fn test_cannot_see_too_close() {
        let sensor = SensorModelService::new();
        
        // Evader too close (in blind spot)
        let can_see = sensor.can_see(0.0, 0.0, 0.0, 10.0, 0.0, true);
        assert!(!can_see, "Should not see target in blind spot");
    }

    #[test]
    fn test_cannot_see_too_far() {
        let sensor = SensorModelService::new();
        
        // Evader too far
        let can_see = sensor.can_see(0.0, 0.0, 0.0, 200.0, 0.0, true);
        assert!(!can_see, "Should not see target beyond max range");
    }

    #[test]
    fn test_fov_check() {
        let mut sensor = SensorModelService::new();
        sensor.pursuer_sensor.fov = 90.0; // 90 degree FOV
        
        // Target directly ahead (should see)
        let can_see = sensor.can_see(0.0, 0.0, 0.0, 100.0, 0.0, true);
        assert!(can_see, "Should see target ahead");
        
        // Target behind (should not see)
        let can_see = sensor.can_see(0.0, 0.0, 0.0, -100.0, 0.0, true);
        assert!(!can_see, "Should not see target behind with 90° FOV");
    }

    #[test]
    fn test_line_of_sight_blocked() {
        let mut sensor = SensorModelService::new();
        
        // Add obstacle between pursuer and evader
        let obstacle = Polygon::new(vec![
            Point::new(40.0, -10.0),
            Point::new(60.0, -10.0),
            Point::new(60.0, 10.0),
            Point::new(40.0, 10.0),
        ]);
        sensor.obstacles = vec![obstacle];
        
        // Pursuer at (0,0), evader at (100,0), obstacle blocks path
        let can_see = sensor.can_see(0.0, 0.0, 0.0, 100.0, 0.0, true);
        assert!(!can_see, "Should not see target through obstacle");
    }
}
