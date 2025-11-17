/**
 * ToolboxSection Web Component
 * Analysis and advanced tools
 */
import { eventBus } from '../utils/EventBus.js';

export class ToolboxSection extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
        this.render();
        this.setupEventListeners();
    }

    setupEventListeners() {
        const envAnalysisBtn = this.shadowRoot.querySelector('#environmentAnalysis');
        
        envAnalysisBtn?.addEventListener('click', () => {
            console.log('Environment Analysis clicked - functionality to be added');
            eventBus.emit('action:environmentAnalysis');
        });
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
            </style>
            
            <div class="toolbar-section">
                <h3>Toolbox</h3>
                <md-filled-button id="environmentAnalysis" class="tool-button">
                    <md-icon slot="icon">analytics</md-icon>
                    Environment Analysis
                </md-filled-button>
            </div>
        `;
    }
}

customElements.define('toolbox-section', ToolboxSection);
