//! Common data types used across the module

use serde::{Deserialize, Serialize};

/// 2D point
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct Point {
    pub x: f64,
    pub y: f64,
}

/// Robot state with position and orientation
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct State {
    pub x: f64,
    pub y: f64,
    pub theta: f64,
}

/// Control inputs for unicycle model
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct Control {
    pub v: f64,     // Linear velocity
    pub omega: f64, // Angular velocity
}

/// Polygon obstacle
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Polygon {
    pub vertices: Vec<Point>,
}

/// Workspace bounds
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Bounds {
    pub x_min: f64,
    pub x_max: f64,
    pub y_min: f64,
    pub y_max: f64,
}

/// RRT* configuration parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RRTConfig {
    // Unicycle constraints
    pub v_max: f64,
    pub v_min: f64,
    pub omega_max: f64,
    
    // Planning parameters
    pub max_nodes: usize,
    pub max_planning_time: f64,
    pub steer_time: f64,
    pub dt: f64,
    pub goal_sample_rate: f64,
    
    // RRT* parameters
    pub rewire_radius: f64,
    
    // Robot parameters
    pub robot_radius: f64,
    
    // Workspace bounds
    pub bounds: Bounds,
}

impl Default for RRTConfig {
    fn default() -> Self {
        Self {
            v_max: 10.0,
            v_min: 0.0,
            omega_max: 1.5,
            max_nodes: 1000,
            max_planning_time: 100.0,
            steer_time: 0.5,
            dt: 0.05,
            goal_sample_rate: 0.05,
            rewire_radius: 50.0,
            robot_radius: 8.0,
            bounds: Bounds {
                x_min: 0.0,
                x_max: 800.0,
                y_min: 0.0,
                y_max: 600.0,
            },
        }
    }
}

/// Sensor parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SensorParams {
    pub enabled: bool,
    pub r_min: f64,      // Blind spot radius
    pub r_max: f64,      // Maximum detection range
    pub fov: f64,        // Field of view in degrees
    pub orientation: f64, // Sensor orientation offset (radians)
}

impl Default for SensorParams {
    fn default() -> Self {
        Self {
            enabled: true,
            r_min: 20.0,
            r_max: 150.0,
            fov: 360.0,
            orientation: 0.0,
        }
    }
}

/// Statistics for RRT* planning
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlanningStats {
    pub pursuer_nodes: usize,
    pub evader_nodes: usize,
    pub planning_time: f64,
}

/// Node in the RRT* tree
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RRTNode {
    pub state: State,
    pub parent_idx: Option<usize>,
    pub children_idx: Vec<usize>,
    pub cost: f64,
}

impl RRTNode {
    pub fn new(state: State, parent_idx: Option<usize>, cost: f64) -> Self {
        Self {
            state,
            parent_idx,
            children_idx: Vec::new(),
            cost,
        }
    }
}

/// Serializable node for export to JavaScript
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SerializableNode {
    pub x: f64,
    pub y: f64,
    pub theta: f64,
    pub cost: f64,
}

/// Edge in the tree (parent_idx, child_idx)
pub type Edge = (usize, usize);

/// Flattened tree structure for serialization
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlatTree {
    pub nodes: Vec<SerializableNode>,
    pub edges: Vec<Edge>,
}

/// Serializable state for path
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SerializableState {
    pub x: f64,
    pub y: f64,
    pub theta: f64,
}

impl From<State> for SerializableState {
    fn from(state: State) -> Self {
        Self {
            x: state.x,
            y: state.y,
            theta: state.theta,
        }
    }
}

/// Path through the tree
pub type Path = Vec<State>;

impl Point {
    pub fn new(x: f64, y: f64) -> Self {
        Self { x, y }
    }
    
    pub fn distance_to(&self, other: &Point) -> f64 {
        let dx = self.x - other.x;
        let dy = self.y - other.y;
        (dx * dx + dy * dy).sqrt()
    }
}

impl State {
    pub fn new(x: f64, y: f64, theta: f64) -> Self {
        Self { x, y, theta }
    }
    
    pub fn to_point(&self) -> Point {
        Point::new(self.x, self.y)
    }
    
    pub fn distance_to(&self, other: &State) -> f64 {
        let dx = self.x - other.x;
        let dy = self.y - other.y;
        (dx * dx + dy * dy).sqrt()
    }
}

impl Polygon {
    pub fn new(vertices: Vec<Point>) -> Self {
        Self { vertices }
    }
}
