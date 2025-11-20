/**
 * CustomizeSection Web Component
 * Floating color customization popup
 */
import { eventBus } from '../utils/EventBus.js';

export class CustomizeSection extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.isOpen = false;
        this.popupEl = null;
    }

    connectedCallback() {
        this.render();
        // Wait for Material Web Components to be ready
        customElements.whenDefined('md-outlined-button').then(() => {
            requestAnimationFrame(() => this.setupEventListeners());
        });
    }

    setupEventListeners() {
        const toggleBtn = this.shadowRoot.querySelector('#toggleCustomize');
        console.log('CustomizeSection init, toggleBtn:', toggleBtn);
        if (toggleBtn) {
            toggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                this.togglePopup();
            });
        }

        document.addEventListener('click', (e) => {
            if (!this.isOpen) return;
            const path = e.composedPath();
            if (this.popupEl && !path.includes(this.popupEl) && !path.includes(this)) {
                this.closePopup();
            }
        });
    }

    createPopup() {
        if (this.popupEl) return;
        this.popupEl = document.createElement('div');
        this.popupEl.className = 'customize-popup';
        this.popupEl.innerHTML = `
            <div class="popup-content">
                <h3>Customize Colors</h3>
                <div class="color-picker">
                    <label for="polygonColor">Fill Color</label>
                    <input type="color" id="polygonColor" value="#6750A4">
                </div>
                <div class="color-picker">
                    <label for="strokeColor">Stroke Color</label>
                    <input type="color" id="strokeColor" value="#21005D">
                </div>
            </div>
        `;
        document.body.appendChild(this.popupEl);
        this.applyPopupStyles();

        // Wire inputs
        const fill = this.popupEl.querySelector('#polygonColor');
        const stroke = this.popupEl.querySelector('#strokeColor');
        fill?.addEventListener('change', (e) => eventBus.emit('color:fillChanged', e.target.value));
        stroke?.addEventListener('change', (e) => eventBus.emit('color:strokeChanged', e.target.value));
    }

    applyPopupStyles() {
        const styleId = 'customize-popup-styles';
        if (!document.getElementById(styleId)) {
            const styleTag = document.createElement('style');
            styleTag.id = styleId;
            styleTag.textContent = `
                .customize-popup {
                    position: fixed;
                    z-index: 10000;
                    display: none;
                    background: var(--floating-surface, #E0F7F9);
                    border: 1px solid rgba(8, 52, 59, 0.2);
                    border-radius: 14px;
                    box-shadow: 0 8px 24px rgba(0,0,0,0.25);
                    padding: 1.25rem 1.25rem 1rem;
                    width: 300px;
                }
                .customize-popup h3 {
                    margin: 0 0 0.75rem 0;
                    font-size: 0.75rem;
                    font-weight: 600;
                    letter-spacing: 0.5px;
                    text-transform: uppercase;
                    color: var(--floating-primary, #0E7490);
                }
                .customize-popup .color-picker { margin-bottom: 0.9rem; }
                .customize-popup .color-picker:last-child { margin-bottom: 0; }
                .customize-popup label {
                    display: block; margin-bottom: 0.4rem; font-size: 0.75rem; font-weight: 500;
                    color: var(--floating-on-surface, #08343B);
                }
                .customize-popup input[type=color] {
                    width: 100%; height: 44px; border: 2px solid rgba(14,116,144,0.35);
                    border-radius: 8px; cursor: pointer; background: transparent; transition: border-color .15s, box-shadow .15s;
                }
                .customize-popup input[type=color]:hover { border-color: var(--floating-primary,#0E7490); }
                .customize-popup input[type=color]:focus { outline: none; border-color: var(--floating-primary,#0E7490); box-shadow: 0 0 0 3px rgba(14,116,144,0.25); }
            `;
            document.head.appendChild(styleTag);
        }
    }

    positionPopup() {
        if (!this.popupEl) return;
        const btn = this.shadowRoot.querySelector('#toggleCustomize');
        if (!btn) return;
        const rect = btn.getBoundingClientRect();
        const gap = 8;
        // Prefer placing to left of sidebar; fallback under button if not enough space
        const preferredLeft = rect.left - 300 - gap; // width 300
        let left = preferredLeft > 8 ? preferredLeft : rect.left;
        let top = rect.top;
        // Keep inside viewport
        const viewportHeight = window.innerHeight;
        if (top + 340 > viewportHeight) { // approximate height
            top = Math.max(8, viewportHeight - 340);
        }
        this.popupEl.style.left = left + 'px';
        this.popupEl.style.top = top + 'px';
    }

    togglePopup() {
        if (!this.popupEl) this.createPopup();
        this.isOpen = !this.isOpen;
        if (this.isOpen) {
            this.popupEl.style.display = 'block';
            this.positionPopup();
        } else {
            this.popupEl.style.display = 'none';
        }
    }

    closePopup() {
        if (this.popupEl) this.popupEl.style.display = 'none';
        this.isOpen = false;
    }

    render() {
        this.shadowRoot.innerHTML = `
            <style>
                :host { display:block; }
                .toolbar-section { padding: 1.25rem 1.25rem 1rem; border-bottom: 1px solid var(--md-sys-color-outline-variant,#CAC4D0); }
                .tool-button { width:100%; }
            </style>
            <div class="toolbar-section">
                <md-outlined-button id="toggleCustomize" class="tool-button">
                    <md-icon slot="icon">palette</md-icon>
                    Customize Colors
                </md-outlined-button>
            </div>
        `;
    }
}

customElements.define('customize-section', CustomizeSection);
