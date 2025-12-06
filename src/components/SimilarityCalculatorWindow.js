/**
 * SimilarityCalculatorWindow Web Component
 * Floating window for calculating visibility polygon similarity between two observers
 */
console.log('Loading SimilarityCalculatorWindow.js');
import { eventBus } from '../utils/EventBus.js';
console.log('EventBus imported successfully');

export class SimilarityCalculatorWindow extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };
        this.position = { x: 180, y: 180 };
        
        // Observer state
        this.observer1 = null; // {x, y, polygon: [{x, y}, ...]}
        this.observer2 = null; // {x, y, polygon: [{x, y}, ...]}
        this.activeObserver = null; // 'observer1' or 'observer2'
        this.similarity = null; // Calculated similarity value
        this.enableGeometric = false; // Default to false
        this.enableMonteCarlo = true; // Default to true
        
        // Load numRays from localStorage or default to 36
        const savedNumRays = localStorage.getItem('similarity:numRays');
        this.numRays = savedNumRays ? parseInt(savedNumRays) : 36;
    }

    connectedCallback() {
        console.log('SimilarityCalculatorWindow: connectedCallback called');
        this.render();
        this.setupEventListeners();
        this.updatePosition();
        // Initialize slider with saved value
        const raySlider = this.shadowRoot.querySelector('#raySlider');
        const rayValue = this.shadowRoot.querySelector('#rayValue');
        if (raySlider) raySlider.value = this.numRays;
        if (rayValue) rayValue.textContent = this.numRays;
        
        // Initialize toggle
        const geoToggle = this.shadowRoot.querySelector('#geometricToggle');
        if (geoToggle) geoToggle.checked = this.enableGeometric;

        const mcToggle = this.shadowRoot.querySelector('#mcToggle');
        if (mcToggle) mcToggle.checked = this.enableMonteCarlo;
        
        console.log('SimilarityCalculatorWindow: initialized, position:', this.position);
    }

    setupEventListeners() {
        const header = this.shadowRoot.querySelector('.window-header');
        const closeBtn = this.shadowRoot.querySelector('.close-btn');
        const minimizeBtn = this.shadowRoot.querySelector('.minimize-btn');
        const placeObserver1Btn = this.shadowRoot.querySelector('#placeObserver1');
        const placeObserver2Btn = this.shadowRoot.querySelector('#placeObserver2');
        const clearBtn = this.shadowRoot.querySelector('#clearObservers');
        const raySlider = this.shadowRoot.querySelector('#raySlider');
        const rayValue = this.shadowRoot.querySelector('#rayValue');
        const geoToggle = this.shadowRoot.querySelector('#geometricToggle');
        const mcToggle = this.shadowRoot.querySelector('#mcToggle');
        
        header.addEventListener('mousedown', (e) => this.startDragging(e));
        document.addEventListener('mousemove', (e) => this.drag(e));
        document.addEventListener('mouseup', () => this.stopDragging());

        closeBtn?.addEventListener('click', () => this.close());
        minimizeBtn?.addEventListener('click', () => this.minimize());

        placeObserver1Btn?.addEventListener('click', () => {
            this.activeObserver = 'observer1';
            eventBus.emit('similarity:setPlacementMode', { observer: 'observer1' });
            this.updateStatus('Click on canvas to place Observer 1');
        });

        placeObserver2Btn?.addEventListener('click', () => {
            this.activeObserver = 'observer2';
            eventBus.emit('similarity:setPlacementMode', { observer: 'observer2' });
            this.updateStatus('Click on canvas to place Observer 2');
        });
        
        clearBtn?.addEventListener('click', () => {
            this.observer1 = null;
            this.observer2 = null;
            this.similarity = null;
            this.activeObserver = null;
            eventBus.emit('similarity:clear');
            this.updateObserverDisplay();
            this.updateSimilarityDisplay();
            this.updateStatus('Observers cleared');
        });

        raySlider?.addEventListener('input', (e) => {
            this.numRays = parseInt(e.target.value);
            rayValue.textContent = this.numRays;
            localStorage.setItem('similarity:numRays', this.numRays);
            eventBus.emit('similarity:updateRayCount', this.numRays);
            // Recompute visibility polygons if observers are placed
            if (this.observer1) {
                this.computeVisibility('observer1', this.observer1);
            }
            if (this.observer2) {
                this.computeVisibility('observer2', this.observer2);
            }
        });

        // Use 'change' for standard checkbox behavior
        geoToggle?.addEventListener('change', (e) => {
            this.enableGeometric = e.target.checked;
            console.log('Geometric toggle changed:', this.enableGeometric);
            this.calculateSimilarity();
        });

        mcToggle?.addEventListener('change', (e) => {
            this.enableMonteCarlo = e.target.checked;
            console.log('MC toggle changed:', this.enableMonteCarlo);
            this.calculateSimilarity();
        });

        // Listen for observer placement
        eventBus.on('similarity:observerPlaced', (data) => {
            if (data.observer === 'observer1') {
                this.observer1 = { x: data.position.x, y: data.position.y, polygon: null };
                this.computeVisibility('observer1', data.position);
            } else if (data.observer === 'observer2') {
                this.observer2 = { x: data.position.x, y: data.position.y, polygon: null };
                this.computeVisibility('observer2', data.position);
            }
            this.updateObserverDisplay();
        });

        // Listen for observer movement
        eventBus.on('similarity:observerMoved', (data) => {
            if (data.observer === 'observer1' && this.observer1) {
                this.observer1.x = data.position.x;
                this.observer1.y = data.position.y;
                this.computeVisibility('observer1', data.position);
            } else if (data.observer === 'observer2' && this.observer2) {
                this.observer2.x = data.position.x;
                this.observer2.y = data.position.y;
                this.computeVisibility('observer2', data.position);
            }
            this.updateObserverDisplay();
        });

        // Listen for visibility computation results
        eventBus.on('similarity:visibilityComputed', (data) => {
            if (data.observer === 'observer1' && this.observer1) {
                this.observer1.polygon = data.polygon;
            } else if (data.observer === 'observer2' && this.observer2) {
                this.observer2.polygon = data.polygon;
            }
            // Auto-calculate if both polygons are available
            if (this.observer1?.polygon && this.observer2?.polygon) {
                // Auto-calculate similarity whenever position changes
                this.calculateSimilarity();
            }
        });
    }

    computeVisibility(observer, position) {
        eventBus.emit('similarity:computeVisibility', { 
            observer,
            position, 
            numRays: this.numRays 
        });
    }

    calculateSimilarity() {
        if (!this.observer1?.polygon || !this.observer2?.polygon) {
            this.updateStatus('Error: Both observers need visibility polygons');
            return;
        }

        console.log('Requesting similarity calculation:', {
            geo: this.enableGeometric,
            mc: this.enableMonteCarlo
        });

        // For now, we'll emit an event that the service will handle
        eventBus.emit('similarity:requestCalculation', {
            observer1: this.observer1,
            observer2: this.observer2,
            enableGeometric: this.enableGeometric,
            enableMonteCarlo: this.enableMonteCarlo
        });

        // Listen for the result
        const handleResult = (result) => {
            this.similarity = result.similarity;
            this.updateSimilarityDisplay(result);
            
            const geoPct = (result.similarity !== null) ? (result.similarity * 100).toFixed(1) : '--';
            const mcPct = (result.mcSimilarity !== undefined) ? (result.mcSimilarity * 100).toFixed(1) : '--';
            
            this.updateStatus(`Geo: ${geoPct}% | MC: ${mcPct}% | Comparison Complete`);
            eventBus.off('similarity:calculationComplete', handleResult);
        };
        eventBus.on('similarity:calculationComplete', handleResult);
    }

    updateObserverDisplay() {
        const obs1Display = this.shadowRoot.querySelector('#observer1Display');
        const obs2Display = this.shadowRoot.querySelector('#observer2Display');
        
        if (obs1Display) {
            if (this.observer1) {
                obs1Display.textContent = `Position: (${this.observer1.x.toFixed(1)}, ${this.observer1.y.toFixed(1)})`;
                obs1Display.style.color = '#2E7D32'; // Green
            } else {
                obs1Display.textContent = 'Not placed';
                obs1Display.style.color = '#90A4AE';
            }
        }
        
        if (obs2Display) {
            if (this.observer2) {
                obs2Display.textContent = `Position: (${this.observer2.x.toFixed(1)}, ${this.observer2.y.toFixed(1)})`;
                obs2Display.style.color = '#EF6C00'; // Orange
            } else {
                obs2Display.textContent = 'Not placed';
                obs2Display.style.color = '#90A4AE';
            }
        }
    }

    updateSimilarityDisplay(result) {
        const display = this.shadowRoot.querySelector('#similarityDisplay');
        const geoDetails = this.shadowRoot.querySelector('#geoDetails');
        
        const mcDisplay = this.shadowRoot.querySelector('#mcSimilarityDisplay');
        const mcDetails = this.shadowRoot.querySelector('#mcDetails');

        if (!display) return;

        if (result) {
            // Geometric
            if (result.similarity !== null) {
                const percentage = (result.similarity * 100).toFixed(2);
                display.textContent = `${percentage}%`;
                display.style.color = '#4CAF50';
                
                if (geoDetails) {
                    geoDetails.textContent = `Time: ${result.calculationTime.toFixed(3)}ms | Exact Area Calculation`;
                }
            } else {
                display.textContent = '--';
                display.style.color = 'rgba(255,255,255,0.3)';
                if (geoDetails) geoDetails.textContent = 'Calculation disabled';
            }
            
            // Monte Carlo
            if (mcDisplay) {
                if (result.mcSimilarity !== undefined) {
                    const mcPercentage = (result.mcSimilarity * 100).toFixed(2);
                    mcDisplay.textContent = `${mcPercentage}%`;
                    if (mcDetails) {
                        mcDetails.textContent = `Time: ${result.mcTime.toFixed(3)}ms | Samples: ${result.mcSamples}`;
                    }
                } else {
                    mcDisplay.textContent = '--';
                    if (mcDetails) mcDetails.textContent = 'Calculation disabled';
                }
            }
        } else {
            display.textContent = '--';
            display.style.color = 'rgba(255,255,255,0.3)';
            if (geoDetails) geoDetails.textContent = '';
            
            if (mcDisplay) mcDisplay.textContent = '--';
            if (mcDetails) mcDetails.textContent = '';
        }
    }

    updateStatus(message) {
        const status = this.shadowRoot.querySelector('#statusText');
        if (status) {
            status.textContent = message;
        }
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
            console.log('Position updated to:', container.style.left, container.style.top);
        } else {
            console.error('Window container not found in updatePosition');
        }
    }

    close() {
        this.removeAttribute('visible');
        eventBus.emit('similarity:windowClosed');
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
        console.log('SimilarityCalculatorWindow: show() called');
        console.log('Before setAttribute - hasAttribute(visible):', this.hasAttribute('visible'));
        this.setAttribute('visible', '');
        console.log('After setAttribute - hasAttribute(visible):', this.hasAttribute('visible'));
        console.log('Element display style:', window.getComputedStyle(this).display);
        console.log('Element position:', this.position);
        this.updateStatus('Place observers to begin');
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
                
                :host([visible]) {
                    display: block;
                    pointer-events: auto;
                }
                
                .window-container {
                    position: fixed;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: #FFFFFF;
                    border-radius: 16px;
                    box-shadow: 0 8px 32px rgba(0,0,0,0.3);
                    min-width: 380px;
                    max-width: 450px;
                    overflow: hidden;
                    border: 2px solid rgba(255, 255, 255, 0.2);
                }
                
                .window-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 1.25rem;
                    background: rgba(255, 255, 255, 0.15);
                    backdrop-filter: blur(10px);
                    cursor: grab;
                    user-select: none;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.2);
                }
                
                .window-header:active {
                    cursor: grabbing;
                }
                
                .window-title {
                    display: flex;
                    align-items: center;
                    gap: 0.6rem;
                    font-size: 1.1rem;
                    font-weight: 700;
                    color: #FFFFFF;
                    text-shadow: 0 2px 4px rgba(0,0,0,0.2);
                }
                
                .window-title md-icon {
                    font-size: 28px;
                    filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));
                }
                
                .window-controls {
                    display: flex;
                    gap: 0.25rem;
                }
                
                .window-controls md-icon-button {
                    --md-icon-button-icon-color: #FFFFFF;
                }
                
                .window-content {
                    padding: 1.5rem;
                    background: #f8f9fa;
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
                    margin-bottom: 1.25rem;
                    padding: 1.25rem;
                    background: #FFFFFF;
                    border-radius: 12px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
                    border-left: 4px solid transparent;
                    transition: all 0.3s ease;
                }
                
                .section:hover {
                    box-shadow: 0 4px 12px rgba(0,0,0,0.12);
                    transform: translateY(-2px);
                }

                .section-title {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    font-size: 1rem;
                    font-weight: 700;
                    margin-bottom: 0.85rem;
                    color: #2c3e50;
                }
                
                .section-title md-icon {
                    font-size: 24px;
                    color: #673ab7;
                }
                
                .button-group {
                    display: flex;
                    gap: 0.6rem;
                    flex-wrap: wrap;
                    margin-bottom: 1rem;
                }
                
                md-filled-button,
                md-filled-tonal-button {
                    flex: 1;
                    min-width: 115px;
                    font-size: 0.85rem;
                    font-weight: 600;
                    --md-filled-tonal-button-container-height: 42px;
                }
                
                .observer-info {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 1rem;
                    margin-bottom: 1rem;
                }
                
                .observer-card {
                    padding: 1rem;
                    background: linear-gradient(135deg, #ffffff 0%, #f3e5f5 100%);
                    border-radius: 8px;
                    border: 1px solid rgba(0,0,0,0.05);
                }
                
                .observer-label {
                    font-size: 0.75rem;
                    font-weight: 700;
                    color: #673ab7;
                    margin-bottom: 0.5rem;
                    text-transform: uppercase;
                }
                
                .observer-position {
                    font-size: 0.85rem;
                    color: #546e7a;
                    font-family: 'Courier New', monospace;
                    font-weight: 600;
                }
                
                .similarity-display {
                    text-align: center;
                    padding: 1.5rem;
                    background: linear-gradient(135deg, #263238 0%, #37474f 100%);
                    border-radius: 12px;
                    margin-bottom: 1rem;
                    box-shadow: inset 0 2px 6px rgba(0,0,0,0.2);
                    border: 1px solid rgba(255,255,255,0.1);
                }
                
                .similarity-label {
                    font-size: 0.85rem;
                    color: rgba(255,255,255,0.7);
                    margin-bottom: 0.5rem;
                }
                
                .similarity-value {
                    font-size: 2rem;
                    font-weight: 700;
                    color: #4CAF50;
                    text-shadow: 0 2px 4px rgba(0,0,0,0.3);
                }
                
                .slider-container {
                    margin-bottom: 1rem;
                }
                
                .slider-label {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 0.5rem;
                    font-size: 0.85rem;
                    font-weight: 600;
                    color: #37474f;
                }
                
                .slider-value {
                    color: #2196F3;
                    font-weight: 700;
                    font-family: 'Courier New', monospace;
                    font-size: 0.9rem;
                    padding: 0.2rem 0.5rem;
                    background: rgba(33, 150, 243, 0.1);
                    border-radius: 4px;
                }
                
                /* Custom Range Slider */
                input[type="range"] {
                    width: 100%;
                    height: 6px;
                    border-radius: 3px;
                    background: linear-gradient(to right, #bbdefb 0%, #2196F3 100%);
                    outline: none;
                    -webkit-appearance: none;
                }
                
                input[type="range"]::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    appearance: none;
                    width: 18px;
                    height: 18px;
                    border-radius: 50%;
                    background: #2196F3;
                    cursor: pointer;
                    box-shadow: 0 2px 6px rgba(33, 150, 243, 0.4);
                    transition: all 0.2s ease;
                }
                
                input[type="range"]::-webkit-slider-thumb:hover {
                    transform: scale(1.2);
                    box-shadow: 0 3px 10px rgba(33, 150, 243, 0.6);
                }
                
                .status-bar {
                    font-size: 0.9rem;
                    color: #2c3e50;
                    padding: 0.85rem;
                    background: linear-gradient(135deg, #fff9c4 0%, #fff59d 100%);
                    border-radius: 8px;
                    text-align: center;
                    min-height: 2.5rem;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: 600;
                    box-shadow: 0 2px 6px rgba(255, 235, 59, 0.3);
                    border: 1px solid rgba(251, 192, 45, 0.3);
                }
            </style>
            
            <div class="window-container">
                <div class="window-header">
                    <div class="window-title">
                        <md-icon>compare</md-icon>
                        <span>Similarity Calculator</span>
                    </div>
                    <div class="window-controls">
                        <md-icon-button class="minimize-btn">
                            <md-icon>remove</md-icon>
                        </md-icon-button>
                        <md-icon-button class="close-btn">
                            <md-icon>close</md-icon>
                        </md-icon-button>
                    </div>
                </div>
                
                <div class="window-content">
                    <div class="section" style="border-left-color: #4CAF50;">
                        <div class="section-title">
                            <md-icon style="color: #4CAF50;">location_on</md-icon>
                            Observer Placement
                        </div>
                        <div class="button-group">
                            <md-filled-tonal-button id="placeObserver1">
                                <md-icon slot="icon">add_location</md-icon>
                                Observer 1
                            </md-filled-tonal-button>
                            <md-filled-tonal-button id="placeObserver2">
                                <md-icon slot="icon">add_location</md-icon>
                                Observer 2
                            </md-filled-tonal-button>
                        </div>
                        <div class="observer-info">
                            <div class="observer-card" style="border-left: 3px solid #4CAF50;">
                                <div class="observer-label" style="color: #2E7D32;">Observer 1 (Green)</div>
                                <div class="observer-position" id="observer1Display">Not placed</div>
                            </div>
                            <div class="observer-card" style="border-left: 3px solid #FF9800;">
                                <div class="observer-label" style="color: #EF6C00;">Observer 2 (Orange)</div>
                                <div class="observer-position" id="observer2Display">Not placed</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="section" style="border-left-color: #2196F3;">
                        <div class="section-title">
                            <md-icon style="color: #2196F3;">visibility</md-icon>
                            Visibility Configuration
                        </div>
                        <div class="slider-container">
                            <div class="slider-label">
                                <span>Number of Rays</span>
                                <span class="slider-value" id="rayValue">36</span>
                            </div>
                            <input 
                                type="range" 
                                id="raySlider" 
                                min="8" 
                                max="180" 
                                value="36" 
                                step="4"
                            >
                        </div>
                    </div>
                    
                    <div class="section" style="border-left-color: #9C27B0;">
                        <div class="section-title">
                            <md-icon style="color: #9C27B0;">analytics</md-icon>
                            Similarity Result
                        </div>
                        
                        <!-- Monte Carlo Result -->
                        <div class="similarity-display" style="background: linear-gradient(135deg, #311b92 0%, #4527a0 100%); margin-top: 0.5rem;">
                            <div class="similarity-label">Monte Carlo (2000 samples)</div>
                            <div class="similarity-value" id="mcSimilarityDisplay" style="color: #B388FF;">--</div>
                            <div class="similarity-details" id="mcDetails" style="font-size: 0.75rem; color: rgba(255,255,255,0.5); margin-top: 0.5rem;"></div>
                            
                            <div class="toggle-container" style="margin-top: 1rem; display: flex; align-items: center; justify-content: center; gap: 0.5rem;">
                                <label class="switch" style="position: relative; display: inline-block; width: 40px; height: 20px;">
                                    <input type="checkbox" id="mcToggle" style="opacity: 0; width: 0; height: 0;">
                                    <span class="slider round" style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #ccc; transition: .4s; border-radius: 20px;"></span>
                                </label>
                                <label for="mcToggle" style="font-size: 0.75rem; color: rgba(255,255,255,0.7); cursor: pointer;">Enable MC Calculation</label>
                            </div>
                        </div>

                        <!-- Geometric Result -->
                        <div class="similarity-display">
                            <div class="similarity-label" id="similarityLabel">Geometric Intersection</div>
                            <div class="similarity-value" id="similarityDisplay">--</div>
                            <div class="similarity-details" id="geoDetails" style="font-size: 0.75rem; color: rgba(255,255,255,0.5); margin-top: 0.5rem;"></div>
                            
                            <div class="toggle-container" style="margin-top: 1rem; display: flex; align-items: center; justify-content: center; gap: 0.5rem;">
                                <label class="switch" style="position: relative; display: inline-block; width: 40px; height: 20px;">
                                    <input type="checkbox" id="geometricToggle" style="opacity: 0; width: 0; height: 0;">
                                    <span class="slider round" style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #ccc; transition: .4s; border-radius: 20px;"></span>
                                </label>
                                <label for="geometricToggle" style="font-size: 0.75rem; color: rgba(255,255,255,0.7); cursor: pointer;">Enable Exact Calculation</label>
                            </div>
                        </div>
                        
                        <style>
                            .switch input:checked + .slider {
                                background-color: #4CAF50;
                            }
                            .switch input:focus + .slider {
                                box-shadow: 0 0 1px #4CAF50;
                            }
                            .switch input:checked + .slider:before {
                                transform: translateX(20px);
                            }
                            .slider:before {
                                position: absolute;
                                content: "";
                                height: 16px;
                                width: 16px;
                                left: 2px;
                                bottom: 2px;
                                background-color: white;
                                transition: .4s;
                                border-radius: 50%;
                            }
                        </style>
                    </div>
                    
                    <div class="section" style="border-left-color: #607D8B;">
                        <md-filled-tonal-button id="clearObservers" style="width: 100%;">
                            <md-icon slot="icon">clear</md-icon>
                            Clear Observers
                        </md-filled-tonal-button>
                    </div>
                    
                    <div class="status-bar" id="statusText">
                        Place observers to begin
                    </div>
                </div>
            </div>
        `;
    }
}

customElements.define('similarity-calculator-window', SimilarityCalculatorWindow);
console.log('SimilarityCalculatorWindow component registered');
