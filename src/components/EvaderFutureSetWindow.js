/**
 * EvaderFutureSetWindow Web Component
 * Draggable floating window for evader future set computation
 */
import { eventBus } from '../utils/EventBus.js';

export class EvaderFutureSetWindow extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };
        this.position = { x: 140, y: 140 };
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
        const computeBtn = this.shadowRoot.querySelector('#computeFutureSet');
        const clearBtn = this.shadowRoot.querySelector('#clearFutureSet');
        const timeHorizonSlider = this.shadowRoot.querySelector('#timeHorizonSlider');
        const timeHorizonValue = this.shadowRoot.querySelector('#timeHorizonValue');
        const speedSlider = this.shadowRoot.querySelector('#intruderSpeedSlider');
        const speedValue = this.shadowRoot.querySelector('#intruderSpeedValue');
        const angularSpeedSlider = this.shadowRoot.querySelector('#intruderAngularSpeedSlider');
        const angularSpeedValue = this.shadowRoot.querySelector('#intruderAngularSpeedValue');

        // Dragging functionality
        header.addEventListener('mousedown', (e) => this.startDragging(e));
        document.addEventListener('mousemove', (e) => this.drag(e));
        document.addEventListener('mouseup', () => this.stopDragging());

        // Window controls
        closeBtn?.addEventListener('click', () => this.close());
        minimizeBtn?.addEventListener('click', () => this.minimize());

        // Future set controls
        computeBtn?.addEventListener('click', () => {
            const timeHorizon = Number(timeHorizonSlider?.value) || 100;
            eventBus.emit('evaderFutureSet:compute', { timeHorizon });
            this.updateStatus('Computing evader future set...', false);
        });

        clearBtn?.addEventListener('click', () => {
            eventBus.emit('evaderFutureSet:clear');
            this.updateStatus('Future set cleared.', false);
        });

        // Time horizon control
        timeHorizonSlider?.addEventListener('input', (e) => {
            const timeHorizon = Number(e.target.value) || 100;
            if (timeHorizonValue) timeHorizonValue.textContent = `${timeHorizon} frames`;
        });

        // Speed controls
        speedSlider?.addEventListener('input', (e) => {
            const speed = Number(e.target.value) || 5.0;
            if (speedValue) speedValue.textContent = `${speed.toFixed(1)} px/frame`;
            eventBus.emit('intruder:setSpeed', speed);
        });

        angularSpeedSlider?.addEventListener('input', (e) => {
            const omega = Number(e.target.value) || 0.2;
            if (angularSpeedValue) angularSpeedValue.textContent = `${omega.toFixed(2)} rad/frame`;
            eventBus.emit('intruder:setAngularSpeed', omega);
        });

        // Listen for future set events
        eventBus.on('evaderFutureSet:computed', (data) => {
            this.updateStatus(
                `Future set computed: ${data.count} positions (${data.computationTime.toFixed(1)}ms, ${data.expansions} expansions)`,
                false
            );
        });

        eventBus.on('evaderFutureSet:cleared', () => {
            this.updateStatus('Future set cleared', false);
        });

        eventBus.on('evaderFutureSet:error', (data) => {
            this.updateStatus(`Error: ${data.message}`, true);
        });
    }

    startDragging(e) {
        if (e.target.closest('.close-btn') || e.target.closest('.minimize-btn')) {
            return;
        }
        this.isDragging = true;
        this.dragOffset.x = e.clientX - this.position.x;
        this.dragOffset.y = e.clientY - this.position.y;
        this.shadowRoot.querySelector('.window').style.cursor = 'grabbing';
    }

    drag(e) {
        if (!this.isDragging) return;
        this.position.x = e.clientX - this.dragOffset.x;
        this.position.y = e.clientY - this.dragOffset.y;
        this.updatePosition();
    }

    stopDragging() {
        this.isDragging = false;
        const window = this.shadowRoot.querySelector('.window');
        if (window) {
            window.style.cursor = 'default';
        }
    }

    updatePosition() {
        const window = this.shadowRoot.querySelector('.window');
        if (window) {
            window.style.left = `${this.position.x}px`;
            window.style.top = `${this.position.y}px`;
        }
    }

    close() {
        this.style.display = 'none';
        eventBus.emit('evaderFutureSet:windowClosed');
    }

    show() {
        this.style.display = 'block';
        this.setAttribute('visible', '');
    }

    minimize() {
        const content = this.shadowRoot.querySelector('.window-content');
        if (content.style.display === 'none') {
            content.style.display = 'block';
        } else {
            content.style.display = 'none';
        }
    }

    updateStatus(message, isError = false) {
        const statusEl = this.shadowRoot.querySelector('#statusMessage');
        if (statusEl) {
            statusEl.textContent = message;
            statusEl.style.color = isError ? 'var(--md-sys-color-error, #BA1A1A)' : 'var(--md-sys-color-on-surface-variant, #49454F)';
        }
    }

    render() {
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: none;
                    position: fixed;
                    z-index: 1001;
                }

                :host([visible]) {
                    display: block;
                }

                .window {
                    position: fixed;
                    background: var(--md-sys-color-surface, #FFFBFE);
                    border: 1px solid var(--md-sys-color-outline-variant, #CAC4D0);
                    border-radius: 12px;
                    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
                    min-width: 320px;
                    max-width: 400px;
                    overflow: hidden;
                }

                .window-header {
                    background: var(--md-sys-color-primary-container, #EADDFF);
                    color: var(--md-sys-color-on-primary-container, #21005D);
                    padding: 1rem;
                    cursor: grab;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    user-select: none;
                }

                .window-header:active {
                    cursor: grabbing;
                }

                .header-title {
                    font-size: 1rem;
                    font-weight: 600;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }

                .header-controls {
                    display: flex;
                    gap: 0.25rem;
                }

                .header-btn {
                    background: transparent;
                    border: none;
                    color: inherit;
                    cursor: pointer;
                    padding: 0.25rem;
                    border-radius: 4px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: background-color 0.2s;
                }

                .header-btn:hover {
                    background: rgba(0, 0, 0, 0.1);
                }

                .window-content {
                    padding: 1rem;
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

                .control-group {
                    margin-bottom: 1.5rem;
                }

                .control-group:last-child {
                    margin-bottom: 0;
                }

                .control-label {
                    display: block;
                    font-size: 0.875rem;
                    font-weight: 600;
                    color: var(--md-sys-color-on-surface, #1C1B1F);
                    margin-bottom: 0.5rem;
                }

                .slider-row {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                }

                md-slider {
                    flex: 1;
                }

                .slider-value {
                    font-size: 0.875rem;
                    color: var(--md-sys-color-on-surface-variant, #49454F);
                    min-width: 100px;
                    text-align: right;
                }

                .button-group {
                    display: flex;
                    gap: 0.5rem;
                    margin-top: 1rem;
                }

                md-filled-button,
                md-outlined-button {
                    flex: 1;
                }

                .status-message {
                    margin-top: 1rem;
                    padding: 0.75rem;
                    background: var(--md-sys-color-surface-variant, #E7E0EC);
                    border-radius: 8px;
                    font-size: 0.875rem;
                    color: var(--md-sys-color-on-surface-variant, #49454F);
                    min-height: 3rem;
                    display: flex;
                    align-items: center;
                }

                .info-box {
                    background: var(--md-sys-color-tertiary-container, #FFD8E4);
                    color: var(--md-sys-color-on-tertiary-container, #31111D);
                    padding: 0.75rem;
                    border-radius: 8px;
                    font-size: 0.75rem;
                    margin-bottom: 1rem;
                }
            </style>

            <div class="window">
                <div class="window-header">
                    <div class="header-title">
                        <md-icon>timeline</md-icon>
                        Evader Future Set
                    </div>
                    <div class="header-controls">
                        <button class="header-btn minimize-btn" title="Minimize">
                            <md-icon>minimize</md-icon>
                        </button>
                        <button class="header-btn close-btn" title="Close">
                            <md-icon>close</md-icon>
                        </button>
                    </div>
                </div>
                
                <div class="window-content">
                    <div class="info-box">
                        ℹ️ <strong>Intruder Control:</strong><br>
                        • Ctrl+Click on canvas to place intruder<br>
                        • Arrow keys: Move intruder (↑↓←→)<br>
                        • Computes reachable set from intruder position
                    </div>

                    <div class="control-group">
                        <label class="control-label">Time Horizon</label>
                        <div class="slider-row">
                            <md-slider 
                                id="timeHorizonSlider" 
                                min="10" 
                                max="500" 
                                value="100" 
                                step="10">
                            </md-slider>
                            <span class="slider-value" id="timeHorizonValue">100 frames</span>
                        </div>
                    </div>

                    <div class="control-group">
                        <label class="control-label">Intruder Max Speed</label>
                        <div class="slider-row">
                            <md-slider 
                                id="intruderSpeedSlider" 
                                min="1" 
                                max="20" 
                                value="5" 
                                step="0.5">
                            </md-slider>
                            <span class="slider-value" id="intruderSpeedValue">5.0 px/frame</span>
                        </div>
                    </div>

                    <div class="control-group">
                        <label class="control-label">Intruder Turn Rate</label>
                        <div class="slider-row">
                            <md-slider 
                                id="intruderAngularSpeedSlider" 
                                min="0.05" 
                                max="0.5" 
                                value="0.2" 
                                step="0.01">
                            </md-slider>
                            <span class="slider-value" id="intruderAngularSpeedValue">0.20 rad/frame</span>
                        </div>
                    </div>

                    <div class="button-group">
                        <md-filled-button id="computeFutureSet">
                            <md-icon slot="icon">calculate</md-icon>
                            Compute
                        </md-filled-button>
                        <md-outlined-button id="clearFutureSet">
                            <md-icon slot="icon">clear</md-icon>
                            Clear
                        </md-outlined-button>
                    </div>

                    <div class="status-message" id="statusMessage">
                        Ready to compute future set.
                    </div>
                </div>
            </div>
        `;
    }
}

customElements.define('evader-future-set-window', EvaderFutureSetWindow);
