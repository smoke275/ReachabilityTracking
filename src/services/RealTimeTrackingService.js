/**
 * RealTimeTrackingService
 * Implements real-time pursuit-evasion tracking with automatic RRT* planning
 * 
 * Algorithm steps:
 * 1. Build RRT* trees from current pursuer and evader states
 * 2. Compute visibility matrix Ne/Np using ActiveTrackingService
 * 3. Choose strategy (PL, EL, ELST, TMA) to select target nodes
 * 4. Reconstruct paths from root to target nodes
 * 5. Execute simulation along paths for dt_exec
 * 6. Repeat loop
 */

import { eventBus } from '../utils/EventBus.js';
import { rrtStarService } from './RRTStarService.js';
import { activeTrackingService } from './ActiveTrackingService.js';

// Worker handle
let plannerWorker = null;
let usingWASM = false;

async function startPlannerWorker() {
    if (plannerWorker) return plannerWorker;
    
    // Try WASM worker first
    try {
        console.log('Attempting to load WASM worker...');
        plannerWorker = new Worker(new URL('../workers/plannerWASMWorker.js', import.meta.url), { type: 'module' });
        
        // Wait for ready signal with timeout
        const ready = await new Promise((resolve) => {
            const timeout = setTimeout(() => resolve(false), 2000);
            
            plannerWorker.onmessage = (e) => {
                if (e.data.type === 'ready' || e.data.type === 'initialized') {
                    clearTimeout(timeout);
                    resolve(true);
                }
            };
            
            plannerWorker.onerror = () => {
                clearTimeout(timeout);
                resolve(false);
            };
        });
        
        if (ready) {
            usingWASM = true;
            console.log('✅ Using WASM worker for high-performance planning');
            return plannerWorker;
        } else {
            throw new Error('WASM worker initialization timeout');
        }
    } catch (error) {
        console.warn('⚠️ WASM worker failed:', error.message);
        if (plannerWorker) {
            plannerWorker.terminate();
            plannerWorker = null;
        }
    }
    
    // Fall back to JavaScript worker
    try {
        console.log('Falling back to JavaScript worker...');
        plannerWorker = new Worker(new URL('../workers/plannerWorker.js', import.meta.url), { type: 'module' });
        usingWASM = false;
        console.log('✅ Using JavaScript worker');
        return plannerWorker;
    } catch (error) {
        console.error('❌ Failed to create JavaScript worker:', error);
        plannerWorker = null;
        return null;
    }
}

function terminatePlannerWorker() {
    if (plannerWorker) {
        plannerWorker.terminate();
        plannerWorker = null;
        usingWASM = false;
    }
}

function reconstructTreeFromFlat(flat) {
    if (!flat || !flat.nodes || !flat.nodes.length) return null;
    const nodes = flat.nodes.map(n => ({ state: { x: n.x, y: n.y, theta: n.theta }, cost: n.cost, parent: null, children: [] }));
    for (const [pi, ci] of flat.edges) {
        nodes[ci].parent = nodes[pi];
        nodes[pi].children.push(nodes[ci]);
    }
    return nodes[0];
}

export class RealTimeTrackingService {
    constructor() {
        this.isTracking = false;
        this.trackingLoopId = null;
        this.animationFrameId = null;
        this.lastUpdateTime = 0;
        
        // Complete RRT* and Sensor Configuration - fully independent
        this.config = {
            // === RRT* Tree Building ===
            maxNodes: 1000,              // Maximum nodes per tree
            maxPlanningTime: 100,        // Max planning time per step (ms)
            steerTime: 0.5,              // Time horizon for steering (seconds)
            dt: 0.05,                    // Integration time step (seconds)
            goalSampleRate: 0.05,        // Probability of sampling goal
            rewireRadius: 50.0,          // Radius for rewiring neighbors
            robotRadius: 8.0,            // Robot collision radius (pixels)
            
            // === Agent Motion Constraints ===
            vMax: 10.0,                  // Maximum linear velocity (pixels/sec)
            vMin: 0.0,                   // Minimum linear velocity
            omegaMax: 1.5,               // Maximum angular velocity (rad/sec)
            
            // === Pursuer Sensor (used for visibility) ===
            pursuerSensorEnabled: true,
            pursuerRMin: 20,             // Pursuer blind spot (pixels)
            pursuerRMax: 150,            // Pursuer detection range (pixels)
            pursuerFOV: 360,             // Pursuer field of view (degrees)
            
            // === Tracking Behavior ===
            strategy: 'tma',             // Strategy: 'pl' or 'tma'
            updateInterval: 2.0,         // Replan interval (seconds)
            
            // === Unicycle Control Gains ===
            K_v: 0.3,                    // Linear velocity gain
            K_h: 3.0                     // Heading error gain
        };
        
        // Store original configs to restore later
        this.originalRRTConfig = null;
        this.originalSensorConfig = null;
        
        // Current agent states
        this.pursuerState = null;
        this.evaderState = null;
        
        // Current trees
        this.pursuerTree = null;
        this.evaderTree = null;
        
        // Current paths and waypoint tracking
        this.pursuerPath = [];
        this.evaderPath = [];
        this.pursuerWaypointIndex = 0;
        this.evaderWaypointIndex = 0;
        
        // Waypoint tolerance
        this.waypointTolerance = 5.0; // pixels
        
        // Last replan time
        this.lastReplanTime = 0;
        
        // Statistics
        this.stats = {
            iterations: 0,
            planningTime: 0,
            distance: 0,
            lastUpdate: Date.now()
        };
        
        // Obstacles
        this.obstacles = [];
        console.log('RealTimeTrackingService initialized');
    }

    /**
     * Configure tracking parameters
     */
    configure(config) {
        this.config = { ...this.config, ...config };
        console.log('RealTimeTrackingService configured:', this.config);
    }

    /**
     * Set obstacles for planning
     */
    setObstacles(obstacles) {
        this.obstacles = obstacles || [];
        const w = plannerWorker;
        if (w) {
            w.postMessage({ type: 'obstacles', payload: { obstacles: this.obstacles } });
        }
    }

    /**
     * Start real-time tracking
     */
    async start(pursuerState, evaderState) {
        if (this.isTracking) {
            console.warn('Tracking already active');
            return;
        }

        if (!pursuerState || !evaderState) {
            eventBus.emit('realTimeTracking:error', {
                message: 'Both pursuer and evader must be placed first'
            });
            return;
        }

        // Make copies of states to avoid modifying the originals
        this.pursuerState = {
            position: {
                x: pursuerState.position.x,
                y: pursuerState.position.y
            },
            heading: pursuerState.heading || 0,
            speed: pursuerState.speed,
            angularSpeed: pursuerState.angularSpeed
        };
        
        this.evaderState = {
            position: {
                x: evaderState.position.x,
                y: evaderState.position.y
            },
            heading: evaderState.heading || 0,
            speed: evaderState.speed,
            angularSpeed: evaderState.angularSpeed
        };
        
        this.isTracking = true;
        this.stats.iterations = 0;
        this.stats.lastUpdate = Date.now();
        this.lastReplanTime = performance.now();
        this.lastUpdateTime = performance.now();

        console.log('Starting real-time tracking:', {
            pursuer: this.pursuerState,
            evader: this.evaderState,
            config: this.config
        });

        eventBus.emit('realTimeTracking:started');
        
        // Initialize worker with current environment
        plannerWorker = await startPlannerWorker();
        if (!plannerWorker) {
            console.error('Failed to start any worker');
            this.stop();
            return;
        }
        
        // Setup message handler
        let workerReady = false;
        let initializationFailed = false;
        
        plannerWorker.onmessage = (e) => {
            const { type, payload } = e.data || {};
            
            if (type === 'error' && payload?.wasmError && !workerReady) {
                // WASM initialization failed, fall back to JavaScript
                console.warn('⚠️ WASM initialization failed:', payload.message);
                initializationFailed = true;
                plannerWorker.terminate();
                plannerWorker = null;
                usingWASM = false;
                
                // Restart with JavaScript worker
                this._restartWithJavaScriptWorker();
                return;
            }
            
            if (type === 'initialized') {
                console.log('Planner worker initialized');
                workerReady = true;
                // Do initial planning after worker is ready
                this.planAsync();
            } else if (type === 'configured') {
                console.log('Planner worker configured');
            } else {
                this.onWorkerMessage(e);
            }
        };
        
        plannerWorker.onerror = (err) => {
            console.error('Worker error:', err);
            if (!workerReady && !initializationFailed) {
                // Error during initialization, fall back
                initializationFailed = true;
                plannerWorker.terminate();
                plannerWorker = null;
                usingWASM = false;
                this._restartWithJavaScriptWorker();
            } else {
                eventBus.emit('realTimeTracking:error', { message: 'Worker error occurred' });
            }
        };
        
        // Send initialization
        plannerWorker.postMessage({
            type: 'init',
            payload: {
                obstacles: this.obstacles || rrtStarService.obstacles || [],
                rrtConfig: usingWASM ? {
                    // WASM expects camelCase
                    maxNodes: this.config.maxNodes,
                    maxPlanningTime: this.config.maxPlanningTime,
                    steerTime: this.config.steerTime,
                    dt: this.config.dt,
                    goalSampleRate: this.config.goalSampleRate,
                    rewireRadius: this.config.rewireRadius,
                    robotRadius: this.config.robotRadius,
                    vMax: this.config.vMax,
                    vMin: this.config.vMin,
                    omegaMax: this.config.omegaMax,
                    bounds: {
                        xMin: rrtStarService.config.bounds.x_min,
                        xMax: rrtStarService.config.bounds.x_max,
                        yMin: rrtStarService.config.bounds.y_min,
                        yMax: rrtStarService.config.bounds.y_max
                    }
                } : {
                    // JavaScript expects snake_case
                    max_nodes: this.config.maxNodes,
                    max_planning_time: this.config.maxPlanningTime,
                    steer_time: this.config.steerTime,
                    dt: this.config.dt,
                    goal_sample_rate: this.config.goalSampleRate,
                    rewire_radius: this.config.rewireRadius,
                    robot_radius: this.config.robotRadius,
                    v_max: this.config.vMax,
                    v_min: this.config.vMin,
                    omega_max: this.config.omegaMax,
                    bounds: rrtStarService.config?.bounds
                },
                pursuerSensorParams: usingWASM ? {
                    // WASM expects camelCase
                    enabled: this.config.pursuerSensorEnabled,
                    rMin: this.config.pursuerRMin,
                    rMax: this.config.pursuerRMax,
                    fov: this.config.pursuerFOV,
                    orientation: 0.0
                } : {
                    // JavaScript expects snake_case
                    enabled: this.config.pursuerSensorEnabled,
                    R_min: this.config.pursuerRMin,
                    R_max: this.config.pursuerRMax,
                    fov: this.config.pursuerFOV
                }
            }
        });
        
        // Start continuous animation loop
        this.animate();
    }

    /**
     * Restart with JavaScript worker after WASM failure
     */
    async _restartWithJavaScriptWorker() {
        console.log('Falling back to JavaScript worker...');
        
        try {
            plannerWorker = new Worker(new URL('../workers/plannerWorker.js', import.meta.url), { type: 'module' });
            usingWASM = false;
            console.log('✅ Using JavaScript worker');
            
            // Setup message handler
            let workerReady = false;
            
            plannerWorker.onmessage = (e) => {
                const { type, payload } = e.data || {};
                
                if (type === 'initialized') {
                    console.log('JavaScript worker initialized');
                    workerReady = true;
                    // Do initial planning after worker is ready
                    this.planAsync();
                } else if (type === 'configured') {
                    console.log('JavaScript worker configured');
                } else {
                    this.onWorkerMessage(e);
                }
            };
            
            plannerWorker.onerror = (err) => {
                console.error('JavaScript worker error:', err);
                eventBus.emit('realTimeTracking:error', { message: 'Worker error occurred' });
            };
            
            // Send initialization
            plannerWorker.postMessage({
                type: 'init',
                payload: {
                    obstacles: this.obstacles || rrtStarService.obstacles || [],
                    rrtConfig: {
                        // JavaScript worker always uses snake_case
                        max_nodes: this.config.maxNodes,
                        max_planning_time: this.config.maxPlanningTime,
                        steer_time: this.config.steerTime,
                        dt: this.config.dt,
                        goal_sample_rate: this.config.goalSampleRate,
                        rewire_radius: this.config.rewireRadius,
                        robot_radius: this.config.robotRadius,
                        v_max: this.config.vMax,
                        v_min: this.config.vMin,
                        omega_max: this.config.omegaMax,
                        bounds: rrtStarService.config?.bounds
                    },
                    pursuerSensorParams: {
                        // JavaScript worker uses snake_case
                        enabled: this.config.pursuerSensorEnabled,
                        R_min: this.config.pursuerRMin,
                        R_max: this.config.pursuerRMax,
                        fov: this.config.pursuerFOV
                    }
                }
            });
        } catch (error) {
            console.error('❌ Failed to start JavaScript worker:', error);
            eventBus.emit('realTimeTracking:error', { message: 'Failed to start fallback worker' });
            this.stop();
        }
    }

    /**
     * Stop real-time tracking
     */
    stop() {
        if (!this.isTracking) return;

        this.isTracking = false;
        
        if (this.trackingLoopId) {
            clearTimeout(this.trackingLoopId);
            this.trackingLoopId = null;
        }
        
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }

        // Restore original RRT configuration
        if (this.originalRRTConfig) {
            rrtStarService.config.max_nodes = this.originalRRTConfig.max_nodes;
            rrtStarService.config.max_planning_time = this.originalRRTConfig.max_planning_time;
            rrtStarService.config.steer_time = this.originalRRTConfig.steer_time;
            rrtStarService.config.dt = this.originalRRTConfig.dt;
            rrtStarService.config.goal_sample_rate = this.originalRRTConfig.goal_sample_rate;
            rrtStarService.config.rewire_radius = this.originalRRTConfig.rewire_radius;
            rrtStarService.config.robot_radius = this.originalRRTConfig.robot_radius;
            rrtStarService.config.v_max = this.originalRRTConfig.v_max;
            rrtStarService.config.v_min = this.originalRRTConfig.v_min;
            rrtStarService.config.omega_max = this.originalRRTConfig.omega_max;
        }

        // Restore original Sensor configuration (only pursuer sensor)
        if (this.originalSensorConfig && this.sensorModelService) {
            this.sensorModelService.pursuerSensor.enabled = this.originalSensorConfig.pursuer.enabled;
            this.sensorModelService.pursuerSensor.R_min = this.originalSensorConfig.pursuer.R_min;
            this.sensorModelService.pursuerSensor.R_max = this.originalSensorConfig.pursuer.R_max;
            this.sensorModelService.pursuerSensor.fov = this.originalSensorConfig.pursuer.fov;
        }

        terminatePlannerWorker();
        console.log('Real-time tracking stopped');
        eventBus.emit('realTimeTracking:stopped', this.stats);
    }

    /**
     * Continuous animation loop - like evader service
     */
    animate() {
        if (!this.isTracking) return;
        
        const currentTime = performance.now();
        const deltaTime = (currentTime - this.lastUpdateTime) / 1000; // Convert to seconds
        this.lastUpdateTime = currentTime;
        
        // Get current evader state from EvaderService if it's running
        // IMPORTANT: Make a deep copy to avoid modifying the original evader state
        eventBus.emit('realTimeTracking:requestEvaderState', (evaderState) => {
            if (evaderState && evaderState.position) {
                // Deep copy to avoid reference issues
                this.evaderState = {
                    position: {
                        x: evaderState.position.x,
                        y: evaderState.position.y
                    },
                    heading: evaderState.heading || 0,
                    speed: evaderState.speed,
                    angularSpeed: evaderState.angularSpeed
                };
            }
        });
        
        // Update agent positions using unicycle feedback control (pursuer only)
        this.updateAgents(deltaTime);
        
        // Check if we need to replan
        const timeSinceLastReplan = (currentTime - this.lastReplanTime) / 1000; // seconds
        if (timeSinceLastReplan >= this.config.updateInterval) {
            this.planAsync();
        }
        
        // Update statistics
        this.stats.distance = this.computeDistance(
            this.pursuerState.position,
            this.evaderState.position
        );
        
        // Update visualization (pursuer only)
        this.updateAgentServices();
        
        // Continue animation loop
        this.animationFrameId = requestAnimationFrame(() => this.animate());
    }

    /**
     * Update agent positions using unicycle feedback control
     * NOTE: Only updates pursuer - evader is managed by EvaderService
     * @param {number} deltaTime - Time since last update in seconds
     */
    updateAgents(deltaTime) {
        // Update pursuer only - evader is controlled by EvaderService
        if (this.pursuerPath.length > 0 && this.pursuerWaypointIndex < this.pursuerPath.length) {
            const target = this.pursuerPath[this.pursuerWaypointIndex];
            const reached = this.updateUnicycle(this.pursuerState, target, deltaTime);
            
            if (reached) {
                this.pursuerWaypointIndex++;
                console.log(`Pursuer reached waypoint ${this.pursuerWaypointIndex}/${this.pursuerPath.length}`);
            }
        }
        
        // DO NOT update evader here - let EvaderService handle it
        // The evader state is only used for planning, not for control
    }

    /**
     * Update agent using unicycle feedback control
     * @param {Object} state - Agent state {position: {x, y}, heading}
     * @param {Object} target - Target waypoint {x, y, theta}
     * @param {number} deltaTime - Time since last update in seconds
     * @returns {boolean} True if waypoint reached
     */
    updateUnicycle(state, target, deltaTime) {
        const dx = target.x - state.position.x;
        const dy = target.y - state.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Check if waypoint reached
        if (distance <= this.waypointTolerance) {
            return true;
        }
        
        // Calculate desired heading to target
        const desiredHeading = Math.atan2(dy, dx);
        
        // Calculate heading error (normalized to [-π, π])
        let headingError = desiredHeading - state.heading;
        while (headingError > Math.PI) headingError -= 2 * Math.PI;
        while (headingError < -Math.PI) headingError += 2 * Math.PI;
        
        // Feedback control law (same as evader service)
        // Linear velocity: v = K_v * distance * max(0, cos(θ_error))
        const alignmentFactor = Math.max(0, Math.cos(headingError));
        let v = this.config.K_v * distance * alignmentFactor;
        v = Math.min(v, this.config.vMax);
        
        // Angular velocity: ω = K_h * θ_error
        let omega = this.config.K_h * headingError;
        omega = Math.max(-this.config.omegaMax, Math.min(this.config.omegaMax, omega));
        
        // Apply unicycle model
        const dt = deltaTime * 60; // 60 fps normalization (same as evader)
        state.position.x += v * Math.cos(state.heading) * dt;
        state.position.y += v * Math.sin(state.heading) * dt;
        state.heading += omega * dt;
        
        // Normalize heading to [-π, π]
        state.heading = this.normalizeAngle(state.heading);
        
        return false;
    }

    /**
     * Plan asynchronously - build trees, compute visibility, select targets
     */
    async planAsync() {
        const planStart = performance.now();
        this.lastReplanTime = planStart;
        
        try {
            // Use plannerWorker directly (it's the manager)
            if (!plannerWorker) throw new Error('Planner worker unavailable');
            
            const strategy = this.config.strategy || 'tma';
            const pState = {
                x: this.pursuerState.position.x,
                y: this.pursuerState.position.y,
                theta: this.pursuerState.heading || 0
            };
            const eState = {
                x: this.evaderState.position.x,
                y: this.evaderState.position.y,
                theta: this.evaderState.heading || 0
            };
            
            // Push latest config deltas (if sliders changed during run)
            plannerWorker.postMessage({
                type: 'config',
                payload: usingWASM ? {
                    // WASM expects camelCase
                    rrtConfig: {
                        maxNodes: this.config.maxNodes,
                        maxPlanningTime: this.config.maxPlanningTime,
                        steerTime: this.config.steerTime,
                        dt: this.config.dt,
                        goalSampleRate: this.config.goalSampleRate,
                        rewireRadius: this.config.rewireRadius,
                        robotRadius: this.config.robotRadius,
                        vMax: this.config.vMax,
                        vMin: this.config.vMin,
                        omegaMax: this.config.omegaMax
                    },
                    pursuerSensorParams: {
                        enabled: this.config.pursuerSensorEnabled,
                        rMin: this.config.pursuerRMin,
                        rMax: this.config.pursuerRMax,
                        fov: this.config.pursuerFOV,
                        orientation: 0.0
                    }
                } : {
                    // JavaScript expects snake_case
                    rrtConfig: {
                        max_nodes: this.config.maxNodes,
                        max_planning_time: this.config.maxPlanningTime,
                        steer_time: this.config.steerTime,
                        dt: this.config.dt,
                        goal_sample_rate: this.config.goalSampleRate,
                        rewire_radius: this.config.rewireRadius,
                        robot_radius: this.config.robotRadius,
                        v_max: this.config.vMax,
                        v_min: this.config.vMin,
                        omega_max: this.config.omegaMax
                    },
                    pursuerSensorParams: {
                        enabled: this.config.pursuerSensorEnabled,
                        R_min: this.config.pursuerRMin,
                        R_max: this.config.pursuerRMax,
                        fov: this.config.pursuerFOV
                    }
                }
            });
            
            // Request plan
            plannerWorker.postMessage({ type: 'plan', payload: { pursuerState: pState, evaderState: eState, strategy } });
            
            // Return immediately; result handled in onWorkerMessage
        } catch (error) {
            console.error('Planning error:', error);
            eventBus.emit('realTimeTracking:error', { message: error.message });
            this.stop();
        }
    }

    onWorkerMessage(e) {
        const { type, payload } = e.data || {};
        if (type === 'initialized' || type === 'configured') return;
        if (type === 'error') {
            eventBus.emit('realTimeTracking:error', { message: payload?.message || 'Worker error' });
            return;
        }
        if (type !== 'planned') return;

        const { stats, pursuer, evader, strategy } = payload;
        // Reconstruct trees for current drawing code
        this.pursuerTree = reconstructTreeFromFlat(pursuer);
        this.evaderTree = reconstructTreeFromFlat(evader);
        
        // Paths and winning nodes
        this.pursuerPath = pursuer.path || [];
        this.evaderPath = evader.path || [];
        this.pursuerWaypointIndex = 0;
        this.evaderWaypointIndex = 0;
        
        // Winning nodes (for visualization)
        let pursuerWinningNode = null;
        let evaderWinningNode = null;
        if (this.pursuerTree && Number.isInteger(pursuer.winningIndex)) {
            const nodes = activeTrackingService.treeToArray(this.pursuerTree);
            pursuerWinningNode = nodes[pursuer.winningIndex] || null;
        }
        if (this.evaderTree && Number.isInteger(evader.winningIndex)) {
            const nodes = activeTrackingService.treeToArray(this.evaderTree);
            evaderWinningNode = nodes[evader.winningIndex] || null;
        }
        
        // Update statistics
        this.stats.iterations++;
        this.stats.planningTime = stats?.planningTime ?? 0;
        
        // Re-emit events for UI
        eventBus.emit('rrt:treesBuilt', {
            pursuerTree: this.pursuerTree,
            evaderTree: this.evaderTree,
            stats: {
                pursuerNodes: pursuer?.nodes?.length || 0,
                evaderNodes: evader?.nodes?.length || 0,
                planningTime: this.stats.planningTime
            }
        });
        
        eventBus.emit('realTimeTracking:update', {
            pursuerState: this.pursuerState,
            evaderState: this.evaderState,
            pursuerPath: this.pursuerPath,
            evaderPath: this.evaderPath,
            pursuerTree: this.pursuerTree,
            evaderTree: this.evaderTree,
            pursuerWinningNode,
            evaderWinningNode,
            strategy,
            stats: this.stats,
            usingWASM: usingWASM
        });
    }

    /**
     * Normalize angle to [-pi, pi]
     * @param {number} angle - Angle in radians
     * @returns {number} Normalized angle
     */
    normalizeAngle(angle) {
        while (angle > Math.PI) angle -= 2 * Math.PI;
        while (angle < -Math.PI) angle += 2 * Math.PI;
        return angle;
    }

    /**
     * Count nodes in an RRT tree
     * @param {RRTNode} root - Root of the tree
     * @returns {number} Number of nodes
     */
    countTreeNodes(root) {
        if (!root) return 0;
        
        let count = 0;
        const queue = [root];
        
        while (queue.length > 0) {
            const node = queue.shift();
            count++;
            
            if (node.children && node.children.length > 0) {
                queue.push(...node.children);
            }
        }
        
        return count;
    }

    /**
     * Compute Euclidean distance
     */
    computeDistance(pos1, pos2) {
        const dx = pos2.x - pos1.x;
        const dy = pos2.y - pos1.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * Get current tracking state
     */
    getState() {
        return {
            isTracking: this.isTracking,
            config: this.config,
            stats: this.stats,
            pursuerState: this.pursuerState,
            evaderState: this.evaderState,
            usingWASM: usingWASM
        };
    }

    /**
     * Update agent services with current states for visualization
     * NOTE: Only updates pursuer - evader is managed by EvaderService
     */
    updateAgentServices() {
        // Update pursuer position via event (IntruderService listens to this)
        eventBus.emit('intruder:positionUpdate', {
            position: this.pursuerState.position,
            heading: this.pursuerState.heading
        });
        
        // DO NOT update evader position here - it's controlled by EvaderService
        // If we emit evader:positionUpdate, it will interfere with the evader simulation
    }

    /**
     * Reset pursuer spawn near the evader, inside bounds and not colliding with polygons
     */
    resetNearEvader() {
        // Ensure we have current evader state
        if (!this.evaderState || !this.evaderState.position) {
            eventBus.emit('realTimeTracking:requestEvaderState', (ev) => {
                if (ev && ev.position) {
                    this.evaderState = {
                        position: { x: ev.position.x, y: ev.position.y },
                        heading: ev.heading || 0,
                        speed: ev.speed,
                        angularSpeed: ev.angularSpeed
                    };
                    this._resetNearEvaderInternal();
                } else {
                    eventBus.emit('realTimeTracking:error', { message: 'Evader state unavailable' });
                }
            });
            return;
        }
        this._resetNearEvaderInternal();
    }

    _resetNearEvaderInternal() {
        const ev = this.evaderState;
        const bounds = (rrtStarService.config && rrtStarService.config.bounds) || { x_min: -Infinity, x_max: Infinity, y_min: -Infinity, y_max: Infinity };
        const robotR = this.config.robotRadius ?? rrtStarService.config?.robot_radius ?? 8.0;

        const distances = [30, 50, 80, 120, 160];
        const angleSteps = 24; // 15° steps
        const twoPi = Math.PI * 2;

        const withinBounds = (x, y) => x >= bounds.x_min && x <= bounds.x_max && y >= bounds.y_min && y <= bounds.y_max;

        let chosen = null;
        // Try around evader
        for (const d of distances) {
            for (let k = 0; k < angleSteps; k++) {
                const ang = (k / angleSteps) * twoPi;
                const x = ev.position.x + Math.cos(ang) * d;
                const y = ev.position.y + Math.sin(ang) * d;
                if (!withinBounds(x, y)) continue;
                const heading = Math.atan2(ev.position.y - y, ev.position.x - x); // face the evader
                const state = { x, y, theta: heading };
                // Use RRT service collision check (uses its obstacles & robot radius)
                const collision = rrtStarService.isStateInCollision ? rrtStarService.isStateInCollision(state) : false;
                if (!collision) { chosen = { x, y, heading }; break; }
            }
            if (chosen) break;
        }

        if (!chosen) {
            eventBus.emit('realTimeTracking:error', { message: 'No valid spawn found near evader' });
            return;
        }

        // Apply new pursuer state
        this.pursuerState = {
            position: { x: chosen.x, y: chosen.y },
            heading: chosen.heading,
            speed: 0,
            angularSpeed: 0
        };
        this.pursuerPath = [];
        this.pursuerWaypointIndex = 0;

        // Update intruder visualization immediately
        eventBus.emit('intruder:positionUpdate', {
            position: this.pursuerState.position,
            heading: this.pursuerState.heading
        });

        // If tracking, replan from new position
        if (this.isTracking) {
            this.planAsync();
        }
    }
}

// Export singleton instance
export const realTimeTrackingService = new RealTimeTrackingService();
