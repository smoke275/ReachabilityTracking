/**
 * ActiveTrackingWindow
 * UI component for active tracking visualization and controls
 */

import { eventBus } from '../utils/EventBus.js';
import { activeTrackingService } from '../services/ActiveTrackingService.js';

export class ActiveTrackingWindow {
    constructor() {
        this.isOpen = false;
        this.windowElement = null;
        this.stats = null;
        
        // Dragging state
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };
        this.position = { x: 100, y: 100 };
        
        // Scroll position state
        this.scrollPosition = 0;
        
        this.setupEventListeners();
    }

    setupEventListeners() {
        eventBus.on('window:toggleActiveTracking', () => this.toggle());
        eventBus.on('activeTracking:visibilityComputed', (data) => {
            this.stats = data.stats;
            this.updateDisplay();
        });
    }

    toggle() {
        // ...existing code...
        this.isOpen = !this.isOpen;
        
        if (this.isOpen) {
            this.open();
        } else {
            this.close();
        }
    }

    open() {
        // Ensure internal state is in sync
        this.isOpen = true;
        
        if (this.windowElement) {
            // Show without removing from layout/scroll state
            this.windowElement.style.visibility = 'visible';
            this.windowElement.style.pointerEvents = 'auto';
            // Restore scroll position after layout
            this.restoreScrollPosition();
            return;
        }

        this.create();
    }

    close() {
        // Ensure internal state is in sync
        this.isOpen = false;
        if (this.windowElement) {
            // Save scroll position before hiding
            const windowContent = this.windowElement.querySelector('.window-content');
            if (windowContent) {
                this.scrollPosition = windowContent.scrollTop;
            }
            // Hide without clearing scroll state
            this.windowElement.style.visibility = 'hidden';
            this.windowElement.style.pointerEvents = 'none';
        }
    }

    create() {
        this.windowElement = document.createElement('div');
        this.windowElement.className = 'floating-window active-tracking-window';
        this.windowElement.innerHTML = `
            <div class="window-header">
                <h3>Active Tracking</h3>
                <button class="close-btn" id="closeActiveTrackingWindow">×</button>
            </div>
            <div class="window-content">
                <div class="section">
                    <h4>Visibility Computation</h4>
                    <button id="computeVisibilityBtn" class="btn btn-primary">
                        <span class="icon">🎯</span>
                        Compute Visibility Matrix
                    </button>
                    <div id="computeStatus" class="status-text"></div>
                </div>

                <div class="section">
                    <h4>Statistics</h4>
                    <div id="activeTrackingStats" class="stats-grid">
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

                <div class="section">
                    <h4>Visualization Options</h4>
                    <div class="control-group">
                        <label>
                            <input type="checkbox" id="showVisibilityLines" checked>
                            Show Visibility Lines
                        </label>
                    </div>
                    <div class="control-group">
                        <label>
                            <input type="checkbox" id="highlightVisible" checked>
                            Highlight Visible Pairs
                        </label>
                    </div>
                    <div class="control-group">
                        <label>
                            <input type="checkbox" id="showNodeIndices">
                            Show Node Indices
                        </label>
                    </div>
                </div>

                <div class="section">
                    <h4>Query Tools</h4>
                    <div class="control-group">
                        <label for="queryPursuerNode">Pursuer Node Index:</label>
                        <input type="number" id="queryPursuerNode" min="0" placeholder="Enter index">
                        <button id="queryNonVisibleBtn" class="btn btn-small">Query Ne</button>
                    </div>
                    <div id="neResult" class="query-result"></div>

                    <div class="control-group">
                        <label for="queryEvaderNode">Evader Node Index:</label>
                        <input type="number" id="queryEvaderNode" min="0" placeholder="Enter index">
                        <button id="queryTrackingBtn" class="btn btn-small">Query Np</button>
                    </div>
                    <div id="npResult" class="query-result"></div>
                </div>

                <div class="section">
                    <h4>Export</h4>
                    <button id="exportVisibilityBtn" class="btn btn-secondary">
                        <span class="icon">💾</span>
                        Export Visibility Data
                    </button>
                </div>

                <div class="section strategy-controls" style="display:none;">
                    <h4>Strategies</h4>
                    <button id="solve-strategies" class="btn btn-secondary">
                        Solve Strategies
                    </button>
                    <select id="strategy-selector">
                        <option value="pl">PL - Pursuer as Leader</option>
                        <option value="el">EL - Evader as Leader</option>
                        <option value="elst">ELST - Evader Shortest Time</option>
                        <option value="tma">TMA - Two Moves Ahead</option>
                    </select>
                    <div id="strategy-results" class="query-result"></div>
                </div>
            </div>
        `;
        document.body.appendChild(this.windowElement);

        // Ensure it's visible by default
        this.windowElement.style.visibility = 'visible';
        this.windowElement.style.pointerEvents = 'auto';
        
        this.attachEventHandlers();
        this.updateDisplay();
        this.updatePosition();

        // Apply any pending slider values from storage restoration
        if (this.pendingSliderValues) {
            Object.entries(this.pendingSliderValues).forEach(([id, value]) => {
                const slider = this.windowElement.querySelector(`#${id}`);
                if (slider) {
                    slider.value = value;
                    slider.dispatchEvent(new Event('input', { bubbles: true }));
                }
            });
            delete this.pendingSliderValues;
        }

        // Restore any saved scroll position on first create (after layout)
        this.restoreScrollPosition();
    }

    attachEventHandlers() {
        // Window dragging
        const header = this.windowElement.querySelector('.window-header');
        header.addEventListener('mousedown', (e) => this.startDragging(e));
        document.addEventListener('mousemove', (e) => this.drag(e));
        document.addEventListener('mouseup', () => this.stopDragging());
        
        // Close button
        const closeBtn = this.windowElement.querySelector('#closeActiveTrackingWindow');
        closeBtn.addEventListener('click', () => this.close());

        // Persist scroll position while scrolling
        const windowContent = this.windowElement.querySelector('.window-content');
        if (windowContent) {
            windowContent.addEventListener('scroll', () => {
                this.scrollPosition = windowContent.scrollTop;
            });
        }

        // Compute visibility button
        const computeBtn = this.windowElement.querySelector('#computeVisibilityBtn');
        computeBtn.addEventListener('click', () => this.computeVisibility());

        // Query buttons
        const queryNeBtn = this.windowElement.querySelector('#queryNonVisibleBtn');
        queryNeBtn.addEventListener('click', () => this.queryNonVisible());

        const queryNpBtn = this.windowElement.querySelector('#queryTrackingBtn');
        queryNpBtn.addEventListener('click', () => this.queryTracking());

        // Export button
        const exportBtn = this.windowElement.querySelector('#exportVisibilityBtn');
        exportBtn.addEventListener('click', () => this.exportData());

        // Solve strategies button
        const solveStrategiesBtn = this.windowElement.querySelector('#solve-strategies');
        solveStrategiesBtn.addEventListener('click', () => this.solveStrategies());

        // Strategy selector
        const strategySelector = this.windowElement.querySelector('#strategy-selector');
        strategySelector.addEventListener('change', () => this.visualizeStrategy());

        // Visualization options
        const showVisLines = this.windowElement.querySelector('#showVisibilityLines');
        showVisLines.addEventListener('change', (e) => {
            eventBus.emit('activeTracking:toggleVisualization', {
                showVisibilityLines: e.target.checked
            });
        });

        const highlightVisible = this.windowElement.querySelector('#highlightVisible');
        highlightVisible.addEventListener('change', (e) => {
            eventBus.emit('activeTracking:toggleVisualization', {
                highlightVisible: e.target.checked
            });
        });

        const showIndices = this.windowElement.querySelector('#showNodeIndices');
        showIndices.addEventListener('change', (e) => {
            eventBus.emit('activeTracking:toggleVisualization', {
                showNodeIndices: e.target.checked
            });
        });
    }

    computeVisibility() {
        const statusEl = this.windowElement.querySelector('#computeStatus');
        statusEl.textContent = 'Computing visibility matrix...';
        statusEl.className = 'status-text status-working';

        // Request RRT trees from RRT service
        eventBus.emit('rrt:requestTrees', {
            callback: (trees) => {
                if (!trees || !trees.pursuerTree || !trees.evaderTree) {
                    statusEl.textContent = 'Error: RRT trees not available. Please build both Pursuer and Evader trees first.';
                    statusEl.className = 'status-text status-error';
                    return;
                }

                // Validate trees have nodes
                if (!trees.pursuerTree.state || !trees.evaderTree.state) {
                    statusEl.textContent = 'Error: Invalid RRT trees. Please rebuild the trees.';
                    statusEl.className = 'status-text status-error';
                    return;
                }

                try {
                    const result = activeTrackingService.computeVisibilityMatrix(
                        trees.pursuerTree,
                        trees.evaderTree
                    );

                    const visRatio = (result.stats.visibilityRatio * 100).toFixed(1);
                    statusEl.textContent = `✓ Visibility computed: ${result.stats.visiblePairs} visible pairs out of ${result.stats.totalPairs} (${visRatio}%)`;
                    statusEl.className = 'status-text status-success';
                    
                    this.stats = result.stats;
                    this.updateDisplay();

                    // Show the strategy controls now that visibility is computed
                    const strategyControls = this.windowElement.querySelector('.strategy-controls');
                    if (strategyControls) {
                        strategyControls.style.display = 'block';
                    }
                } catch (error) {
                    console.error('Visibility computation error:', error);
                    statusEl.textContent = `Error: ${error.message}`;
                    statusEl.className = 'status-text status-error';
                }
            }
        });
    }

    queryNonVisible() {
        const input = this.windowElement.querySelector('#queryPursuerNode');
        const resultEl = this.windowElement.querySelector('#neResult');
        
        const index = parseInt(input.value);
        if (isNaN(index) || index < 0) {
            resultEl.textContent = 'Please enter a valid node index (≥ 0).';
            resultEl.className = 'query-result error';
            return;
        }

        // Check if visibility matrix is computed
        if (!activeTrackingService.visibilityMatrix) {
            resultEl.textContent = 'Please compute visibility matrix first.';
            resultEl.className = 'query-result error';
            return;
        }

        // Check if index is within range
        if (index >= activeTrackingService.pursuerNodes.length) {
            resultEl.textContent = `Invalid index. Pursuer has ${activeTrackingService.pursuerNodes.length} nodes (0-${activeTrackingService.pursuerNodes.length - 1}).`;
            resultEl.className = 'query-result error';
            return;
        }

        const Ne = activeTrackingService.getNonVisibleEvaderNodes(index);
        
        if (Ne.length === 0) {
            resultEl.textContent = `✓ Pursuer node ${index} can see all evader nodes (perfect surveillance).`;
            resultEl.className = 'query-result success';
        } else {
            const preview = Ne.slice(0, 20).join(', ');
            const remaining = Ne.length > 20 ? `, ... +${Ne.length - 20} more` : '';
            resultEl.textContent = `Ne[${index}] = [${preview}${remaining}] (${Ne.length} non-visible nodes)`;
            resultEl.className = 'query-result info';
        }

        // Highlight on canvas
        eventBus.emit('activeTracking:highlightNode', {
            type: 'pursuer',
            index: index,
            relatedNodes: Ne
        });
    }

    queryTracking() {
        const input = this.windowElement.querySelector('#queryEvaderNode');
        const resultEl = this.windowElement.querySelector('#npResult');
        
        const index = parseInt(input.value);
        if (isNaN(index) || index < 0) {
            resultEl.textContent = 'Please enter a valid node index (≥ 0).';
            resultEl.className = 'query-result error';
            return;
        }

        // Check if visibility matrix is computed
        if (!activeTrackingService.visibilityMatrix) {
            resultEl.textContent = 'Please compute visibility matrix first.';
            resultEl.className = 'query-result error';
            return;
        }

        // Check if index is within range
        if (index >= activeTrackingService.evaderNodes.length) {
            resultEl.textContent = `Invalid index. Evader has ${activeTrackingService.evaderNodes.length} nodes (0-${activeTrackingService.evaderNodes.length - 1}).`;
            resultEl.className = 'query-result error';
            return;
        }

        const Np = activeTrackingService.getTrackingPursuerNodes(index);
        
        if (Np.length === 0) {
            resultEl.textContent = `⚠ Evader node ${index} is not visible to any pursuer nodes (escape opportunity).`;
            resultEl.className = 'query-result warning';
        } else {
            const preview = Np.slice(0, 20).join(', ');
            const remaining = Np.length > 20 ? `, ... +${Np.length - 20} more` : '';
            resultEl.textContent = `Np[${index}] = [${preview}${remaining}] (${Np.length} tracking nodes)`;
            resultEl.className = 'query-result info';
        }

        // Highlight on canvas
        eventBus.emit('activeTracking:highlightNode', {
            type: 'evader',
            index: index,
            relatedNodes: Np
        });
    }

    exportData() {
        const data = activeTrackingService.exportVisibilityData();
        
        const dataStr = JSON.stringify(data, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `visibility_data_${new Date().getTime()}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
        
        console.log('Visibility data exported');
    }

    solveStrategies() {
        const statusEl = this.windowElement.querySelector('#strategy-results');
        
        // Check if visibility matrix is computed
        if (!activeTrackingService.visibilityMatrix) {
            statusEl.innerHTML = `<p class="error">Please compute visibility matrix first.</p>`;
            statusEl.className = 'query-result error';
            return;
        }
        
        statusEl.textContent = 'Solving strategies...';
        statusEl.className = 'query-result';

        setTimeout(() => {
            try {
                this.strategySolutions = activeTrackingService.computeStrategies();
                
                if (!this.strategySolutions) {
                    statusEl.innerHTML = `<p class="error">Failed to solve strategies. Check console for details.</p>`;
                    statusEl.className = 'query-result error';
                    return;
                }

                let html = '<p class="success">Strategies computed successfully!</p><ul class="strategy-list">';
                for (const [key, value] of Object.entries(this.strategySolutions)) {
                    const strategyName = key.toUpperCase();
                    const hasWinner = value.winningNode !== null;
                    const valueText = isFinite(value.bestValue) 
                        ? value.bestValue.toFixed(2) 
                        : (value.bestValue === -Infinity ? '-∞' : '∞');
                    
                    html += `<li><strong>${strategyName}:</strong> `;
                    if (hasWinner) {
                        html += `Winning value: ${valueText}, Type: ${value.type}`;
                    } else {
                        html += `No winning node found (value: ${valueText})`;
                    }
                    html += '</li>';
                }
                html += '</ul><p class="info">Select a strategy above to visualize the winning node.</p>';

                statusEl.innerHTML = html;
                statusEl.className = 'query-result success';
                
                // Automatically visualize the first strategy with a winning node
                this.visualizeStrategy();
            } catch (error) {
                console.error('Error solving strategies:', error);
                statusEl.innerHTML = `<p class="error">Error: ${error.message}</p>`;
                statusEl.className = 'query-result error';
            }
        }, 10);
    }

    visualizeStrategy() {
        if (!this.strategySolutions) {
            return;
        }

        const selectedStrategy = this.windowElement.querySelector('#strategy-selector').value;
        const solution = this.strategySolutions[selectedStrategy];
        const statusEl = this.windowElement.querySelector('#strategy-results');

        if (!solution) {
            statusEl.innerHTML = `<p class="error">Strategy ${selectedStrategy.toUpperCase()} not found.</p>`;
            statusEl.className = 'query-result error';
            return;
        }

        if (solution.winningNode) {
            // Display summary with highlight on current selection
            let html = '<p class="success">Strategies computed successfully!</p><ul class="strategy-list">';
            for (const [key, value] of Object.entries(this.strategySolutions)) {
                const strategyName = key.toUpperCase();
                const hasWinner = value.winningNode !== null;
                const valueText = isFinite(value.bestValue) 
                    ? value.bestValue.toFixed(2) 
                    : (value.bestValue === -Infinity ? '-∞' : '∞');
                
                const isSelected = key === selectedStrategy;
                html += `<li${isSelected ? ' class="selected"' : ''}><strong>${strategyName}:</strong> `;
                if (hasWinner) {
                    html += `Winning value: ${valueText}, Type: ${value.type}`;
                    if (isSelected) {
                        html += ' <span class="badge">◀ Visualized</span>';
                    }
                } else {
                    html += `No winning node found (value: ${valueText})`;
                }
                html += '</li>';
            }
            html += '</ul>';

            statusEl.innerHTML = html;
            statusEl.className = 'query-result success';

            // Emit visualization event
            eventBus.emit('activeTracking:visualizeNode', {
                node: solution.winningNode,
                type: solution.type,
                strategy: selectedStrategy
            });
        } else {
            // Re-display the summary but note that this strategy has no winner
            let html = '<p class="success">Strategies computed successfully!</p><ul class="strategy-list">';
            for (const [key, value] of Object.entries(this.strategySolutions)) {
                const strategyName = key.toUpperCase();
                const hasWinner = value.winningNode !== null;
                const valueText = isFinite(value.bestValue) 
                    ? value.bestValue.toFixed(2) 
                    : (value.bestValue === -Infinity ? '-∞' : '∞');
                
                const isSelected = key === selectedStrategy;
                html += `<li${isSelected ? ' class="selected"' : ''}><strong>${strategyName}:</strong> `;
                if (hasWinner) {
                    html += `Winning value: ${valueText}, Type: ${value.type}`;
                } else {
                    html += `No winning node found (value: ${valueText})`;
                    if (isSelected) {
                        html += ' <span class="badge">◀ Selected</span>';
                    }
                }
                html += '</li>';
            }
            html += '</ul><p class="warning">Strategy ${selectedStrategy.toUpperCase()} has no winning node to visualize.</p>';

            statusEl.innerHTML = html;
            statusEl.className = 'query-result warning';
            
            // Clear visualizations
            eventBus.emit('activeTracking:clearVisualizations');
        }
    }

    updateDisplay() {
        if (!this.windowElement) return;

        // Preserve current scroll during updates
        const content = this.windowElement.querySelector('.window-content');
        const prevScroll = content ? content.scrollTop : 0;

        if (this.stats) {
            this.windowElement.querySelector('#statPursuerNodes').textContent = this.stats.totalPursuerNodes;
            this.windowElement.querySelector('#statEvaderNodes').textContent = this.stats.totalEvaderNodes;
            this.windowElement.querySelector('#statTotalPairs').textContent = this.stats.totalPairs || '-';
            this.windowElement.querySelector('#statVisiblePairs').textContent = this.stats.visiblePairs || '-';
            this.windowElement.querySelector('#statVisibilityRatio').textContent = 
                this.stats.visibilityRatio ? (this.stats.visibilityRatio * 100).toFixed(2) + '%' : '-';
            this.windowElement.querySelector('#statComputeTime').textContent = 
                this.stats.visibilityComputeTime ? this.stats.visibilityComputeTime.toFixed(2) + ' ms' : '-';
            this.windowElement.querySelector('#statAvgNonVisible').textContent = 
                this.stats.averageNonVisibleEvaderNodes ? this.stats.averageNonVisibleEvaderNodes.toFixed(2) : '-';
            this.windowElement.querySelector('#statAvgTracking').textContent = 
                this.stats.averageTrackingPursuerNodes ? this.stats.averageTrackingPursuerNodes.toFixed(2) : '-';
        }

        // Restore previous scroll
        if (content) {
            const apply = () => { content.scrollTop = prevScroll; };
            apply();
            if (typeof requestAnimationFrame === 'function') {
                requestAnimationFrame(apply);
            }
        }
    }

    // Dragging functionality
    startDragging(e) {
        if (e.target.classList.contains('close-btn')) return;
        
        this.isDragging = true;
        this.dragOffset.x = e.clientX - this.position.x;
        this.dragOffset.y = e.clientY - this.position.y;
        
        if (this.windowElement) {
            this.windowElement.style.cursor = 'grabbing';
        }
    }

    drag(e) {
        if (!this.isDragging) return;
        
        this.position.x = e.clientX - this.dragOffset.x;
        this.position.y = e.clientY - this.dragOffset.y;
        
        this.updatePosition();
    }

    stopDragging() {
        if (this.isDragging) {
            this.isDragging = false;
            if (this.windowElement) {
                this.windowElement.style.cursor = 'default';
            }
        }
    }

    updatePosition() {
        if (this.windowElement) {
            this.windowElement.style.left = `${this.position.x}px`;
            this.windowElement.style.top = `${this.position.y}px`;
            this.windowElement.style.transform = 'none';
        }
    }

    // Helper to robustly restore scroll after showing the window
    restoreScrollPosition() {
        const content = this.windowElement?.querySelector('.window-content');
        if (!content) return;
        const target = this.scrollPosition || 0;
        const apply = () => { content.scrollTop = target; };
        // Try immediate and after layout ticks
        apply();
        if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(() => apply());
            requestAnimationFrame(() => setTimeout(apply, 0));
        } else {
            setTimeout(apply, 0);
        }
        // Final fallback a bit later (for fonts/layout shifts)
        setTimeout(apply, 50);
    }

    destroy() {
        if (this.windowElement) {
            this.windowElement.remove();
            this.windowElement = null;
        }
    }
}
