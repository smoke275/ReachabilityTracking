//! RRT* (Rapidly-exploring Random Tree Star) implementation
//! with unicycle dynamics for pursuit-evasion games

use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};
use rand::Rng;
use std::f64::consts::PI;

use crate::types::*;
use crate::geometry::*;
use crate::utils::*;

/// RRT* planner service
#[wasm_bindgen]
pub struct RRTStarService {
    config: RRTConfig,
    obstacles: Vec<Polygon>,
    pursuer_state: Option<State>,
    evader_state: Option<State>,
}

#[wasm_bindgen]
impl RRTStarService {
    /// Create a new RRT* service with default configuration
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            config: RRTConfig::default(),
            obstacles: Vec::new(),
            pursuer_state: None,
            evader_state: None,
        }
    }
    
    /// Initialize with obstacles and configuration (from JSON)
    pub fn initialize(&mut self, obstacles_json: JsValue, config_json: JsValue) -> Result<(), JsValue> {
        // Parse obstacles
        let obstacles: Vec<Polygon> = serde_wasm_bindgen::from_value(obstacles_json)
            .map_err(|e| JsValue::from_str(&format!("Failed to parse obstacles: {:?}", e)))?;
        self.obstacles = obstacles;
        
        // Parse config if provided
        if !config_json.is_undefined() && !config_json.is_null() {
            let config: RRTConfig = serde_wasm_bindgen::from_value(config_json)
                .map_err(|e| JsValue::from_str(&format!("Failed to parse config: {:?}", e)))?;
            self.config = config;
        }
        
        Ok(())
    }
    
    /// Set pursuer initial state
    pub fn set_pursuer_state(&mut self, x: f64, y: f64, theta: f64) {
        self.pursuer_state = Some(State::new(x, y, theta));
    }
    
    /// Set evader initial state
    pub fn set_evader_state(&mut self, x: f64, y: f64, theta: f64) {
        self.evader_state = Some(State::new(x, y, theta));
    }
    
    /// Update configuration (from JSON)
    pub fn update_config(&mut self, config_json: JsValue) -> Result<(), JsValue> {
        if !config_json.is_undefined() && !config_json.is_null() {
            let config: RRTConfig = serde_wasm_bindgen::from_value(config_json)
                .map_err(|e| JsValue::from_str(&format!("Failed to parse config: {:?}", e)))?;
            self.config = config;
        }
        Ok(())
    }
    
    /// Update obstacles (from JSON)
    pub fn update_obstacles(&mut self, obstacles_json: JsValue) -> Result<(), JsValue> {
        let obstacles: Vec<Polygon> = serde_wasm_bindgen::from_value(obstacles_json)
            .map_err(|e| JsValue::from_str(&format!("Failed to parse obstacles: {:?}", e)))?;
        self.obstacles = obstacles;
        Ok(())
    }
    
    /// Plan for both pursuer and evader agents
    pub fn plan_both_agents(&self) -> Result<JsValue, JsValue> {
        let pursuer_state = self.pursuer_state
            .ok_or_else(|| JsValue::from_str("Pursuer state not set"))?;
        let evader_state = self.evader_state
            .ok_or_else(|| JsValue::from_str("Evader state not set"))?;
        
        let start_time = js_sys::Date::now();
        
        // Build pursuer tree (goal-biased toward evader)
        let pursuer_tree = self.build_rrt_star(&pursuer_state, Some(&evader_state));
        
        // Build evader tree (exploration, no goal)
        let evader_tree = self.build_rrt_star(&evader_state, None);
        
        let planning_time = js_sys::Date::now() - start_time;
        
        // Flatten trees for serialization
        let flat_pursuer = self.flatten_tree(&pursuer_tree);
        let flat_evader = self.flatten_tree(&evader_tree);
        
        let result = PlanBothResult {
            pursuer_tree: flat_pursuer,
            evader_tree: flat_evader,
            stats: PlanningStats {
                pursuer_nodes: pursuer_tree.len(),
                evader_nodes: evader_tree.len(),
                planning_time,
            },
        };
        
        serde_wasm_bindgen::to_value(&result)
            .map_err(|e| JsValue::from_str(&format!("Failed to serialize result: {:?}", e)))
    }
}

/// Result of planning for both agents
#[derive(Serialize, Deserialize)]
struct PlanBothResult {
    pursuer_tree: FlatTree,
    evader_tree: FlatTree,
    stats: PlanningStats,
}

// Internal implementation (not exposed to JS)
impl RRTStarService {
    /// Build an RRT* tree from root state
    fn build_rrt_star(&self, root_state: &State, goal_state: Option<&State>) -> Vec<RRTNode> {
        let start_time = js_sys::Date::now();
        
        // Check if root state is valid
        if self.is_state_in_collision(root_state) {
            web_sys::console::warn_1(&JsValue::from_str(&format!(
                "Root state is in collision: {:?}",
                root_state
            )));
        }
        
        // Initialize tree
        let mut nodes = vec![RRTNode::new(*root_state, None, 0.0)];
        let mut rng = rand::thread_rng();
        
        let mut iterations = 0;
        
        while nodes.len() < self.config.max_nodes {
            iterations += 1;
            
            // Check time limit
            if js_sys::Date::now() - start_time > self.config.max_planning_time {
                break;
            }
            
            // Sample random state (or goal with probability)
            let random_state = if let Some(goal) = goal_state {
                if rng.gen::<f64>() < self.config.goal_sample_rate {
                    *goal
                } else {
                    self.sample_random_state(&mut rng)
                }
            } else {
                self.sample_random_state(&mut rng)
            };
            
            // Find nearest node
            let nearest_idx = self.find_nearest(&nodes, &random_state);
            
            // Steer toward random state
            let steer_result = self.steer(&nodes[nearest_idx].state, &random_state);
            
            if !steer_result.valid {
                continue;
            }
            
            // Create new node
            let new_cost = nodes[nearest_idx].cost + self.config.steer_time;
            let mut new_node = RRTNode::new(steer_result.new_state, Some(nearest_idx), new_cost);
            
            // Find nearby nodes for rewiring
            let nearby_indices = self.find_nearby(&nodes, &new_node, self.config.rewire_radius);
            
            // Choose best parent (RRT* optimization)
            let mut best_parent_idx = nearest_idx;
            let mut best_cost = new_cost;
            
            for &nearby_idx in &nearby_indices {
                let test_result = self.steer(&nodes[nearby_idx].state, &steer_result.new_state);
                if test_result.valid {
                    let test_cost = nodes[nearby_idx].cost + self.config.steer_time;
                    if test_cost < best_cost {
                        best_parent_idx = nearby_idx;
                        best_cost = test_cost;
                    }
                }
            }
            
            // Update parent and cost if better parent found
            if best_parent_idx != nearest_idx {
                new_node.parent_idx = Some(best_parent_idx);
                new_node.cost = best_cost;
            }
            
            let new_idx = nodes.len();
            nodes.push(new_node);
            
            // Add to parent's children
            if let Some(parent_idx) = nodes[new_idx].parent_idx {
                nodes[parent_idx].children_idx.push(new_idx);
            }
            
            // Rewire nearby nodes
            self.rewire(&mut nodes, new_idx, &nearby_indices);
        }
        
        nodes
    }
    
    /// Sample a random state in the workspace
    fn sample_random_state(&self, rng: &mut impl Rng) -> State {
        let bounds = &self.config.bounds;
        let x = rng.gen_range(bounds.x_min..bounds.x_max);
        let y = rng.gen_range(bounds.y_min..bounds.y_max);
        let theta = rng.gen_range(-PI..PI);
        
        State::new(x, y, theta)
    }
    
    /// Find nearest node to a given state
    fn find_nearest(&self, nodes: &[RRTNode], state: &State) -> usize {
        let mut min_dist = f64::INFINITY;
        let mut nearest_idx = 0;
        
        for (idx, node) in nodes.iter().enumerate() {
            let dist = state_distance(&node.state, state, 10.0);
            if dist < min_dist {
                min_dist = dist;
                nearest_idx = idx;
            }
        }
        
        nearest_idx
    }
    
    /// Find nodes within a radius
    fn find_nearby(&self, nodes: &[RRTNode], node: &RRTNode, radius: f64) -> Vec<usize> {
        let mut nearby = Vec::new();
        
        for (idx, other) in nodes.iter().enumerate() {
            if Some(idx) == node.parent_idx {
                continue;
            }
            
            let dist = node.state.distance_to(&other.state);
            if dist < radius {
                nearby.push(idx);
            }
        }
        
        nearby
    }
    
    /// Steer from one state toward another
    fn steer(&self, from_state: &State, to_state: &State) -> SteerResult {
        let dx = to_state.x - from_state.x;
        let dy = to_state.y - from_state.y;
        let distance = (dx * dx + dy * dy).sqrt();
        
        // If very close, consider reached
        if distance < 1.0 {
            return SteerResult {
                new_state: *from_state,
                valid: true,
            };
        }
        
        let desired_theta = dy.atan2(dx);
        let heading_error = wrap_to_pi(desired_theta - from_state.theta);
        
        // Choose control inputs
        let omega = heading_error.signum()
            * (heading_error.abs() / self.config.steer_time).min(self.config.omega_max);
        
        let alignment = heading_error.cos();
        let v = self.config.v_max * alignment.max(0.3);
        
        let control = Control { v, omega };
        
        // Simulate forward with collision checking
        let mut current_state = *from_state;
        let num_steps = (self.config.steer_time / self.config.dt).ceil() as usize;
        
        for _ in 0..num_steps {
            let next_state = integrate_unicycle(&current_state, &control, self.config.dt);
            
            // Check collision
            if self.is_state_in_collision(&next_state) {
                return SteerResult {
                    new_state: current_state,
                    valid: false,
                };
            }
            
            // Check bounds
            let bounds = &self.config.bounds;
            if next_state.x < bounds.x_min
                || next_state.x > bounds.x_max
                || next_state.y < bounds.y_min
                || next_state.y > bounds.y_max
            {
                return SteerResult {
                    new_state: current_state,
                    valid: false,
                };
            }
            
            current_state = next_state;
        }
        
        SteerResult {
            new_state: current_state,
            valid: true,
        }
    }
    
    /// Check if state is in collision with obstacles
    fn is_state_in_collision(&self, state: &State) -> bool {
        robot_collides_with_obstacles(state.x, state.y, self.config.robot_radius, &self.obstacles)
    }
    
    /// Rewire nearby nodes through new node if cheaper
    fn rewire(&self, nodes: &mut Vec<RRTNode>, new_idx: usize, nearby_indices: &[usize]) {
        let new_state = nodes[new_idx].state;
        let new_cost = nodes[new_idx].cost;
        
        for &nearby_idx in nearby_indices {
            let steer_result = self.steer(&new_state, &nodes[nearby_idx].state);
            
            if steer_result.valid {
                let potential_cost = new_cost + self.config.steer_time;
                
                if potential_cost < nodes[nearby_idx].cost {
                    // Remove from old parent's children
                    if let Some(old_parent_idx) = nodes[nearby_idx].parent_idx {
                        nodes[old_parent_idx]
                            .children_idx
                            .retain(|&idx| idx != nearby_idx);
                    }
                    
                    // Rewire to new parent
                    nodes[nearby_idx].parent_idx = Some(new_idx);
                    nodes[nearby_idx].cost = potential_cost;
                    nodes[new_idx].children_idx.push(nearby_idx);
                    
                    // Update descendant costs
                    self.update_descendant_costs(nodes, nearby_idx);
                }
            }
        }
    }
    
    /// Update costs of all descendants after rewiring
    fn update_descendant_costs(&self, nodes: &mut Vec<RRTNode>, node_idx: usize) {
        let children = nodes[node_idx].children_idx.clone();
        for child_idx in children {
            if let Some(parent_idx) = nodes[child_idx].parent_idx {
                nodes[child_idx].cost = nodes[parent_idx].cost + self.config.steer_time;
                self.update_descendant_costs(nodes, child_idx);
            }
        }
    }
    
    /// Flatten tree for serialization
    fn flatten_tree(&self, nodes: &[RRTNode]) -> FlatTree {
        let serializable_nodes: Vec<SerializableNode> = nodes
            .iter()
            .map(|node| SerializableNode {
                x: node.state.x,
                y: node.state.y,
                theta: node.state.theta,
                cost: node.cost,
            })
            .collect();
        
        let mut edges = Vec::new();
        for (idx, node) in nodes.iter().enumerate() {
            if let Some(parent_idx) = node.parent_idx {
                edges.push((parent_idx, idx));
            }
        }
        
        FlatTree {
            nodes: serializable_nodes,
            edges,
        }
    }
    
    /// Reconstruct path from root to a specific node index
    fn reconstruct_path(&self, nodes: &[RRTNode], target_idx: usize) -> Vec<State> {
        if target_idx >= nodes.len() {
            return Vec::new();
        }
        
        let mut path = Vec::new();
        let mut current_idx = Some(target_idx);
        
        // Backtrack from target to root
        while let Some(idx) = current_idx {
            path.push(nodes[idx].state);
            current_idx = nodes[idx].parent_idx;
        }
        
        // Reverse to get path from root to target
        path.reverse();
        path
    }
}

/// Result of steering operation
struct SteerResult {
    new_state: State,
    valid: bool,
}
