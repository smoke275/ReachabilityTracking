/**
 * PolygonCanvas Web Component
 * Wraps the canvas element and manages its lifecycle
 */
export class PolygonCanvasComponent extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
        this.render();
    }

    getCanvas() {
        return this.shadowRoot.querySelector('canvas');
    }

    render() {
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: block;
                    flex: 1;
                }
                
                .canvas-container {
                    padding: 1rem;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    background: #FAFAFA;
                    min-height: 400px;
                    height: 100%;
                }
                
                canvas {
                    border: 2px solid #E0E0E0;
                    border-radius: 8px;
                    background: white;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                    cursor: grab;
                }
                
                canvas:active {
                    cursor: grabbing;
                }
                
                canvas.drawing-mode {
                    cursor: crosshair;
                    border-color: #6750A4;
                }
            </style>
            
            <div class="canvas-container">
                <canvas id="polygonCanvas"></canvas>
            </div>
        `;
    }
}

customElements.define('polygon-canvas', PolygonCanvasComponent);
