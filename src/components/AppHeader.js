/**
 * AppHeader Web Component
 * Displays the application header with logo and tagline
 */
export class AppHeader extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
        this.render();
    }

    render() {
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: block;
                }
                
                .app-header {
                    background: linear-gradient(135deg, var(--md-sys-color-primary, #6750A4) 0%, #7C4DFF 100%);
                    color: var(--md-sys-color-on-primary, white);
                    padding: 1rem 2rem;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                }
                
                .header-content {
                    max-width: 1400px;
                    margin: 0 auto;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                }
                
                .logo {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                }
                
                md-icon {
                    font-size: 2rem;
                    color: var(--md-sys-color-on-primary, white);
                    --md-icon-size: 2rem;
                }
                
                .title-group {
                    display: flex;
                    flex-direction: column;
                }
                
                h1 {
                    margin: 0;
                    font-size: 1.5rem;
                    font-weight: 500;
                    line-height: 1.2;
                }
                
                .tagline {
                    margin: 0;
                    opacity: 0.9;
                    font-size: 0.875rem;
                    font-weight: 300;
                }
            </style>
            
            <header class="app-header">
                <div class="header-content">
                    <div class="logo">
                        <md-icon>explore</md-icon>
                        <div class="title-group">
                            <h1>Reachability Tracking</h1>
                            <p class="tagline">Visualize and analyze spatial reachability</p>
                        </div>
                    </div>
                </div>
            </header>
        `;
    }
}

customElements.define('app-header', AppHeader);
