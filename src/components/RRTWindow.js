/**
 * RRTWindow Web Component
 * Floating window for RRT-based tracking controls
 */
import { eventBus } from '../utils/EventBus.js';
import { rrtStarService } from '../services/RRTStarService.js';

export class RRTWindow extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };
        this.position = { x: 150, y: 150 };
        this.isRunning = false;
        this.animationId = null;
        this.planningInterval = null;
    }

    connectedCallback() {
        this.render();
        this.setupEventListeners();
        this.updatePosition();
        this.updateStatus('Ready. Place both agents to start planning.');
        this.updateParameterSliders();
    }

    setupEventListeners() {
        const header = this.shadowRoot.querySelector('.window-header');
        const closeBtn = this.shadowRoot.querySelector('.close-btn');
        const minimizeBtn = this.shadowRoot.querySelector('.minimize-btn');
        
        header.addEventListener('mousedown', (e) => this.startDragging(e));
        document.addEventListener('mousemove', (e) => this.drag(e));
        document.addEventListener('mouseup', () => this.stopDragging());

        closeBtn?.addEventListener('click', () => this.close());
        minimizeBtn?.addEventListener('click', () => this.minimize());

        // RRT control buttons
        const buildTreesBtn = this.shadowRoot.querySelector('#buildTrees');
        const startTrackingBtn = this.shadowRoot.querySelector('#startTracking');
        const stopTrackingBtn = this.shadowRoot.querySelector('#stopTracking');
        const resetBtn = this.shadowRoot.querySelector('#resetRRT');

        buildTreesBtn?.addEventListener('click', () => this.buildTrees());
        startTrackingBtn?.addEventListener('click', () => this.startTracking());
        stopTrackingBtn?.addEventListener('click', () => this.stopTracking());
        resetBtn?.addEventListener('click', () => this.resetRRT());

        // Listen for agent state updates and initial placement
        eventBus.on('canvas:placeIntruder', (position) => {
            // Set pursuer state when placed via canvas
            if (position) {
                rrtStarService.setPursuerState({
                    x: position.x,
                    y: position.y,
                    theta: 0
                });
                this.updateStatus('Pursuer placed. ' + (rrtStarService.evaderState ? 'Ready to build trees!' : 'Place evader to continue.'), false);
            }
        });

        eventBus.on('intruder:initialized', (state) => {
            if (state && state.position) {
                rrtStarService.setPursuerState({
                    x: state.position.x,
                    y: state.position.y,
                    theta: state.heading || 0
                });
                this.updateStatus('Pursuer placed. ' + (rrtStarService.evaderState ? 'Ready to build trees!' : 'Place evader to continue.'), false);
            }
        });

        eventBus.on('intruder:positionUpdate', (state) => {
            if (state && state.position) {
                rrtStarService.setPursuerState({
                    x: state.position.x,
                    y: state.position.y,
                    theta: state.heading || 0
                });
            }
        });

        eventBus.on('canvas:placeEvader', (position) => {
            // Set evader state when placed
            if (position) {
                rrtStarService.setEvaderState({
                    x: position.x,
                    y: position.y,
                    theta: 0
                });
                this.updateStatus('Evader placed. ' + (rrtStarService.pursuerState ? 'Ready to build trees!' : 'Place pursuer to continue.'), false);
            }
        });

        eventBus.on('evader:positionUpdate', (data) => {
            if (data && data.position) {
                rrtStarService.setEvaderState({
                    x: data.position.x,
                    y: data.position.y,
                    theta: data.heading || 0
                });
            }
        });

        // Listen for tree build completion
        eventBus.on('rrt:treesBuilt', (data) => {
            this.updateStats(data.stats);
        });

        // Get obstacles from canvas
        eventBus.on('canvas:polygonsUpdated', (polygons) => {
            rrtStarService.obstacles = polygons || [];
        });

        // Parameter sliders
        const sliderMap = [
            { id: 'vMax', key: 'v_max' },
            { id: 'omegaMax', key: 'omega_max' },
            { id: 'maxNodes', key: 'max_nodes' },
            { id: 'planningTimeLimit', key: 'max_planning_time' }, // renamed to avoid clash with stats id
            { id: 'steerTime', key: 'steer_time' },
            { id: 'dt', key: 'dt' },
            { id: 'goalSampleRate', key: 'goal_sample_rate' },
            { id: 'rewireRadius', key: 'rewire_radius' },
            { id: 'robotRadius', key: 'robot_radius' }
        ];
        sliderMap.forEach(cfg => {
            const el = this.shadowRoot.querySelector(`#${cfg.id}`);
            if (el) {
                el.addEventListener('input', (e) => {
                    let val = parseFloat(e.target.value);
                    if (cfg.key === 'goal_sample_rate') {
                        val = Math.max(0, Math.min(0.5, val));
                    }
                    rrtStarService.config[cfg.key] = val;
                    const valueLabel = this.shadowRoot.querySelector(`#${cfg.id}Value`);
                    if (valueLabel) valueLabel.textContent = val.toFixed( (val < 1 ? 2 : 1) );
                });
            }
        });
    }

    updateParameterSliders() {
        if (!this.shadowRoot) return;
        const c = rrtStarService.config;
        const setVal = (id, val, fixed = (val < 1 ? 2 : 1)) => {
            const el = this.shadowRoot.querySelector(`#${id}`);
            const label = this.shadowRoot.querySelector(`#${id}Value`);
            if (el) el.value = val;
            if (label) label.textContent = val.toFixed(fixed);
        };
        setVal('vMax', c.v_max);
        setVal('omegaMax', c.omega_max);
        setVal('maxNodes', c.max_nodes, 0);
        setVal('planningTimeLimit', c.max_planning_time, 0); // updated id
        setVal('steerTime', c.steer_time);
        setVal('dt', c.dt, 2);
        setVal('goalSampleRate', c.goal_sample_rate, 2);
        setVal('rewireRadius', c.rewire_radius);
        setVal('robotRadius', c.robot_radius);
    }

    buildTrees() {
        console.log('buildTrees called');
        console.log('Pursuer state:', rrtStarService.pursuerState);
        console.log('Evader state:', rrtStarService.evaderState);
        
        this.updateStatus('Building RRT* trees...', false);
        
        // Get obstacles from the canvas controller through the app
        // First emit event to request polygons
        eventBus.emit('rrt:requestPolygons');
        
        // Wait a bit for polygons to be set, then calculate bounds from polygons
        setTimeout(() => {
            console.log('Obstacles:', rrtStarService.obstacles.length);
            
            // Calculate workspace bounds from polygon bounding box
            const bounds = this.calculateWorkspaceBounds(rrtStarService.obstacles);
            rrtStarService.config.bounds = bounds;
            console.log('Workspace bounds set from polygons:', rrtStarService.config.bounds);
            
            // Plan for both agents
            const result = rrtStarService.planBothAgents();
            
            if (result) {
                this.updateStatus(`Trees built: Pursuer ${result.stats.pursuerNodes} nodes, Evader ${result.stats.evaderNodes} nodes`, false);
                
                // Enable tracking button
                const startBtn = this.shadowRoot.querySelector('#startTracking');
                if (startBtn) startBtn.removeAttribute('disabled');
            } else {
                this.updateStatus('Failed to build trees. Ensure both agents are placed.', true);
            }
        }, 50);
    }

    startTracking() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        this.updateStatus('RRT tracking active. Replanning every 1s...', false);
        
        // Disable start, enable stop
        const startBtn = this.shadowRoot.querySelector('#startTracking');
        const stopBtn = this.shadowRoot.querySelector('#stopTracking');
        if (startBtn) startBtn.setAttribute('disabled', '');
        if (stopBtn) stopBtn.removeAttribute('disabled');
        
        // Replan periodically
        this.planningInterval = setInterval(() => {
            this.buildTrees();
        }, 1000); // Replan every 1 second
    }

    stopTracking() {
        if (!this.isRunning) return;
        
        this.isRunning = false;
        this.updateStatus('RRT tracking stopped.', false);
        
        if (this.planningInterval) {
            clearInterval(this.planningInterval);
            this.planningInterval = null;
        }
        
        // Enable start, disable stop
        const startBtn = this.shadowRoot.querySelector('#startTracking');
        const stopBtn = this.shadowRoot.querySelector('#stopTracking');
        if (startBtn) startBtn.removeAttribute('disabled');
        if (stopBtn) stopBtn.setAttribute('disabled', '');
    }

    resetRRT() {
        this.stopTracking();
        rrtStarService.reset();
        this.updateStatus('RRT service reset.', false);
        this.updateStats({ pursuerNodes: 0, evaderNodes: 0, planningTime: 0 });
        
        // Emit event to clear visualization
        eventBus.emit('rrt:reset');
    }

    /**
     * Calculate workspace bounds from polygon bounding box
     * @param {Array} obstacles - Array of polygon obstacles
     * @returns {Object} Bounds {x_min, x_max, y_min, y_max}
     */
    calculateWorkspaceBounds(obstacles) {
        // Default bounds if no obstacles
        const defaultBounds = {
            x_min: -500,
            x_max: 1500,
            y_min: -500,
            y_max: 1500
        };
        
        if (!obstacles || obstacles.length === 0) {
            console.log('No obstacles, using default bounds');
            return defaultBounds;
        }
        
        // Calculate bounding box of all polygons
        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;
        
        for (const polygon of obstacles) {
            if (!polygon.vertices || polygon.vertices.length === 0) continue;
            
            for (const vertex of polygon.vertices) {
                minX = Math.min(minX, vertex.x);
                maxX = Math.max(maxX, vertex.x);
                minY = Math.min(minY, vertex.y);
                maxY = Math.max(maxY, vertex.y);
            }
        }
        
        // Add margin around obstacles for exploration (20% of size, minimum 200)
        const width = maxX - minX;
        const height = maxY - minY;
        const margin = Math.max(200, Math.max(width, height) * 0.2);
        
        // Include agent positions in bounds calculation
        const pursuer = rrtStarService.pursuerState;
        const evader = rrtStarService.evaderState;
        
        if (pursuer) {
            minX = Math.min(minX, pursuer.x);
            maxX = Math.max(maxX, pursuer.x);
            minY = Math.min(minY, pursuer.y);
            maxY = Math.max(maxY, pursuer.y);
        }
        
        if (evader) {
            minX = Math.min(minX, evader.x);
            maxX = Math.max(maxX, evader.x);
            minY = Math.min(minY, evader.y);
            maxY = Math.max(maxY, evader.y);
        }
        
        // Return bounds with margin
        return {
            x_min: minX - margin,
            x_max: maxX + margin,
            y_min: minY - margin,
            y_max: maxY + margin
        };
    }

    updateStats(stats) {
        const pursuerNodes = this.shadowRoot.querySelector('#pursuerNodes');
        const evaderNodes = this.shadowRoot.querySelector('#evaderNodes');
        const planningTime = this.shadowRoot.querySelector('#planningTime');
        
        if (pursuerNodes) pursuerNodes.textContent = stats.pursuerNodes || 0;
        if (evaderNodes) evaderNodes.textContent = stats.evaderNodes || 0;
        if (planningTime) planningTime.textContent = `${(stats.planningTime || 0).toFixed(1)} ms`;
    }

    updateStatus(message, isError = false) {
        const statusEl = this.shadowRoot.querySelector('#statusMessage');
        if (statusEl) {
            statusEl.textContent = message;
            statusEl.style.color = isError 
                ? 'var(--md-sys-color-error, #BA1A1A)' 
                : 'var(--md-sys-color-on-surface-variant, #49454F)';
        }
    }

    startDragging(e) {
        if (e.target.closest('.close-btn') || e.target.closest('.minimize-btn')) return;
        this.isDragging = true;
        const container = this.shadowRoot.querySelector('.window-container');
        const rect = container.getBoundingClientRect();
        this.dragOffset.x = e.clientX - rect.left;
        this.dragOffset.y = e.clientY - rect.top;
        container.style.cursor = 'grabbing';
    }

    drag(e) {
        if (!this.isDragging) return;
        this.position.x = e.clientX - this.dragOffset.x;
        this.position.y = e.clientY - this.dragOffset.y;
        const container = this.shadowRoot.querySelector('.window-container');
        if (container) {
            const rect = container.getBoundingClientRect();
            this.position.x = Math.max(0, Math.min(window.innerWidth - rect.width, this.position.x));
            this.position.y = Math.max(0, Math.min(window.innerHeight - rect.height, this.position.y));
        }
        this.updatePosition();
    }

    stopDragging() {
        if (!this.isDragging) return;
        this.isDragging = false;
        this.shadowRoot.querySelector('.window-container').style.cursor = 'default';
    }

    updatePosition() {
        const container = this.shadowRoot.querySelector('.window-container');
        if (container) {
            container.style.left = `${this.position.x}px`;
            container.style.top = `${this.position.y}px`;
        }
    }

    close() {
        this.removeAttribute('visible');
        eventBus.emit('rrt:windowClosed');
    }

    minimize() {
        const content = this.shadowRoot.querySelector('.window-content');
        const container = this.shadowRoot.querySelector('.window-container');
        const icon = this.shadowRoot.querySelector('.minimize-btn md-icon');
        if (content.style.display === 'none') {
            content.style.display = 'block';
            container.style.height = 'auto';
            icon.textContent = 'remove';
        } else {
            content.style.display = 'none';
            container.style.height = 'auto';
            icon.textContent = 'add';
        }
    }

    show() {
        this.setAttribute('visible', '');
    }

    render() {
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    position: fixed;
                    z-index: 1000;
                    display: none;
                    pointer-events: none;
                }
                
                :host([visible]) {
                    display: block;
                    pointer-events: auto;
                }
                
                .window-container {
                    position: fixed;
                    background: var(--floating-surface, #FFF4E6);
                    color: var(--floating-on-surface, #3E2723);
                    border-radius: 12px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                    min-width: 360px;
                    max-width: 450px;
                    overflow: hidden;
                }
                
                .window-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 1rem;
                    background: var(--md-sys-color-tertiary-container, #FFD8E4);
                    cursor: grab;
                    user-select: none;
                }
                
                .window-header:active {
                    cursor: grabbing;
                }
                
                .window-title {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    font-size: 1rem;
                    font-weight: 600;
                    color: var(--md-sys-color-on-tertiary-container, #31111D);
                }
                
                .window-controls {
                    display: flex;
                    gap: 0.25rem;
                }
                
                .window-content {
                    padding: 1.5rem;
                    max-height: 460px; /* constrain height */
                    overflow-y: auto; /* enable vertical scrolling */
                    overscroll-behavior: contain;
                    scrollbar-width: thin;
                }
                
                .window-content::-webkit-scrollbar {
                    width: 8px;
                }
                
                .window-content::-webkit-scrollbar-track {
                    background: transparent;
                }
                
                .window-content::-webkit-scrollbar-thumb {
                    background: rgba(0,0,0,0.25);
                    border-radius: 4px;
                }
                
                .control-group {
                    margin-bottom: 1.5rem;
                }
                
                .control-group:last-child {
                    margin-bottom: 0;
                }
                
                .control-label {
                    display: block;
                    font-size: 0.875rem;
                    font-weight: 500;
                    margin-bottom: 0.5rem;
                    color: var(--md-sys-color-on-surface-variant, #49454F);
                }
                
                .info-box {
                    font-size: 0.875rem;
                    color: var(--md-sys-color-on-surface-variant, #49454F);
                    line-height: 1.5;
                    padding: 1rem;
                    background: var(--md-sys-color-surface-variant, #E7E0EC);
                    border-radius: 8px;
                }
                
                .info-box md-icon {
                    vertical-align: middle;
                    margin-right: 0.5rem;
                }
                
                .stats-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 0.5rem;
                    margin-top: 0.5rem;
                }
                
                .stat-item {
                    padding: 0.4rem 0.5rem;
                    border-radius: 6px;
                    border-left-width: 2px;
                }
                
                .stat-label {
                    font-size: 0.6rem;
                    margin-bottom: 0.15rem;
                }
                
                .stat-value {
                    font-size: 0.9rem;
                }
                
                .parameters-grid {
                    display: grid;
                    grid-template-columns: auto 1fr auto;
                    row-gap: 1rem;
                    column-gap: 1rem;
                    align-items: center;
                }
                
                .param-label {
                    font-size: 0.75rem;
                    font-weight: 600;
                    color: var(--md-sys-color-primary, #6750A4);
                    min-width: 100px;
                    text-align: right;
                }
                
                .param-value {
                    font-size: 0.85rem;
                    font-family: 'Roboto Mono', monospace;
                    font-weight: 700;
                    color: var(--md-sys-color-on-surface, #1C1B1F);
                    background: var(--md-sys-color-surface-variant, #E7E0EC);
                    padding: 0.25rem 0.5rem;
                    border-radius: 4px;
                    min-width: 60px;
                    text-align: center;
                }
                
                md-slider {
                    width: 100%;
                    grid-column: 2 / 3;
                    --md-slider-track-active-color: #2196F3;
                    --md-slider-handle-color: #2196F3;
                    --md-slider-track-inactive-color: #BBDEFB;
                    --md-slider-hover-handle-color: #1976D2;
                    --md-slider-pressed-handle-color: #0D47A1;
                    --md-slider-handle-height: 20px;
                    --md-slider-handle-width: 20px;
                }
            </style>
            <div class="window-container">
                <div class="window-header">
                    <div class="window-title">
                        <md-icon>account_tree</md-icon>
                        <span>RRT* Tracking</span>
                    </div>
                    <div class="window-controls">
                        <md-icon-button class="minimize-btn">
                            <md-icon>remove</md-icon>
                        </md-icon-button>
                        <md-icon-button class="close-btn">
                            <md-icon>close</md-icon>
                        </md-icon-button>
                    </div>
                </div>
                
                <div class="window-content">
                    <div class="control-group">
                        <div class="info-box">
                            <md-icon>info</md-icon>
                            RRT* planning with unicycle dynamics for pursuit-evasion. Place both agents first.
                        </div>
                    </div>
                    
                    <div class="control-group">
                        <span class="control-label">Planning Controls</span>
                        <div class="button-group">
                            <md-filled-tonal-button id="buildTrees">
                                <md-icon slot="icon">refresh</md-icon>
                                Build Trees
                            </md-filled-tonal-button>
                            <md-outlined-button id="resetRRT">
                                <md-icon slot="icon">restart_alt</md-icon>
                                Reset
                            </md-outlined-button>
                        </div>
                    </div>
                    
                    <div class="control-group">
                        <span class="control-label">Tracking Control</span>
                        <div class="button-group">
                            <md-filled-button id="startTracking" disabled>
                                <md-icon slot="icon">play_arrow</md-icon>
                                Start Tracking
                            </md-filled-button>
                            <md-outlined-button id="stopTracking" disabled>
                                <md-icon slot="icon">stop</md-icon>
                                Stop Tracking
                            </md-outlined-button>
                        </div>
                    </div>
                    
                    <div class="control-group">
                        <span class="control-label">Parameters</span>
                        <div class="parameters-grid">
                            <span class="param-label">Linear Velocity (v_max)</span>
                            <md-slider id="vMax" min="0" max="50" step="1"></md-slider>
                            <span class="param-value" id="vMaxValue"></span>
                            
                            <span class="param-label">Angular Velocity (ω_max)</span>
                            <md-slider id="omegaMax" min="0" max="3" step="0.1"></md-slider>
                            <span class="param-value" id="omegaMaxValue"></span>
                            
                            <span class="param-label">Max Nodes</span>
                            <md-slider id="maxNodes" min="100" max="5000" step="100"></md-slider>
                            <span class="param-value" id="maxNodesValue"></span>
                            
                            <span class="param-label">Planning Time (ms)</span>
                            <md-slider id="planningTimeLimit" min="10" max="1000" step="10"></md-slider>
                            <span class="param-value" id="planningTimeValue"></span>
                            
                            <span class="param-label">Steer Time (sec)</span>
                            <md-slider id="steerTime" min="0.1" max="2" step="0.1"></md-slider>
                            <span class="param-value" id="steerTimeValue"></span>
                            
                            <span class="param-label">Time Step (dt)</span>
                            <md-slider id="dt" min="0.01" max="0.2" step="0.01"></md-slider>
                            <span class="param-value" id="dtValue"></span>
                            
                            <span class="param-label">Goal Sample Rate</span>
                            <md-slider id="goalSampleRate" min="0" max="0.5" step="0.01"></md-slider>
                            <span class="param-value" id="goalSampleRateValue"></span>
                            
                            <span class="param-label">Rewire Radius</span>
                            <md-slider id="rewireRadius" min="10" max="200" step="5"></md-slider>
                            <span class="param-value" id="rewireRadiusValue"></span>
                            
                            <span class="param-label">Robot Radius</span>
                            <md-slider id="robotRadius" min="2" max="30" step="1"></md-slider>
                            <span class="param-value" id="robotRadiusValue"></span>
                        </div>
                    </div>
                    
                    <div class="control-group">
                        <span class="control-label">Statistics</span>
                        <div class="stats-grid">
                            <div class="stat-item">
                                <div class="stat-label">Pursuer</div>
                                <div class="stat-value" id="pursuerNodes">0</div>
                            </div>
                            <div class="stat-item">
                                <div class="stat-label">Evader</div>
                                <div class="stat-value" id="evaderNodes">0</div>
                            </div>
                            <div class="stat-item">
                                <div class="stat-label">Time</div>
                                <div class="stat-value" id="planningTime">0 ms</div>
                            </div>
                        </div>
                    </div>
                    
                    <div id="statusMessage" class="status-message">
                        Ready
                    </div>
                </div>
            </div>
        `;
    }
}

customElements.define('rrt-window', RRTWindow);
