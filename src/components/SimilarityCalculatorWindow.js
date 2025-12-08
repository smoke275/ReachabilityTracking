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
        
        // AI Model state
        this.model = null;
        this.normalizationParams = null;
        this.aiObserver1Polygon = null;
        this.aiObserver2Polygon = null;
        this.aiSimilarity = null;
        this.mcSimilarity = null;
        this.enableAiRealtime = false; // Default to false

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

        const aiToggle = this.shadowRoot.querySelector('#aiToggle');
        if (aiToggle) aiToggle.checked = this.enableAiRealtime;
        
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
        
        const loadModelBtn = this.shadowRoot.querySelector('#loadModelBtn');
        const showAiEstimatesBtn = this.shadowRoot.querySelector('#showAiEstimatesBtn');

        header.addEventListener('mousedown', (e) => this.startDragging(e));
        document.addEventListener('mousemove', (e) => this.drag(e));
        document.addEventListener('mouseup', () => this.stopDragging());

        closeBtn?.addEventListener('click', () => this.close());
        minimizeBtn?.addEventListener('click', () => this.minimize());

        loadModelBtn?.addEventListener('click', () => this.loadModel());
        showAiEstimatesBtn?.addEventListener('click', () => this.toggleAiEstimates());

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
                
                // Auto-calculate AI similarity if enabled
                if (this.enableAiRealtime && this.model) {
                    this.calculateAISimilarity(true); // true = silent mode
                }
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

    // Fourier feature encoding for better spatial representation
    fourierEncode(x, y, numFrequencies = 6) {
        const features = [];
        for (let i = 0; i < numFrequencies; i++) {
            const freq = Math.pow(2, i) * Math.PI;
            features.push(Math.sin(freq * x));
            features.push(Math.cos(freq * x));
            features.push(Math.sin(freq * y));
            features.push(Math.cos(freq * y));
        }
        return features;
    }

    async loadModel() {
        try {
            // Create file input that accepts multiple files
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json,.bin';
            input.multiple = true;
            
            input.onchange = async (e) => {
                const files = Array.from(e.target.files);
                if (files.length < 2) {
                    alert('Please select at least 2 files: model.json and weights file (.bin)');
                    return;
                }
                
                try {
                    // Find each file by name pattern (more flexible matching)
                    const modelFile = files.find(f => f.name.endsWith('.json') && !f.name.includes('params'));
                    const weightsFile = files.find(f => f.name.endsWith('.bin'));
                    const paramsFile = files.find(f => f.name.includes('params') || (f.name.endsWith('.json') && f.name.includes('model')));
                    
                    console.log('Files found:', {
                        modelFile: modelFile?.name,
                        weightsFile: weightsFile?.name,
                        paramsFile: paramsFile?.name,
                        allFiles: files.map(f => f.name)
                    });
                    
                    if (!modelFile || !weightsFile) {
                        alert(`Missing required files!\nFound: ${files.map(f => f.name).join(', ')}\n\nNeed:\n- model.json\n- weights.bin (or .bin file)`);
                        return;
                    }
                    
                    const statusDiv = this.shadowRoot.querySelector('#modelStatus');
                    statusDiv.textContent = 'Loading model...';
                    
                    // Load normalization params if available
                    if (paramsFile) {
                        const paramsText = await paramsFile.text();
                        const params = JSON.parse(paramsText);
                        this.normalizationParams = params.normalizationParams;
                        // We use the model's numRays for prediction
                        this.modelNumRays = params.numRays;
                    } else {
                        console.warn('No params file found, normalization may not work correctly');
                        statusDiv.textContent = 'Warning: No params file found';
                    }
                    
                    // Load model
                    const tf = await import('@tensorflow/tfjs');
                    this.model = await tf.loadLayersModel(
                        tf.io.browserFiles([modelFile, weightsFile])
                    );
                    
                    // Update UI
                    const showAiBtn = this.shadowRoot.querySelector('#showAiEstimatesBtn');
                    if (showAiBtn) showAiBtn.removeAttribute('disabled');
                    
                    statusDiv.textContent = `Model loaded! Rays: ${this.modelNumRays || 'Unknown'}`;
                    
                } catch (error) {
                    console.error('Error loading model:', error);
                    const statusDiv = this.shadowRoot.querySelector('#modelStatus');
                    statusDiv.textContent = 'Error loading model';
                    alert('Error loading model: ' + error.message);
                }
            };
            
            input.click();
            
        } catch (error) {
            console.error('Error in loadModel:', error);
            alert('Error loading model: ' + error.message);
        }
    }

    async predictVisibility(observer) {
        if (!this.model || !this.normalizationParams) return null;
        
        const tf = await import('@tensorflow/tfjs');
        
        const { xMin, xMax, yMin, yMax } = this.normalizationParams;
        
        // Normalize
        let xNorm = 2 * (observer.x - xMin) / (xMax - xMin || 1) - 1;
        let yNorm = 2 * (observer.y - yMin) / (yMax - yMin || 1) - 1;
        
        // Clamp
        xNorm = Math.max(-1, Math.min(1, xNorm));
        yNorm = Math.max(-1, Math.min(1, yNorm));
        
        // Fourier encode
        const features = this.fourierEncode(xNorm, yNorm, 6);
        
        // Predict
        const inputTensor = tf.tensor2d([features]);
        const prediction = this.model.predict(inputTensor);
        const normalizedDistances = await prediction.data();
        
        inputTensor.dispose();
        prediction.dispose();
        
        // Denormalize distances
        const { dMin, dMax } = this.normalizationParams;
        const distances = Array.from(normalizedDistances).map(d => 
            d * (dMax - dMin) + dMin
        );
        
        return this.reconstructPolygon(observer, distances);
    }

    reconstructPolygon(observer, distances) {
        const vertices = [];
        const numRays = distances.length;
        
        for (let i = 0; i < numRays; i++) {
            const angle = i * (2 * Math.PI / numRays);
            const dist = distances[i];
            
            vertices.push({
                x: observer.x + dist * Math.cos(angle),
                y: observer.y + dist * Math.sin(angle)
            });
        }
        
        return vertices;
    }

    async calculateAISimilarity(silent = false) {
        if (!this.model) {
            if (!silent) alert('Please load a model first');
            return;
        }
        
        if (!this.observer1 || !this.observer2) {
            if (!silent) this.updateStatus('Place both observers first');
            return;
        }
        
        const statusDiv = this.shadowRoot.querySelector('#aiDetails');
        if (!silent) statusDiv.textContent = 'Predicting visibility...';
        
        try {
            // Predict polygons
            const poly1 = await this.predictVisibility(this.observer1);
            const poly2 = await this.predictVisibility(this.observer2);
            
            if (!poly1 || !poly2) {
                if (!silent) statusDiv.textContent = 'Prediction failed';
                return;
            }
            
            this.aiObserver1Polygon = poly1;
            this.aiObserver2Polygon = poly2;
            
            if (!silent) statusDiv.textContent = 'Calculating MC Similarity...';
            
            const tempObserver1 = { ...this.observer1, polygon: poly1 };
            const tempObserver2 = { ...this.observer2, polygon: poly2 };
            
            // Calculate locally to avoid event bus race conditions
            const startTime = performance.now();
            const similarity = this.calculateLocalMcSimilarity(tempObserver1, tempObserver2);
            this.aiSimilarity = similarity;
            const endTime = performance.now();
            
            const percentage = (similarity * 100).toFixed(2);
            const display = this.shadowRoot.querySelector('#aiSimilarityDisplay');
            if (display) {
                display.textContent = `${percentage}%`;
                display.style.color = '#80DEEA';
            }
            
            // Always update status with metrics, even in silent mode
            statusDiv.textContent = `Time: ${(endTime - startTime).toFixed(3)}ms | Samples: 2000`;
            
            this.updateErrorDisplay();
            
        } catch (error) {
            console.error('Error in AI similarity:', error);
            statusDiv.textContent = 'Error: ' + error.message;
        }
    }

    toggleAiEstimates() {
        this.enableAiRealtime = !this.enableAiRealtime;
        const btn = this.shadowRoot.querySelector('#showAiEstimatesBtn');
        const icon = btn.querySelector('md-icon');
        
        if (this.enableAiRealtime) {
            // Enable
            btn.style.setProperty('--md-sys-color-secondary-container', '#006064');
            btn.style.setProperty('--md-sys-color-on-secondary-container', '#E0F7FA');
            icon.textContent = 'stop_circle';
            // Trigger initial calculation
            this.calculateAISimilarity();
        } else {
            // Disable
            btn.style.setProperty('--md-sys-color-secondary-container', 'rgba(255,255,255,0.2)');
            btn.style.setProperty('--md-sys-color-on-secondary-container', 'white');
            icon.textContent = 'psychology';
            
            // Clear display
            const display = this.shadowRoot.querySelector('#aiSimilarityDisplay');
            const statusDiv = this.shadowRoot.querySelector('#aiDetails');
            if (display) {
                display.textContent = '--';
                display.style.color = '#80DEEA';
            }
            if (statusDiv) statusDiv.textContent = 'AI estimation paused';
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
                    this.mcSimilarity = result.mcSimilarity;
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
            this.mcSimilarity = null;
        }
        this.updateErrorDisplay();
    }

    updateStatus(message) {
        const status = this.shadowRoot.querySelector('#statusText');
        if (status) {
            status.textContent = message;
        }
    }

    updateErrorDisplay() {
        const display = this.shadowRoot.querySelector('#aiErrorDisplay');
        if (!display) return;
        
        if (this.mcSimilarity !== null && this.aiSimilarity !== null) {
            const diff = Math.abs(this.mcSimilarity - this.aiSimilarity);
            const diffPct = (diff * 100).toFixed(1);
            display.textContent = `Err: ${diffPct}%`;
            display.style.display = 'block';
            
            // Color coding based on error magnitude
            if (diff < 0.05) {
                display.style.color = '#C8E6C9'; // Light Green (Good)
            } else if (diff < 0.09) {
                display.style.color = '#FFE0B2'; // Light Orange (Okay)
            } else {
                display.style.color = '#FFAB91'; // Light Red (Bad)
            }
        } else {
            display.style.display = 'none';
        }
    }

    isPointInPolygon(point, polygon) {
        let inside = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const xi = polygon[i].x, yi = polygon[i].y;
            const xj = polygon[j].x, yj = polygon[j].y;
            
            const intersect = ((yi > point.y) !== (yj > point.y))
                && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    }

    calculateLocalMcSimilarity(observer1, observer2) {
        const poly1 = observer1.polygon; // Array of {x,y}
        const poly2 = observer2.polygon; // Array of {x,y}
        const center = { x: observer2.x, y: observer2.y };
        
        if (!poly1 || !poly2 || poly2.length < 3) return 0;

        // 1. Calculate total area of poly2 (sum of triangles from center)
        // Since it's a visibility polygon from 'center', it is star-shaped.
        // We can just sum areas of triangles (center, p[i], p[i+1])
        
        let totalArea = 0;
        const cdf = [];
        
        for (let i = 0; i < poly2.length; i++) {
            const p1 = poly2[i];
            const p2 = poly2[(i + 1) % poly2.length];
            
            // Area = 0.5 * |x1(y2 - y3) + x2(y3 - y1) + x3(y1 - y2)|
            // x3,y3 is center
            const area = 0.5 * Math.abs(
                p1.x * (p2.y - center.y) + 
                p2.x * (center.y - p1.y) + 
                center.x * (p1.y - p2.y)
            );
            
            totalArea += area;
            cdf.push(totalArea);
        }
        
        if (totalArea === 0) return 0;

        // 2. Sample points
        let pointsInA = 0;
        const numSamples = 2000;
        
        for (let k = 0; k < numSamples; k++) {
            // Select triangle based on area weight
            const r = Math.random() * totalArea;
            let triIndex = cdf.findIndex(v => v >= r);
            if (triIndex === -1) triIndex = cdf.length - 1;
            
            // Sample point in triangle (center, p1, p2)
            const p1 = poly2[triIndex];
            const p2 = poly2[(triIndex + 1) % poly2.length];
            
            const r1 = Math.random();
            const r2 = Math.random();
            
            // Uniform sampling in triangle
            // P = (1 - sqrt(r1)) * A + (sqrt(r1) * (1 - r2)) * B + (sqrt(r1) * r2) * C
            let sqrtR1 = Math.sqrt(r1);
            let u = 1 - sqrtR1;
            let v = sqrtR1 * (1 - r2);
            let w = sqrtR1 * r2;
            
            const px = u * center.x + v * p1.x + w * p2.x;
            const py = u * center.y + v * p1.y + w * p2.y;
            
            if (this.isPointInPolygon({x: px, y: py}, poly1)) {
                pointsInA++;
            }
        }
        
        return pointsInA / numSamples;
    }

    render() {
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    position: fixed;
                    z-index: 1000;
                    display: none;
                    pointer-events: none;
                    /* Floating palette overrides - Purple Theme */
                    --floating-primary: #673AB7;
                    --floating-on-primary: #FFFFFF;
                    --floating-surface: #EDE7F6;
                    --floating-on-surface: #311B92;
                    --floating-on-surface-variant: #4527A0;
                }
                
                :host([visible]) {
                    display: block;
                    pointer-events: auto;
                }
                
                .window-container {
                    position: fixed;
                    background: var(--floating-surface, #EDE7F6);
                    color: var(--floating-on-surface, #311B92);
                    border-radius: 12px;
                    box-shadow: 
                        0px 4px 8px rgba(0, 0, 0, 0.12),
                        0px 8px 16px rgba(0, 0, 0, 0.08);
                    min-width: 380px;
                    max-width: 450px;
                    overflow: hidden;
                }
                
                .window-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 12px 16px;
                    background: var(--floating-primary, #673AB7);
                    color: var(--floating-on-primary, #FFFFFF);
                    cursor: grab;
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
                
                .window-title md-icon {
                    font-size: 24px;
                }
                
                .window-controls {
                    display: flex;
                    gap: 4px;
                }
                
                .control-btn {
                    background: transparent;
                    border: none;
                    color: var(--floating-on-primary, #FFFFFF);
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
                
                .section {
                    margin-bottom: 16px;
                }

                .section-title {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 0.875rem;
                    font-weight: 600;
                    margin-bottom: 12px;
                    color: var(--floating-primary, #673AB7);
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                
                .section-title md-icon {
                    font-size: 20px;
                }
                
                .button-group {
                    display: flex;
                    gap: 8px;
                    flex-wrap: wrap;
                    margin-bottom: 12px;
                }
                
                md-filled-button,
                md-filled-tonal-button {
                    flex: 1;
                    min-width: 115px;
                }
                
                .observer-info {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 12px;
                    margin-bottom: 12px;
                }
                
                .observer-card {
                    padding: 12px;
                    background: rgba(255, 255, 255, 0.5);
                    border-radius: 8px;
                    border: 1px solid rgba(0,0,0,0.1);
                }
                
                .observer-label {
                    font-size: 0.75rem;
                    font-weight: 600;
                    margin-bottom: 4px;
                }
                
                .observer-position {
                    font-family: monospace;
                    font-size: 0.9rem;
                    font-weight: 500;
                }
                
                .slider-container {
                    padding: 12px;
                    background: rgba(0,0,0,0.03);
                    border-radius: 8px;
                }
                
                .slider-label {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 8px;
                    font-size: 0.875rem;
                    font-weight: 500;
                }
                
                .slider-value {
                    font-weight: 600;
                    color: var(--floating-primary, #673AB7);
                }
                
                input[type="range"] {
                    width: 100%;
                    height: 4px;
                    background: rgba(0,0,0,0.1);
                    border-radius: 2px;
                    outline: none;
                    -webkit-appearance: none;
                }
                
                input[type="range"]::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    appearance: none;
                    width: 16px;
                    height: 16px;
                    background: var(--floating-primary, #673AB7);
                    border-radius: 50%;
                    cursor: pointer;
                    transition: transform 0.1s;
                }
                
                input[type="range"]::-webkit-slider-thumb:hover {
                    transform: scale(1.2);
                }
                
                .similarity-display {
                    background: rgba(0,0,0,0.03);
                    border-radius: 8px;
                    padding: 16px;
                    text-align: center;
                    margin-bottom: 12px;
                    border: 1px solid rgba(0,0,0,0.05);
                }
                
                .similarity-label {
                    font-size: 0.875rem;
                    color: var(--floating-on-surface-variant, #4527A0);
                    margin-bottom: 8px;
                    font-weight: 500;
                }
                
                .similarity-value {
                    font-size: 2.5rem;
                    font-weight: 700;
                    line-height: 1.2;
                    color: var(--floating-primary, #673AB7);
                }
                
                .similarity-details {
                    font-size: 0.75rem;
                    color: var(--floating-on-surface-variant, #4527A0);
                    opacity: 0.8;
                    margin-top: 8px;
                }
                
                .toggle-container {
                    margin-top: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                }
                
                /* Toggle Switch */
                .switch {
                    position: relative;
                    display: inline-block;
                    width: 36px;
                    height: 20px;
                }
                
                .switch input {
                    opacity: 0;
                    width: 0;
                    height: 0;
                }
                
                .slider {
                    position: absolute;
                    cursor: pointer;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background-color: #ccc;
                    transition: .4s;
                    border-radius: 20px;
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
                
                input:checked + .slider {
                    background-color: var(--floating-primary, #673AB7);
                }
                
                input:focus + .slider {
                    box-shadow: 0 0 1px var(--floating-primary, #673AB7);
                }
                
                input:checked + .slider:before {
                    transform: translateX(16px);
                }
                
                .status-text {
                    font-size: 0.75rem;
                    color: var(--floating-on-surface-variant, #4527A0);
                    text-align: center;
                    margin-top: 12px;
                    opacity: 0.8;
                }
            </style>
            
            <div class="window-container">
                <div class="window-header">
                    <div class="window-title">
                        <md-icon>compare</md-icon>
                        Similarity Calculator
                    </div>
                    <div class="window-controls">
                        <button class="control-btn minimize-btn">
                            <md-icon>remove</md-icon>
                        </button>
                        <button class="control-btn close-btn">
                            <md-icon>close</md-icon>
                        </button>
                    </div>
                </div>
                
                <div class="window-content">
                    <div class="section">
                        <div class="section-title">
                            <md-icon>location_on</md-icon>
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
                        <md-outlined-button id="clearObservers" style="width: 100%;">
                            <md-icon slot="icon">clear</md-icon>
                            Clear Observers
                        </md-outlined-button>
                    </div>
                    
                    <div class="section">
                        <div class="section-title">
                            <md-icon>visibility</md-icon>
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
                    
                    <div class="section">
                        <div class="section-title">
                            <md-icon>analytics</md-icon>
                            Similarity Result
                        </div>
                        
                        <!-- Monte Carlo Result -->
                        <div class="similarity-display" style="background: linear-gradient(135deg, #311b92 0%, #4527a0 100%); color: white;">
                            <div class="similarity-label" style="color: rgba(255,255,255,0.9);">Monte Carlo (2000 samples)</div>
                            <div class="similarity-value" id="mcSimilarityDisplay" style="color: #B388FF;">--</div>
                            <div class="similarity-details" id="mcDetails" style="color: rgba(255,255,255,0.7);"></div>
                            
                            <div class="toggle-container">
                                <label class="switch">
                                    <input type="checkbox" id="mcToggle">
                                    <span class="slider round"></span>
                                </label>
                                <label for="mcToggle" style="font-size: 0.75rem; color: rgba(255,255,255,0.9); cursor: pointer;">Enable MC Calculation</label>
                            </div>
                        </div>

                        <!-- AI Estimate Result -->
                        <div class="similarity-display" style="background: linear-gradient(135deg, #006064 0%, #00838F 100%); color: white;">
                            <div class="similarity-label" style="color: rgba(255,255,255,0.9);">AI Estimate (VisibilNet)</div>
                            <div style="display: flex; align-items: center; justify-content: center; gap: 10px;">
                                <div class="similarity-value" id="aiSimilarityDisplay" style="color: #80DEEA;">--</div>
                                <div id="aiErrorDisplay" style="font-size: 0.85rem; color: #FFAB91; font-weight: 600; background: rgba(0,0,0,0.2); padding: 2px 6px; border-radius: 4px; display: none;"></div>
                            </div>
                            <div class="similarity-details" id="aiDetails" style="color: rgba(255,255,255,0.7);">Load model to enable</div>
                            
                            <div style="margin-top: 12px; display: flex; gap: 8px; justify-content: center;">
                                <md-outlined-button id="loadModelBtn" style="--md-outlined-button-label-text-color: #E0F7FA; --md-sys-color-outline: rgba(255,255,255,0.3);">
                                    <md-icon slot="icon">upload_file</md-icon>
                                    Load Model
                                </md-outlined-button>
                                <md-filled-tonal-button id="showAiEstimatesBtn" disabled style="--md-sys-color-secondary-container: rgba(255,255,255,0.2); --md-sys-color-on-secondary-container: white;">
                                    <md-icon slot="icon">psychology</md-icon>
                                    Show AI Estimates
                                </md-filled-tonal-button>
                            </div>
                            <div id="modelStatus" style="font-size: 0.7rem; margin-top: 8px; opacity: 0.8;"></div>
                        </div>

                        <!-- Geometric Result -->
                        <div class="similarity-display">
                            <div class="similarity-label" id="similarityLabel">Geometric Intersection</div>
                            <div class="similarity-value" id="similarityDisplay">--</div>
                            <div class="similarity-details" id="geoDetails"></div>
                            
                            <div class="toggle-container">
                                <label class="switch">
                                    <input type="checkbox" id="geometricToggle">
                                    <span class="slider round"></span>
                                </label>
                                <label for="geometricToggle" style="font-size: 0.75rem; cursor: pointer;">Enable Exact Calculation</label>
                            </div>
                        </div>
                        
                        <div class="status-text" id="statusMessage">Place observers to begin</div>
                    </div>
                </div>
            </div>
        `;
    }
}

customElements.define('similarity-calculator-window', SimilarityCalculatorWindow);
console.log('SimilarityCalculatorWindow component registered');
