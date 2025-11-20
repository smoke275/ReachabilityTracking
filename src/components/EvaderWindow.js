/**
 * EvaderWindow Web Component
 * Draggable floating window for evader simulation
 */
import { eventBus } from '../utils/EventBus.js';

export class EvaderWindow extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };
        this.position = { x: 120, y: 120 };
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
        const startBtn = this.shadowRoot.querySelector('#startSimulation');
        const stopBtn = this.shadowRoot.querySelector('#stopSimulation');
        const resetBtn = this.shadowRoot.querySelector('#resetSimulation');
        const modeSelect = this.shadowRoot.querySelector('#motionMode');
        const speedSlider = this.shadowRoot.querySelector('#speedSlider');
        const speedValue = this.shadowRoot.querySelector('#speedValue');
        const angularSpeedSlider = this.shadowRoot.querySelector('#angularSpeedSlider');
        const angularSpeedValue = this.shadowRoot.querySelector('#angularSpeedValue');
        const angularSpeedRow = this.shadowRoot.querySelector('.angular-speed-row');

        // Dragging functionality
        header.addEventListener('mousedown', (e) => this.startDragging(e));
        document.addEventListener('mousemove', (e) => this.drag(e));
        document.addEventListener('mouseup', () => this.stopDragging());

        // Window controls
        closeBtn?.addEventListener('click', () => this.close());
        minimizeBtn?.addEventListener('click', () => this.minimize());

        // Motion mode selection - show/hide angular speed slider
        modeSelect?.addEventListener('change', (e) => {
            const mode = e.target.value;
            if (mode === 'unicycle') {
                angularSpeedRow.style.display = 'block';
            } else {
                angularSpeedRow.style.display = 'none';
            }
            // Emit event to change mode (works during active simulation too)
            eventBus.emit('evader:setMode', mode);
        });

        // Simulation controls
        startBtn?.addEventListener('click', () => {
            const mode = modeSelect?.value || 'holonomic';
            eventBus.emit('evader:start', { mode });
            this.updateStatus('Evader simulation started...', false);
        });

        stopBtn?.addEventListener('click', () => {
            eventBus.emit('evader:stop');
            this.updateStatus('Evader simulation paused.', false);
        });

        resetBtn?.addEventListener('click', () => {
            eventBus.emit('evader:reset');
            this.updateStatus('Evader simulation reset.', false);
        });

        // Speed control
        speedSlider?.addEventListener('input', (e) => {
            const speed = Number(e.target.value) || 1;
            if (speedValue) speedValue.textContent = `${speed.toFixed(1)} px/frame`;
            eventBus.emit('evader:setSpeed', speed);
        });

        // Angular speed control
        angularSpeedSlider?.addEventListener('input', (e) => {
            const omega = Number(e.target.value) || 0.15;
            if (angularSpeedValue) angularSpeedValue.textContent = `${omega.toFixed(2)} rad/frame`;
            eventBus.emit('evader:setAngularSpeed', omega);
        });

        // Listen for evader events
        eventBus.on('evader:started', (data) => {
            this.updateStatus(`Evader started in ${data.mode} mode`, false);
        });

        eventBus.on('evader:stopped', () => {
            this.updateStatus('Evader paused', false);
        });

        eventBus.on('evader:reachedDestination', (data) => {
            this.updateStatus(`Reached destination! Choosing new target...`, false);
        });

        eventBus.on('evader:error', (error) => {
            this.updateStatus(`Error: ${error}`, true);
        });

        eventBus.on('evader:noSkeleton', () => {
            this.updateStatus('Please generate environment analysis first!', true);
        });

        // Listen for settings restoration
        eventBus.on('evader:settingsRestored', (settings) => {
            this.restoreSettings(settings);
        });
    }

    restoreSettings(settings) {
        const modeSelect = this.shadowRoot.querySelector('#motionMode');
        const speedSlider = this.shadowRoot.querySelector('#speedSlider');
        const speedValue = this.shadowRoot.querySelector('#speedValue');
        const angularSpeedSlider = this.shadowRoot.querySelector('#angularSpeedSlider');
        const angularSpeedValue = this.shadowRoot.querySelector('#angularSpeedValue');
        const angularSpeedRow = this.shadowRoot.querySelector('.angular-speed-row');

        // Restore mode
        if (settings.mode && modeSelect) {
            modeSelect.value = settings.mode;
            // Show/hide angular speed slider based on mode
            if (settings.mode === 'unicycle') {
                angularSpeedRow.style.display = 'block';
            } else {
                angularSpeedRow.style.display = 'none';
            }
        }

        // Restore speed
        if (typeof settings.speed === 'number' && speedSlider) {
            speedSlider.value = settings.speed;
            if (speedValue) {
                speedValue.textContent = `${settings.speed.toFixed(1)} px/frame`;
            }
        }

        // Restore angular speed
        if (typeof settings.angularSpeed === 'number' && angularSpeedSlider) {
            angularSpeedSlider.value = settings.angularSpeed;
            if (angularSpeedValue) {
                angularSpeedValue.textContent = `${settings.angularSpeed.toFixed(2)} rad/frame`;
            }
        }

        console.log('Evader UI settings restored:', settings);
    }

    startDragging(e) {
        if (e.target.closest('.close-btn') || e.target.closest('.minimize-btn')) {
            return;
        }

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

        // Keep window within viewport bounds
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

    updateStatus(message, isError = false) {
        const statusEl = this.shadowRoot.querySelector('.status-message');
        if (statusEl) {
            statusEl.textContent = message;
            statusEl.style.color = isError ? 'var(--md-sys-color-error)' : 'var(--md-sys-color-on-surface-variant)';
        }
    }

    minimize() {
        const content = this.shadowRoot.querySelector('.window-content');
        const container = this.shadowRoot.querySelector('.window-container');
        const minimizeBtn = this.shadowRoot.querySelector('.minimize-btn md-icon');
        
        if (content.style.display === 'none') {
            content.style.display = 'block';
            container.style.height = 'auto';
            minimizeBtn.textContent = 'remove';
        } else {
            content.style.display = 'none';
            container.style.height = 'auto';
            minimizeBtn.textContent = 'add';
        }
    }

    close() {
        this.removeAttribute('visible');
        eventBus.emit('evader:windowClosed');
    }

    show() {
        console.log('EvaderWindow.show() called');
        this.setAttribute('visible', '');
        console.log('Visible attribute set');
    }

    render() {
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    position: fixed;
                    z-index: 1001;
                    display: none;
                    pointer-events: none;
                    /* Floating palette overrides - use different color for evader window */
                    --floating-primary: #C2185B; /* pink/magenta */
                    --floating-on-primary: #FFFFFF;
                    --floating-surface: #FCE4EC;
                    --floating-on-surface: #4A0E24;
                    --floating-on-surface-variant: #5D3043;
                }

                :host([visible]) {
                    display: block;
                    pointer-events: auto;
                }

                .window-container {
                    position: fixed;
                    background: var(--floating-surface, #FCE4EC);
                    border-radius: 12px;
                    box-shadow: 
                        0px 4px 8px rgba(0, 0, 0, 0.12),
                        0px 8px 16px rgba(0, 0, 0, 0.08);
                    min-width: 320px;
                    max-width: 400px;
                    overflow: hidden;
                }

                .window-header {
                    background: var(--floating-primary, #C2185B);
                    color: var(--floating-on-primary, #FFFFFF);
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
                    color: var(--floating-on-primary, #FFFFFF);
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
                    color: var(--floating-primary, #C2185B);
                    letter-spacing: 0.5px;
                    margin-bottom: 12px;
                }

                .tool-button {
                    width: 100%;
                    margin-bottom: 8px;
                }

                .status-message {
                    font-size: 0.875rem;
                    color: var(--floating-on-surface-variant, #5D3043);
                    margin-top: 12px;
                    padding: 12px;
                    background: rgba(255, 255, 255, 0.5);
                    border-radius: 8px;
                    min-height: 44px;
                }

                .info-text {
                    font-size: 0.8rem;
                    color: var(--floating-on-surface-variant, #5D3043);
                    line-height: 1.4;
                    margin-bottom: 12px;
                }

                .control-group {
                    margin-bottom: 16px;
                }

                .control-label {
                    font-size: 0.875rem;
                    font-weight: 500;
                    color: var(--floating-on-surface, #4A0E24);
                    margin-bottom: 8px;
                    display: block;
                }

                select {
                    width: 100%;
                    padding: 10px;
                    border: 1px solid var(--floating-primary, #C2185B);
                    border-radius: 8px;
                    font-size: 0.875rem;
                    background: white;
                    color: var(--floating-on-surface, #4A0E24);
                    cursor: pointer;
                }

                select:focus {
                    outline: 2px solid var(--floating-primary, #C2185B);
                    outline-offset: 2px;
                }

                .slider-row {
                    margin-top: 12px;
                }

                .slider-label {
                    font-size: 0.875rem;
                    color: var(--floating-on-surface, #4A0E24);
                    margin-bottom: 8px;
                    display: block;
                }

                .button-row {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 8px;
                    margin-top: 8px;
                }

                md-divider {
                    margin: 16px 0;
                }
            </style>
            
            <div class="window-container">
                <div class="window-header">
                    <div class="window-title">
                        <md-icon>directions_run</md-icon>
                        <span>Evader Simulation</span>
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
                        <div class="section-title">Motion Model</div>
                        <p class="info-text">
                            The evader moves between random vertices on the medial axis skeleton.
                        </p>
                        
                        <div class="control-group">
                            <label class="control-label" for="motionMode">Motion Type:</label>
                            <select id="motionMode">
                                <option value="holonomic">Holonomic (Direct)</option>
                                <option value="unicycle">Unicycle (Turning)</option>
                            </select>
                        </div>

                        <div class="slider-row">
                            <div class="slider-label">Linear Speed (v_max): <strong><span id="speedValue">1.0 px/frame</span></strong></div>
                            <md-slider id="speedSlider" min="0.5" max="5" value="1" step="0.1" labeled></md-slider>
                        </div>

                        <div class="slider-row angular-speed-row" style="display: none;">
                            <div class="slider-label">Angular Speed (ω_max): <strong><span id="angularSpeedValue">0.15 rad/frame</span></strong></div>
                            <md-slider id="angularSpeedSlider" min="0.05" max="0.5" value="0.15" step="0.01" labeled></md-slider>
                        </div>
                    </div>
                    
                    <md-divider></md-divider>
                    
                    <div class="section">
                        <div class="section-title">Controls</div>
                        <md-filled-button id="startSimulation" class="tool-button">
                            <md-icon slot="icon">play_arrow</md-icon>
                            Start Simulation
                        </md-filled-button>

                        <div class="button-row">
                            <md-outlined-button id="stopSimulation">
                                <md-icon slot="icon">pause</md-icon>
                                Pause
                            </md-outlined-button>
                            <md-outlined-button id="resetSimulation">
                                <md-icon slot="icon">refresh</md-icon>
                                Reset
                            </md-outlined-button>
                        </div>
                    </div>
                    
                    <md-divider></md-divider>
                    
                    <div class="status-message">
                        Ready to start evader simulation
                    </div>
                </div>
            </div>
        `;
    }
}

customElements.define('evader-window', EvaderWindow);
