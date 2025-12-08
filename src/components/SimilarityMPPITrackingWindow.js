/**
 * SimilarityMPPITrackingWindow Web Component
 * Draggable floating window for Similarity-based MPPI tracking
 */
import { eventBus } from '../utils/EventBus.js';
import { similarityMPPITrackingService } from '../services/SimilarityMPPITrackingService.js';
import { sdfService } from '../services/SDFService.js';

export class SimilarityMPPITrackingWindow extends HTMLElement {
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
        this.loadConfig();
        this.updatePosition();
    }

    setupEventListeners() {
        const header = this.shadowRoot.querySelector('.window-header');
        const closeBtn = this.shadowRoot.querySelector('.close-btn');
        const minimizeBtn = this.shadowRoot.querySelector('.minimize-btn');
        const startBtn = this.shadowRoot.querySelector('#startTracking');
        const stopBtn = this.shadowRoot.querySelector('#stopTracking');
        const resetBtn = this.shadowRoot.querySelector('#resetNearEvader');
        const syncBtn = this.shadowRoot.querySelector('#syncEvaderParams');

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
        resetBtn?.addEventListener('click', () => {
            // Placeholder for reset functionality
            console.log('Reset Near Evader clicked');
        });
        
        // Sync button
        syncBtn?.addEventListener('click', () => this.syncWithEvader());
        
        // Visualization toggle
        const showTrajectories = this.shadowRoot.querySelector('#showTrajectories');
        showTrajectories?.addEventListener('change', (e) => {
            console.log('Toggle visualization:', e.target.checked);
            eventBus.emit('similarityMPPITracking:toggleVisualization', e.target.checked);
        });

        // All parameter sliders
        this.attachSlider('vMaxSlider', 'vMaxValue', (v) => parseFloat(v).toFixed(1));
        this.attachSlider('vMinSlider', 'vMinValue', (v) => parseFloat(v).toFixed(1));
        this.attachSlider('omegaMaxSlider', 'omegaMaxValue', (v) => parseFloat(v).toFixed(1));
        
        // MPPI parameter sliders
        this.attachSlider('mppiSamplesSlider', 'mppiSamplesValue', (v) => parseInt(v));
        this.attachSlider('mppiHorizonSlider', 'mppiHorizonValue', (v) => parseFloat(v).toFixed(1));
        this.attachSlider('mppiLambdaSlider', 'mppiLambdaValue', (v) => parseFloat(v).toFixed(2));
        this.attachSlider('mppiSigmaSlider', 'mppiSigmaValue', (v) => parseFloat(v).toFixed(2));
        this.attachSlider('controlFreqSlider', 'controlFreqValue', (v) => parseInt(v));
        this.attachSlider('collisionWeightSlider', 'collisionWeightValue', (v) => parseInt(v));
        this.attachSlider('safeDistanceSlider', 'safeDistanceValue', (v) => parseInt(v));

        // Listen for events
        eventBus.on('similarityMPPITracking:started', () => {
            this.isTracking = true;
            this.updateDisplay();
        });

        // SDF Status
        const updateSDFStatus = () => {
            const badge = this.shadowRoot.querySelector('#sdfStatus');
            if (badge) {
                if (sdfService.isReady) {
                    badge.textContent = 'SDF: Ready';
                    badge.style.background = '#e8f5e9'; // Light green
                    badge.style.color = '#2e7d32'; // Dark green
                    badge.title = `Grid: ${sdfService.cols}x${sdfService.rows}, Res: ${sdfService.resolution}px`;
                } else {
                    badge.textContent = 'SDF: Computing...';
                    badge.style.background = '#fff3e0'; // Light orange
                    badge.style.color = '#ef6c00'; // Dark orange
                }
            }
        };
        
        eventBus.on('sdf:updated', updateSDFStatus);
        // Initial check
        setTimeout(updateSDFStatus, 100); // Small delay to ensure render

        eventBus.on('similarityMPPITracking:stopped', (stats) => {
            this.isTracking = false;
            this.updateDisplay();
            if (stats) this.showStats(stats);
        });

        eventBus.on('similarityMPPITracking:update', (data) => {
            this.updateTracking(data);
        });

        eventBus.on('similarityMPPITracking:error', (data) => {
            this.showError(data.message);
        });

        // Listen for evader updates to keep the service informed
        eventBus.on('evader:positionUpdate', (data) => {
            if (this.isTracking) {
                similarityMPPITrackingService.updateEvaderState(data);
            }
        });
        
        // Listen for evader params response
        eventBus.on('evader:params', (params) => {
            this.applyEvaderParams(params);
        });
    }

    syncWithEvader() {
        eventBus.emit('evader:requestParams');
    }

    applyEvaderParams(params) {
        if (!params) return;
        
        // Use raw values (px/frame and rad/frame) directly
        const vMax = params.speed || 0;
        const omegaMax = params.angularSpeed || 0;
        
        console.log(`Syncing Evader Params: Speed ${params.speed} -> ${vMax} px/frame, Omega ${params.angularSpeed} -> ${omegaMax} rad/frame`);
        
        // Update sliders
        const vMaxSlider = this.shadowRoot.querySelector('#vMaxSlider');
        const omegaMaxSlider = this.shadowRoot.querySelector('#omegaMaxSlider');
        
        if (vMaxSlider) {
            vMaxSlider.value = vMax;
            const display = this.shadowRoot.querySelector('#vMaxValue');
            if (display) display.textContent = vMax.toFixed(1);
        }
        
        if (omegaMaxSlider) {
            omegaMaxSlider.value = omegaMax;
            const display = this.shadowRoot.querySelector('#omegaMaxValue');
            if (display) display.textContent = omegaMax.toFixed(2);
        }
        
        this.updateConfig();
        this.showError(`Synced: ${vMax.toFixed(1)} px/frame, ${omegaMax.toFixed(2)} rad/frame`);
        
        // Clear message after 3 seconds
        setTimeout(() => {
            const statusEl = this.shadowRoot.querySelector('#trackingStatus');
            if (statusEl && statusEl.textContent.includes('Synced')) {
                statusEl.textContent = 'Ready to start tracking';
                statusEl.className = 'status-message';
            }
        }, 3000);
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
            vMax: parseFloat(this.shadowRoot.querySelector('#vMaxSlider')?.value || 1.0),
            vMin: parseFloat(this.shadowRoot.querySelector('#vMinSlider')?.value || 0),
            omegaMax: parseFloat(this.shadowRoot.querySelector('#omegaMaxSlider')?.value || 0.15),
            mppiSamples: parseInt(this.shadowRoot.querySelector('#mppiSamplesSlider')?.value || 500),
            mppiHorizon: parseFloat(this.shadowRoot.querySelector('#mppiHorizonSlider')?.value || 2.0),
            mppiLambda: parseFloat(this.shadowRoot.querySelector('#mppiLambdaSlider')?.value || 0.5),
            mppiSigma: parseFloat(this.shadowRoot.querySelector('#mppiSigmaSlider')?.value || 0.1),
            controlFreq: parseInt(this.shadowRoot.querySelector('#controlFreqSlider')?.value || 30),
            collisionWeight: parseFloat(this.shadowRoot.querySelector('#collisionWeightSlider')?.value || 10000),
            safeDistance: parseFloat(this.shadowRoot.querySelector('#safeDistanceSlider')?.value || 20),
        };

        console.log('Similarity MPPI Config updated:', config);
        similarityMPPITrackingService.configure(config);
        this.saveConfig(config);
    }
    
    saveConfig(config) {
        localStorage.setItem('mppiTrackingConfig', JSON.stringify(config));
    }
    
    loadConfig() {
        const saved = localStorage.getItem('mppiTrackingConfig');
        if (saved) {
            try {
                const config = JSON.parse(saved);
                
                // Helper to set slider and display
                const setSlider = (id, val, displayId, fixed) => {
                    const slider = this.shadowRoot.querySelector(`#${id}`);
                    const display = this.shadowRoot.querySelector(`#${displayId}`);
                    if (slider && val !== undefined) {
                        slider.value = val;
                        if (display) display.textContent = fixed ? parseFloat(val).toFixed(fixed) : val;
                    }
                };
                
                setSlider('vMaxSlider', config.vMax, 'vMaxValue', 1);
                setSlider('vMinSlider', config.vMin, 'vMinValue', 1);
                setSlider('omegaMaxSlider', config.omegaMax, 'omegaMaxValue', 1);
                setSlider('mppiSamplesSlider', config.mppiSamples, 'mppiSamplesValue', 0);
                setSlider('mppiHorizonSlider', config.mppiHorizon, 'mppiHorizonValue', 1);
                setSlider('mppiLambdaSlider', config.mppiLambda, 'mppiLambdaValue', 2);
                setSlider('mppiSigmaSlider', config.mppiSigma, 'mppiSigmaValue', 2);
                setSlider('controlFreqSlider', config.controlFreq, 'controlFreqValue', 0);
                setSlider('collisionWeightSlider', config.collisionWeight, 'collisionWeightValue', 0);
                setSlider('safeDistanceSlider', config.safeDistance, 'safeDistanceValue', 0);
                
                // Apply to service
                similarityMPPITrackingService.configure(config);
            } catch (e) {
                console.error('Failed to load MPPI config', e);
            }
        }
    }

    startTracking() {
        console.log('Start Tracking clicked');
        
        eventBus.emit('realTimeTracking:requestStates', (states) => {
            if (!states.pursuerState || !states.evaderState) {
                this.showError('Please place both Pursuer and Evader first using the Agents window');
                return;
            }

            this.updateConfig();
            similarityMPPITrackingService.start(states.pursuerState, states.evaderState);
        });
    }

    stopTracking() {
        console.log('Stop Tracking clicked');
        similarityMPPITrackingService.stop();
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
        const statusEl = this.shadowRoot.querySelector('#trackingStatus');
        if (statusEl) {
            statusEl.textContent = `✓ Tracking active`;
            statusEl.className = 'status-message active';
        }
    }

    showStats(stats) {
        const statusEl = this.shadowRoot.querySelector('#trackingStatus');
        if (statusEl) {
            statusEl.textContent = `Tracking stopped`;
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
        eventBus.emit('similarityMPPITracking:windowClosed');
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

                .tool-button + .tool-button { margin-left: 8px; }

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
                        <md-icon class="title-icon">track_changes</md-icon>
                        Similarity-based MPPI Tracking
                    </div>
                    <div class="window-controls">
                        <button class="control-btn minimize-btn" title="Minimize"><md-icon>remove</md-icon></button>
                        <button class="control-btn close-btn" title="Close"><md-icon>close</md-icon></button>
                    </div>
                </div>
                <div class="window-content">
                    
                    <div class="section">
                        <div class="section-title" style="display: flex; justify-content: space-between; align-items: center;">
                            MPPI Parameters
                            <span id="sdfStatus" style="font-size: 11px; padding: 2px 8px; border-radius: 12px; background: #eee; color: #666; font-weight: normal; text-transform: none;">SDF: Init</span>
                        </div>
                        <div class="slider-row">
                            <div class="slider-label">Samples (K): <strong><span id="mppiSamplesValue">500</span></strong></div>
                            <md-slider id="mppiSamplesSlider" min="100" max="2000" step="50" value="500" labeled></md-slider>
                        </div>
                        <div class="slider-row">
                            <div class="slider-label">Time Horizon (T): <strong><span id="mppiHorizonValue">2.0</span>s</strong></div>
                            <md-slider id="mppiHorizonSlider" min="0.5" max="5.0" step="0.1" value="2.0" labeled></md-slider>
                        </div>
                        <div class="slider-row">
                            <div class="slider-label">Temperature (λ): <strong><span id="mppiLambdaValue">0.5</span></strong></div>
                            <md-slider id="mppiLambdaSlider" min="0.01" max="2.0" step="0.01" value="0.5" labeled></md-slider>
                        </div>
                        <div class="slider-row">
                            <div class="slider-label">Exploration Noise (σ): <strong><span id="mppiSigmaValue">0.1</span></strong></div>
                            <md-slider id="mppiSigmaSlider" min="0.01" max="1.0" step="0.01" value="0.1" labeled></md-slider>
                        </div>
                        <div class="slider-row">
                            <div class="slider-label">Control Frequency: <strong><span id="controlFreqValue">30</span> Hz</strong></div>
                            <md-slider id="controlFreqSlider" min="1" max="60" step="1" value="30" labeled></md-slider>
                        </div>
                        <div class="slider-row">
                            <div class="slider-label">Collision Weight: <strong><span id="collisionWeightValue">10000</span></strong></div>
                            <md-slider id="collisionWeightSlider" min="0" max="20000" step="100" value="10000" labeled></md-slider>
                        </div>
                        <div class="slider-row">
                            <div class="slider-label">Safe Distance: <strong><span id="safeDistanceValue">20</span> px</strong></div>
                            <md-slider id="safeDistanceSlider" min="5" max="100" step="1" value="20" labeled></md-slider>
                        </div>
                    </div>

                    <md-divider></md-divider>

                    <div class="section">
                        <div class="section-title">Motion Constraints</div>
                        <div class="slider-row">
                            <div class="slider-label">Max Speed: <strong><span id="vMaxValue">1.0</span> px/frame</strong></div>
                            <md-slider id="vMaxSlider" min="0" max="10" step="0.1" value="1.0" labeled></md-slider>
                        </div>
                        <div class="slider-row">
                            <div class="slider-label">Min Speed: <strong><span id="vMinValue">0.0</span> px/frame</strong></div>
                            <md-slider id="vMinSlider" min="0" max="5" step="0.1" value="0" labeled></md-slider>
                        </div>
                        <div class="slider-row">
                            <div class="slider-label">Max Angular Speed: <strong><span id="omegaMaxValue">0.15</span> rad/frame</strong></div>
                            <md-slider id="omegaMaxSlider" min="0" max="0.5" step="0.01" value="0.15" labeled></md-slider>
                        </div>
                        <md-outlined-button id="syncEvaderParams" class="tool-button">
                            <md-icon slot="icon">sync</md-icon>
                            Sync with Evader
                        </md-outlined-button>
                    </div>

                    <md-divider></md-divider>

                    <div class="section">
                        <div class="section-title">Visualization</div>
                        <div class="control-group">
                            <label class="control-label" style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                                <input type="checkbox" id="showTrajectories" style="width: 18px; height: 18px;">
                                Show Trajectories
                            </label>
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
                        <md-outlined-button id="resetNearEvader" class="tool-button">
                            <md-icon slot="icon">my_location</md-icon>
                            Reset Near Evader
                        </md-outlined-button>
                    </div>

                    <md-divider></md-divider>

                    <div class="section">
                        <div class="section-title">Instructions</div>
                        <div class="info-box">
                            <p><strong>Setup:</strong></p>
                            <ol>
                                <li>Place Pursuer and Evader using the Agents window</li>
                                <li>Adjust parameters using sliders above</li>
                                <li>Click "Start Tracking" to begin</li>
                            </ol>
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

customElements.define('similarity-mppi-tracking-window', SimilarityMPPITrackingWindow);
