/**
 * EvaderFutureSetService
 * Computes the reachable set of evader positions over a time horizon
 * Based on grid-based forward propagation with unicycle kinematics
 * 
 * Algorithm:
 * 1. Generate circular grid around evader's current position
 * 2. Forward search using motion primitives (10 primitives)
 * 3. Compute reachability scores using Dijkstra-like propagation
 * 4. Account for obstacles and motion constraints
 */

export class EvaderFutureSetService {
    constructor() {
        this.futureSet = new Map(); // Map of position -> score
        this.gridPoints = [];
        this.timeHorizon = 100; // frames
        this.isComputing = false;
        
        // Motion parameters (pixels per frame)
        this.v_max = 2.0; // Maximum linear velocity
        this.omega_max = 0.15; // Maximum angular velocity (rad/frame)
        this.dt = 1.0; // Time step (1 frame)
        
        // Algorithm parameters
        this.maxSteps = 50; // Increased from 25
        this.maxExpansions = 100000;
        this.scoreThreshold = 0.00001; // Reduced from 0.001 to allow more exploration
        this.thetaBins = 16;
        this.gridResolution = 15; // pixels between grid points
        
        // Cost weights (reduced to allow more exploration)
        this.controlWeight = 0.01; // Reduced from 0.05
        this.headingWeight = 0.1;  // Reduced from 0.3
        this.distanceWeight = 0.01; // Reduced from 0.05
        this.obstacleWeight = 5.0;
        this.obstacleThreshold = 30; // pixels
        
        // Precompute sin/cos lookup table
        this.sinTable = [];
        this.cosTable = [];
        for (let i = 0; i < 360; i++) {
            const rad = (i * Math.PI) / 180;
            this.sinTable.push(Math.sin(rad));
            this.cosTable.push(Math.cos(rad));
        }
        
        // Motion primitives (v, ω) relative to max values
        this.motionPrimitives = [
            [1.0, 0],          // Straight forward
            [1.0, 1.0],        // Hard left
            [1.0, -1.0],       // Hard right
            [1.0, 0.5],        // Moderate left
            [1.0, -0.5],       // Moderate right
            [0.7, 0.7],        // Medium speed curved left
            [0.7, -0.7],       // Medium speed curved right
            [0.5, 1.0],        // Slow tight left
            [0.5, -1.0],       // Slow tight right
            [0.5, 0]           // Slow forward
        ];
    }

    /**
     * Set motion parameters from evader service
     */
    setMotionParameters(v_max, omega_max) {
        this.v_max = v_max;
        this.omega_max = omega_max;
    }

    /**
     * Generate circular grid around center position
     */
    createGrid(centerX, centerY, radius) {
        const points = [];
        const res = this.gridResolution;
        
        // Generate square grid and filter to circle
        const gridRadius = Math.ceil(radius / res);
        
        for (let i = -gridRadius; i <= gridRadius; i++) {
            for (let j = -gridRadius; j <= gridRadius; j++) {
                const x = centerX + i * res;
                const y = centerY + j * res;
                const dist = Math.sqrt(i * i + j * j) * res;
                
                if (dist <= radius) {
                    points.push({ x, y });
                }
            }
        }
        
        return points;
    }

    /**
     * Apply motion model (unicycle kinematics)
     */
    applyMotion(x, y, theta, v, omega, dt) {
        if (Math.abs(omega) < 0.001) {
            // Straight motion
            return {
                x: x + v * Math.cos(theta) * dt,
                y: y + v * Math.sin(theta) * dt,
                theta: theta
            };
        } else {
            // Arc motion
            const radius = v / omega;
            const dTheta = omega * dt;
            return {
                x: x + radius * (Math.sin(theta + dTheta) - Math.sin(theta)),
                y: y - radius * (Math.cos(theta + dTheta) - Math.cos(theta)),
                theta: this.normalizeAngle(theta + dTheta)
            };
        }
    }

    /**
     * Normalize angle to [-π, π]
     */
    normalizeAngle(theta) {
        while (theta > Math.PI) theta -= 2 * Math.PI;
        while (theta < -Math.PI) theta += 2 * Math.PI;
        return theta;
    }

    /**
     * Check if position collides with obstacles
     */
    isCollision(x, y, polygons) {
        if (!polygons || polygons.length === 0) return false;
        
        for (const polygon of polygons) {
            // Handle both 'points' and 'vertices' property names
            const points = polygon.points || polygon.vertices;
            if (!points) continue;
            
            if (this.pointInPolygon(x, y, points)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Point in polygon test (ray casting)
     */
    pointInPolygon(x, y, points) {
        if (!points || points.length < 3) return false;
        
        let inside = false;
        for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
            const xi = points[i].x, yi = points[i].y;
            const xj = points[j].x, yj = points[j].y;
            
            const intersect = ((yi > y) !== (yj > y)) &&
                (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    }

    /**
     * Compute distance to nearest obstacle
     */
    distanceToObstacles(x, y, polygons) {
        if (!polygons || polygons.length === 0) return Infinity;
        
        let minDist = Infinity;
        
        for (const polygon of polygons) {
            // Handle both 'points' and 'vertices' property names
            const points = polygon.points || polygon.vertices;
            if (!points) continue;
            
            // Distance to each edge
            for (let i = 0; i < points.length; i++) {
                const p1 = points[i];
                const p2 = points[(i + 1) % points.length];
                const dist = this.distanceToSegment(x, y, p1.x, p1.y, p2.x, p2.y);
                minDist = Math.min(minDist, dist);
            }
        }
        
        return minDist;
    }

    /**
     * Distance from point to line segment
     */
    distanceToSegment(px, py, x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const l2 = dx * dx + dy * dy;
        
        if (l2 === 0) return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
        
        let t = ((px - x1) * dx + (py - y1) * dy) / l2;
        t = Math.max(0, Math.min(1, t));
        
        const projX = x1 + t * dx;
        const projY = y1 + t * dy;
        
        return Math.sqrt((px - projX) ** 2 + (py - projY) ** 2);
    }

    /**
     * Compute transition cost
     */
    computeCost(x1, y1, theta1, x2, y2, theta2, v, omega, targetX, targetY, polygons) {
        // Control cost (energy)
        const controlCost = this.controlWeight * (v * v + omega * omega) * this.dt;
        
        // Heading cost (alignment to target)
        const targetAngle = Math.atan2(targetY - y1, targetX - x1);
        const headingError = Math.abs(this.normalizeAngle(theta2 - targetAngle));
        const headingCost = this.headingWeight * headingError / Math.PI;
        
        // Distance cost (efficiency)
        const distance = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
        const distanceCost = this.distanceWeight * distance;
        
        // Obstacle cost (safety)
        const obstDist = this.distanceToObstacles(x2, y2, polygons);
        let obstacleCost = 0;
        if (obstDist < this.obstacleThreshold) {
            obstacleCost = this.obstacleWeight * (this.obstacleThreshold - obstDist);
        }
        
        return controlCost + headingCost + distanceCost + obstacleCost;
    }

    /**
     * Discretize position for visited state tracking
     */
    discretizePosition(x, y) {
        const res = this.gridResolution;
        return `${Math.round(x / res)}_${Math.round(y / res)}`;
    }

    /**
     * Discretize heading into bins
     */
    discretizeHeading(theta) {
        const normalized = this.normalizeAngle(theta);
        const bin = Math.floor(((normalized + Math.PI) / (2 * Math.PI)) * this.thetaBins);
        return Math.max(0, Math.min(this.thetaBins - 1, bin));
    }

    /**
     * Main computation: Forward search with motion primitives
     */
    async compute(startState, polygons, timeHorizonFrames, motionParams = {}) {
        this.isComputing = true;
        const startTime = performance.now();
        
        try {
            // Update parameters
            if (motionParams.v_max) this.v_max = motionParams.v_max;
            if (motionParams.omega_max) this.omega_max = motionParams.omega_max;
            
            const { x: startX, y: startY, theta: startTheta } = startState;
            
            // Generate grid
            const maxRadius = this.v_max * timeHorizonFrames * this.dt;
            this.gridPoints = this.createGrid(startX, startY, maxRadius);
            
            console.log(`Generated ${this.gridPoints.length} grid points (radius: ${maxRadius.toFixed(1)}px)`);
            
            // Initialize scores
            const scores = new Map();
            this.gridPoints.forEach(pt => {
                const key = this.discretizePosition(pt.x, pt.y);
                scores.set(key, 0.0);
            });
            
            // Set start score
            const startKey = this.discretizePosition(startX, startY);
            scores.set(startKey, 1.0);
            
            // Priority queue: [score, x, y, theta, step]
            const queue = [[1.0, startX, startY, startTheta, 0]];
            const visited = new Set();
            
            let expansions = 0;
            
            // Forward search
            while (queue.length > 0 && expansions < this.maxExpansions) {
                // Pop highest score (simple sort, could use heap for efficiency)
                queue.sort((a, b) => b[0] - a[0]);
                const [currentScore, x, y, theta, step] = queue.shift();
                
                if (step > this.maxSteps) continue;
                
                // Check visited
                const posKey = this.discretizePosition(x, y);
                const thetaBin = this.discretizeHeading(theta);
                const stateKey = `${posKey}_${thetaBin}_${step}`;
                
                if (visited.has(stateKey)) continue;
                visited.add(stateKey);
                
                expansions++;
                
                // Try all motion primitives
                for (const [vRel, omegaRel] of this.motionPrimitives) {
                    const v = vRel * this.v_max;
                    const omega = omegaRel * this.omega_max;
                    
                    // Apply motion
                    const newState = this.applyMotion(x, y, theta, v, omega, this.dt);
                    
                    // Check collision
                    if (this.isCollision(newState.x, newState.y, polygons)) {
                        continue;
                    }
                    
                    // Compute cost
                    const cost = this.computeCost(
                        x, y, theta,
                        newState.x, newState.y, newState.theta,
                        v, omega,
                        startX, startY, // Target (could be modified)
                        polygons
                    );
                    
                    // Update score
                    const newScore = currentScore * Math.exp(-cost);
                    
                    if (newScore > this.scoreThreshold) {
                        const newPosKey = this.discretizePosition(newState.x, newState.y);
                        
                        if (!scores.has(newPosKey) || newScore > scores.get(newPosKey)) {
                            scores.set(newPosKey, newScore);
                            queue.push([newScore, newState.x, newState.y, newState.theta, step + 1]);
                        }
                    }
                }
            }
            
            // Normalize scores
            const totalScore = Array.from(scores.values()).reduce((sum, s) => sum + s, 0);
            if (totalScore > 0) {
                scores.forEach((score, key) => {
                    scores.set(key, score / totalScore);
                });
            }
            
            // Filter significant scores and convert to array
            this.futureSet = scores;
            const significantPoints = Array.from(scores.entries())
                .filter(([_, score]) => score > 0.0001)
                .map(([key, score]) => {
                    const [x, y] = key.split('_').map(Number).map(n => n * this.gridResolution);
                    return { x, y, score };
                });
            
            const elapsed = performance.now() - startTime;
            
            console.log(`Reachability computed: ${significantPoints.length} reachable points in ${elapsed.toFixed(1)}ms`);
            console.log(`Expansions: ${expansions}, Max score: ${Math.max(...scores.values()).toFixed(4)}`);
            
            this.isComputing = false;
            
            return {
                success: true,
                futureSet: significantPoints,
                gridPoints: this.gridPoints,
                timeHorizon: timeHorizonFrames,
                computationTime: elapsed,
                expansions: expansions
            };
            
        } catch (error) {
            this.isComputing = false;
            console.error('Error computing future set:', error);
            throw error;
        }
    }

    /**
     * Clear the computed future set
     */
    clear() {
        this.futureSet.clear();
        this.gridPoints = [];
        this.isComputing = false;
    }

    /**
     * Get the current future set
     * @returns {Map} The computed future set
     */
    getFutureSet() {
        return this.futureSet;
    }

    /**
     * Check if computation is in progress
     * @returns {boolean} True if computing
     */
    isComputingFutureSet() {
        return this.isComputing;
    }
}
