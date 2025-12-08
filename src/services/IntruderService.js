/**
 * IntruderService
 * Manages a manually-controlled intruder agent for reachability computation.
 * The intruder can be moved with arrow keys and serves as the reference point
 * for computing reachable sets.
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
// IntruderService
// ============================================================================

export class IntruderService {
    constructor() {
        this.isActive = false;
        this.position = null;
        this.heading = 0; // Current heading in radians
        this.speed = 5.0; // Movement speed (pixels per key press) - increased for responsiveness
        this.angularSpeed = 0.2; // Turn rate (radians per key press) - increased for responsiveness
        
        // Collision detection
        this.obstacles = [];
        this.robotRadius = 8.0; // Same as RRT service
        
        // Keyboard state
        this.keysPressed = new Set();
        
        // Continuous movement
        this.movementInterval = null;
        this.movementSpeed = 16; // milliseconds between updates (60fps)
        
        // Listen for external position updates (e.g. from MPPI or other controllers)
        eventBus.on('intruder:positionUpdate', (data) => {
            // Update internal state to match external changes
            if (data.position && 
                typeof data.position.x === 'number' && !isNaN(data.position.x) &&
                typeof data.position.y === 'number' && !isNaN(data.position.y)) {
                
                // Only update if we have a position object
                if (!this.position) this.position = { x: 0, y: 0 };
                this.position.x = data.position.x;
                this.position.y = data.position.y;
            }
            if (typeof data.heading === 'number' && !isNaN(data.heading)) {
                this.heading = data.heading;
            }
        });

        this.setupKeyboardListeners();
    }

    setupKeyboardListeners() {
        window.addEventListener('keydown', (e) => {
            if (!this.isActive) return;
            // Ignore if modifier keys are pressed (Ctrl, Alt, Cmd/Meta) - these are for shortcuts
            if (e.ctrlKey || e.altKey || e.metaKey) return;
            // Supported movement keys (arrows + WASD)
            const moveKeys = ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d','W','A','S','D'];
            if (moveKeys.includes(e.key)) {
                e.preventDefault();
                this.keysPressed.add(e.key);
                if (!this.movementInterval) {
                    this.startContinuousMovement();
                }
            }
        });

        window.addEventListener('keyup', (e) => {
            if (!this.isActive) return;
            const moveKeys = ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d','W','A','S','D'];
            if (moveKeys.includes(e.key)) {
                this.keysPressed.delete(e.key);
                if (this.keysPressed.size === 0) {
                    this.stopContinuousMovement();
                }
            }
        });
    }

    /**
     * Set obstacles for collision detection
     * @param {Array} obstacles - Array of polygon obstacles
     */
    setObstacles(obstacles) {
        this.obstacles = obstacles || [];
        console.log(`IntruderService: ${this.obstacles.length} obstacles loaded for collision detection`);
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

    startContinuousMovement() {
        if (this.movementInterval) return;
        
        this.movementInterval = setInterval(() => {
            this.handleMovement();
        }, this.movementSpeed);
    }

    stopContinuousMovement() {
        if (this.movementInterval) {
            clearInterval(this.movementInterval);
            this.movementInterval = null;
        }
    }

    handleMovement() {
        if (!this.position || this.keysPressed.size === 0) return;

        let moved = false;

        const hasKey = (k) => this.keysPressed.has(k);
        const leftTurn = hasKey('ArrowLeft') || hasKey('a') || hasKey('A');
        const rightTurn = hasKey('ArrowRight') || hasKey('d') || hasKey('D');
        const forward = hasKey('ArrowUp') || hasKey('w') || hasKey('W');
        const backward = hasKey('ArrowDown') || hasKey('s') || hasKey('S');

        // Rotation
        if (leftTurn) {
            this.heading -= this.angularSpeed;
            moved = true;
        }
        if (rightTurn) {
            this.heading += this.angularSpeed;
            moved = true;
        }

        // Normalize heading
        while (this.heading > Math.PI) this.heading -= 2 * Math.PI;
        while (this.heading < -Math.PI) this.heading += 2 * Math.PI;

        // Forward/backward movement
        if (forward) {
            const newX = this.position.x + Math.cos(this.heading) * this.speed;
            const newY = this.position.y + Math.sin(this.heading) * this.speed;
            if (!this.isPositionInCollision(newX, newY)) {
                this.position.x = newX;
                this.position.y = newY;
                moved = true;
            }
        }
        if (backward) {
            const newX = this.position.x - Math.cos(this.heading) * this.speed;
            const newY = this.position.y - Math.sin(this.heading) * this.speed;
            if (!this.isPositionInCollision(newX, newY)) {
                this.position.x = newX;
                this.position.y = newY;
                moved = true;
            }
        }

        if (moved) {
            eventBus.emit('intruder:positionUpdate', this.getState());
        }
    }

    /**
     * Initialize intruder at a specific position
     */
    initialize(x, y, heading = 0) {
        // Check for collision before placing
        if (this.isPositionInCollision(x, y)) {
            console.warn(`Cannot place pursuer at (${x.toFixed(1)}, ${y.toFixed(1)}): collision detected`);
            eventBus.emit('intruder:placementFailed', { x, y, reason: 'collision' });
            return false;
        }
        
        this.position = { x, y };
        this.heading = heading;
        this.isActive = true;
        
        console.log('IntruderService initialized at:', { x, y, heading });
        eventBus.emit('intruder:initialized', this.getState());
        return true;
    }

    /**
     * Set intruder position (for clicking on canvas)
     */
    setPosition(x, y) {
        // Check for collision before placing
        if (this.isPositionInCollision(x, y)) {
            console.warn(`Cannot place pursuer at (${x.toFixed(1)}, ${y.toFixed(1)}): collision detected`);
            eventBus.emit('intruder:placementFailed', { x, y, reason: 'collision' });
            return false;
        }
        
        if (!this.position) {
            this.position = { x, y };
        } else {
            this.position.x = x;
            this.position.y = y;
        }
        
        eventBus.emit('intruder:positionUpdate', this.getState());
        return true;
    }

    /**
     * Set intruder heading
     */
    setHeading(heading) {
        this.heading = heading;
        eventBus.emit('intruder:positionUpdate', this.getState());
    }

    /**
     * Activate intruder
     */
    activate() {
        this.isActive = true;
        eventBus.emit('intruder:activated');
    }

    /**
     * Deactivate intruder
     */
    deactivate() {
        this.isActive = false;
        this.keysPressed.clear();
        this.stopContinuousMovement();
        eventBus.emit('intruder:deactivated');
    }

    /**
     * Reset intruder
     */
    reset() {
        this.position = null;
        this.heading = 0;
        this.isActive = false;
        this.keysPressed.clear();
        this.stopContinuousMovement();
        eventBus.emit('intruder:reset');
    }

    /**
     * Get current state
     */
    getState() {
        return {
            position: this.position,
            heading: this.heading,
            isActive: this.isActive,
            speed: this.speed,
            angularSpeed: this.angularSpeed
        };
    }

    /**
     * Check if intruder is active
     */
    isIntruderActive() {
        return this.isActive && this.position !== null;
    }

    /**
     * Set motion parameters
     */
    setSpeed(speed) {
        this.speed = speed;
    }

    setAngularSpeed(angularSpeed) {
        this.angularSpeed = angularSpeed;
    }
}
