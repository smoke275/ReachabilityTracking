/**
 * AnalysisWindow Web Component
 * Draggable floating window for environment analysis tools
 */
import { eventBus } from '../utils/EventBus.js';

export class AnalysisWindow extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };
        this.position = { x: 100, y: 100 };
        this.isSkeletonVisible = true;
        this.hasGenerated = false;
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
        const generateBtn = this.shadowRoot.querySelector('#generateStructure');
        const toggleBtn = this.shadowRoot.querySelector('#toggleStructure');
        const reductionSlider = this.shadowRoot.querySelector('#reductionSlider');
        const reductionValue = this.shadowRoot.querySelector('#reductionValue');

        // Dragging functionality
        header.addEventListener('mousedown', (e) => this.startDragging(e));
        document.addEventListener('mousemove', (e) => this.drag(e));
        document.addEventListener('mouseup', () => this.stopDragging());

        // Window controls
        closeBtn?.addEventListener('click', () => this.close());
        minimizeBtn?.addEventListener('click', () => this.minimize());

        // Analysis actions
        generateBtn?.addEventListener('click', () => {
            eventBus.emit('analysis:generateMedialAxis');
            this.updateStatus('Generating medial axis skeleton...');
        });

        // Toggle visibility button
        toggleBtn?.addEventListener('click', () => {
            this.isSkeletonVisible = !this.isSkeletonVisible;
            eventBus.emit('analysis:toggleSkeleton');
            this.updateToggleButton();
        });

        // Live vertex reduction slider
        reductionSlider?.addEventListener('input', (e) => {
            const level = Number(e.target.value) || 0;
            if (reductionValue) reductionValue.textContent = `${level}%`;
            eventBus.emit('analysis:setReductionLevel', level);
        });

        // Listen for analysis results
        eventBus.on('analysis:medialAxisGenerated', (data) => {
            const message = `Generated: ${data.samplePointCount || 0} sample points, ${data.voronoiCellCount || 0} Voronoi cells, ${data.pointCount || 0} skeleton points, ${data.edgeCount || 0} edges`;
            this.updateStatus(message);
            this.hasGenerated = true;
            this.updateToggleButton();
        });

        eventBus.on('analysis:error', (error) => {
            this.updateStatus(`Error: ${error}`, true);
        });

        // Listen for reduction level restoration from loaded/imported data
        eventBus.on('analysis:reductionLevelRestored', (level) => {
            if (reductionSlider) reductionSlider.value = level;
            if (reductionValue) reductionValue.textContent = `${level}%`;
        });
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

    updateToggleButton() {
        const toggleBtn = this.shadowRoot.querySelector('#toggleStructure');
        const toggleIcon = this.shadowRoot.querySelector('#toggleIcon');
        const toggleText = this.shadowRoot.querySelector('#toggleText');
        
        if (toggleBtn && toggleIcon && toggleText) {
            // Show or hide the button based on whether skeleton has been generated
            toggleBtn.style.display = this.hasGenerated ? 'flex' : 'none';
            
            // Update button text and icon based on visibility state
            if (this.isSkeletonVisible) {
                toggleIcon.textContent = 'visibility_off';
                toggleText.textContent = 'Hide Analysis';
            } else {
                toggleIcon.textContent = 'visibility';
                toggleText.textContent = 'Show Analysis';
            }
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
        eventBus.emit('analysis:windowClosed');
    }

    show() {
        console.log('AnalysisWindow.show() called');
        this.setAttribute('visible', '');
        console.log('Visible attribute set');
    }

    render() {
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    position: fixed;
                    z-index: 1000;
                    display: none;
                    pointer-events: none;
                    /* Floating palette overrides */
                    --floating-primary: #0E7490; /* teal */
                    --floating-on-primary: #FFFFFF;
                    --floating-surface: #E0F7F9;
                    --floating-on-surface: #08343B;
                    --floating-on-surface-variant: #2B4C52;
                }

                :host([visible]) {
                    display: block;
                    pointer-events: auto;
                }

                .window-container {
                    position: fixed;
                    background: var(--floating-surface, #E0F7F9);
                    border-radius: 12px;
                    box-shadow: 
                        0px 4px 8px rgba(0, 0, 0, 0.12),
                        0px 8px 16px rgba(0, 0, 0, 0.08);
                    min-width: 320px;
                    max-width: 400px;
                    overflow: hidden;
                }

                .window-header {
                    background: var(--floating-primary, #0E7490);
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
                    color: var(--floating-primary, #0E7490);
                    letter-spacing: 0.5px;
                    margin-bottom: 12px;
                }

                .tool-button {
                    width: 100%;
                    margin-bottom: 8px;
                }

                .status-message {
                    font-size: 0.875rem;
                    color: var(--floating-on-surface-variant, #2B4C52);
                    margin-top: 12px;
                    padding: 12px;
                    background: var(--floating-surface, #E0F7F9);
                    border-radius: 8px;
                    min-height: 44px;
                }

                .info-text {
                    font-size: 0.8rem;
                    color: var(--floating-on-surface-variant, #2B4C52);
                    line-height: 1.4;
                    margin-bottom: 12px;
                }

                md-divider {
                    margin: 16px 0;
                }
            </style>
            
            <div class="window-container">
                <div class="window-header">
                    <div class="window-title">
                        <md-icon>analytics</md-icon>
                        <span>Environment Analysis</span>
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
                        <div class="section-title">Spatial Structure</div>
                        <p class="info-text">
                            Generate the medial axis skeleton of the environment using Voronoi diagrams
                            from polygon edge samples.
                        </p>
                        <md-filled-button id="generateStructure" class="tool-button">
                            <md-icon slot="icon">hub</md-icon>
                            Generate Structure
                        </md-filled-button>

                        <md-outlined-button id="toggleStructure" class="tool-button" style="display: none;">
                            <md-icon slot="icon" id="toggleIcon">visibility_off</md-icon>
                            <span id="toggleText">Hide Analysis</span>
                        </md-outlined-button>

                        <div class="slider-row">
                            <div class="slider-label">Vertex reduction: <strong><span id="reductionValue">0%</span></strong></div>
                            <md-slider id="reductionSlider" min="0" max="100" value="0" step="1" labeled></md-slider>
                        </div>
                    </div>
                    
                    <md-divider></md-divider>
                    
                    <div class="status-message">
                        Ready to generate medial axis skeleton
                    </div>
                </div>
            </div>
        `;
    }
}

customElements.define('analysis-window', AnalysisWindow);
