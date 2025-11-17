/**
 * ActionsSection Web Component
 * Delete and clear actions
 */
import { eventBus } from '../utils/EventBus.js';

export class ActionsSection extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
        this.render();
        this.setupEventListeners();
    }

    setupEventListeners() {
        const deleteBtn = this.shadowRoot.querySelector('#deleteSelected');
        const clearBtn = this.shadowRoot.querySelector('#clearCanvas');

        deleteBtn?.addEventListener('click', () => eventBus.emit('action:deleteSelected'));
        clearBtn?.addEventListener('click', () => {
            if (confirm('Are you sure you want to clear all polygons?')) {
                eventBus.emit('action:clearAll');
            }
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
                <h3>Actions</h3>
                <md-outlined-button id="deleteSelected" class="tool-button">
                    <md-icon slot="icon">delete</md-icon>
                    Delete Selected
                </md-outlined-button>
                
                <md-filled-tonal-button id="clearCanvas" class="tool-button">
                    <md-icon slot="icon">delete_sweep</md-icon>
                    Clear All
                </md-filled-tonal-button>
            </div>
        `;
    }
}

customElements.define('actions-section', ActionsSection);
