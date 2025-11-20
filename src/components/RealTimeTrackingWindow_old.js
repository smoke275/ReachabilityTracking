/**
 * RealTimeTrackingWindow
 * UI component for real-time pursuit-evasion tracking
 */

import { eventBus } from '../utils/EventBus.js';
import { realTimeTrackingService } from '../services/RealTimeTrackingService.js';

export class RealTimeTrackingWindow {
    constructor() {
        this.isOpen = false;
        this.windowElement = null;
        this.isTracking = false;
        
        // Dragging state
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };
        this.position = { x: window.innerWidth - 450, y: 120 }; // Position on right side
        
        // Scroll position state
        this.scrollPosition = 0;
        
        this.setupEventListeners();
    }

    setupEventListeners() {
        eventBus.on('window:toggleRealTimeTracking', () => this.toggle());
        eventBus.on('realTimeTracking:started', () => {
            this.isTracking = true;
            this.updateDisplay();
        });
        eventBus.on('realTimeTracking:stopped', (stats) => {
            this.isTracking = false;
            this.updateDisplay();
            this.showStats(stats);
        });
        eventBus.on('realTimeTracking:update', (data) => {
            this.updateTracking(data);
        });
        eventBus.on('realTimeTracking:error', (data) => {
            this.showError(data.message);
        });
    }

    toggle() {
        this.isOpen = !this.isOpen;
        
        if (this.isOpen) {
            this.open();
        } else {
            this.close();
        }
    }

    open() {
        this.isOpen = true;
        
        if (this.windowElement) {
            this.windowElement.style.visibility = 'visible';
            this.windowElement.style.pointerEvents = 'auto';
            this.restoreScrollPosition();
            return;
        }

        this.create();
    }

    close() {
        this.isOpen = false;
        if (this.windowElement) {
            const windowContent = this.windowElement.querySelector('.window-content');
            if (windowContent) {
                this.scrollPosition = windowContent.scrollTop;
            }
            this.windowElement.style.visibility = 'hidden';
            this.windowElement.style.pointerEvents = 'none';
        }
    }

    create() {
        this.windowElement = document.createElement('div');
        this.windowElement.className = 'floating-window real-time-tracking-window';
        
        // Add modern styling
        const style = document.createElement('style');
        style.textContent = `
            .real-time-tracking-window {
                background: #E3F2FD;
                border-radius: 12px;
                box-shadow: 
                    0px 4px 8px rgba(0, 0, 0, 0.12),
                    0px 8px 16px rgba(0, 0, 0, 0.08);
                min-width: 380px;
                max-width: 420px;
            }
            
            .real-time-tracking-window .window-header {
                background: #1976D2;
                color: #FFFFFF;
                padding: 12px 16px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                border-radius: 12px 12px 0 0;
            }
            
            .real-time-tracking-window .window-header h3 {
                display: flex;
                align-items: center;
                gap: 8px;
                font-size: 1rem;
                font-weight: 500;
                margin: 0;
            }
            
            .real-time-tracking-window .close-btn {
                background: transparent;
                border: none;
                color: #FFFFFF;
                cursor: pointer;
                padding: 4px;
                border-radius: 50%;
                width: 32px;
                height: 32px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 1.5rem;
                transition: background 0.2s;
            }
            
            .real-time-tracking-window .close-btn:hover {
                background: rgba(255, 255, 255, 0.1);
            }
            
            .real-time-tracking-window .window-content {
                padding: 20px;
                max-height: 500px;
                overflow-y: auto;
                overscroll-behavior: contain;
                scrollbar-width: thin;
            }
            
            .real-time-tracking-window .window-content::-webkit-scrollbar {
                width: 8px;
            }
            
            .real-time-tracking-window .window-content::-webkit-scrollbar-track {
                background: transparent;
            }
            
            .real-time-tracking-window .window-content::-webkit-scrollbar-thumb {
                background: rgba(0,0,0,0.25);
                border-radius: 4px;
            }
            
            .real-time-tracking-window .section {
                margin-bottom: 20px;
            }
            
            .real-time-tracking-window .section h4 {
                font-size: 0.875rem;
                font-weight: 600;
                text-transform: uppercase;
                color: #1976D2;
                letter-spacing: 0.5px;
                margin: 0 0 12px 0;
            }
            
            .real-time-tracking-window .control-group {
                margin-bottom: 16px;
            }
            
            .real-time-tracking-window .control-group label {
                font-size: 0.875rem;
                font-weight: 500;
                color: #0D47A1;
                margin-bottom: 8px;
                display: block;
            }
            
            .real-time-tracking-window select {
                width: 100%;
                padding: 10px;
                border: 1px solid #1976D2;
                border-radius: 8px;
                font-size: 0.875rem;
                background: white;
                color: #0D47A1;
                cursor: pointer;
            }
            
            .real-time-tracking-window select:focus {
                outline: 2px solid #1976D2;
                outline-offset: 2px;
            }
            
            .real-time-tracking-window .slider-group {
                margin-bottom: 16px;
            }
            
            .real-time-tracking-window .slider-group label {
                font-size: 0.875rem;
                color: #0D47A1;
                margin-bottom: 8px;
                display: block;
            }
            
            .real-time-tracking-window .slider-group input[type="range"] {
                width: 100%;
                height: 6px;
                border-radius: 3px;
                background: rgba(25, 118, 210, 0.2);
                outline: none;
                -webkit-appearance: none;
            }
            
            .real-time-tracking-window .slider-group input[type="range"]::-webkit-slider-thumb {
                -webkit-appearance: none;
                appearance: none;
                width: 20px;
                height: 20px;
                border-radius: 50%;
                background: #1976D2;
                cursor: pointer;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
            }
            
            .real-time-tracking-window .slider-group input[type="range"]::-moz-range-thumb {
                width: 20px;
                height: 20px;
                border-radius: 50%;
                background: #1976D2;
                cursor: pointer;
                border: none;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
            }
            
            .real-time-tracking-window .btn {
                padding: 12px 24px;
                border-radius: 8px;
                border: none;
                cursor: pointer;
                font-size: 0.875rem;
                font-weight: 500;
                transition: all 0.2s;
                width: 100%;
                margin-bottom: 8px;
            }
            
            .real-time-tracking-window .btn-primary {
                background: #1976D2;
                color: #FFFFFF;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            }
            
            .real-time-tracking-window .btn-primary:hover {
                background: #1565C0;
                box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
            }
            
            .real-time-tracking-window .btn-secondary {
                background: #BBDEFB;
                color: #0D47A1;
            }
            
            .real-time-tracking-window .btn-secondary:hover {
                background: #90CAF9;
            }
            
            .real-time-tracking-window .btn:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
            
            .real-time-tracking-window .stats-grid {
                display: grid;
                grid-template-columns: 1fr;
                gap: 12px;
            }
            
            .real-time-tracking-window .stat-item {
                display: flex;
                justify-content: space-between;
                padding: 12px;
                background: rgba(255, 255, 255, 0.6);
                border-radius: 8px;
                border: 1px solid rgba(25, 118, 210, 0.2);
            }
            
            .real-time-tracking-window .stat-label {
                font-size: 0.875rem;
                color: #0D47A1;
            }
            
            .real-time-tracking-window .stat-value {
                font-weight: 600;
                color: #1976D2;
            }
            
            .real-time-tracking-window .info-box {
                background: rgba(255, 255, 255, 0.6);
                border: 1px solid rgba(25, 118, 210, 0.2);
                border-radius: 8px;
                padding: 16px;
                font-size: 0.875rem;
                color: #0D47A1;
                line-height: 1.6;
            }
            
            .real-time-tracking-window .info-box p {
                margin: 0 0 8px 0;
            }
            
            .real-time-tracking-window .info-box strong {
                color: #1976D2;
            }
            
            .real-time-tracking-window .info-box ol,
            .real-time-tracking-window .info-box ul {
                margin: 8px 0;
                padding-left: 20px;
            }
            
            .real-time-tracking-window .info-box li {
                margin-bottom: 4px;
            }
            
            .real-time-tracking-window .status-text {
                margin-top: 12px;
                padding: 12px;
                background: rgba(255, 255, 255, 0.5);
                border-radius: 8px;
                font-size: 0.875rem;
                color: #0D47A1;
                min-height: 44px;
            }
            
            .real-time-tracking-window .info-text {
                font-size: 0.75rem;
                color: #546E7A;
                margin-top: 5px;
            }
        `;
        document.head.appendChild(style);
        
        this.windowElement.innerHTML = `
            <div class="window-header">
                <h3>⚡ Real-Time Tracking</h3>
                <button class="close-btn" id="closeRealTimeTrackingWindow">×</button>
            </div>
            <div class="window-content">
                <div class="section">
                    <h4>Strategy</h4>
                    <div class="control-group">
                        <label for="strategySelector">Tracking Strategy:</label>
                        <select id="strategySelector">
                            <option value="pl">PL - Pursuer Leader</option>
                            <option value="tma" selected>TMA - Two Moves Ahead</option>
                        </select>
                    </div>
                </div>

                <div class="section">
                    <h4>RRT* Tree Parameters</h4>
                    <div class="slider-group">
                        <label for="maxNodesSlider">
                            Max Nodes: <span id="maxNodesValue">1000</span>
                        </label>
                        <input type="range" id="maxNodesSlider" min="100" max="5000" step="100" value="1000">
                    </div>
                    <div class="slider-group">
                        <label for="maxPlanningTimeSlider">
                            Max Planning Time: <span id="maxPlanningTimeValue">100</span>ms
                        </label>
                        <input type="range" id="maxPlanningTimeSlider" min="10" max="1000" step="10" value="100">
                    </div>
                    <div class="slider-group">
                        <label for="steerTimeSlider">
                            Steer Time: <span id="steerTimeValue">0.5</span>s
                        </label>
                        <input type="range" id="steerTimeSlider" min="0.1" max="2.0" step="0.1" value="0.5">
                    </div>
                    <div class="slider-group">
                        <label for="dtSlider">
                            Integration dt: <span id="dtValue">0.05</span>s
                        </label>
                        <input type="range" id="dtSlider" min="0.01" max="0.2" step="0.01" value="0.05">
                    </div>
                    <div class="slider-group">
                        <label for="goalSampleRateSlider">
                            Goal Sample Rate: <span id="goalSampleRateValue">0.05</span>
                        </label>
                        <input type="range" id="goalSampleRateSlider" min="0.0" max="0.5" step="0.01" value="0.05">
                    </div>
                    <div class="slider-group">
                        <label for="rewireRadiusSlider">
                            Rewire Radius: <span id="rewireRadiusValue">50</span>px
                        </label>
                        <input type="range" id="rewireRadiusSlider" min="10" max="200" step="5" value="50">
                    </div>
                    <div class="slider-group">
                        <label for="robotRadiusSlider">
                            Robot Radius: <span id="robotRadiusValue">8</span>px
                        </label>
                        <input type="range" id="robotRadiusSlider" min="2" max="30" step="1" value="8">
                    </div>
                </div>

                <div class="section">
                    <h4>Motion Constraints</h4>
                    <div class="slider-group">
                        <label for="vMaxSlider">
                            Max Speed: <span id="vMaxValue">10.0</span> px/s
                        </label>
                        <input type="range" id="vMaxSlider" min="0" max="50" step="0.5" value="10">
                    </div>
                    <div class="slider-group">
                        <label for="vMinSlider">
                            Min Speed: <span id="vMinValue">0.0</span> px/s
                        </label>
                        <input type="range" id="vMinSlider" min="0" max="5" step="0.5" value="0">
                    </div>
                    <div class="slider-group">
                        <label for="omegaMaxSlider">
                            Max Angular Speed: <span id="omegaMaxValue">1.5</span> rad/s
                        </label>
                        <input type="range" id="omegaMaxSlider" min="0" max="3.0" step="0.1" value="1.5">
                    </div>
                </div>

                <div class="section">
                    <h4>Pursuer Sensor</h4>
                    <div class="control-group">
                        <label>
                            <input type="checkbox" id="pursuerSensorEnabled" checked>
                            Enable Pursuer Sensor
                        </label>
                    </div>
                    <div class="slider-group">
                        <label for="pursuerRMinSlider">
                            Blind Spot: <span id="pursuerRMinValue">20</span>px
                        </label>
                        <input type="range" id="pursuerRMinSlider" min="0" max="50" step="5" value="20">
                    </div>
                    <div class="slider-group">
                        <label for="pursuerRMaxSlider">
                            Detection Range: <span id="pursuerRMaxValue">150</span>px
                        </label>
                        <input type="range" id="pursuerRMaxSlider" min="50" max="400" step="10" value="150">
                    </div>
                    <div class="slider-group">
                        <label for="pursuerFOVSlider">
                            Field of View: <span id="pursuerFOVValue">360</span>°
                        </label>
                        <input type="range" id="pursuerFOVSlider" min="45" max="360" step="15" value="360">
                    </div>
                </div>

                <div class="section">
                    <h4>Tracking Behavior</h4>
                    <div class="slider-group">
                        <label for="updateIntervalSlider">
                            Update Interval: <span id="updateIntervalValue">2.0</span>s
                        </label>
                        <input type="range" id="updateIntervalSlider" min="0.5" max="10.0" step="0.5" value="2.0">
                        <p class="info-text">
                            Pursuer follows path for this duration before replanning
                        </p>
                    </div>
                </div>

                <div class="section">
                    <h4>Control</h4>
                    <button id="startTrackingBtn" class="btn btn-primary">
                        ▶ Start Tracking
                    </button>
                    <button id="stopTrackingBtn" class="btn btn-secondary" disabled>
                        ⏹ Stop Tracking
                    </button>
                    <div id="trackingStatus" class="status-text"></div>
                </div>

                <div class="section">
                    <h4>Live Statistics</h4>
                    <div id="trackingStats" class="stats-grid">
                        <div class="stat-item">
                            <span class="stat-label">Iterations:</span>
                            <span class="stat-value" id="statIterations">-</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Planning Time:</span>
                            <span class="stat-value" id="statPlanningTime">-</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Distance:</span>
                            <span class="stat-value" id="statDistance">-</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Tree Nodes:</span>
                            <span class="stat-value" id="statTreeNodes">-</span>
                        </div>
                    </div>
                </div>

                <div class="section">
                    <h4>Instructions</h4>
                    <div class="info-box">
                        <p><strong>Setup:</strong></p>
                        <ol>
                            <li>Place Pursuer and Evader using the Agents window</li>
                            <li>Adjust ALL parameters using sliders above</li>
                            <li>Click "Start Tracking" to begin</li>
                        </ol>
                        <p><strong>What happens:</strong></p>
                        <ul>
                            <li>Blue (Pursuer) and Pink (Evader) RRT* trees are visualized</li>
                            <li>Winning nodes are highlighted with pulsating circles</li>
                            <li>Agents move toward their targets automatically</li>
                            <li>Sensor ranges and FOV are applied independently</li>
                        </ul>
                        <p><strong>Note:</strong> This window has its own complete configuration. Changes here won't affect RRT Window or Sensor settings.</p>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(this.windowElement);

        this.windowElement.style.visibility = 'visible';
        this.windowElement.style.pointerEvents = 'auto';
        
        this.attachEventHandlers();
        this.updateDisplay();
        this.updatePosition();
        
        // Apply any pending slider values from storage restoration
        if (this.pendingSliderValues) {
            Object.entries(this.pendingSliderValues).forEach(([id, value]) => {
                const slider = this.windowElement.querySelector(`#${id}`);
                if (slider) {
                    slider.value = value;
                    slider.dispatchEvent(new Event('input', { bubbles: true }));
                }
            });
            delete this.pendingSliderValues;
        }
        
        this.restoreScrollPosition();
    }

    attachEventHandlers() {
        // Window dragging
        const header = this.windowElement.querySelector('.window-header');
        header.addEventListener('mousedown', (e) => this.startDragging(e));
        document.addEventListener('mousemove', (e) => this.drag(e));
        document.addEventListener('mouseup', () => this.stopDragging());
        
        // Close button
        const closeBtn = this.windowElement.querySelector('#closeRealTimeTrackingWindow');
        closeBtn.addEventListener('click', () => this.close());

        // Persist scroll position
        const windowContent = this.windowElement.querySelector('.window-content');
        if (windowContent) {
            windowContent.addEventListener('scroll', () => {
                this.scrollPosition = windowContent.scrollTop;
            });
        }

        // Start/Stop tracking buttons
        const startBtn = this.windowElement.querySelector('#startTrackingBtn');
        startBtn.addEventListener('click', () => this.startTracking());

        const stopBtn = this.windowElement.querySelector('#stopTrackingBtn');
        stopBtn.addEventListener('click', () => this.stopTracking());

        // Strategy selector
        const strategySelect = this.windowElement.querySelector('#strategySelector');
        strategySelect.addEventListener('change', () => this.updateConfig());

        // Sensor enable checkboxes
        const pursuerSensorEnabled = this.windowElement.querySelector('#pursuerSensorEnabled');
        pursuerSensorEnabled.addEventListener('change', () => this.updateConfig());

        // RRT* Tree Parameter Sliders
        this.attachSlider('maxNodesSlider', 'maxNodesValue', (value) => parseInt(value));
        this.attachSlider('maxPlanningTimeSlider', 'maxPlanningTimeValue', (value) => parseInt(value));
        this.attachSlider('steerTimeSlider', 'steerTimeValue', (value) => parseFloat(value).toFixed(1));
        this.attachSlider('dtSlider', 'dtValue', (value) => parseFloat(value).toFixed(2));
        this.attachSlider('goalSampleRateSlider', 'goalSampleRateValue', (value) => parseFloat(value).toFixed(2));
        this.attachSlider('rewireRadiusSlider', 'rewireRadiusValue', (value) => parseInt(value));
        this.attachSlider('robotRadiusSlider', 'robotRadiusValue', (value) => parseInt(value));
        
        // Motion Constraint Sliders
        this.attachSlider('vMaxSlider', 'vMaxValue', (value) => parseFloat(value).toFixed(1));
        this.attachSlider('vMinSlider', 'vMinValue', (value) => parseFloat(value).toFixed(1));
        this.attachSlider('omegaMaxSlider', 'omegaMaxValue', (value) => parseFloat(value).toFixed(1));
        
        // Pursuer Sensor Sliders
        this.attachSlider('pursuerRMinSlider', 'pursuerRMinValue', (value) => parseInt(value));
        this.attachSlider('pursuerRMaxSlider', 'pursuerRMaxValue', (value) => parseInt(value));
        this.attachSlider('pursuerFOVSlider', 'pursuerFOVValue', (value) => parseInt(value));
        
        // Tracking Behavior Slider - single slider controls both execution time and replan frequency
        this.attachSlider('updateIntervalSlider', 'updateIntervalValue', (value) => parseFloat(value).toFixed(1));
    }

    attachSlider(sliderId, valueId, formatter) {
        const slider = this.windowElement.querySelector(`#${sliderId}`);
        const valueSpan = this.windowElement.querySelector(`#${valueId}`);
        
        slider.addEventListener('input', () => {
            valueSpan.textContent = formatter(slider.value);
        });
        
        slider.addEventListener('change', () => {
            this.updateConfig();
        });
    }

    updateConfig() {
        // RRT* Tree Parameters
        const maxNodes = parseInt(this.windowElement.querySelector('#maxNodesSlider').value);
        const maxPlanningTime = parseInt(this.windowElement.querySelector('#maxPlanningTimeSlider').value);
        const steerTime = parseFloat(this.windowElement.querySelector('#steerTimeSlider').value);
        const dt = parseFloat(this.windowElement.querySelector('#dtSlider').value);
        const goalSampleRate = parseFloat(this.windowElement.querySelector('#goalSampleRateSlider').value);
        const rewireRadius = parseFloat(this.windowElement.querySelector('#rewireRadiusSlider').value);
        const robotRadius = parseFloat(this.windowElement.querySelector('#robotRadiusSlider').value);
        
        // Motion Constraints
        const vMax = parseFloat(this.windowElement.querySelector('#vMaxSlider').value);
        const vMin = parseFloat(this.windowElement.querySelector('#vMinSlider').value);
        const omegaMax = parseFloat(this.windowElement.querySelector('#omegaMaxSlider').value);
        
        // Pursuer Sensor
        const pursuerSensorEnabled = this.windowElement.querySelector('#pursuerSensorEnabled').checked;
        const pursuerRMin = parseFloat(this.windowElement.querySelector('#pursuerRMinSlider').value);
        const pursuerRMax = parseFloat(this.windowElement.querySelector('#pursuerRMaxSlider').value);
        const pursuerFOV = parseFloat(this.windowElement.querySelector('#pursuerFOVSlider').value);
        
        // Tracking Behavior - single slider controls replan interval
        const updateInterval = parseFloat(this.windowElement.querySelector('#updateIntervalSlider').value);
        const strategy = this.windowElement.querySelector('#strategySelector').value;

        realTimeTrackingService.configure({
            maxNodes,
            maxPlanningTime,
            steerTime,
            dt,
            goalSampleRate,
            rewireRadius,
            robotRadius,
            vMax,
            vMin,
            omegaMax,
            pursuerSensorEnabled,
            pursuerRMin,
            pursuerRMax,
            pursuerFOV,
            updateInterval,
            strategy
        });
    }

    startTracking() {
        // Get current agent states from services
        eventBus.emit('realTimeTracking:requestStates', (states) => {
            if (!states.pursuerState || !states.evaderState) {
                this.showError('Please place both Pursuer and Evader first using the Agents window');
                return;
            }

            // Update configuration
            this.updateConfig();

            // Start tracking
            realTimeTrackingService.start(states.pursuerState, states.evaderState);
        });
    }

    stopTracking() {
        realTimeTrackingService.stop();
    }

    updateDisplay() {
        if (!this.windowElement) return;

        const startBtn = this.windowElement.querySelector('#startTrackingBtn');
        const stopBtn = this.windowElement.querySelector('#stopTrackingBtn');

        if (this.isTracking) {
            startBtn.disabled = true;
            stopBtn.disabled = false;
        } else {
            startBtn.disabled = false;
            stopBtn.disabled = true;
        }
    }

    updateTracking(data) {
        if (!this.windowElement) return;

        // Count tree nodes
        let treeNodesCount = '-';
        if (data.pursuerTree && data.evaderTree) {
            // Simple node count by traversing the tree
            const countNodes = (node) => {
                if (!node) return 0;
                let count = 1;
                if (node.children && node.children.length > 0) {
                    for (const child of node.children) {
                        count += countNodes(child);
                    }
                }
                return count;
            };
            const pursuerNodes = countNodes(data.pursuerTree);
            const evaderNodes = countNodes(data.evaderTree);
            treeNodesCount = `P:${pursuerNodes} / E:${evaderNodes}`;
        }

        // Update statistics
        this.windowElement.querySelector('#statIterations').textContent = data.stats.iterations;
        this.windowElement.querySelector('#statPlanningTime').textContent = 
            data.stats.planningTime.toFixed(2) + ' ms';
        this.windowElement.querySelector('#statDistance').textContent = 
            data.stats.distance.toFixed(2) + ' px';
        this.windowElement.querySelector('#statTreeNodes').textContent = treeNodesCount;

        // Update status
        const statusEl = this.windowElement.querySelector('#trackingStatus');
        statusEl.textContent = `✓ Tracking active - Iteration ${data.stats.iterations}`;
        statusEl.className = 'status-text status-success';
    }

    showStats(stats) {
        const statusEl = this.windowElement.querySelector('#trackingStatus');
        statusEl.textContent = `Tracking stopped - Completed ${stats.iterations} iterations`;
        statusEl.className = 'status-text status-info';
    }

    showError(message) {
        const statusEl = this.windowElement.querySelector('#trackingStatus');
        statusEl.textContent = `Error: ${message}`;
        statusEl.className = 'status-text status-error';
    }

    // Dragging functionality
    startDragging(e) {
        if (e.target.classList.contains('close-btn')) return;
        
        this.isDragging = true;
        this.dragOffset.x = e.clientX - this.position.x;
        this.dragOffset.y = e.clientY - this.position.y;
        
        if (this.windowElement) {
            this.windowElement.style.cursor = 'grabbing';
        }
    }

    drag(e) {
        if (!this.isDragging) return;
        
        this.position.x = e.clientX - this.dragOffset.x;
        this.position.y = e.clientY - this.dragOffset.y;
        
        this.updatePosition();
    }

    stopDragging() {
        if (this.isDragging) {
            this.isDragging = false;
            if (this.windowElement) {
                this.windowElement.style.cursor = 'default';
            }
        }
    }

    updatePosition() {
        if (this.windowElement) {
            this.windowElement.style.left = `${this.position.x}px`;
            this.windowElement.style.top = `${this.position.y}px`;
            this.windowElement.style.transform = 'none';
        }
    }

    restoreScrollPosition() {
        const content = this.windowElement?.querySelector('.window-content');
        if (!content) return;
        const target = this.scrollPosition || 0;
        const apply = () => { content.scrollTop = target; };
        apply();
        if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(() => apply());
            requestAnimationFrame(() => setTimeout(apply, 0));
        } else {
            setTimeout(apply, 0);
        }
        setTimeout(apply, 50);
    }

    destroy() {
        if (this.windowElement) {
            this.windowElement.remove();
            this.windowElement = null;
        }
    }
}
