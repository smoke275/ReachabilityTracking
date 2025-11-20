/**
 * RealTimeTrackingWindow Web Component
 * Draggable floating window for real-time pursuit-evasion tracking
 */
import { eventBus } from '../utils/EventBus.js';
import { realTimeTrackingService } from '../services/RealTimeTrackingService.js';

export class RealTimeTrackingWindow extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };
        this.position = { x: window.innerWidth - 450, y: 120 };
        this.isTracking = false;
    }

    connectedCallback() {
        this.render();
        this.setupEventListeners();
        this.updatePosition();
    }

    setupEventListeners() {
        const header = this.shadowRoot.querySelector('.window-header');
        const closeBtn = this.shadowRoot.querySelector('.close-btn');
        const minimizeBtn = this.shadowRoot.querySelector('.minimize-btn');
        const startBtn = this.shadowRoot.querySelector('#startTracking');
        const stopBtn = this.shadowRoot.querySelector('#stopTracking');

        // Dragging functionality
        header.addEventListener('mousedown', (e) => this.startDragging(e));
        document.addEventListener('mousemove', (e) => this.drag(e));
        document.addEventListener('mouseup', () => this.stopDragging());

        // Window controls
        closeBtn?.addEventListener('click', () => this.close());
        minimizeBtn?.addEventListener('click', () => this.minimize());

        // Tracking controls
        startBtn?.addEventListener('click', () => this.startTracking());
        stopBtn?.addEventListener('click', () => this.stopTracking());

        // Strategy selector
        const strategySelect = this.shadowRoot.querySelector('#strategySelector');
        strategySelect?.addEventListener('change', () => this.updateConfig());

        // Sensor enable checkbox
        const pursuerSensorEnabled = this.shadowRoot.querySelector('#pursuerSensorEnabled');
        pursuerSensorEnabled?.addEventListener('change', () => this.updateConfig());

        // All parameter sliders
        this.attachSlider('maxNodesSlider', 'maxNodesValue', (v) => parseInt(v));
        this.attachSlider('maxPlanningTimeSlider', 'maxPlanningTimeValue', (v) => parseInt(v));
        this.attachSlider('steerTimeSlider', 'steerTimeValue', (v) => parseFloat(v).toFixed(1));
        this.attachSlider('dtSlider', 'dtValue', (v) => parseFloat(v).toFixed(2));
        this.attachSlider('goalSampleRateSlider', 'goalSampleRateValue', (v) => parseFloat(v).toFixed(2));
        this.attachSlider('rewireRadiusSlider', 'rewireRadiusValue', (v) => parseInt(v));
        this.attachSlider('robotRadiusSlider', 'robotRadiusValue', (v) => parseInt(v));
        this.attachSlider('vMaxSlider', 'vMaxValue', (v) => parseFloat(v).toFixed(1));
        this.attachSlider('vMinSlider', 'vMinValue', (v) => parseFloat(v).toFixed(1));
        this.attachSlider('omegaMaxSlider', 'omegaMaxValue', (v) => parseFloat(v).toFixed(1));
        this.attachSlider('pursuerRMinSlider', 'pursuerRMinValue', (v) => parseInt(v));
        this.attachSlider('pursuerRMaxSlider', 'pursuerRMaxValue', (v) => parseInt(v));
        this.attachSlider('pursuerFOVSlider', 'pursuerFOVValue', (v) => parseInt(v));
        this.attachSlider('updateIntervalSlider', 'updateIntervalValue', (v) => parseFloat(v).toFixed(1));

        // Listen for events
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

    attachSlider(sliderId, valueId, formatter) {
        const slider = this.shadowRoot.querySelector(`#${sliderId}`);
        const valueSpan = this.shadowRoot.querySelector(`#${valueId}`);
        
        if (!slider || !valueSpan) return;

        slider.addEventListener('input', () => {
            valueSpan.textContent = formatter(slider.value);
        });
        
        slider.addEventListener('change', () => {
            this.updateConfig();
        });
    }

    updateConfig() {
        const config = {
            maxNodes: parseInt(this.shadowRoot.querySelector('#maxNodesSlider')?.value || 1000),
            maxPlanningTime: parseInt(this.shadowRoot.querySelector('#maxPlanningTimeSlider')?.value || 100),
            steerTime: parseFloat(this.shadowRoot.querySelector('#steerTimeSlider')?.value || 0.5),
            dt: parseFloat(this.shadowRoot.querySelector('#dtSlider')?.value || 0.05),
            goalSampleRate: parseFloat(this.shadowRoot.querySelector('#goalSampleRateSlider')?.value || 0.05),
            rewireRadius: parseFloat(this.shadowRoot.querySelector('#rewireRadiusSlider')?.value || 50),
            robotRadius: parseFloat(this.shadowRoot.querySelector('#robotRadiusSlider')?.value || 8),
            vMax: parseFloat(this.shadowRoot.querySelector('#vMaxSlider')?.value || 10),
            vMin: parseFloat(this.shadowRoot.querySelector('#vMinSlider')?.value || 0),
            omegaMax: parseFloat(this.shadowRoot.querySelector('#omegaMaxSlider')?.value || 1.5),
            pursuerSensorEnabled: this.shadowRoot.querySelector('#pursuerSensorEnabled')?.checked || true,
            pursuerRMin: parseFloat(this.shadowRoot.querySelector('#pursuerRMinSlider')?.value || 20),
            pursuerRMax: parseFloat(this.shadowRoot.querySelector('#pursuerRMaxSlider')?.value || 150),
            pursuerFOV: parseFloat(this.shadowRoot.querySelector('#pursuerFOVSlider')?.value || 360),
            updateInterval: parseFloat(this.shadowRoot.querySelector('#updateIntervalSlider')?.value || 2),
            strategy: this.shadowRoot.querySelector('#strategySelector')?.value || 'tma'
        };

        realTimeTrackingService.configure(config);
    }

    startTracking() {
        eventBus.emit('realTimeTracking:requestStates', (states) => {
            if (!states.pursuerState || !states.evaderState) {
                this.showError('Please place both Pursuer and Evader first using the Agents window');
                return;
            }

            this.updateConfig();
            realTimeTrackingService.start(states.pursuerState, states.evaderState);
        });
    }

    stopTracking() {
        realTimeTrackingService.stop();
    }

    updateDisplay() {
        const startBtn = this.shadowRoot.querySelector('#startTracking');
        const stopBtn = this.shadowRoot.querySelector('#stopTracking');

        if (startBtn && stopBtn) {
            if (this.isTracking) {
                startBtn.disabled = true;
                stopBtn.disabled = false;
            } else {
                startBtn.disabled = false;
                stopBtn.disabled = true;
            }
        }
    }

    updateTracking(data) {
        // Count tree nodes
        let treeNodesCount = '-';
        if (data.pursuerTree && data.evaderTree) {
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
        const statIterations = this.shadowRoot.querySelector('#statIterations');
        const statPlanningTime = this.shadowRoot.querySelector('#statPlanningTime');
        const statDistance = this.shadowRoot.querySelector('#statDistance');
        const statTreeNodes = this.shadowRoot.querySelector('#statTreeNodes');
        const statusEl = this.shadowRoot.querySelector('#trackingStatus');

        if (statIterations) statIterations.textContent = data.stats.iterations;
        if (statPlanningTime) statPlanningTime.textContent = data.stats.planningTime.toFixed(2) + ' ms';
        if (statDistance) statDistance.textContent = data.stats.distance.toFixed(2) + ' px';
        if (statTreeNodes) statTreeNodes.textContent = treeNodesCount;
        if (statusEl) {
            statusEl.textContent = `✓ Tracking active - Iteration ${data.stats.iterations}`;
            statusEl.className = 'status-message active';
        }
    }

    showStats(stats) {
        const statusEl = this.shadowRoot.querySelector('#trackingStatus');
        if (statusEl) {
            statusEl.textContent = `Tracking stopped - Completed ${stats.iterations} iterations`;
            statusEl.className = 'status-message';
        }
    }

    showError(message) {
        const statusEl = this.shadowRoot.querySelector('#trackingStatus');
        if (statusEl) {
            statusEl.textContent = `Error: ${message}`;
            statusEl.className = 'status-message error';
        }
    }

    startDragging(e) {
        if (e.target.closest('.control-btn')) return;
        
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
        const container = this.shadowRoot.querySelector('.window-container');
        if (container) {
            container.style.cursor = 'default';
        }
    }

    updatePosition() {
        const container = this.shadowRoot.querySelector('.window-container');
        if (container) {
            container.style.left = `${this.position.x}px`;
            container.style.top = `${this.position.y}px`;
        }
    }

    minimize() {
        const content = this.shadowRoot.querySelector('.window-content');
        const container = this.shadowRoot.querySelector('.window-container');
        const minimizeBtn = this.shadowRoot.querySelector('.minimize-btn md-icon');
        
        if (content.style.display === 'none') {
            content.style.display = 'block';
            container.style.height = 'auto';
            if (minimizeBtn) minimizeBtn.textContent = 'remove';
        } else {
            content.style.display = 'none';
            container.style.height = 'auto';
            if (minimizeBtn) minimizeBtn.textContent = 'add';
        }
    }

    close() {
        this.removeAttribute('visible');
        eventBus.emit('realTimeTracking:windowClosed');
    }

    show() {
        this.setAttribute('visible', '');
    }

    render() {
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    position: fixed;
                    z-index: 1001;
                    display: none;
                    pointer-events: none;
                    --floating-primary: #1976D2;
                    --floating-on-primary: #FFFFFF;
                    --floating-surface: #E3F2FD;
                    --floating-on-surface: #0D47A1;
                    --floating-on-surface-variant: #1565C0;
                }

                :host([visible]) {
                    display: block;
                    pointer-events: auto;
                }

                .window-container {
                    position: fixed;
                    background: var(--floating-surface);
                    border-radius: 12px;
                    box-shadow: 
                        0px 4px 8px rgba(0, 0, 0, 0.12),
                        0px 8px 16px rgba(0, 0, 0, 0.08);
                    min-width: 380px;
                    max-width: 420px;
                    overflow: hidden;
                }

                .window-header {
                    background: var(--floating-primary);
                    color: var(--floating-on-primary);
                    padding: 12px 16px;
                    cursor: grab;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    user-select: none;
                }

                .window-header:active {
                    cursor: grabbing;
                }

                .window-title {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 1rem;
                    font-weight: 500;
                }

                .window-controls {
                    display: flex;
                    gap: 4px;
                }

                .control-btn {
                    background: transparent;
                    border: none;
                    color: var(--floating-on-primary);
                    cursor: pointer;
                    padding: 4px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 32px;
                    height: 32px;
                    transition: background 0.2s;
                }

                .control-btn:hover {
                    background: rgba(255, 255, 255, 0.1);
                }

                .control-btn md-icon {
                    font-size: 20px;
                }

                .window-content {
                    padding: 20px;
                    max-height: 500px;
                    overflow-y: auto;
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

                .section {
                    margin-bottom: 20px;
                }

                .section-title {
                    font-size: 0.875rem;
                    font-weight: 600;
                    text-transform: uppercase;
                    color: var(--floating-primary);
                    letter-spacing: 0.5px;
                    margin-bottom: 12px;
                }

                .control-group {
                    margin-bottom: 16px;
                }

                .control-label {
                    font-size: 0.875rem;
                    font-weight: 500;
                    color: var(--floating-on-surface);
                    margin-bottom: 8px;
                    display: block;
                }

                select {
                    width: 100%;
                    padding: 10px;
                    border: 1px solid var(--floating-primary);
                    border-radius: 8px;
                    font-size: 0.875rem;
                    background: white;
                    color: var(--floating-on-surface);
                    cursor: pointer;
                }

                select:focus {
                    outline: 2px solid var(--floating-primary);
                    outline-offset: 2px;
                }

                .slider-row {
                    margin-bottom: 16px;
                }

                .slider-label {
                    font-size: 0.875rem;
                    color: var(--floating-on-surface);
                    margin-bottom: 8px;
                    display: block;
                }

                .slider-label strong {
                    color: var(--floating-primary);
                }

                .tool-button {
                    width: 100%;
                    margin-bottom: 8px;
                }

                .status-message {
                    font-size: 0.875rem;
                    color: var(--floating-on-surface-variant);
                    margin-top: 12px;
                    padding: 12px;
                    background: rgba(255, 255, 255, 0.5);
                    border-radius: 8px;
                    min-height: 44px;
                }

                .status-message.active {
                    background: rgba(76, 175, 80, 0.1);
                    color: #2E7D32;
                }

                .status-message.error {
                    background: rgba(244, 67, 54, 0.1);
                    color: #C62828;
                }

                .info-text {
                    font-size: 0.8rem;
                    color: var(--floating-on-surface-variant);
                    line-height: 1.4;
                    margin-top: 6px;
                }

                .stats-grid {
                    display: grid;
                    grid-template-columns: 1fr;
                    gap: 12px;
                }

                .stat-item {
                    display: flex;
                    justify-content: space-between;
                    padding: 12px;
                    background: rgba(255, 255, 255, 0.6);
                    border-radius: 8px;
                    border: 1px solid rgba(25, 118, 210, 0.2);
                }

                .stat-label {
                    font-size: 0.875rem;
                    color: var(--floating-on-surface);
                }

                .stat-value {
                    font-weight: 600;
                    color: var(--floating-primary);
                }

                .info-box {
                    background: rgba(255, 255, 255, 0.6);
                    border: 1px solid rgba(25, 118, 210, 0.2);
                    border-radius: 8px;
                    padding: 16px;
                    font-size: 0.875rem;
                    color: var(--floating-on-surface);
                    line-height: 1.6;
                }

                .info-box p {
                    margin: 0 0 8px 0;
                }

                .info-box strong {
                    color: var(--floating-primary);
                }

                .info-box ol,
                .info-box ul {
                    margin: 8px 0;
                    padding-left: 20px;
                }

                .info-box li {
                    margin-bottom: 4px;
                }

                md-divider {
                    margin: 16px 0;
                }
            </style>
            
            <div class="window-container">
                <div class="window-header">
                    <div class="window-title">
                        <md-icon>track_changes</md-icon>
                        <span>Real-Time Tracking</span>
                    </div>
                    <div class="window-controls">
                        <button class="control-btn minimize-btn" title="Minimize">
                            <md-icon>remove</md-icon>
                        </button>
                        <button class="control-btn close-btn" title="Close">
                            <md-icon>close</md-icon>
                        </button>
                    </div>
                </div>
                
                <div class="window-content">
                    <div class="section">
                        <div class="section-title">Strategy</div>
                        <div class="control-group">
                            <label class="control-label" for="strategySelector">Tracking Strategy:</label>
                            <select id="strategySelector">
                                <option value="pl">PL - Pursuer Leader</option>
                                <option value="tma" selected>TMA - Two Moves Ahead</option>
                            </select>
                        </div>
                    </div>

                    <md-divider></md-divider>

                    <div class="section">
                        <div class="section-title">RRT* Tree Parameters</div>
                        <div class="slider-row">
                            <div class="slider-label">Max Nodes: <strong><span id="maxNodesValue">1000</span></strong></div>
                            <md-slider id="maxNodesSlider" min="100" max="5000" step="100" value="1000" labeled></md-slider>
                        </div>
                        <div class="slider-row">
                            <div class="slider-label">Max Planning Time: <strong><span id="maxPlanningTimeValue">100</span>ms</strong></div>
                            <md-slider id="maxPlanningTimeSlider" min="10" max="1000" step="10" value="100" labeled></md-slider>
                        </div>
                        <div class="slider-row">
                            <div class="slider-label">Steer Time: <strong><span id="steerTimeValue">0.5</span>s</strong></div>
                            <md-slider id="steerTimeSlider" min="0.1" max="2.0" step="0.1" value="0.5" labeled></md-slider>
                        </div>
                        <div class="slider-row">
                            <div class="slider-label">Integration dt: <strong><span id="dtValue">0.05</span>s</strong></div>
                            <md-slider id="dtSlider" min="0.01" max="0.2" step="0.01" value="0.05" labeled></md-slider>
                        </div>
                        <div class="slider-row">
                            <div class="slider-label">Goal Sample Rate: <strong><span id="goalSampleRateValue">0.05</span></strong></div>
                            <md-slider id="goalSampleRateSlider" min="0.0" max="0.5" step="0.01" value="0.05" labeled></md-slider>
                        </div>
                        <div class="slider-row">
                            <div class="slider-label">Rewire Radius: <strong><span id="rewireRadiusValue">50</span>px</strong></div>
                            <md-slider id="rewireRadiusSlider" min="10" max="200" step="5" value="50" labeled></md-slider>
                        </div>
                        <div class="slider-row">
                            <div class="slider-label">Robot Radius: <strong><span id="robotRadiusValue">8</span>px</strong></div>
                            <md-slider id="robotRadiusSlider" min="2" max="30" step="1" value="8" labeled></md-slider>
                        </div>
                    </div>

                    <md-divider></md-divider>

                    <div class="section">
                        <div class="section-title">Motion Constraints</div>
                        <div class="slider-row">
                            <div class="slider-label">Max Speed: <strong><span id="vMaxValue">10.0</span> px/s</strong></div>
                            <md-slider id="vMaxSlider" min="0" max="50" step="0.5" value="10" labeled></md-slider>
                        </div>
                        <div class="slider-row">
                            <div class="slider-label">Min Speed: <strong><span id="vMinValue">0.0</span> px/s</strong></div>
                            <md-slider id="vMinSlider" min="0" max="5" step="0.5" value="0" labeled></md-slider>
                        </div>
                        <div class="slider-row">
                            <div class="slider-label">Max Angular Speed: <strong><span id="omegaMaxValue">1.5</span> rad/s</strong></div>
                            <md-slider id="omegaMaxSlider" min="0" max="3.0" step="0.1" value="1.5" labeled></md-slider>
                        </div>
                    </div>

                    <md-divider></md-divider>

                    <div class="section">
                        <div class="section-title">Pursuer Sensor</div>
                        <div class="control-group">
                            <label class="control-label">
                                <input type="checkbox" id="pursuerSensorEnabled" checked>
                                Enable Pursuer Sensor
                            </label>
                        </div>
                        <div class="slider-row">
                            <div class="slider-label">Blind Spot: <strong><span id="pursuerRMinValue">20</span>px</strong></div>
                            <md-slider id="pursuerRMinSlider" min="0" max="50" step="5" value="20" labeled></md-slider>
                        </div>
                        <div class="slider-row">
                            <div class="slider-label">Detection Range: <strong><span id="pursuerRMaxValue">150</span>px</strong></div>
                            <md-slider id="pursuerRMaxSlider" min="50" max="400" step="10" value="150" labeled></md-slider>
                        </div>
                        <div class="slider-row">
                            <div class="slider-label">Field of View: <strong><span id="pursuerFOVValue">360</span>°</strong></div>
                            <md-slider id="pursuerFOVSlider" min="45" max="360" step="15" value="360" labeled></md-slider>
                        </div>
                    </div>

                    <md-divider></md-divider>

                    <div class="section">
                        <div class="section-title">Tracking Behavior</div>
                        <div class="slider-row">
                            <div class="slider-label">Update Interval: <strong><span id="updateIntervalValue">2.0</span>s</strong></div>
                            <md-slider id="updateIntervalSlider" min="0.5" max="10.0" step="0.5" value="2.0" labeled></md-slider>
                            <p class="info-text">Pursuer follows path for this duration before replanning</p>
                        </div>
                    </div>

                    <md-divider></md-divider>

                    <div class="section">
                        <div class="section-title">Controls</div>
                        <md-filled-button id="startTracking" class="tool-button">
                            <md-icon slot="icon">play_arrow</md-icon>
                            Start Tracking
                        </md-filled-button>
                        <md-outlined-button id="stopTracking" class="tool-button" disabled>
                            <md-icon slot="icon">stop</md-icon>
                            Stop Tracking
                        </md-outlined-button>
                    </div>

                    <md-divider></md-divider>

                    <div class="section">
                        <div class="section-title">Live Statistics</div>
                        <div class="stats-grid">
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

                    <md-divider></md-divider>

                    <div class="section">
                        <div class="section-title">Instructions</div>
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

                    <md-divider></md-divider>

                    <div id="trackingStatus" class="status-message">
                        Ready to start tracking
                    </div>
                </div>
            </div>
        `;
    }
}

customElements.define('real-time-tracking-window', RealTimeTrackingWindow);
