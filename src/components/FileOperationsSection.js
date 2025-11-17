/**
 * FileOperationsSection Web Component
 * File save, load, and export controls
 */
import { eventBus } from '../utils/EventBus.js';

export class FileOperationsSection extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
        this.render();
        this.setupEventListeners();
    }

    setupEventListeners() {
        const saveBtn = this.shadowRoot.querySelector('#savePolygons');
        const loadBtn = this.shadowRoot.querySelector('#loadPolygons');
        const importBtn = this.shadowRoot.querySelector('#importJSON');
        const exportBtn = this.shadowRoot.querySelector('#exportJSON');
        const fileInput = this.shadowRoot.querySelector('#fileInput');

        saveBtn?.addEventListener('click', () => eventBus.emit('action:save'));
        loadBtn?.addEventListener('click', () => eventBus.emit('action:load'));
        importBtn?.addEventListener('click', () => fileInput.click());
        exportBtn?.addEventListener('click', () => eventBus.emit('action:export'));
        
        fileInput?.addEventListener('change', (e) => {
            if (e.target.files[0]) {
                eventBus.emit('action:import', e.target.files[0]);
                e.target.value = ''; // Reset input
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
                
                input[type="file"] {
                    display: none;
                }
            </style>
            
            <div class="toolbar-section">
                <h3>File Operations</h3>
                <md-filled-tonal-button id="savePolygons" class="tool-button">
                    <md-icon slot="icon">save</md-icon>
                    Save
                </md-filled-tonal-button>
                
                <md-filled-tonal-button id="loadPolygons" class="tool-button">
                    <md-icon slot="icon">folder_open</md-icon>
                    Load
                </md-filled-tonal-button>
                
                <md-outlined-button id="importJSON" class="tool-button">
                    <md-icon slot="icon">upload</md-icon>
                    Import JSON
                </md-outlined-button>
                
                <md-outlined-button id="exportJSON" class="tool-button">
                    <md-icon slot="icon">download</md-icon>
                    Export JSON
                </md-outlined-button>
                
                <input type="file" id="fileInput" accept=".json">
            </div>
        `;
    }
}

customElements.define('file-operations-section', FileOperationsSection);
