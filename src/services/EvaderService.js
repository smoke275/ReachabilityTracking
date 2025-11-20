/**
 * EvaderService
 * Manages evader movement along the medial axis skeleton.
 * The evader travels between random leaf nodes using shortest path routing.
 */

import { eventBus } from '../utils/EventBus.js';

// ============================================================================
// Collision Detection Utilities
// ============================================================================

/**
 * Check if a point is inside a polygon using ray casting
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
 * Calculate distance from point to line segment
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

/**
 * Check if a circular robot collides with any obstacles
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

// ============================================================================
// EvaderService
// ============================================================================

export class EvaderService {
    constructor() {
        this.isRunning = false;
        this.speed = 1.0; // v_max: linear speed in pixels per frame
        this.angularSpeed = 0.15; // ω_max: angular speed in radians per frame
        this.mode = 'holonomic';
        this._skeleton = null;
        
        // Collision detection
        this.obstacles = [];
        this.robotRadius = 8.0; // Same as RRT service
        
        // Graph structure
        this.graph = null; // adjacency list
        this.leaves = []; // leaf nodes (degree 1)
        this.pointToKey = new Map(); // point -> key string
        this.keyToPoint = new Map(); // key string -> point
        
        // Movement state
        this.position = null;
        this.currentLeaf = null;
        this.targetLeaf = null;
        this.path = []; // array of points from current to target
        this.pathEdges = []; // array of edges for visualization
        this.currentWaypointIndex = 0;
        this.heading = 0;
        
        // Unicycle control gains
        this.K_v = 0.3; // Linear velocity gain (reduced to slow down more)
        this.K_h = 3.0; // Heading error gain (increased for faster turning)
        
        // Animation
        this.animationFrameId = null;
        this.lastUpdateTime = 0;
    }

    /**
     * Accept and store skeleton data, build graph structure
     * @param {Object} skeletonData - {points: Array, edges: Array}
     */
    initialize(skeletonData) {
        this._skeleton = skeletonData || null;
        
        if (!skeletonData || !skeletonData.edges || skeletonData.edges.length === 0) {
            console.warn('EvaderService: No skeleton data provided');
            return;
        }
        
        this.buildGraph(skeletonData);
        this.findLeaves();
        
        console.log('EvaderService initialized:', {
            vertices: this.keyToPoint.size,
            edges: skeletonData.edges.length,
            leaves: this.leaves.length
        });
    }

    /**
     * Set obstacles for collision detection
     * @param {Array} obstacles - Array of polygon obstacles
     */
    setObstacles(obstacles) {
        this.obstacles = obstacles || [];
        console.log(`EvaderService: ${this.obstacles.length} obstacles loaded for collision detection`);
    }

    /**
     * Check if a position would cause collision
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @returns {boolean} True if collision detected
     */
    isPositionInCollision(x, y) {
        return robotCollidesWithObstacles(x, y, this.robotRadius, this.obstacles);
    }

    /**
     * Build adjacency list graph from skeleton data
     * @param {Object} skeletonData - {points: Array, edges: Array}
     */
    buildGraph(skeletonData) {
        this.graph = new Map();
        this.pointToKey = new Map();
        this.keyToPoint = new Map();
        
        const pointKey = (p) => `${Math.round(p.x)}_${Math.round(p.y)}`;
        
        // Register all points
        if (skeletonData.points) {
            skeletonData.points.forEach(p => {
                const key = pointKey(p);
                this.keyToPoint.set(key, { x: p.x, y: p.y });
                this.pointToKey.set(JSON.stringify(p), key);
                if (!this.graph.has(key)) {
                    this.graph.set(key, []);
                }
            });
        }
        
        // Build adjacency list from edges
        skeletonData.edges.forEach(edge => {
            const startKey = pointKey(edge.start);
            const endKey = pointKey(edge.end);
            
            // Ensure both points exist in graph
            if (!this.keyToPoint.has(startKey)) {
                this.keyToPoint.set(startKey, { x: edge.start.x, y: edge.start.y });
            }
            if (!this.keyToPoint.has(endKey)) {
                this.keyToPoint.set(endKey, { x: edge.end.x, y: edge.end.y });
            }
            
            // Add edges (undirected graph)
            if (!this.graph.has(startKey)) {
                this.graph.set(startKey, []);
            }
            if (!this.graph.has(endKey)) {
                this.graph.set(endKey, []);
            }
            
            const dist = this.distance(edge.start, edge.end);
            this.graph.get(startKey).push({ key: endKey, distance: dist });
            this.graph.get(endKey).push({ key: startKey, distance: dist });
        });
    }

    /**
     * Find all leaf nodes (vertices with degree 1)
     */
    findLeaves() {
        this.leaves = [];
        
        this.graph.forEach((neighbors, key) => {
            if (neighbors.length === 1) {
                this.leaves.push(key);
            }
        });
        
        console.log(`Found ${this.leaves.length} leaf nodes`);
    }

    /**
     * Choose a random leaf node
     * @returns {string|null} - Key of random leaf node
     */
    chooseRandomLeaf() {
        if (this.leaves.length === 0) {
            console.warn('No leaf nodes available');
            return null;
        }
        
        const randomIndex = Math.floor(Math.random() * this.leaves.length);
        return this.leaves[randomIndex];
    }

    /**
     * Find shortest path between two nodes using Dijkstra's algorithm
     * @param {string} startKey - Start node key
     * @param {string} endKey - End node key
     * @returns {Array} - Array of point keys representing the path
     */
    findShortestPath(startKey, endKey) {
        if (!this.graph.has(startKey) || !this.graph.has(endKey)) {
            console.warn('Start or end node not in graph');
            return [];
        }
        
        if (startKey === endKey) {
            return [startKey];
        }
        
        const distances = new Map();
        const previous = new Map();
        const unvisited = new Set(this.graph.keys());
        
        // Initialize distances
        this.graph.forEach((_, key) => {
            distances.set(key, Infinity);
        });
        distances.set(startKey, 0);
        
        while (unvisited.size > 0) {
            // Find unvisited node with minimum distance
            let currentKey = null;
            let minDist = Infinity;
            
            unvisited.forEach(key => {
                const dist = distances.get(key);
                if (dist < minDist) {
                    minDist = dist;
                    currentKey = key;
                }
            });
            
            if (currentKey === null || minDist === Infinity) {
                break; // No path exists
            }
            
            if (currentKey === endKey) {
                break; // Found shortest path to target
            }
            
            unvisited.delete(currentKey);
            
            // Update distances to neighbors
            const neighbors = this.graph.get(currentKey) || [];
            neighbors.forEach(({ key: neighborKey, distance: edgeDist }) => {
                if (unvisited.has(neighborKey)) {
                    const newDist = distances.get(currentKey) + edgeDist;
                    if (newDist < distances.get(neighborKey)) {
                        distances.set(neighborKey, newDist);
                        previous.set(neighborKey, currentKey);
                    }
                }
            });
        }
        
        // Reconstruct path
        if (!previous.has(endKey) && startKey !== endKey) {
            console.warn('No path found between nodes');
            return [];
        }
        
        const path = [];
        let current = endKey;
        
        while (current) {
            path.unshift(current);
            current = previous.get(current);
        }
        
        return path;
    }

    /**
     * Select a new target leaf and compute path
     */
    selectNewTarget() {
        const newTarget = this.chooseRandomLeaf();
        
        if (!newTarget) {
            console.warn('Cannot select new target - no leaves available');
            return;
        }
        
        // Avoid selecting the same leaf we're currently at
        if (newTarget === this.currentLeaf && this.leaves.length > 1) {
            return this.selectNewTarget();
        }
        
        this.targetLeaf = newTarget;
        
        // Find path from current position to target
        const pathKeys = this.findShortestPath(this.currentLeaf, this.targetLeaf);
        
        // Convert keys to points
        this.path = pathKeys.map(key => this.keyToPoint.get(key));
        
        // Build path edges for visualization
        this.pathEdges = [];
        for (let i = 0; i < this.path.length - 1; i++) {
            this.pathEdges.push({
                start: this.path[i],
                end: this.path[i + 1]
            });
        }
        
        this.currentWaypointIndex = 0;
        
        // Initialize heading for unicycle mode when selecting new target
        if (this.mode === 'unicycle' && this.path.length > 1 && this.position) {
            // Point toward the first waypoint (which should be close to current position)
            const target = this.path[1]; // Use second point since first is current position
            const dx = target.x - this.position.x;
            const dy = target.y - this.position.y;
            this.heading = Math.atan2(dy, dx);
        }
        
        console.log(`New target selected: ${this.leaves.indexOf(newTarget)} (${this.path.length} waypoints), mode: ${this.mode}`);
    }

    /**
     * Calculate Euclidean distance between two points
     * @param {Object} p1 - First point {x, y}
     * @param {Object} p2 - Second point {x, y}
     * @returns {number} - Distance
     */
    distance(p1, p2) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * Start the evader simulation
     * @param {string} mode - Movement mode ('holonomic' or 'unicycle')
     */
    start(mode = 'holonomic') {
        if (!this._skeleton || this.leaves.length === 0) {
            console.warn('Cannot start evader - no skeleton or no leaves');
            return;
        }
        
        // If already has position, just resume
        if (this.position && this.path.length > 0) {
            this.resume();
            return;
        }
        
        this.mode = mode;
        this.isRunning = true;
        
        // Initialize at a random leaf
        this.currentLeaf = this.chooseRandomLeaf();
        this.position = { ...this.keyToPoint.get(this.currentLeaf) };
        
        // Select first target
        this.selectNewTarget();
        
        // Initialize heading for unicycle mode
        if (this.mode === 'unicycle' && this.path.length > 1) {
            // Start by facing the first real waypoint (skip index 0 which is current position)
            const target = this.path[1];
            const dx = target.x - this.position.x;
            const dy = target.y - this.position.y;
            this.heading = Math.atan2(dy, dx);
            console.log(`Initial heading set to: ${this.heading.toFixed(2)} rad`);
        } else {
            this.heading = 0;
        }
        
        // Start animation loop
        this.lastUpdateTime = performance.now();
        this.animate();
        
        console.log(`Evader simulation started in ${mode} mode`);
    }

    /**
     * Resume a paused simulation
     */
    resume() {
        if (!this.position || this.path.length === 0) {
            console.warn('Cannot resume - no previous state. Use start() instead.');
            return;
        }
        
        this.isRunning = true;
        this.lastUpdateTime = performance.now();
        this.animate();
        
        console.log(`Evader simulation resumed in ${this.mode} mode`);
    }

    /**
     * Animation loop
     */
    animate() {
        if (!this.isRunning) {
            return;
        }
        
        const currentTime = performance.now();
        const deltaTime = (currentTime - this.lastUpdateTime) / 1000; // Convert to seconds
        this.lastUpdateTime = currentTime;
        
        this.update(deltaTime);
        
        this.animationFrameId = requestAnimationFrame(() => this.animate());
    }

    /**
     * Update evader position
     * @param {number} deltaTime - Time since last update in seconds
     */
    update(deltaTime) {
        if (!this.isRunning || this.path.length === 0) {
            return;
        }
        
        // Get current target waypoint
        if (this.currentWaypointIndex >= this.path.length) {
            // Reached end of path, select new target
            this.currentLeaf = this.targetLeaf;
            this.selectNewTarget();
            return;
        }
        
        const target = this.path[this.currentWaypointIndex];
        
        // Route to appropriate update method based on mode
        if (this.mode === 'holonomic') {
            this.updateHolonomic(target, deltaTime);
        } else if (this.mode === 'unicycle') {
            this.updateUnicycle(target, deltaTime);
        } else {
            console.warn(`Unknown mode: ${this.mode}, defaulting to holonomic`);
            this.updateHolonomic(target, deltaTime);
        }
    }

    /**
     * Update holonomic motion (direct movement)
     * @param {Object} target - Target waypoint {x, y}
     * @param {number} deltaTime - Time since last update in seconds
     */
    updateHolonomic(target, deltaTime) {
        const dx = target.x - this.position.x;
        const dy = target.y - this.position.y;
        const distToTarget = Math.sqrt(dx * dx + dy * dy);
        
        // Calculate movement distance for this frame
        const moveDistance = this.speed * deltaTime * 60; // 60 fps normalization
        
        if (distToTarget <= moveDistance) {
            // Reached waypoint, move to next
            this.position = { ...target };
            this.currentWaypointIndex++;
        } else {
            // Move towards waypoint
            const ratio = moveDistance / distToTarget;
            this.position.x += dx * ratio;
            this.position.y += dy * ratio;
            
            // Update heading for visualization
            this.heading = Math.atan2(dy, dx);
        }
    }

    /**
     * Update unicycle motion with feedback control law
     * @param {Object} target - Target waypoint {x, y}
     * @param {number} deltaTime - Time since last update in seconds
     */
    updateUnicycle(target, deltaTime) {
        const dx = target.x - this.position.x;
        const dy = target.y - this.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Waypoint tolerance for switching to next waypoint
        // Smaller tolerance means robot gets closer before switching
        const waypointTolerance = 5.0; // pixels
        
        if (distance <= waypointTolerance) {
            // Reached waypoint, move to next
            console.log(`Unicycle reached waypoint ${this.currentWaypointIndex}`);
            this.currentWaypointIndex++;
            return;
        }
        
        // Calculate desired heading to target
        const desiredHeading = Math.atan2(dy, dx);
        
        // Calculate heading error (normalized to [-π, π])
        let headingError = desiredHeading - this.heading;
        // Normalize to [-π, π]
        while (headingError > Math.PI) headingError -= 2 * Math.PI;
        while (headingError < -Math.PI) headingError += 2 * Math.PI;
        
        // Feedback control law
        // Linear velocity: v = K_v * distance * max(0, cos(θ_error))
        // - Proportional to distance
        // - Scaled by heading alignment (slow down when not facing target)
        const headingAlignment = Math.max(0, Math.cos(headingError));
        let v = this.K_v * distance * headingAlignment;
        
        // Clamp linear velocity to [0, v_max]
        v = Math.max(0, Math.min(this.speed, v));
        
        // Angular velocity: ω = K_h * θ_error
        // - Proportional to heading error
        let omega = this.K_h * headingError;
        
        // Clamp angular velocity to [-ω_max, ω_max]
        omega = Math.max(-this.angularSpeed, Math.min(this.angularSpeed, omega));
        
        // Debug logging (occasional)
        if (Math.random() < 0.016) {
            console.log(`Unicycle: dist=${distance.toFixed(1)}px, heading_error=${(headingError * 180 / Math.PI).toFixed(1)}°, v=${v.toFixed(2)}px/f, ω=${omega.toFixed(3)}rad/f, alignment=${headingAlignment.toFixed(2)}`);
        }
        
        // Time step normalization (60 fps baseline)
        const dt = deltaTime * 60;
        
        // Update heading first (integrate angular velocity)
        this.heading += omega * dt;
        
        // Normalize heading to [-π, π]
        while (this.heading > Math.PI) this.heading -= 2 * Math.PI;
        while (this.heading < -Math.PI) this.heading += 2 * Math.PI;
        
        // Update position based on current heading (integrate linear velocity)
        // The robot moves in the direction it's facing, not toward the target
        this.position.x += v * Math.cos(this.heading) * dt;
        this.position.y += v * Math.sin(this.heading) * dt;
    }

    /**
     * Stop the evader simulation (pause - keeps state for resume)
     */
    stop() {
        this.isRunning = false;
        
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        
        console.log('Evader simulation paused (state preserved)');
    }

    /**
     * Reset the evader to initial state
     */
    reset() {
        this.stop();
        
        this.position = null;
        this.currentLeaf = null;
        this.targetLeaf = null;
        this.path = [];
        this.pathEdges = [];
        this.currentWaypointIndex = 0;
        this.heading = 0;
        
        console.log('Evader simulation reset');
    }

    /**
     * Set speed multiplier
     * @param {number} multiplier - Speed multiplier (v_max in px/frame)
     */
    setSpeed(multiplier) {
        const m = Number(multiplier);
        this.speed = Number.isFinite(m) && m > 0 ? m : 1.0;
    }

    /**
     * Set angular speed
     * @param {number} omega - Angular speed (ω_max in rad/frame)
     */
    setAngularSpeed(omega) {
        const w = Number(omega);
        this.angularSpeed = Number.isFinite(w) && w > 0 ? w : 0.15;
    }

    /**
     * Set motion mode (can be called during active simulation)
     * @param {string} newMode - 'holonomic' or 'unicycle'
     */
    setMode(newMode) {
        if (newMode !== 'holonomic' && newMode !== 'unicycle') {
            console.warn(`Invalid mode: ${newMode}, must be 'holonomic' or 'unicycle'`);
            return;
        }

        const wasUnicycle = this.mode === 'unicycle';
        const isNowUnicycle = newMode === 'unicycle';

        this.mode = newMode;

        // If switching to unicycle mode and simulation is running, initialize heading
        if (isNowUnicycle && !wasUnicycle && this.isRunning && this.position && this.path.length > this.currentWaypointIndex) {
            // Set heading toward the current waypoint
            const target = this.path[this.currentWaypointIndex];
            const dx = target.x - this.position.x;
            const dy = target.y - this.position.y;
            this.heading = Math.atan2(dy, dx);
            console.log(`Switched to unicycle mode, heading set to: ${this.heading.toFixed(2)} rad`);
        }

        console.log(`Motion mode changed to: ${newMode}`);
    }

    /**
     * Manually set evader position (for manual placement and control)
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {number} heading - Heading angle in radians
     */
    setManualPosition(x, y, heading = 0) {
        // Check for collision before placing
        if (this.isPositionInCollision(x, y)) {
            console.warn(`Cannot place evader at (${x.toFixed(1)}, ${y.toFixed(1)}): collision detected`);
            eventBus.emit('evader:placementFailed', { x, y, reason: 'collision' });
            return false;
        }
        
        this.position = { x, y };
        this.heading = heading;
        
        // Emit position update event
        eventBus.emit('evader:positionUpdate', this.getState());
        
        console.log(`Evader manually positioned at (${x.toFixed(1)}, ${y.toFixed(1)}), heading: ${heading.toFixed(2)}`);
        return true;
    }

    /**
     * Get current state snapshot
     * @returns {Object} - Current state
     */
    getState() {
        return {
            isRunning: this.isRunning,
            position: this.position ? { ...this.position } : null,
            target: this.targetLeaf ? this.keyToPoint.get(this.targetLeaf) : null,
            heading: this.heading,
            mode: this.mode,
            speed: this.speed,
            angularSpeed: this.angularSpeed,
            path: [...this.path],
            pathEdges: [...this.pathEdges],
            currentWaypointIndex: this.currentWaypointIndex
        };
    }
}
