/**
 * StatsSection Web Component
 * Quick statistics display
 */
import { eventBus } from '../utils/EventBus.js';

export class StatsSection extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.totalPolygons = 0;
        this.totalVertices = 0;
    }

    connectedCallback() {
        this.render();
        this.setupEventListeners();
    }

    setupEventListeners() {
        eventBus.on('polygon:added', () => this.updateStats());
        eventBus.on('polygon:deleted', () => this.updateStats());
        eventBus.on('polygons:cleared', () => this.updateStats());
        eventBus.on('polygons:imported', () => this.updateStats());
        eventBus.on('drawing:completed', () => this.updateStats());
    }

    updateStats() {
        // Request current stats from controller
        eventBus.emit('request:stats', (stats) => {
            this.totalPolygons = stats.polygonCount;
            this.totalVertices = stats.totalVertices;
            this.updateDisplay();
        });
    }

    updateDisplay() {
        const polygonsSpan = this.shadowRoot.querySelector('#totalPolygons');
        const verticesSpan = this.shadowRoot.querySelector('#totalVertices');
        
        if (polygonsSpan) polygonsSpan.textContent = this.totalPolygons;
        if (verticesSpan) verticesSpan.textContent = this.totalVertices;
    }

    render() {
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: block;
                }
                
                .toolbar-section {
                    padding: 1.5rem;
                    background: linear-gradient(135deg, var(--md-sys-color-primary-container, #EADDFF) 0%, var(--md-sys-color-secondary-container, #E8DEF8) 100%);
                }
                
                h3 {
                    margin: 0 0 1rem 0;
                    font-size: 0.875rem;
                    font-weight: 600;
                    text-transform: uppercase;
                    color: var(--md-sys-color-primary, #6750A4);
                    letter-spacing: 0.5px;
                }
                
                .stat-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 1rem;
                }
                
                .stat-item {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    padding: 1rem;
                    background: var(--md-sys-color-surface, white);
                    border-radius: 12px;
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
                    transition: transform 0.2s ease;
                }
                
                .stat-item:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
                }
                
                .stat-value {
                    font-size: 2rem;
                    font-weight: 700;
                    color: var(--md-sys-color-primary, #6750A4);
                    line-height: 1;
                    margin-bottom: 0.25rem;
                }
                
                .stat-label {
                    font-size: 0.75rem;
                    color: var(--md-sys-color-on-surface-variant, #49454F);
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    font-weight: 500;
                }
            </style>
            
            <div class="toolbar-section info-section">
                <h3>Quick Stats</h3>
                <div class="stat-grid">
                    <div class="stat-item">
                        <span class="stat-value" id="totalPolygons">0</span>
                        <span class="stat-label">Total</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value" id="totalVertices">0</span>
                        <span class="stat-label">Vertices</span>
                    </div>
                </div>
            </div>
        `;
    }
}

customElements.define('stats-section', StatsSection);
