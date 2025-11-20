/**
 * SensorModelService
 * Implements sensor models with FOV, range constraints, and line-of-sight detection
 * for both pursuer and evader agents.
 * 
 * Based on surveillance model with:
 * - Upper range (R_max)
 * - Lower range (R_min) - blind spot/collision zone
 * - Field of View (FOV) - angle α (360° for omni-directional)
 * - Line-of-sight (LOS) - ray-casting for obstacle occlusion
 */

import { eventBus } from '../utils/EventBus.js';

// ============================================================================
// Geometry Utilities
// ============================================================================

/**
 * Wrap angle to [-π, π]
 */
function wrapAngle(angle) {
    while (angle > Math.PI) angle -= 2 * Math.PI;
    while (angle < -Math.PI) angle += 2 * Math.PI;
    return angle;
}

/**
 * Check if two line segments intersect
 * @param {Object} p1 - Start of segment 1
 * @param {Object} p2 - End of segment 1
 * @param {Object} p3 - Start of segment 2
 * @param {Object} p4 - End of segment 2
 * @returns {boolean} True if segments intersect
 */
function segmentsIntersect(p1, p2, p3, p4) {
    const d1 = direction(p3, p4, p1);
    const d2 = direction(p3, p4, p2);
    const d3 = direction(p1, p2, p3);
    const d4 = direction(p1, p2, p4);
    
    if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
        ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
        return true;
    }
    
    // Check for collinear cases
    if (d1 === 0 && onSegment(p3, p4, p1)) return true;
    if (d2 === 0 && onSegment(p3, p4, p2)) return true;
    if (d3 === 0 && onSegment(p1, p2, p3)) return true;
    if (d4 === 0 && onSegment(p1, p2, p4)) return true;
    
    return false;
}

function direction(p1, p2, p3) {
    return (p3.x - p1.x) * (p2.y - p1.y) - (p2.x - p1.x) * (p3.y - p1.y);
}

function onSegment(p1, p2, p) {
    return Math.min(p1.x, p2.x) <= p.x && p.x <= Math.max(p1.x, p2.x) &&
           Math.min(p1.y, p2.y) <= p.y && p.y <= Math.max(p1.y, p2.y);
}

// ============================================================================
// SensorModelService
// ============================================================================

export class SensorModelService {
    constructor() {
        // Sensor parameters for pursuer
        this.pursuerSensor = {
            enabled: true,
            R_min: 20,      // Blind spot radius (pixels)
            R_max: 150,     // Maximum detection range (pixels)
            fov: 360,       // Field of view in degrees (360 = omni-directional)
            orientation: 0  // Sensor orientation offset from heading (radians)
        };
        
        // Sensor parameters for evader
        this.evaderSensor = {
            enabled: true,
            R_min: 15,      // Blind spot radius
            R_max: 120,     // Maximum detection range
            fov: 270,       // Field of view in degrees
            orientation: 0  // Sensor orientation offset from heading
        };
        
        // Obstacles for line-of-sight checking
        this.obstacles = [];
        
        // Visualization settings
        this.showSensorRange = true;
        this.showBlindSpot = true;
        this.showFOV = true;
        this.showLOS = true;
        
        // Detection results (for visualization)
        this.detectionResult = {
            pursuerSeesEvader: false,
            evaderSeesPursuer: false,
            pursuerLOS: null,
            evaderLOS: null
        };
        
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Listen for sensor parameter updates
        eventBus.on('sensor:updatePursuerParams', (params) => {
            Object.assign(this.pursuerSensor, params);
            this.checkVisibility();
            eventBus.emit('sensor:paramsUpdated', { agent: 'pursuer', params: this.pursuerSensor });
            // Immediately request redraw for reactive visualization
            eventBus.emit('canvas:requestRedraw');
        });

        eventBus.on('sensor:updateEvaderParams', (params) => {
            Object.assign(this.evaderSensor, params);
            this.checkVisibility();
            eventBus.emit('sensor:paramsUpdated', { agent: 'evader', params: this.evaderSensor });
            // Immediately request redraw for reactive visualization
            eventBus.emit('canvas:requestRedraw');
        });

        eventBus.on('sensor:toggleVisualization', (settings) => {
            if (settings.showSensorRange !== undefined) this.showSensorRange = settings.showSensorRange;
            if (settings.showBlindSpot !== undefined) this.showBlindSpot = settings.showBlindSpot;
            if (settings.showFOV !== undefined) this.showFOV = settings.showFOV;
            if (settings.showLOS !== undefined) this.showLOS = settings.showLOS;
            eventBus.emit('canvas:requestRedraw');
        });

        // Listen for agent position updates to recompute visibility
        eventBus.on('intruder:positionUpdate', () => this.checkVisibility());
        eventBus.on('evader:positionUpdate', () => this.checkVisibility());
    }

    /**
     * Set obstacles for line-of-sight checking
     * @param {Array} obstacles - Array of polygon obstacles
     */
    setObstacles(obstacles) {
        this.obstacles = obstacles || [];
        console.log(`SensorModelService: ${this.obstacles.length} obstacles loaded for LOS`);
    }

    /**
     * Main sensor check: can a pursuer see an evader?
     * @param {Object} pursuerState - {position: {x, y}, heading: angle}
     * @param {Object} evaderState - {position: {x, y}}
     * @param {Object} sensorParams - {R_min, R_max, fov, orientation}
     * @param {Array} obstacles - Array of polygon obstacles
     * @returns {boolean} True if evader is visible to pursuer
     */
    canSee(pursuerState, evaderState, sensorParams, obstacles = null) {
        if (!pursuerState || !evaderState || !pursuerState.position || !evaderState.position) {
            return false;
        }

        const p_x = pursuerState.position.x;
        const p_y = pursuerState.position.y;
        const p_theta = pursuerState.heading || 0;
        
        const e_x = evaderState.position.x;
        const e_y = evaderState.position.y;
        
        // Use provided obstacles or fall back to stored obstacles
        const obstacleList = obstacles !== null ? obstacles : this.obstacles;
        
        // 1. Distance check
        const dx = e_x - p_x;
        const dy = e_y - p_y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Check if in valid range (not in blind spot and within max range)
        if (distance <= sensorParams.R_min || distance > sensorParams.R_max) {
            return false;
        }
        
        // 2. FOV check (if not omni-directional)
        if (sensorParams.fov < 360) {
            // Angle to evader
            const psi = Math.atan2(dy, dx);
            
            // Sensor axis direction
            const phi = p_theta + sensorParams.orientation;
            
            // Angular difference
            const angleDiff = Math.abs(wrapAngle(psi - phi));
            
            // Convert FOV to radians and check
            const fovRad = (sensorParams.fov * Math.PI) / 180;
            if (angleDiff > fovRad / 2) {
                return false;
            }
        }
        
        // 3. Line-of-sight check
        const hasLOS = this.checkLineOfSight(
            { x: p_x, y: p_y },
            { x: e_x, y: e_y },
            obstacleList
        );
        
        return hasLOS;
    }

    /**
     * Check if line segment from p1 to p2 intersects any obstacles
     * @param {Object} p1 - Start point {x, y}
     * @param {Object} p2 - End point {x, y}
     * @param {Array} obstacles - Array of polygon obstacles
     * @returns {boolean} True if line-of-sight is clear
     */
    checkLineOfSight(p1, p2, obstacles) {
        if (!obstacles || obstacles.length === 0) {
            return true;
        }
        
        // Check against each obstacle edge
        for (const obstacle of obstacles) {
            const vertices = obstacle.vertices;
            if (!vertices || vertices.length < 2) continue;
            
            for (let i = 0; i < vertices.length; i++) {
                const v1 = vertices[i];
                const v2 = vertices[(i + 1) % vertices.length];
                
                if (segmentsIntersect(p1, p2, v1, v2)) {
                    return false;
                }
            }
        }
        
        return true;
    }

    /**
     * Check mutual visibility between pursuer and evader
     * Updates internal detection results
     */
    checkVisibility() {
        // This will be called when agent positions update
        // The actual visibility check happens in the draw method
        // where we have access to both agent states
        eventBus.emit('canvas:requestRedraw');
    }

    /**
     * Perform visibility check with specific agent states
     * @param {Object} pursuerState - Pursuer state
     * @param {Object} evaderState - Evader state
     * @returns {Object} Detection results
     */
    computeVisibility(pursuerState, evaderState) {
        const result = {
            pursuerSeesEvader: false,
            evaderSeesPursuer: false,
            pursuerLOS: null,
            evaderLOS: null,
            distance: null
        };

        if (!pursuerState || !evaderState || !pursuerState.position || !evaderState.position) {
            return result;
        }

        // Calculate distance
        const dx = evaderState.position.x - pursuerState.position.x;
        const dy = evaderState.position.y - pursuerState.position.y;
        result.distance = Math.sqrt(dx * dx + dy * dy);

        // Check if pursuer can see evader
        if (this.pursuerSensor.enabled) {
            result.pursuerSeesEvader = this.canSee(
                pursuerState,
                evaderState,
                this.pursuerSensor,
                this.obstacles
            );
            
            // Store LOS line for visualization
            if (this.showLOS && result.pursuerSeesEvader) {
                result.pursuerLOS = {
                    from: { x: pursuerState.position.x, y: pursuerState.position.y },
                    to: { x: evaderState.position.x, y: evaderState.position.y }
                };
            }
        }

        // Check if evader can see pursuer
        if (this.evaderSensor.enabled) {
            result.evaderSeesPursuer = this.canSee(
                evaderState,
                pursuerState,
                this.evaderSensor,
                this.obstacles
            );
            
            // Store LOS line for visualization
            if (this.showLOS && result.evaderSeesPursuer) {
                result.evaderLOS = {
                    from: { x: evaderState.position.x, y: evaderState.position.y },
                    to: { x: pursuerState.position.x, y: pursuerState.position.y }
                };
            }
        }

        this.detectionResult = result;
        return result;
    }

    /**
     * Draw sensor visualization on canvas
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {Object} agentState - Agent state {position, heading}
     * @param {Object} sensorParams - Sensor parameters
     * @param {string} color - Color for visualization
     */
    drawSensorRange(ctx, agentState, sensorParams, color) {
        if (!agentState || !agentState.position) return;

        const { x, y } = agentState.position;
        const heading = agentState.heading || 0;
        const sensorAxis = heading + sensorParams.orientation;

        ctx.save();

        // Draw maximum range circle
        if (this.showSensorRange) {
            ctx.strokeStyle = color;
            ctx.lineWidth = 1.5;
            ctx.setLineDash([5, 5]);
            ctx.globalAlpha = 0.4;
            ctx.beginPath();
            ctx.arc(x, y, sensorParams.R_max, 0, 2 * Math.PI);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // Draw blind spot (minimum range)
        if (this.showBlindSpot && sensorParams.R_min > 0) {
            ctx.fillStyle = color;
            ctx.globalAlpha = 0.15;
            ctx.beginPath();
            ctx.arc(x, y, sensorParams.R_min, 0, 2 * Math.PI);
            ctx.fill();
        }

        // Draw FOV cone (if not omni-directional)
        if (this.showFOV && sensorParams.fov < 360) {
            const fovRad = (sensorParams.fov * Math.PI) / 180;
            const startAngle = sensorAxis - fovRad / 2;
            const endAngle = sensorAxis + fovRad / 2;

            // FOV arc at max range
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.globalAlpha = 0.5;
            ctx.beginPath();
            ctx.arc(x, y, sensorParams.R_max, startAngle, endAngle);
            ctx.stroke();

            // FOV boundary lines
            ctx.globalAlpha = 0.3;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(
                x + Math.cos(startAngle) * sensorParams.R_max,
                y + Math.sin(startAngle) * sensorParams.R_max
            );
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(
                x + Math.cos(endAngle) * sensorParams.R_max,
                y + Math.sin(endAngle) * sensorParams.R_max
            );
            ctx.stroke();

            // FOV fill
            ctx.fillStyle = color;
            ctx.globalAlpha = 0.08;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.arc(x, y, sensorParams.R_max, startAngle, endAngle);
            ctx.closePath();
            ctx.fill();
        }

        ctx.restore();
    }

    /**
     * Draw line-of-sight indicator
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {Object} from - Start point {x, y}
     * @param {Object} to - End point {x, y}
     * @param {string} color - Color for line
     * @param {boolean} detected - Whether target is detected
     */
    drawLOS(ctx, from, to, color, detected) {
        if (!this.showLOS || !from || !to) return;

        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.globalAlpha = detected ? 0.6 : 0.2;
        ctx.setLineDash(detected ? [10, 5] : [5, 5]);

        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();

        ctx.restore();
    }

    /**
     * Get current sensor parameters for an agent
     * @param {string} agentType - 'pursuer' or 'evader'
     * @returns {Object} Sensor parameters
     */
    getSensorParams(agentType) {
        if (agentType === 'pursuer') {
            return { ...this.pursuerSensor };
        } else if (agentType === 'evader') {
            return { ...this.evaderSensor };
        }
        return null;
    }

    /**
     * Get pursuer sensor parameters
     * @returns {Object} Pursuer sensor parameters
     */
    getPursuerSensorParams() {
        return { ...this.pursuerSensor };
    }

    /**
     * Get evader sensor parameters
     * @returns {Object} Evader sensor parameters
     */
    getEvaderSensorParams() {
        return { ...this.evaderSensor };
    }

    /**
     * Get current detection results
     * @returns {Object} Detection results
     */
    getDetectionResult() {
        return { ...this.detectionResult };
    }

    /**
     * Reset sensor model to defaults
     */
    reset() {
        this.pursuerSensor = {
            enabled: true,
            R_min: 20,
            R_max: 150,
            fov: 360,
            orientation: 0
        };
        
        this.evaderSensor = {
            enabled: true,
            R_min: 15,
            R_max: 120,
            fov: 270,
            orientation: 0
        };
        
        this.detectionResult = {
            pursuerSeesEvader: false,
            evaderSeesPursuer: false,
            pursuerLOS: null,
            evaderLOS: null
        };
        
        eventBus.emit('canvas:requestRedraw');
    }
}
