/**
 * RRTStarService
 * Implements RRT* (Rapidly-exploring Random Tree Star) with unicycle dynamics
 * for both pursuer and evader agents in pursuit-evasion game.
 * 
 * Features:
 * - Unicycle (Differential Drive Robot) kinematic model
 * - Collision checking with polygon obstacles
 * - Time-based cost metric
 * - Rewiring for optimality
 * - Separate trees for pursuer and evader
 */

import { eventBus } from '../utils/EventBus.js';

// ============================================================================
// Node Class
// ============================================================================

class RRTNode {
    /**
     * @param {Object} state - {x, y, theta} for basic unicycle, or {x, y, theta, phi} for sensor
     * @param {RRTNode|null} parent - Parent node
     * @param {number} cost - Time cost from root to this node
     */
    constructor(state, parent = null, cost = 0.0) {
        this.state = state; // {x, y, theta, [phi]}
        this.parent = parent;
        this.cost = cost; // time to reach from root
        this.children = []; // for tree structure
    }
}

// ============================================================================
// Collision Detection Utilities
// ============================================================================

/**
 * Check if a line segment intersects with a polygon
 * @param {Object} seg - {start: {x, y}, end: {x, y}}
 * @param {Object} poly - Polygon with vertices array
 * @returns {boolean} True if segment intersects polygon
 */
function segmentIntersectsPolygon(seg, poly) {
    const {start, end} = seg;
    const vertices = poly.vertices;
    
    if (vertices.length < 3) return false;
    
    // Check if either endpoint is inside the polygon
    if (pointInPolygon(start, poly) || pointInPolygon(end, poly)) {
        return true;
    }
    
    // Check if segment intersects any edge of the polygon
    for (let i = 0; i < vertices.length; i++) {
        const v1 = vertices[i];
        const v2 = vertices[(i + 1) % vertices.length];
        
        if (segmentsIntersect(start, end, v1, v2)) {
            return true;
        }
    }
    
    return false;
}

/**
 * Check if a point is inside a polygon using ray casting
 * @param {Object} p - {x, y}
 * @param {Object} poly - Polygon with vertices array
 * @returns {boolean} True if point is inside polygon
 */
function pointInPolygon(p, poly) {
    const vertices = poly.vertices;
    if (vertices.length < 3) return false;
    
    let inside = false;
    for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
        const xi = vertices[i].x;
        const yi = vertices[i].y;
        const xj = vertices[j].x;
        const yj = vertices[j].y;
        
        const intersect = ((yi > p.y) !== (yj > p.y)) &&
                        (p.x < (xj - xi) * (p.y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

/**
 * Check if two line segments intersect
 * @param {Object} p1 - {x, y} start of first segment
 * @param {Object} p2 - {x, y} end of first segment
 * @param {Object} p3 - {x, y} start of second segment
 * @param {Object} p4 - {x, y} end of second segment
 * @returns {boolean} True if segments intersect
 */
function segmentsIntersect(p1, p2, p3, p4) {
    const ccw = (A, B, C) => {
        return (C.y - A.y) * (B.x - A.x) > (B.y - A.y) * (C.x - A.x);
    };
    
    return ccw(p1, p3, p4) !== ccw(p2, p3, p4) && ccw(p1, p2, p3) !== ccw(p1, p2, p4);
}

/**
 * Check if a circular robot collides with any obstacles
 * @param {number} x - Robot x position
 * @param {number} y - Robot y position
 * @param {number} radius - Robot radius
 * @param {Array} obstacles - Array of polygon obstacles
 * @returns {boolean} True if collision detected
 */
function robotCollidesWithObstacles(x, y, radius, obstacles) {
    const robotPos = {x, y};
    
    for (const obstacle of obstacles) {
        // Check if robot center is inside obstacle
        if (pointInPolygon(robotPos, obstacle)) {
            return true;
        }
        
        // Check if any edge of the obstacle is within robot radius
        const vertices = obstacle.vertices;
        for (let i = 0; i < vertices.length; i++) {
            const v1 = vertices[i];
            const v2 = vertices[(i + 1) % vertices.length];
            
            const dist = pointToSegmentDistance(robotPos, v1, v2);
            if (dist < radius) {
                return true;
            }
        }
    }
    
    return false;
}

/**
 * Calculate distance from point to line segment
 * @param {Object} p - Point {x, y}
 * @param {Object} v1 - Segment start {x, y}
 * @param {Object} v2 - Segment end {x, y}
 * @returns {number} Distance
 */
function pointToSegmentDistance(p, v1, v2) {
    const dx = v2.x - v1.x;
    const dy = v2.y - v1.y;
    const lengthSq = dx * dx + dy * dy;
    
    if (lengthSq === 0) {
        return Math.sqrt((p.x - v1.x) ** 2 + (p.y - v1.y) ** 2);
    }
    
    let t = ((p.x - v1.x) * dx + (p.y - v1.y) * dy) / lengthSq;
    t = Math.max(0, Math.min(1, t));
    
    const projX = v1.x + t * dx;
    const projY = v1.y + t * dy;
    
    return Math.sqrt((p.x - projX) ** 2 + (p.y - projY) ** 2);
}

// ============================================================================
// Unicycle Dynamics
// ============================================================================

/**
 * Wrap angle to [-π, π]
 * @param {number} angle - Angle in radians
 * @returns {number} Wrapped angle
 */
function wrapToPi(angle) {
    while (angle > Math.PI) angle -= 2 * Math.PI;
    while (angle < -Math.PI) angle += 2 * Math.PI;
    return angle;
}

/**
 * Integrate unicycle dynamics for one time step
 * @param {Object} state - {x, y, theta}
 * @param {Object} control - {v, omega} linear and angular velocity
 * @param {number} dt - Time step
 * @returns {Object} New state {x, y, theta}
 */
function integrateDDR(state, control, dt) {
    const {x, y, theta} = state;
    const {v, omega} = control;
    
    const x_new = x + v * Math.cos(theta) * dt;
    const y_new = y + v * Math.sin(theta) * dt;
    const theta_new = wrapToPi(theta + omega * dt);
    
    return {x: x_new, y: y_new, theta: theta_new};
}

// ============================================================================
// RRT* Service
// ============================================================================

export class RRTStarService {
    constructor() {
        // Configuration
        this.config = {
            // Unicycle constraints
            v_max: 10.0,           // Maximum linear velocity (pixels/sec)
            v_min: 0.0,            // Minimum linear velocity (can allow negative for backward)
            omega_max: 1.5,        // Maximum angular velocity (rad/sec)
            
            // Planning parameters
            max_nodes: 1000,       // Maximum nodes per tree
            max_planning_time: 100, // Max planning time per step (ms)
            steer_time: 0.5,       // Time horizon for steering (seconds)
            dt: 0.05,              // Integration time step (seconds)
            goal_sample_rate: 0.05, // Probability of sampling goal (reduced from 0.1)
            
            // RRT* parameters
            rewire_radius: 50.0,   // Radius for rewiring neighbors
            
            // Robot parameters
            robot_radius: 8.0,     // Robot collision radius (pixels) - reduced from 10.0
            
            // Workspace bounds (will be set dynamically)
            bounds: {
                x_min: 0,
                x_max: 800,
                y_min: 0,
                y_max: 600
            }
        };
        
        // Trees
        this.pursuerTree = null;  // RRT* tree for pursuer
        this.evaderTree = null;   // RRT* tree for evader
        
        // Obstacles
        this.obstacles = [];
        
        // Current states
        this.pursuerState = null; // {x, y, theta}
        this.evaderState = null;  // {x, y, theta}
        
        // Statistics
        this.stats = {
            pursuerNodes: 0,
            evaderNodes: 0,
            planningTime: 0
        };
    }

    /**
     * Initialize the RRT* service with workspace bounds and obstacles
     * @param {Object} params - {bounds: {x_min, x_max, y_min, y_max}, obstacles: Array}
     */
    initialize(params) {
        if (params.bounds) {
            this.config.bounds = params.bounds;
        }
        
        if (params.obstacles) {
            this.obstacles = params.obstacles;
        }
        
        console.log('RRTStarService initialized:', {
            bounds: this.config.bounds,
            obstacles: this.obstacles.length
        });
    }

    /**
     * Set pursuer initial state
     * @param {Object} state - {x, y, theta}
     */
    setPursuerState(state) {
        this.pursuerState = {
            x: state.x,
            y: state.y,
            theta: state.theta || 0
        };
        console.log('Pursuer state set:', this.pursuerState);
    }

    /**
     * Set evader initial state
     * @param {Object} state - {x, y, theta}
     */
    setEvaderState(state) {
        this.evaderState = {
            x: state.x,
            y: state.y,
            theta: state.theta || 0
        };
        console.log('Evader state set:', this.evaderState);
    }

    /**
     * Build RRT* tree from a root state
     * @param {Object} rootState - {x, y, theta}
     * @param {Object} goalState - Optional goal state for biased sampling
     * @returns {RRTNode} Root node of the tree
     */
    buildRRTStar(rootState, goalState = null) {
        const startTime = performance.now();
        
        // Check if root state is valid
        if (this.isStateInCollision(rootState)) {
            console.warn('Root state is in collision!', rootState);
        }
        
        // Initialize tree with root
        const root = new RRTNode(rootState, null, 0);
        const nodes = [root];
        
        // Build tree
        let iterations = 0;
        let failedAttempts = 0;
        
        while (nodes.length < this.config.max_nodes) {
            iterations++;
            
            // Check time limit
            if (performance.now() - startTime > this.config.max_planning_time) {
                console.log(`Stopped due to time limit. Nodes: ${nodes.length}, Iterations: ${iterations}, Failed: ${failedAttempts}`);
                break;
            }
            
            // Sample random state (or goal with probability)
            const randomState = (goalState && Math.random() < this.config.goal_sample_rate)
                ? goalState
                : this.sampleRandomState();
            
            // Find nearest node
            const nearest = this.findNearest(nodes, randomState);
            
            // Steer toward random state (enable debug for first few failures)
            const enableDebug = (failedAttempts < 3 && nodes.length === 1);
            const {newState, control, trajectory, valid} = this.steer(nearest.state, randomState, enableDebug);
            
            if (!valid) {
                failedAttempts++;
                if (enableDebug) {
                    console.log('Steering failed:', {
                        from: nearest.state,
                        to: randomState,
                        nodes: nodes.length,
                        failedAttempts
                    });
                }
                continue;
            }
            
            // Create new node
            const newCost = nearest.cost + this.config.steer_time;
            const newNode = new RRTNode(newState, nearest, newCost);
            
            // Find nearby nodes for rewiring
            const nearbyNodes = this.findNearby(nodes, newNode, this.config.rewire_radius);
            
            // Choose best parent (RRT* optimization)
            let bestParent = nearest;
            let bestCost = newCost;
            
            for (const nearby of nearbyNodes) {
                const {newState: testState, valid: testValid} = this.steer(nearby.state, newState);
                if (testValid) {
                    const testCost = nearby.cost + this.config.steer_time;
                    if (testCost < bestCost) {
                        bestParent = nearby;
                        bestCost = testCost;
                    }
                }
            }
            
            // Update parent and cost if better parent found
            if (bestParent !== nearest) {
                newNode.parent = bestParent;
                newNode.cost = bestCost;
            }
            
            // Add to tree
            newNode.parent.children.push(newNode);
            nodes.push(newNode);
            
            // Rewire nearby nodes
            this.rewire(newNode, nearbyNodes);
        }
        
        const planningTime = performance.now() - startTime;
        console.log(`Built RRT* tree: ${nodes.length} nodes in ${planningTime.toFixed(2)}ms`);
        
        return root;
    }

    /**
     * Sample a random state in the workspace
     * @returns {Object} Random state {x, y, theta}
     */
    sampleRandomState() {
        const x = this.config.bounds.x_min + 
                  Math.random() * (this.config.bounds.x_max - this.config.bounds.x_min);
        const y = this.config.bounds.y_min + 
                  Math.random() * (this.config.bounds.y_max - this.config.bounds.y_min);
        const theta = -Math.PI + Math.random() * 2 * Math.PI;
        
        return {x, y, theta};
    }

    /**
     * Find nearest node in tree to a given state
     * @param {Array} nodes - Array of RRTNode
     * @param {Object} state - Target state {x, y, theta}
     * @returns {RRTNode} Nearest node
     */
    findNearest(nodes, state) {
        let minDist = Infinity;
        let nearest = null;
        
        for (const node of nodes) {
            // Euclidean distance for position
            const dx = node.state.x - state.x;
            const dy = node.state.y - state.y;
            const positionDist = Math.sqrt(dx * dx + dy * dy);
            
            // Angular distance (optional weighting)
            const angleDiff = Math.abs(wrapToPi(node.state.theta - state.theta));
            
            // Combined distance (position weighted more heavily)
            const dist = positionDist + 10 * angleDiff;
            
            if (dist < minDist) {
                minDist = dist;
                nearest = node;
            }
        }
        
        return nearest;
    }

    /**
     * Find nodes within a radius of a given node
     * @param {Array} nodes - Array of RRTNode
     * @param {RRTNode} node - Center node
     * @param {number} radius - Search radius
     * @returns {Array} Nearby nodes
     */
    findNearby(nodes, node, radius) {
        const nearby = [];
        
        for (const other of nodes) {
            if (other === node || other === node.parent) continue;
            
            const dx = other.state.x - node.state.x;
            const dy = other.state.y - node.state.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < radius) {
                nearby.push(other);
            }
        }
        
        return nearby;
    }

    /**
     * Steer from one state toward another using unicycle dynamics
     * @param {Object} fromState - Starting state {x, y, theta}
     * @param {Object} toState - Target state {x, y, theta}
     * @param {boolean} debug - Enable debug logging
     * @returns {Object} {newState, control, trajectory, valid}
     */
    steer(fromState, toState, debug = false) {
        // Calculate desired direction
        const dx = toState.x - fromState.x;
        const dy = toState.y - fromState.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // If already very close, consider it reached
        if (distance < 1.0) {
            return {newState: fromState, control: {v: 0, omega: 0}, trajectory: [fromState], valid: true};
        }
        
        const desiredTheta = Math.atan2(dy, dx);
        
        // Calculate heading error
        const headingError = wrapToPi(desiredTheta - fromState.theta);
        
        // Choose control inputs
        const omega = Math.sign(headingError) * 
                     Math.min(Math.abs(headingError) / this.config.steer_time, this.config.omega_max);
        
        // Linear velocity proportional to alignment
        const alignment = Math.cos(headingError);
        const v = this.config.v_max * Math.max(0.3, alignment); // Minimum 30% speed
        
        const control = {v, omega};
        
        // Simulate forward with collision checking
        let currentState = {...fromState};
        const trajectory = [currentState];
        const numSteps = Math.ceil(this.config.steer_time / this.config.dt);
        
        for (let i = 0; i < numSteps; i++) {
            const nextState = integrateDDR(currentState, control, this.config.dt);
            
            // Check collision
            if (this.isStateInCollision(nextState)) {
                if (debug) {
                    console.log('Collision detected at step', i, 'nextState:', nextState);
                }
                return {newState: currentState, control, trajectory, valid: false};
            }
            
            // Check bounds
            if (nextState.x < this.config.bounds.x_min || nextState.x > this.config.bounds.x_max ||
                nextState.y < this.config.bounds.y_min || nextState.y > this.config.bounds.y_max) {
                if (debug) {
                    console.log('Out of bounds at step', i, 'nextState:', nextState, 'bounds:', this.config.bounds);
                }
                return {newState: currentState, control, trajectory, valid: false};
            }
            
            trajectory.push(nextState);
            currentState = nextState;
        }
        
        return {newState: currentState, control, trajectory, valid: true};
    }

    /**
     * Check if a state is in collision with obstacles
     * @param {Object} state - {x, y, theta}
     * @returns {boolean} True if in collision
     */
    isStateInCollision(state) {
        return robotCollidesWithObstacles(
            state.x,
            state.y,
            this.config.robot_radius,
            this.obstacles
        );
    }

    /**
     * Rewire nearby nodes if routing through newNode is cheaper
     * @param {RRTNode} newNode - Newly added node
     * @param {Array} nearbyNodes - Nearby nodes to consider
     */
    rewire(newNode, nearbyNodes) {
        for (const nearby of nearbyNodes) {
            // Try to connect newNode to nearby
            const {newState, valid} = this.steer(newNode.state, nearby.state);
            
            if (valid) {
                const newCost = newNode.cost + this.config.steer_time;
                
                if (newCost < nearby.cost) {
                    // Remove from old parent's children
                    if (nearby.parent) {
                        const idx = nearby.parent.children.indexOf(nearby);
                        if (idx !== -1) {
                            nearby.parent.children.splice(idx, 1);
                        }
                    }
                    
                    // Rewire to new parent
                    nearby.parent = newNode;
                    nearby.cost = newCost;
                    newNode.children.push(nearby);
                    
                    // Update costs of descendants
                    this.updateDescendantCosts(nearby);
                }
            }
        }
    }

    /**
     * Update costs of all descendants after rewiring
     * @param {RRTNode} node - Node whose descendants need updating
     */
    updateDescendantCosts(node) {
        for (const child of node.children) {
            child.cost = node.cost + this.config.steer_time;
            this.updateDescendantCosts(child);
        }
    }

    /**
     * Plan for both pursuer and evader
     * @returns {Object} {pursuerTree, evaderTree, stats}
     */
    planBothAgents() {
        if (!this.pursuerState || !this.evaderState) {
            console.warn('Cannot plan: agent states not set');
            return null;
        }
        
        // Check if agents are in collision
        if (this.isStateInCollision(this.pursuerState)) {
            console.error('Pursuer is starting inside an obstacle!', this.pursuerState);
        }
        if (this.isStateInCollision(this.evaderState)) {
            console.error('Evader is starting inside an obstacle!', this.evaderState);
        }
        
        console.log('Planning with states:', {
            pursuer: this.pursuerState,
            evader: this.evaderState,
            obstacles: this.obstacles.length,
            bounds: this.config.bounds
        });
        
        const startTime = performance.now();
        
        // Build pursuer tree (goal is evader position)
        console.log('Building pursuer RRT*...');
        this.pursuerTree = this.buildRRTStar(this.pursuerState, this.evaderState);
        
        // Build evader tree (no specific goal, explore)
        console.log('Building evader RRT*...');
        this.evaderTree = this.buildRRTStar(this.evaderState, null);
        
        const totalTime = performance.now() - startTime;
        
        this.stats = {
            pursuerNodes: this.countNodes(this.pursuerTree),
            evaderNodes: this.countNodes(this.evaderTree),
            planningTime: totalTime
        };
        
        console.log('Planning complete:', this.stats);
        
        // Emit event with trees for visualization
        eventBus.emit('rrt:treesBuilt', {
            pursuerTree: this.pursuerTree,
            evaderTree: this.evaderTree,
            stats: this.stats
        });
        
        return {
            pursuerTree: this.pursuerTree,
            evaderTree: this.evaderTree,
            stats: this.stats
        };
    }

    /**
     * Count nodes in a tree
     * @param {RRTNode} root - Root node
     * @returns {number} Node count
     */
    countNodes(root) {
        if (!root) return 0;
        
        let count = 1;
        for (const child of root.children) {
            count += this.countNodes(child);
        }
        return count;
    }

    /**
     * Get all nodes in a tree as a flat array
     * @param {RRTNode} root - Root node
     * @returns {Array} Array of nodes
     */
    getNodesArray(root) {
        if (!root) return [];
        
        const nodes = [root];
        const queue = [root];
        
        while (queue.length > 0) {
            const node = queue.shift();
            for (const child of node.children) {
                nodes.push(child);
                queue.push(child);
            }
        }
        
        return nodes;
    }

    /**
     * Find path from root to a target state
     * @param {RRTNode} root - Tree root
     * @param {Object} targetState - Target state {x, y, theta}
     * @returns {Array} Path as array of states
     */
    findPath(root, targetState) {
        const nodes = this.getNodesArray(root);
        
        // Find closest node to target
        const closest = this.findNearest(nodes, targetState);
        
        // Backtrack to root
        const path = [];
        let current = closest;
        while (current) {
            path.unshift(current.state);
            current = current.parent;
        }
        
        return path;
    }

    /**
     * Get statistics
     * @returns {Object} Statistics object
     */
    getStats() {
        return {...this.stats};
    }

    /**
     * Reset the service
     */
    reset() {
        this.pursuerTree = null;
        this.evaderTree = null;
        this.pursuerState = null;
        this.evaderState = null;
        this.stats = {
            pursuerNodes: 0,
            evaderNodes: 0,
            planningTime: 0
        };
        
        console.log('RRTStarService reset');
    }
}

// Export as singleton
export const rrtStarService = new RRTStarService();
