//! Active tracking service with visibility matrix and strategy computation
//! 
//! Based on surveillance and collision-free tracking paper:
//! - Computes visibility relationships between pursuer and evader nodes
//! - Ne(n_i^p): Set of evader nodes NOT visible from pursuer node i
//! - Np(n_j^e): Set of pursuer nodes that CAN see evader node j

use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};

use crate::types::RRTNode;
use crate::sensor_model::SensorModelService;

/// Statistics for visibility computation
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VisibilityStats {
    pub total_pursuer_nodes: usize,
    pub total_evader_nodes: usize,
    pub visibility_compute_time: f64,
    pub visible_pairs: usize,
    pub total_pairs: usize,
    pub visibility_ratio: f64,
    pub average_non_visible_evader_nodes: f64,
    pub average_tracking_pursuer_nodes: f64,
}

/// Result of visibility matrix computation
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VisibilityResult {
    pub visibility_matrix: Vec<Vec<bool>>,
    pub ne: Vec<Vec<usize>>,  // Non-visible evader nodes for each pursuer node
    pub np: Vec<Vec<usize>>,  // Tracking pursuer nodes for each evader node
    pub stats: VisibilityStats,
}

/// Strategy solution
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StrategyResult {
    pub best_value: f64,
    pub winning_node_index: i32,  // -1 if no solution
    #[serde(rename = "type")]
    pub agent_type: String,  // "pursuer" or "evader"
}

/// All strategy solutions
#[derive(Serialize, Deserialize)]
pub struct StrategySolutions {
    pub pl: StrategyResult,
    pub el: StrategyResult,
    pub elst: StrategyResult,
    pub tma: StrategyResult,
}

/// Active tracking service
#[wasm_bindgen]
pub struct ActiveTrackingService {
    visibility_matrix: Option<Vec<Vec<bool>>>,
    ne: Vec<Vec<usize>>,
    np: Vec<Vec<usize>>,
    pursuer_nodes: Vec<RRTNode>,
    evader_nodes: Vec<RRTNode>,
    sensor_service: SensorModelService,
    stats: Option<VisibilityStats>,
}

#[wasm_bindgen]
impl ActiveTrackingService {
    /// Create a new active tracking service
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            visibility_matrix: None,
            ne: Vec::new(),
            np: Vec::new(),
            pursuer_nodes: Vec::new(),
            evader_nodes: Vec::new(),
            sensor_service: SensorModelService::new(),
            stats: None,
        }
    }
    
    /// Set obstacles for visibility checking
    pub fn set_obstacles(&mut self, obstacles_json: JsValue) -> Result<(), JsValue> {
        self.sensor_service.set_obstacles(obstacles_json)
    }
    
    /// Update sensor model service configuration
    pub fn update_sensor_params(&mut self, params_json: JsValue) -> Result<(), JsValue> {
        self.sensor_service.update_pursuer_sensor(params_json)
    }
    
    /// Compute visibility matrix between pursuer and evader trees
    /// 
    /// # Arguments
    /// * `pursuer_tree_json` - Flattened pursuer tree nodes as JSON
    /// * `evader_tree_json` - Flattened evader tree nodes as JSON
    /// 
    /// # Returns
    /// JSON object with visibility matrix, Ne, Np, and stats
    pub fn compute_visibility_matrix(
        &mut self,
        pursuer_tree_json: JsValue,
        evader_tree_json: JsValue,
    ) -> Result<JsValue, JsValue> {
        let start_time = js_sys::Date::now();
        
        // Parse trees
        self.pursuer_nodes = serde_wasm_bindgen::from_value(pursuer_tree_json)
            .map_err(|e| JsValue::from_str(&format!("Failed to parse pursuer tree: {:?}", e)))?;
        self.evader_nodes = serde_wasm_bindgen::from_value(evader_tree_json)
            .map_err(|e| JsValue::from_str(&format!("Failed to parse evader tree: {:?}", e)))?;
        
        let num_pursuer = self.pursuer_nodes.len();
        let num_evader = self.evader_nodes.len();
        
        web_sys::console::log_1(&JsValue::from_str(&format!(
            "Computing visibility matrix: {} pursuer nodes × {} evader nodes",
            num_pursuer, num_evader
        )));
        
        // Initialize visibility matrix
        self.visibility_matrix = Some(vec![vec![false; num_evader]; num_pursuer]);
        self.ne = vec![Vec::new(); num_pursuer];
        self.np = vec![Vec::new(); num_evader];
        
        let mut visible_pairs = 0;
        
        // Compute visibility for each pair
        for i in 0..num_pursuer {
            for j in 0..num_evader {
                let is_visible = self.can_see_node(i, j);
                
                if let Some(ref mut matrix) = self.visibility_matrix {
                    matrix[i][j] = is_visible;
                }
                
                if is_visible {
                    visible_pairs += 1;
                    // Pursuer node i can see evader node j
                    self.np[j].push(i);
                } else {
                    // Pursuer node i cannot see evader node j
                    self.ne[i].push(j);
                }
            }
            
            // Progress logging
            if (i + 1) % 100 == 0 || i == num_pursuer - 1 {
                web_sys::console::log_1(&JsValue::from_str(&format!(
                    "Visibility computation: {}/{} pursuer nodes processed",
                    i + 1, num_pursuer
                )));
            }
        }
        
        let compute_time = js_sys::Date::now() - start_time;
        
        // Calculate statistics
        let avg_non_visible = self.ne.iter().map(|v| v.len()).sum::<usize>() as f64 / num_pursuer as f64;
        let avg_tracking = self.np.iter().map(|v| v.len()).sum::<usize>() as f64 / num_evader as f64;
        
        let stats = VisibilityStats {
            total_pursuer_nodes: num_pursuer,
            total_evader_nodes: num_evader,
            visibility_compute_time: compute_time,
            visible_pairs,
            total_pairs: num_pursuer * num_evader,
            visibility_ratio: visible_pairs as f64 / (num_pursuer * num_evader) as f64,
            average_non_visible_evader_nodes: avg_non_visible,
            average_tracking_pursuer_nodes: avg_tracking,
        };
        
        self.stats = Some(stats.clone());
        
        web_sys::console::log_1(&JsValue::from_str(&format!(
            "Visibility computation complete: {:.2}ms, {} visible pairs",
            compute_time, visible_pairs
        )));
        
        let result = VisibilityResult {
            visibility_matrix: self.visibility_matrix.clone().unwrap(),
            ne: self.ne.clone(),
            np: self.np.clone(),
            stats,
        };
        
        serde_wasm_bindgen::to_value(&result)
            .map_err(|e| JsValue::from_str(&format!("Failed to serialize result: {:?}", e)))
    }
    
    /// Compute all active tracking strategies
    pub fn compute_strategies(&self) -> Result<JsValue, JsValue> {
        if self.pursuer_nodes.is_empty() || self.evader_nodes.is_empty() {
            return Err(JsValue::from_str("Nodes not available for computing strategies"));
        }
        
        let solutions = StrategySolutions {
            pl: self.compute_pl(),
            el: self.compute_el(),
            elst: self.compute_elst(),
            tma: self.compute_tma(),
        };
        
        web_sys::console::log_1(&JsValue::from_str("Strategy solutions computed"));
        
        serde_wasm_bindgen::to_value(&solutions)
            .map_err(|e| JsValue::from_str(&format!("Failed to serialize strategies: {:?}", e)))
    }
    
    /// Get current statistics
    pub fn get_stats(&self) -> Result<JsValue, JsValue> {
        if let Some(ref stats) = self.stats {
            serde_wasm_bindgen::to_value(stats)
                .map_err(|e| JsValue::from_str(&format!("Failed to serialize stats: {:?}", e)))
        } else {
            Err(JsValue::from_str("No statistics available"))
        }
    }
}

// Internal implementation
impl ActiveTrackingService {
    /// Check if pursuer node can see evader node
    fn can_see_node(&self, pursuer_idx: usize, evader_idx: usize) -> bool {
        if pursuer_idx >= self.pursuer_nodes.len() || evader_idx >= self.evader_nodes.len() {
            return false;
        }
        
        let p_node = &self.pursuer_nodes[pursuer_idx];
        let e_node = &self.evader_nodes[evader_idx];
        
        self.sensor_service.can_see(
            p_node.state.x,
            p_node.state.y,
            p_node.state.theta,
            e_node.state.x,
            e_node.state.y,
            true,  // use pursuer sensor
        )
    }
    
    /// PL – Pursuer as Leader (Eq. 2)
    /// Pursuer chooses a node to maximize its minimum margin against any escape.
    fn compute_pl(&self) -> StrategyResult {
        let mut best_value = f64::NEG_INFINITY;
        let mut winning_node_index = -1;
        
        let tau_p: Vec<f64> = self.pursuer_nodes.iter().map(|n| n.cost).collect();
        let tau_e: Vec<f64> = self.evader_nodes.iter().map(|n| n.cost).collect();
        
        for i in 0..self.pursuer_nodes.len() {
            let non_visible_evader_indices = &self.ne[i];
            
            if non_visible_evader_indices.is_empty() {
                // This pursuer node sees all evader nodes
                continue;
            }
            
            let min_evader_time = non_visible_evader_indices
                .iter()
                .map(|&j| tau_e[j])
                .fold(f64::INFINITY, f64::min);
            
            let value = min_evader_time - tau_p[i];
            
            if value > best_value {
                best_value = value;
                winning_node_index = i as i32;
            }
        }
        
        StrategyResult {
            best_value,
            winning_node_index,
            agent_type: "pursuer".to_string(),
        }
    }
    
    /// EL – Evader as Leader (Eq. 4)
    /// Evader finds an escape node that minimizes the pursuer's interception margin.
    fn compute_el(&self) -> StrategyResult {
        let mut best_value = f64::INFINITY;
        let mut winning_node_index = -1;
        
        let tau_p: Vec<f64> = self.pursuer_nodes.iter().map(|n| n.cost).collect();
        let tau_e: Vec<f64> = self.evader_nodes.iter().map(|n| n.cost).collect();
        
        // Evader searches from nodes not visible from pursuer's root
        let root_pursuer_node_index = 0;
        let evader_candidates = &self.ne[root_pursuer_node_index];
        
        for &j in evader_candidates {
            let tracking_pursuer_indices = &self.np[j];
            
            if tracking_pursuer_indices.is_empty() {
                // No pursuer node can see this evader node - winning escape
                best_value = f64::NEG_INFINITY;
                winning_node_index = j as i32;
                break;
            }
            
            let min_pursuer_time = tracking_pursuer_indices
                .iter()
                .map(|&i| tau_p[i])
                .fold(f64::INFINITY, f64::min);
            
            let value = tau_e[j] - min_pursuer_time;
            
            if value < best_value {
                best_value = value;
                winning_node_index = j as i32;
            }
        }
        
        StrategyResult {
            best_value,
            winning_node_index,
            agent_type: "evader".to_string(),
        }
    }
    
    /// ELST – Evader with Shortest-Time Escape (Eq. 5–6)
    /// Evader finds the fastest winning escape route.
    fn compute_elst(&self) -> StrategyResult {
        let tau_p: Vec<f64> = self.pursuer_nodes.iter().map(|n| n.cost).collect();
        let tau_e: Vec<f64> = self.evader_nodes.iter().map(|n| n.cost).collect();
        
        let root_pursuer_node_index = 0;
        let evader_candidates = &self.ne[root_pursuer_node_index];
        
        let mut escape_nodes = Vec::new();
        
        for &j in evader_candidates {
            let tracking_pursuer_indices = &self.np[j];
            
            if tracking_pursuer_indices.is_empty() {
                escape_nodes.push((j, tau_e[j], f64::NEG_INFINITY));
                continue;
            }
            
            let min_pursuer_time = tracking_pursuer_indices
                .iter()
                .map(|&i| tau_p[i])
                .fold(f64::INFINITY, f64::min);
            
            let margin = tau_e[j] - min_pursuer_time;
            
            if margin < 0.0 {
                escape_nodes.push((j, tau_e[j], margin));
            }
        }
        
        if !escape_nodes.is_empty() {
            // Find escape node with minimum time
            escape_nodes.sort_by(|a, b| a.1.partial_cmp(&b.1).unwrap());
            let (index, _time, margin) = escape_nodes[0];
            
            StrategyResult {
                best_value: margin,
                winning_node_index: index as i32,
                agent_type: "evader".to_string(),
            }
        } else {
            // No escape node, fall back to EL
            self.compute_el()
        }
    }
    
    /// TMA – Two Moves Ahead (Eq. 7)
    /// Pursuer anticipates evader's ELST move and counters it.
    fn compute_tma(&self) -> StrategyResult {
        // 1. Find evader's likely target via ELST
        let elst_solution = self.compute_elst();
        
        if elst_solution.winning_node_index == -1 {
            // If evader has no move, pursuer can do PL
            return self.compute_pl();
        }
        
        let evader_target_index = elst_solution.winning_node_index as usize;
        
        // 2. Pursuer reacts by choosing a node that can see evader's target
        let pursuer_candidates = &self.np[evader_target_index];
        
        if pursuer_candidates.is_empty() {
            // Evader found completely invisible node, no counter-move
            return self.compute_pl();
        }
        
        let mut best_value = f64::NEG_INFINITY;
        let mut winning_node_index = -1;
        
        let tau_p: Vec<f64> = self.pursuer_nodes.iter().map(|n| n.cost).collect();
        let tau_e: Vec<f64> = self.evader_nodes.iter().map(|n| n.cost).collect();
        
        for &i in pursuer_candidates {
            let non_visible_evader_indices = &self.ne[i];
            
            if non_visible_evader_indices.is_empty() {
                continue;
            }
            
            let min_evader_time = non_visible_evader_indices
                .iter()
                .map(|&j| tau_e[j])
                .fold(f64::INFINITY, f64::min);
            
            let value = min_evader_time - tau_p[i];
            
            if value > best_value {
                best_value = value;
                winning_node_index = i as i32;
            }
        }
        
        StrategyResult {
            best_value,
            winning_node_index,
            agent_type: "pursuer".to_string(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::State;

    #[test]
    fn test_active_tracking_service_creation() {
        let service = ActiveTrackingService::new();
        assert!(service.pursuer_nodes.is_empty());
        assert!(service.evader_nodes.is_empty());
    }

    // Additional tests would require setting up full trees and sensor models
}
