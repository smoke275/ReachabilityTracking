/**
 * VisibilityWindow Web Component
 * Floating window to control visibility analysis
 */
import { eventBus } from '../utils/EventBus.js';

export class VisibilityWindow extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };
        this.position = { x: 120, y: 120 };
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
        const placeStartBtn = this.shadowRoot.querySelector('#placeStart');
        const placeEndBtn = this.shadowRoot.querySelector('#placeEnd');
        const clearBtn = this.shadowRoot.querySelector('#clearVisibility');
        const toggleBtn = this.shadowRoot.querySelector('#toggleLive');
        const diffBtn = this.shadowRoot.querySelector('#toggleDifference');
        const rayFilterBtn = this.shadowRoot.querySelector('#toggleRayFilter');
        
        header.addEventListener('mousedown', (e) => this.startDragging(e));
        document.addEventListener('mousemove', (e) => this.drag(e));
        document.addEventListener('mouseup', () => this.stopDragging());

        closeBtn?.addEventListener('click', () => this.close());
        minimizeBtn?.addEventListener('click', () => this.minimize());

        placeStartBtn?.addEventListener('click', () => {
            eventBus.emit('visibility:setPlacementMode', 'start');
        });
        placeEndBtn?.addEventListener('click', () => {
            eventBus.emit('visibility:setPlacementMode', 'end');
        });
        clearBtn?.addEventListener('click', () => {
            eventBus.emit('visibility:clear');
        });
        toggleBtn?.addEventListener('click', () => {
            eventBus.emit('visibility:toggleLive');
        });
        diffBtn?.addEventListener('click', () => {
            const isDiffActive = diffBtn.hasAttribute('selected');
            if (isDiffActive) {
                diffBtn.removeAttribute('selected');
            } else {
                diffBtn.setAttribute('selected', '');
            }
            eventBus.emit('visibility:toggleDifference', !isDiffActive);
        });
        rayFilterBtn?.addEventListener('click', () => {
            const isRayFilterActive = rayFilterBtn.hasAttribute('selected');
            if (isRayFilterActive) {
                rayFilterBtn.removeAttribute('selected');
            } else {
                rayFilterBtn.setAttribute('selected', '');
            }
            eventBus.emit('visibility:toggleRayFilter', !isRayFilterActive);
        });
    }

    startDragging(e) {
        if (e.target.closest('.close-btn') || e.target.closest('.minimize-btn')) return;
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

    close() {
        this.removeAttribute('visible');
        eventBus.emit('visibility:windowClosed');
    }

    minimize() {
        const content = this.shadowRoot.querySelector('.window-content');
        const container = this.shadowRoot.querySelector('.window-container');
        const icon = this.shadowRoot.querySelector('.minimize-btn md-icon');
        if (content.style.display === 'none') {
            content.style.display = 'block';
            container.style.height = 'auto';
            icon.textContent = 'remove';
        } else {
            content.style.display = 'none';
            container.style.height = 'auto';
            icon.textContent = 'add';
        }
    }

    show() {
        this.setAttribute('visible', '');
    }

    render() {
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    position: fixed;
                    z-index: 1000;
                    display: none;
                    pointer-events: none;
                }
                :host([visible]) { display: block; pointer-events: auto; }
                .window-container {
                    position: fixed;
                    background: var(--floating-surface, #EEF7FF);
                    color: var(--floating-on-surface, #06304b);
                    border-radius: 12px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.12);
                    min-width: 300px;
                    max-width: 360px;
                    overflow: hidden;
                }
                .window-header {
                    background: var(--floating-primary, #1565C0);
                    color: white;
                    padding: 12px 16px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    cursor: grab;
                    user-select: none;
                }
                .window-title { display:flex; align-items:center; gap:8px; font-weight:500; }
                .window-controls { display:flex; gap:4px; }
                .control-btn { background: transparent; border: none; color: white; cursor: pointer; padding: 4px; border-radius: 50%; width: 32px; height: 32px; display:flex; align-items:center; justify-content:center; }
                .window-content { 
                    padding: 16px; 
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
                .tool-button { width: 100%; margin-bottom: 8px; }
                .tool-button[selected] { 
                    background: var(--floating-primary, #1565C0); 
                    color: white; 
                }
                .hint { font-size: 0.85rem; opacity: 0.8; }
            </style>
            <div class="window-container">
                <div class="window-header">
                    <div class="window-title">
                        <md-icon>visibility</md-icon>
                        <span>Visibility Analysis</span>
                    </div>
                    <div class="window-controls">
                        <button class="control-btn minimize-btn" title="Minimize"><md-icon>remove</md-icon></button>
                        <button class="control-btn close-btn" title="Close"><md-icon>close</md-icon></button>
                    </div>
                </div>
                <div class="window-content">
                    <md-filled-button id="placeStart" class="tool-button">
                        <md-icon slot="icon">adjust</md-icon>
                        Place/Move Start Point
                    </md-filled-button>
                    <md-filled-button id="placeEnd" class="tool-button">
                        <md-icon slot="icon">my_location</md-icon>
                        Place/Move End Point
                    </md-filled-button>
                    <md-filled-tonal-button id="toggleDifference" class="tool-button">
                        <md-icon slot="icon">difference</md-icon>
                        Show Difference
                    </md-filled-tonal-button>
                    <md-filled-tonal-button id="toggleRayFilter" class="tool-button">
                        <md-icon slot="icon">flare</md-icon>
                        Ray Filter (Closest)
                    </md-filled-tonal-button>
                    <md-outlined-button id="clearVisibility" class="tool-button">
                        <md-icon slot="icon">clear</md-icon>
                        Clear
                    </md-outlined-button>
                    <div class="hint">Tip: drag the points on canvas to auto-recalculate visibility polygons.</div>
                </div>
            </div>
        `;
    }
}

customElements.define('visibility-window', VisibilityWindow);
