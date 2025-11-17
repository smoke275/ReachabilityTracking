/**
 * CanvasToolbar Web Component
 * Displays canvas information and current selection status
 */
import { eventBus } from '../utils/EventBus.js';

export class CanvasToolbar extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.polygonCount = 0;
        this.selectedInfo = 'None selected';
        this.isDrawing = false;
        this.drawingPointCount = 0;
        this.zoomLevel = 100; // Default 100%
    }

    connectedCallback() {
        this.render();
        this.setupEventListeners();
    }

    disconnectedCallback() {
        // Event bus will handle cleanup
    }

    setupEventListeners() {
        eventBus.on('polygon:added', () => this.updatePolygonCount());
        eventBus.on('polygon:deleted', () => this.updatePolygonCount());
        eventBus.on('polygons:cleared', () => this.updatePolygonCount());
        eventBus.on('polygons:imported', () => this.updatePolygonCount());
        
        eventBus.on('polygon:selected', (polygon) => this.updateSelection(polygon));
        eventBus.on('polygon:deselected', () => this.updateSelection(null));
        
        eventBus.on('drawing:started', () => this.updateDrawingMode(true, 0));
        eventBus.on('drawing:pointAdded', (data) => this.updateDrawingMode(true, data.count));
        eventBus.on('drawing:pointRemoved', (data) => this.updateDrawingMode(true, data.count));
        eventBus.on('drawing:completed', () => this.updateDrawingMode(false, 0));
        eventBus.on('drawing:cancelled', () => this.updateDrawingMode(false, 0));
        
        // Listen for camera zoom changes from wheel/other sources
        eventBus.on('camera:zoomChanged', (zoom) => {
            this.zoomLevel = Math.round(zoom * 100);
            const zoomSlider = this.shadowRoot.querySelector('#zoomSlider');
            if (zoomSlider) {
                zoomSlider.value = this.zoomLevel;
            }
            this.updateZoomDisplay();
        });
        
        // Zoom slider listener
        const zoomSlider = this.shadowRoot.querySelector('#zoomSlider');
        zoomSlider?.addEventListener('input', (e) => {
            this.zoomLevel = parseInt(e.target.value);
            this.updateZoomDisplay();
            eventBus.emit('canvas:zoom', this.zoomLevel / 100);
        });
    }

    updatePolygonCount() {
        eventBus.emit('request:polygonCount', (count) => {
            this.polygonCount = count;
            this.updateDisplay();
        });
    }

    updateSelection(polygon) {
        if (polygon) {
            this.selectedInfo = `Selected: ${polygon.vertices.length} vertices`;
        } else {
            this.selectedInfo = 'None selected';
        }
        this.updateDisplay();
    }

    updateDrawingMode(isDrawing, pointCount) {
        this.isDrawing = isDrawing;
        this.drawingPointCount = pointCount;
        
        if (isDrawing) {
            const needed = Math.max(0, 3 - pointCount);
            const status = pointCount >= 3 ? 'Ready' : `Need ${needed} more`;
            this.selectedInfo = `Drawing: ${pointCount} point${pointCount !== 1 ? 's' : ''} (${status})`;
        } else {
            this.selectedInfo = 'None selected';
        }
        this.updateDisplay();
    }

    updateDisplay() {
        const countSpan = this.shadowRoot.querySelector('#polygonCount');
        const infoSpan = this.shadowRoot.querySelector('#selectedInfo');
        
        if (countSpan) {
            countSpan.textContent = `${this.polygonCount} polygon${this.polygonCount !== 1 ? 's' : ''}`;
        }
        if (infoSpan) {
            infoSpan.textContent = this.selectedInfo;
        }
    }

    updateZoomDisplay() {
        const zoomValue = this.shadowRoot.querySelector('#zoomValue');
        if (zoomValue) {
            zoomValue.textContent = `${this.zoomLevel}%`;
        }
    }

    render() {
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: block;
                }
                
                .canvas-toolbar {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 0.75rem 1.5rem;
                    background: var(--md-sys-color-surface-container, #F3EDF7);
                    border-bottom: 1px solid var(--md-sys-color-outline-variant, #CAC4D0);
                    gap: 1.5rem;
                    flex-wrap: wrap;
                }
                
                .canvas-info,
                .canvas-status {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    font-size: 0.875rem;
                    color: var(--md-sys-color-on-surface-variant, #49454F);
                }
                
                md-icon {
                    color: var(--md-sys-color-primary, #6750A4);
                    font-size: 1.25rem;
                }
                
                span {
                    font-weight: 500;
                    color: var(--md-sys-color-on-surface, #1D1B20);
                }

                .zoom-control {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                }

                .zoom-slider-wrapper {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }

                md-slider {
                    width: 120px;
                    --md-slider-handle-color: var(--md-sys-color-primary, #6750A4);
                    --md-slider-active-track-color: var(--md-sys-color-primary, #6750A4);
                    --md-slider-inactive-track-color: var(--md-sys-color-outline-variant, #CAC4D0);
                }

                .zoom-value {
                    min-width: 40px;
                    text-align: right;
                    font-size: 0.875rem;
                    font-weight: 500;
                    color: var(--md-sys-color-on-surface, #1D1B20);
                }
            </style>
            
            <div class="canvas-toolbar">
                <div class="canvas-info">
                    <md-icon>shapes</md-icon>
                    <span id="polygonCount">${this.polygonCount} polygons</span>
                </div>
                <div class="zoom-control">
                    <md-icon>zoom_in</md-icon>
                    <div class="zoom-slider-wrapper">
                        <md-slider 
                            id="zoomSlider"
                            min="25"
                            max="200"
                            value="${this.zoomLevel}"
                            step="5"
                            labeled>
                        </md-slider>
                        <span id="zoomValue" class="zoom-value">${this.zoomLevel}%</span>
                    </div>
                </div>
                <div class="canvas-status">
                    <md-icon>touch_app</md-icon>
                    <span id="selectedInfo">${this.selectedInfo}</span>
                </div>
            </div>
        `;
    }
}

customElements.define('canvas-toolbar', CanvasToolbar);
