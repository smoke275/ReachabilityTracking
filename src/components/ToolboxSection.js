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
        const evaderSimBtn = this.shadowRoot.querySelector('#evaderSimulation');
        const agentsBtn = this.shadowRoot.querySelector('#agents');
        const evaderFutureSetBtn = this.shadowRoot.querySelector('#evaderFutureSet');
        const visibilityAnalysisBtn = this.shadowRoot.querySelector('#visibilityAnalysis');
        const rrtTrackingBtn = this.shadowRoot.querySelector('#rrtTracking');
        const activeTrackingBtn = this.shadowRoot.querySelector('#activeTracking');
        const realTimeTrackingBtn = this.shadowRoot.querySelector('#realTimeTracking');
        const visibilnetTrainingBtn = this.shadowRoot.querySelector('#visibilnetTraining');
        const kilovisinetTrainingBtn = this.shadowRoot.querySelector('#kilovisinetTraining');
        const similarityCalculatorBtn = this.shadowRoot.querySelector('#similarityCalculator');
        const siminetTrainingBtn = this.shadowRoot.querySelector('#siminetTraining');
        
        envAnalysisBtn?.addEventListener('click', () => {
            console.log('Environment Analysis button clicked');
            eventBus.emit('action:environmentAnalysis');
            console.log('Event emitted: action:environmentAnalysis');
        });

        evaderSimBtn?.addEventListener('click', () => {
            console.log('Evader Simulation button clicked');
            eventBus.emit('action:evaderSimulation');
            console.log('Event emitted: action:evaderSimulation');
        });

        agentsBtn?.addEventListener('click', () => {
            console.log('Agents button clicked');
            eventBus.emit('action:agents');
            console.log('Event emitted: action:agents');
        });

        evaderFutureSetBtn?.addEventListener('click', () => {
            console.log('Evader Future Set button clicked');
            eventBus.emit('action:evaderFutureSet');
            console.log('Event emitted: action:evaderFutureSet');
        });
        
        visibilityAnalysisBtn?.addEventListener('click', () => {
            console.log('Visibility Analysis button clicked');
            eventBus.emit('action:visibilityAnalysis');
            console.log('Event emitted: action:visibilityAnalysis');
        });

        rrtTrackingBtn?.addEventListener('click', () => {
            console.log('RRT-Based Tracking button clicked');
            eventBus.emit('action:rrtTracking');
            console.log('Event emitted: action:rrtTracking');
        });

        activeTrackingBtn?.addEventListener('click', () => {
            console.log('Active Tracking button clicked');
            eventBus.emit('action:activeTracking');
            console.log('Event emitted: action:activeTracking');
        });

        realTimeTrackingBtn?.addEventListener('click', () => {
            console.log('Real-Time Tracking button clicked');
            eventBus.emit('action:realTimeTracking');
            console.log('Event emitted: action:realTimeTracking');
        });

        visibilnetTrainingBtn?.addEventListener('click', () => {
            console.log('VisibilNet Training button clicked');
            eventBus.emit('action:visibilnetTraining');
            console.log('Event emitted: action:visibilnetTraining');
        });

        kilovisinetTrainingBtn?.addEventListener('click', () => {
            console.log('KiloVisiNet Training button clicked');
            eventBus.emit('action:kilovisinetTraining');
            console.log('Event emitted: action:kilovisinetTraining');
        });

        similarityCalculatorBtn?.addEventListener('click', () => {
            console.log('Similarity Calculator button clicked');
            eventBus.emit('action:similarityCalculator');
            console.log('Event emitted: action:similarityCalculator');
        });

        siminetTrainingBtn?.addEventListener('click', () => {
            console.log('SimiNet Training button clicked');
            eventBus.emit('action:siminetTraining');
            console.log('Event emitted: action:siminetTraining');
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
                
                <md-filled-button id="evaderSimulation" class="tool-button">
                    <md-icon slot="icon">directions_run</md-icon>
                    Evader Simulation
                </md-filled-button>
                
                <md-filled-button id="agents" class="tool-button">
                    <md-icon slot="icon">group</md-icon>
                    Agents
                </md-filled-button>
                
                <md-filled-button id="evaderFutureSet" class="tool-button">
                    <md-icon slot="icon">timeline</md-icon>
                    Evader Future Set
                </md-filled-button>

                <md-filled-button id="visibilityAnalysis" class="tool-button">
                    <md-icon slot="icon">visibility</md-icon>
                    Visibility Analysis
                </md-filled-button>

                <md-filled-button id="rrtTracking" class="tool-button">
                    <md-icon slot="icon">account_tree</md-icon>
                    RRT-Based Tracking
                </md-filled-button>

                <md-filled-button id="activeTracking" class="tool-button">
                    <md-icon slot="icon">track_changes</md-icon>
                    Active Tracking
                </md-filled-button>
                
                <md-filled-button id="realTimeTracking" class="tool-button">
                    <md-icon slot="icon">play_circle</md-icon>
                    Real-Time Tracking
                </md-filled-button>
                
                <md-filled-button id="visibilnetTraining" class="tool-button">
                    <md-icon slot="icon">school</md-icon>
                    VisibilNet Training
                </md-filled-button>
                
                <md-filled-button id="kilovisinetTraining" class="tool-button">
                    <md-icon slot="icon">grid_4x4</md-icon>
                    Kilo VisiNet Training
                </md-filled-button>
                
                <md-filled-button id="similarityCalculator" class="tool-button">
                    <md-icon slot="icon">compare</md-icon>
                    Similarity Calculator
                </md-filled-button>

                <md-filled-button id="siminetTraining" class="tool-button">
                    <md-icon slot="icon">model_training</md-icon>
                    SimiNet Training
                </md-filled-button>
            </div>
        `;
    }
}

customElements.define('toolbox-section', ToolboxSection);
