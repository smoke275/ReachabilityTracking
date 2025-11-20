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
     * Start real-time tracking
     */
    start(pursuerState, evaderState) {
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
        
        // Do initial planning
        this.planAsync();
        
        // Start continuous animation loop
        this.animate();
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
            console.log(`\n=== Real-Time Tracking Planning ${this.stats.iterations + 1} ===`);
            
            // Step 1: Build RRT* trees from current states
            await this.buildTrees();

            // Step 2: Compute visibility matrix
            const visibilityResult = this.computeVisibility();
            
            if (!visibilityResult.success) {
                throw new Error('Failed to compute visibility');
            }

            // Step 3: Choose strategy and select target nodes
            const targets = this.chooseTargets();
            
            if (!targets) {
                throw new Error('Failed to choose target nodes');
            }

            // Step 4: Extract paths from root to targets
            this.pursuerPath = this.reconstructPath(this.pursuerTree, targets.pursuerIndex);
            this.evaderPath = this.reconstructPath(this.evaderTree, targets.evaderIndex);
            
            // Reset waypoint indices
            this.pursuerWaypointIndex = 0;
            this.evaderWaypointIndex = 0;

            // Get winning nodes for visualization
            const pursuerNodes = activeTrackingService.treeToArray(this.pursuerTree);
            const evaderNodes = activeTrackingService.treeToArray(this.evaderTree);
            const pursuerWinningNode = targets.pursuerIndex >= 0 ? pursuerNodes[targets.pursuerIndex] : null;
            const evaderWinningNode = targets.evaderIndex >= 0 ? evaderNodes[targets.evaderIndex] : null;

            // Update statistics
            this.stats.iterations++;
            this.stats.planningTime = performance.now() - planStart;

            // Emit update event with trees and winning nodes
            console.log('Emitting realTimeTracking:update with trees:', {
                hasPursuerTree: !!this.pursuerTree,
                hasEvaderTree: !!this.evaderTree,
                pursuerTreeNodes: this.pursuerTree ? Object.keys(this.pursuerTree).length : 0,
                evaderTreeNodes: this.evaderTree ? Object.keys(this.evaderTree).length : 0,
                pursuerWinningNode: pursuerWinningNode,
                evaderWinningNode: evaderWinningNode,
                iteration: this.stats.iterations
            });
            
            eventBus.emit('realTimeTracking:update', {
                pursuerState: this.pursuerState,
                evaderState: this.evaderState,
                pursuerPath: this.pursuerPath,
                evaderPath: this.evaderPath,
                pursuerTree: this.pursuerTree,
                evaderTree: this.evaderTree,
                pursuerWinningNode: pursuerWinningNode,
                evaderWinningNode: evaderWinningNode,
                strategy: this.config.strategy,
                stats: this.stats
            });

        } catch (error) {
            console.error('Planning error:', error);
            eventBus.emit('realTimeTracking:error', {
                message: error.message
            });
            this.stop();
        }
    }

    /**
     * Build RRT* trees from current agent states
     */
    async buildTrees() {
        // Get sensor service from activeTrackingService
        if (!this.sensorModelService) {
            this.sensorModelService = activeTrackingService.sensorModelService;
            if (!this.sensorModelService) {
                throw new Error('SensorModelService not available. Make sure it is initialized in the app.');
            }
        }
        
        // Save original configs if this is the first time
        if (!this.originalRRTConfig) {
            this.originalRRTConfig = {
                max_nodes: rrtStarService.config.max_nodes,
                max_planning_time: rrtStarService.config.max_planning_time,
                steer_time: rrtStarService.config.steer_time,
                dt: rrtStarService.config.dt,
                goal_sample_rate: rrtStarService.config.goal_sample_rate,
                rewire_radius: rrtStarService.config.rewire_radius,
                robot_radius: rrtStarService.config.robot_radius,
                v_max: rrtStarService.config.v_max,
                v_min: rrtStarService.config.v_min,
                omega_max: rrtStarService.config.omega_max
            };
        }
        
        // Save original sensor config if this is the first time
        if (!this.originalSensorConfig) {
            this.originalSensorConfig = {
                pursuer: {
                    enabled: this.sensorModelService.pursuerSensor.enabled,
                    R_min: this.sensorModelService.pursuerSensor.R_min,
                    R_max: this.sensorModelService.pursuerSensor.R_max,
                    fov: this.sensorModelService.pursuerSensor.fov
                }
            };
        }
        
        // Apply Real-Time Tracking RRT configuration
        rrtStarService.config.max_nodes = this.config.maxNodes;
        rrtStarService.config.max_planning_time = this.config.maxPlanningTime;
        rrtStarService.config.steer_time = this.config.steerTime;
        rrtStarService.config.dt = this.config.dt;
        rrtStarService.config.goal_sample_rate = this.config.goalSampleRate;
        rrtStarService.config.rewire_radius = this.config.rewireRadius;
        rrtStarService.config.robot_radius = this.config.robotRadius;
        rrtStarService.config.v_max = this.config.vMax;
        rrtStarService.config.v_min = this.config.vMin;
        rrtStarService.config.omega_max = this.config.omegaMax;
        
        // Apply Real-Time Tracking Pursuer Sensor configuration (only pursuer sensor is used for visibility)
        this.sensorModelService.pursuerSensor.enabled = this.config.pursuerSensorEnabled;
        this.sensorModelService.pursuerSensor.R_min = this.config.pursuerRMin;
        this.sensorModelService.pursuerSensor.R_max = this.config.pursuerRMax;
        this.sensorModelService.pursuerSensor.fov = this.config.pursuerFOV;
        
        // Convert state format: {position: {x, y}, heading} -> {x, y, theta}
        const pursuerRRTState = {
            x: this.pursuerState.position.x,
            y: this.pursuerState.position.y,
            theta: this.pursuerState.heading || 0
        };
        
        const evaderRRTState = {
            x: this.evaderState.position.x,
            y: this.evaderState.position.y,
            theta: this.evaderState.heading || 0
        };
        
        // Set agent states in rrtStarService
        rrtStarService.setPursuerState(pursuerRRTState);
        rrtStarService.setEvaderState(evaderRRTState);
        
        // Build both trees
        const result = rrtStarService.planBothAgents();
        
        if (!result) {
            throw new Error('Failed to build RRT* trees');
        }
        
        this.pursuerTree = result.pursuerTree;
        this.evaderTree = result.evaderTree;

        // Count nodes properly
        const pursuerNodeCount = this.countTreeNodes(this.pursuerTree);
        const evaderNodeCount = this.countTreeNodes(this.evaderTree);

        console.log('RRT* trees built:', {
            pursuerNodes: pursuerNodeCount,
            evaderNodes: evaderNodeCount,
            pursuerTreeObject: this.pursuerTree ? 'exists' : 'null',
            evaderTreeObject: this.evaderTree ? 'exists' : 'null'
        });

        return {
            pursuerTree: this.pursuerTree,
            evaderTree: this.evaderTree
        };
    }

    /**
     * Compute visibility matrix using ActiveTrackingService
     */
    computeVisibility() {
        try {
            const result = activeTrackingService.computeVisibilityMatrix(
                this.pursuerTree,
                this.evaderTree
            );
            
            return {
                success: true,
                result: result
            };
        } catch (error) {
            console.error('Visibility computation failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Choose target nodes using selected strategy
     */
    chooseTargets() {
        // Get strategies from ActiveTrackingService
        const strategies = activeTrackingService.computeStrategies();
        
        if (!strategies || !strategies[this.config.strategy]) {
            console.warn('Strategy not found:', this.config.strategy);
            return null;
        }

        const selectedStrategy = strategies[this.config.strategy];
        
        if (!selectedStrategy.winningNode) {
            console.warn('No winning node for strategy:', this.config.strategy);
            return null;
        }

        // Return indices based on strategy type (use winningNodeIndex, not winningNode.index)
        if (selectedStrategy.type === 'pursuer') {
            return {
                pursuerIndex: selectedStrategy.winningNodeIndex,
                evaderIndex: 0  // Evader stays at root initially
            };
        } else {
            return {
                pursuerIndex: 0,  // Pursuer stays at root initially
                evaderIndex: selectedStrategy.winningNodeIndex
            };
        }
    }

    /**
     * Reconstruct path from root to target node
     */
    reconstructPath(tree, targetIndex) {
        const nodes = activeTrackingService.treeToArray(tree);
        
        if (targetIndex < 0 || targetIndex >= nodes.length) {
            return [];
        }

        const path = [];
        let current = nodes[targetIndex];

        while (current) {
            path.unshift({
                x: current.state.x,
                y: current.state.y,
                theta: current.state.theta
            });
            current = current.parent;
        }

        return path;
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
            evaderState: this.evaderState
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
}

// Export singleton instance
export const realTimeTrackingService = new RealTimeTrackingService();
