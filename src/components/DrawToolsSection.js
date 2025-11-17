/**
 * DrawToolsSection Web Component
 * Drawing tools for creating polygons
 */
import { eventBus } from '../utils/EventBus.js';

export class DrawToolsSection extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.isDrawing = false;
        this.canComplete = false;
    }

    connectedCallback() {
        this.render();
        this.setupEventListeners();
    }

    setupEventListeners() {
        const startBtn = this.shadowRoot.querySelector('#startDrawing');
        const completeBtn = this.shadowRoot.querySelector('#completePolygon');
        const cancelBtn = this.shadowRoot.querySelector('#cancelDrawing');

        startBtn?.addEventListener('click', () => eventBus.emit('action:startDrawing'));
        completeBtn?.addEventListener('click', () => eventBus.emit('action:completePolygon'));
        cancelBtn?.addEventListener('click', () => eventBus.emit('action:cancelDrawing'));

        // Listen to drawing state changes
        eventBus.on('drawing:started', () => this.updateDrawingState(true, false));
        eventBus.on('drawing:pointAdded', (data) => this.updateDrawingState(true, data.count >= 3));
        eventBus.on('drawing:pointRemoved', (data) => this.updateDrawingState(true, data.count >= 3));
        eventBus.on('drawing:completed', () => this.updateDrawingState(false, false));
        eventBus.on('drawing:cancelled', () => this.updateDrawingState(false, false));
    }

    updateDrawingState(isDrawing, canComplete) {
        this.isDrawing = isDrawing;
        this.canComplete = canComplete;
        
        const startBtn = this.shadowRoot.querySelector('#startDrawing');
        const completeBtn = this.shadowRoot.querySelector('#completePolygon');
        const cancelBtn = this.shadowRoot.querySelector('#cancelDrawing');
        
        if (startBtn) startBtn.disabled = isDrawing;
        if (completeBtn) completeBtn.disabled = !isDrawing || !canComplete;
        if (cancelBtn) cancelBtn.disabled = !isDrawing;
    }

    render() {
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: block;
                }
                
                .toolbar-section {
                    padding: 1.5rem;
                    border-bottom: 1px solid var(--md-sys-color-outline-variant, #CAC4D0);
                }
                
                h3 {
                    margin: 0 0 1rem 0;
                    font-size: 0.875rem;
                    font-weight: 600;
                    text-transform: uppercase;
                    color: var(--md-sys-color-primary, #6750A4);
                    letter-spacing: 0.5px;
                }
                
                .tool-button {
                    width: 100%;
                    margin-bottom: 0.5rem;
                }
                
                .divider {
                    height: 1px;
                    background: var(--md-sys-color-outline-variant, #CAC4D0);
                    margin: 1rem 0;
                }
            </style>
            
            <div class="toolbar-section">
                <h3>Draw Tools</h3>
                <md-filled-button id="startDrawing" class="tool-button">
                    <md-icon slot="icon">draw</md-icon>
                    Draw from Points
                </md-filled-button>
                
                <md-filled-tonal-button id="completePolygon" class="tool-button" disabled>
                    <md-icon slot="icon">check_circle</md-icon>
                    Complete Polygon
                </md-filled-tonal-button>
                
                <md-outlined-button id="cancelDrawing" class="tool-button" disabled>
                    <md-icon slot="icon">cancel</md-icon>
                    Cancel Drawing
                </md-outlined-button>
            </div>
        `;
    }
}

customElements.define('draw-tools-section', DrawToolsSection);
