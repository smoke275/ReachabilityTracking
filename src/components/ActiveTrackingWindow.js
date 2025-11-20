/**
 * ActiveTrackingWindow Web Component
 * Draggable floating window for active tracking visualization and controls
 */
import { eventBus } from '../utils/EventBus.js';
import { activeTrackingService } from '../services/ActiveTrackingService.js';

export class ActiveTrackingWindow extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };
        this.position = { x: 100, y: 100 };
        this.stats = null;
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
        const computeBtn = this.shadowRoot.querySelector('#computeVisibilityBtn');
        const queryNeBtn = this.shadowRoot.querySelector('#queryNonVisibleBtn');
        const queryNpBtn = this.shadowRoot.querySelector('#queryTrackingBtn');
        const exportBtn = this.shadowRoot.querySelector('#exportVisibilityBtn');
        const solveStrategiesBtn = this.shadowRoot.querySelector('#solve-strategies');
        const strategySelector = this.shadowRoot.querySelector('#strategy-selector');

        // Dragging functionality
        header.addEventListener('mousedown', (e) => this.startDragging(e));
        document.addEventListener('mousemove', (e) => this.drag(e));
        document.addEventListener('mouseup', () => this.stopDragging());

        // Window controls
        closeBtn?.addEventListener('click', () => this.close());
        minimizeBtn?.addEventListener('click', () => this.minimize());

        // Compute visibility
        computeBtn?.addEventListener('click', () => this.computeVisibility());

        // Query buttons
        queryNeBtn?.addEventListener('click', () => this.queryNonVisible());
        queryNpBtn?.addEventListener('click', () => this.queryTracking());

        // Export button
        exportBtn?.addEventListener('click', () => this.exportData());

        // Solve strategies
        solveStrategiesBtn?.addEventListener('click', () => this.solveStrategies());
        strategySelector?.addEventListener('change', () => this.visualizeStrategy());

        // Visualization options
        const showVisLines = this.shadowRoot.querySelector('#showVisibilityLines');
        showVisLines?.addEventListener('change', (e) => {
            eventBus.emit('activeTracking:toggleVisualization', {
                showVisibilityLines: e.target.checked
            });
        });

        const highlightVisible = this.shadowRoot.querySelector('#highlightVisible');
        highlightVisible?.addEventListener('change', (e) => {
            eventBus.emit('activeTracking:toggleVisualization', {
                highlightVisible: e.target.checked
            });
        });

        const showIndices = this.shadowRoot.querySelector('#showNodeIndices');
        showIndices?.addEventListener('change', (e) => {
            eventBus.emit('activeTracking:toggleVisualization', {
                showNodeIndices: e.target.checked
            });
        });

        // Listen for events
        eventBus.on('activeTracking:visibilityComputed', (data) => {
            this.stats = data.stats;
            this.updateDisplay();
        });
    }

    computeVisibility() {
        const statusEl = this.shadowRoot.querySelector('#computeStatus');
        if (statusEl) {
            statusEl.textContent = 'Computing visibility matrix...';
            statusEl.className = 'status-message working';
        }

        eventBus.emit('rrt:requestTrees', {
            callback: (trees) => {
                if (!trees || !trees.pursuerTree || !trees.evaderTree) {
                    if (statusEl) {
                        statusEl.textContent = 'Error: RRT trees not available. Please build both Pursuer and Evader trees first.';
                        statusEl.className = 'status-message error';
                    }
                    return;
                }

                if (!trees.pursuerTree.state || !trees.evaderTree.state) {
                    if (statusEl) {
                        statusEl.textContent = 'Error: RRT trees are empty. Please build trees first.';
                        statusEl.className = 'status-message error';
                    }
                    return;
                }

                try {
                    const result = activeTrackingService.computeVisibilityMatrix(trees.pursuerTree, trees.evaderTree);
                    
                    if (statusEl) {
                        statusEl.textContent = '✓ Visibility matrix computed successfully';
                        statusEl.className = 'status-message success';
                    }

                    // Show strategy controls
                    const strategyControls = this.shadowRoot.querySelector('.strategy-controls');
                    if (strategyControls) {
                        strategyControls.style.display = 'block';
                    }

                    this.stats = result.stats;
                    this.updateDisplay();
                } catch (error) {
                    console.error('Error computing visibility:', error);
                    if (statusEl) {
                        statusEl.textContent = `Error: ${error.message}`;
                        statusEl.className = 'status-message error';
                    }
                }
            }
        });
    }

    queryNonVisible() {
        const input = this.shadowRoot.querySelector('#queryPursuerNode');
        const resultEl = this.shadowRoot.querySelector('#neResult');
        
        if (!input || !resultEl) return;

        const pursuerIndex = parseInt(input.value);
        if (isNaN(pursuerIndex) || pursuerIndex < 0) {
            resultEl.textContent = 'Please enter a valid pursuer node index';
            resultEl.className = 'query-result error';
            return;
        }

        try {
            const neSet = activeTrackingService.getNonVisibleSet(pursuerIndex);
            if (neSet) {
                resultEl.textContent = `Ne(${pursuerIndex}) = {${neSet.join(', ')}}`;
                resultEl.className = 'query-result info';
            } else {
                resultEl.textContent = `No visibility data for pursuer node ${pursuerIndex}`;
                resultEl.className = 'query-result error';
            }
        } catch (error) {
            resultEl.textContent = `Error: ${error.message}`;
            resultEl.className = 'query-result error';
        }
    }

    queryTracking() {
        const input = this.shadowRoot.querySelector('#queryEvaderNode');
        const resultEl = this.shadowRoot.querySelector('#npResult');
        
        if (!input || !resultEl) return;

        const evaderIndex = parseInt(input.value);
        if (isNaN(evaderIndex) || evaderIndex < 0) {
            resultEl.textContent = 'Please enter a valid evader node index';
            resultEl.className = 'query-result error';
            return;
        }

        try {
            const npSet = activeTrackingService.getTrackingSet(evaderIndex);
            if (npSet) {
                resultEl.textContent = `Np(${evaderIndex}) = {${npSet.join(', ')}}`;
                resultEl.className = 'query-result info';
            } else {
                resultEl.textContent = `No visibility data for evader node ${evaderIndex}`;
                resultEl.className = 'query-result error';
            }
        } catch (error) {
            resultEl.textContent = `Error: ${error.message}`;
            resultEl.className = 'query-result error';
        }
    }

    solveStrategies() {
        const resultEl = this.shadowRoot.querySelector('#strategy-results');
        if (!resultEl) return;

        try {
            const strategies = activeTrackingService.computeStrategies();
            
            let html = '<div style="margin-top: 12px;">';
            Object.entries(strategies).forEach(([key, strategy]) => {
                html += `<div style="margin-bottom: 8px;">
                    <strong>${strategy.name}:</strong> 
                    ${strategy.type === 'pursuer' ? 'Pursuer' : 'Evader'} wins at node ${strategy.winningNodeIndex}
                    (depth: ${strategy.depth}, cost: ${strategy.cost.toFixed(2)})
                </div>`;
            });
            html += '</div>';
            
            resultEl.innerHTML = html;
            resultEl.className = 'query-result info';
        } catch (error) {
            resultEl.textContent = `Error: ${error.message}`;
            resultEl.className = 'query-result error';
        }
    }

    visualizeStrategy() {
        const selector = this.shadowRoot.querySelector('#strategy-selector');
        if (!selector) return;

        const strategy = selector.value;
        eventBus.emit('activeTracking:visualizeStrategy', { strategy });
    }

    exportData() {
        try {
            const data = activeTrackingService.exportVisibilityData();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'active-tracking-visibility.json';
            a.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error exporting data:', error);
            alert('Error exporting data: ' + error.message);
        }
    }

    updateDisplay() {
        if (!this.stats) return;

        const elements = {
            statPursuerNodes: this.stats.pursuerNodes,
            statEvaderNodes: this.stats.evaderNodes,
            statTotalPairs: this.stats.totalPairs,
            statVisiblePairs: this.stats.visiblePairs,
            statVisibilityRatio: (this.stats.visibilityRatio * 100).toFixed(1) + '%',
            statComputeTime: this.stats.computeTime.toFixed(2) + ' ms',
            statAvgNonVisible: this.stats.avgNonVisibleEvaderNodes.toFixed(1),
            statAvgTracking: this.stats.avgTrackingPursuerNodes.toFixed(1)
        };

        Object.entries(elements).forEach(([id, value]) => {
            const el = this.shadowRoot.querySelector(`#${id}`);
            if (el) el.textContent = value;
        });
    }

    startDragging(e) {
        if (e.target.closest('.control-btn')) return;
        
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
        const container = this.shadowRoot.querySelector('.window-container');
        if (container) {
            container.style.cursor = 'default';
        }
    }

    updatePosition() {
        const container = this.shadowRoot.querySelector('.window-container');
        if (container) {
            container.style.left = `${this.position.x}px`;
            container.style.top = `${this.position.y}px`;
        }
    }

    minimize() {
        const content = this.shadowRoot.querySelector('.window-content');
        const container = this.shadowRoot.querySelector('.window-container');
        const minimizeBtn = this.shadowRoot.querySelector('.minimize-btn md-icon');
        
        if (content.style.display === 'none') {
            content.style.display = 'block';
            container.style.height = 'auto';
            if (minimizeBtn) minimizeBtn.textContent = 'remove';
        } else {
            content.style.display = 'none';
            container.style.height = 'auto';
            if (minimizeBtn) minimizeBtn.textContent = 'add';
        }
    }

    close() {
        this.removeAttribute('visible');
        eventBus.emit('activeTracking:windowClosed');
    }

    show() {
        this.setAttribute('visible', '');
    }

    render() {
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    position: fixed;
                    z-index: 1001;
                    display: none;
                    pointer-events: none;
                    --floating-primary: #7B1FA2;
                    --floating-on-primary: #FFFFFF;
                    --floating-surface: #F3E5F5;
                    --floating-on-surface: #4A148C;
                    --floating-on-surface-variant: #6A1B9A;
                }

                :host([visible]) {
                    display: block;
                    pointer-events: auto;
                }

                .window-container {
                    position: fixed;
                    background: var(--floating-surface);
                    border-radius: 12px;
                    box-shadow: 
                        0px 4px 8px rgba(0, 0, 0, 0.12),
                        0px 8px 16px rgba(0, 0, 0, 0.08);
                    min-width: 380px;
                    max-width: 450px;
                    overflow: hidden;
                }

                .window-header {
                    background: var(--floating-primary);
                    color: var(--floating-on-primary);
                    padding: 12px 16px;
                    cursor: grab;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    user-select: none;
                }

                .window-header:active {
                    cursor: grabbing;
                }

                .window-title {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 1rem;
                    font-weight: 500;
                }

                .window-controls {
                    display: flex;
                    gap: 4px;
                }

                .control-btn {
                    background: transparent;
                    border: none;
                    color: var(--floating-on-primary);
                    cursor: pointer;
                    padding: 4px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 32px;
                    height: 32px;
                    transition: background 0.2s;
                }

                .control-btn:hover {
                    background: rgba(255, 255, 255, 0.1);
                }

                .control-btn md-icon {
                    font-size: 20px;
                }

                .window-content {
                    padding: 20px;
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

                .section {
                    margin-bottom: 20px;
                }

                .section-title {
                    font-size: 0.875rem;
                    font-weight: 600;
                    text-transform: uppercase;
                    color: var(--floating-primary);
                    letter-spacing: 0.5px;
                    margin-bottom: 12px;
                }

                .control-group {
                    margin-bottom: 16px;
                }

                .control-label {
                    font-size: 0.875rem;
                    font-weight: 500;
                    color: var(--floating-on-surface);
                    margin-bottom: 8px;
                    display: block;
                }

                input[type="number"] {
                    width: 100%;
                    padding: 10px;
                    border: 1px solid var(--floating-primary);
                    border-radius: 8px;
                    font-size: 0.875rem;
                    background: white;
                    color: var(--floating-on-surface);
                }

                select {
                    width: 100%;
                    padding: 10px;
                    border: 1px solid var(--floating-primary);
                    border-radius: 8px;
                    font-size: 0.875rem;
                    background: white;
                    color: var(--floating-on-surface);
                    cursor: pointer;
                }

                .tool-button {
                    width: 100%;
                    margin-bottom: 8px;
                }

                .status-message {
                    font-size: 0.875rem;
                    color: var(--floating-on-surface-variant);
                    margin-top: 12px;
                    padding: 12px;
                    background: rgba(255, 255, 255, 0.5);
                    border-radius: 8px;
                    min-height: 44px;
                }

                .status-message.working {
                    background: rgba(33, 150, 243, 0.1);
                    color: #1565C0;
                }

                .status-message.success {
                    background: rgba(76, 175, 80, 0.1);
                    color: #2E7D32;
                }

                .status-message.error {
                    background: rgba(244, 67, 54, 0.1);
                    color: #C62828;
                }

                .stats-grid {
                    display: grid;
                    grid-template-columns: 1fr;
                    gap: 12px;
                }

                .stat-item {
                    display: flex;
                    justify-content: space-between;
                    padding: 12px;
                    background: rgba(255, 255, 255, 0.6);
                    border-radius: 8px;
                    border: 1px solid rgba(123, 31, 162, 0.2);
                }

                .stat-label {
                    font-size: 0.875rem;
                    color: var(--floating-on-surface);
                }

                .stat-value {
                    font-weight: 600;
                    color: var(--floating-primary);
                }

                .query-result {
                    margin-top: 8px;
                    padding: 12px;
                    border-radius: 8px;
                    font-size: 0.875rem;
                    font-family: 'Roboto Mono', monospace;
                }

                .query-result.info {
                    background: rgba(123, 31, 162, 0.1);
                    color: var(--floating-on-surface);
                }

                .query-result.error {
                    background: rgba(244, 67, 54, 0.1);
                    color: #C62828;
                }

                .strategy-controls {
                    display: none;
                }

                md-divider {
                    margin: 16px 0;
                }
            </style>
            
            <div class="window-container">
                <div class="window-header">
                    <div class="window-title">
                        <md-icon>visibility</md-icon>
                        <span>Active Tracking</span>
                    </div>
                    <div class="window-controls">
                        <button class="control-btn minimize-btn" title="Minimize">
                            <md-icon>remove</md-icon>
                        </button>
                        <button class="control-btn close-btn" title="Close">
                            <md-icon>close</md-icon>
                        </button>
                    </div>
                </div>
                
                <div class="window-content">
                    <div class="section">
                        <div class="section-title">Visibility Computation</div>
                        <md-filled-button id="computeVisibilityBtn" class="tool-button">
                            <md-icon slot="icon">calculate</md-icon>
                            Compute Visibility Matrix
                        </md-filled-button>
                        <div id="computeStatus" class="status-message">
                            Ready to compute visibility matrix
                        </div>
                    </div>

                    <md-divider></md-divider>

                    <div class="section">
                        <div class="section-title">Statistics</div>
                        <div class="stats-grid">
                            <div class="stat-item">
                                <span class="stat-label">Pursuer Nodes:</span>
                                <span class="stat-value" id="statPursuerNodes">-</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">Evader Nodes:</span>
                                <span class="stat-value" id="statEvaderNodes">-</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">Total Pairs:</span>
                                <span class="stat-value" id="statTotalPairs">-</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">Visible Pairs:</span>
                                <span class="stat-value" id="statVisiblePairs">-</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">Visibility Ratio:</span>
                                <span class="stat-value" id="statVisibilityRatio">-</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">Compute Time:</span>
                                <span class="stat-value" id="statComputeTime">-</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">Avg Non-Visible Evader Nodes:</span>
                                <span class="stat-value" id="statAvgNonVisible">-</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">Avg Tracking Pursuer Nodes:</span>
                                <span class="stat-value" id="statAvgTracking">-</span>
                            </div>
                        </div>
                    </div>

                    <md-divider></md-divider>

                    <div class="section">
                        <div class="section-title">Visualization Options</div>
                        <div class="control-group">
                            <label class="control-label">
                                <input type="checkbox" id="showVisibilityLines" checked>
                                Show Visibility Lines
                            </label>
                        </div>
                        <div class="control-group">
                            <label class="control-label">
                                <input type="checkbox" id="highlightVisible" checked>
                                Highlight Visible Pairs
                            </label>
                        </div>
                        <div class="control-group">
                            <label class="control-label">
                                <input type="checkbox" id="showNodeIndices">
                                Show Node Indices
                            </label>
                        </div>
                    </div>

                    <md-divider></md-divider>

                    <div class="section">
                        <div class="section-title">Query Tools</div>
                        <div class="control-group">
                            <label class="control-label" for="queryPursuerNode">Pursuer Node Index:</label>
                            <input type="number" id="queryPursuerNode" min="0" placeholder="Enter index">
                            <md-filled-button id="queryNonVisibleBtn" class="tool-button" style="margin-top: 8px;">
                                <md-icon slot="icon">search</md-icon>
                                Query Ne (Non-Visible)
                            </md-filled-button>
                        </div>
                        <div id="neResult" class="query-result" style="display: none;"></div>

                        <div class="control-group" style="margin-top: 16px;">
                            <label class="control-label" for="queryEvaderNode">Evader Node Index:</label>
                            <input type="number" id="queryEvaderNode" min="0" placeholder="Enter index">
                            <md-filled-button id="queryTrackingBtn" class="tool-button" style="margin-top: 8px;">
                                <md-icon slot="icon">search</md-icon>
                                Query Np (Tracking)
                            </md-filled-button>
                        </div>
                        <div id="npResult" class="query-result" style="display: none;"></div>
                    </div>

                    <md-divider></md-divider>

                    <div class="section strategy-controls">
                        <div class="section-title">Strategies</div>
                        <md-filled-button id="solve-strategies" class="tool-button">
                            <md-icon slot="icon">psychology</md-icon>
                            Solve Strategies
                        </md-filled-button>
                        <div style="margin-top: 12px;">
                            <label class="control-label" for="strategy-selector">Strategy:</label>
                            <select id="strategy-selector">
                                <option value="pl">PL - Pursuer as Leader</option>
                                <option value="el">EL - Evader as Leader</option>
                                <option value="elst">ELST - Evader Shortest Time</option>
                                <option value="tma">TMA - Two Moves Ahead</option>
                            </select>
                        </div>
                        <div id="strategy-results" class="query-result" style="display: none;"></div>
                    </div>

                    <md-divider></md-divider>

                    <div class="section">
                        <div class="section-title">Export</div>
                        <md-outlined-button id="exportVisibilityBtn" class="tool-button">
                            <md-icon slot="icon">download</md-icon>
                            Export Visibility Data
                        </md-outlined-button>
                    </div>
                </div>
            </div>
        `;
    }
}

customElements.define('active-tracking-window', ActiveTrackingWindow);
