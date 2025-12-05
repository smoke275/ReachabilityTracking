/**
 * KiloVisiNetTrainingWindow Web Component
 * Kilo-NeRF inspired grid-based visibility learning
 * Divides environment into small cells, each with its own local network
 */
import { eventBus } from '../utils/EventBus.js';

export class KiloVisiNetTrainingWindow extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };
        this.position = { x: 180, y: 180 };
        
        // Load settings from localStorage
        const savedNumRays = localStorage.getItem('kilovisinet:numRays');
        const savedCellSize = localStorage.getItem('kilovisinet:cellSize');
        
        this.numRays = savedNumRays ? parseInt(savedNumRays) : 36;
        this.cellSize = savedCellSize ? parseInt(savedCellSize) : 50;
        this.gridCells = new Map(); // cellKey -> {model, trainingData, normalizationParams}
        this.isTraining = false;
        this.useModelPrediction = false;
        this.currentCell = null;
        this.displayCellBounds = false;
    }

    connectedCallback() {
        this.render();
        this.setupEventListeners();
        this.updatePosition();
        
        // Initialize sliders with saved values
        const raySlider = this.shadowRoot.querySelector('#raySlider');
        const rayValue = this.shadowRoot.querySelector('#rayValue');
        const cellSizeSlider = this.shadowRoot.querySelector('#cellSizeSlider');
        const cellSizeValue = this.shadowRoot.querySelector('#cellSizeValue');
        
        if (raySlider) raySlider.value = this.numRays;
        if (rayValue) rayValue.textContent = this.numRays;
        if (cellSizeSlider) cellSizeSlider.value = this.cellSize;
        if (cellSizeValue) cellSizeValue.textContent = this.cellSize;
    }

    setupEventListeners() {
        const header = this.shadowRoot.querySelector('.window-header');
        const closeBtn = this.shadowRoot.querySelector('.close-btn');
        const minimizeBtn = this.shadowRoot.querySelector('.minimize-btn');
        const placeObserverBtn = this.shadowRoot.querySelector('#placeObserver');
        const clearBtn = this.shadowRoot.querySelector('#clearTraining');
        const raySlider = this.shadowRoot.querySelector('#raySlider');
        const rayValue = this.shadowRoot.querySelector('#rayValue');
        const cellSizeSlider = this.shadowRoot.querySelector('#cellSizeSlider');
        const cellSizeValue = this.shadowRoot.querySelector('#cellSizeValue');
        const generateDataBtn = this.shadowRoot.querySelector('#generateData');
        const trainCellBtn = this.shadowRoot.querySelector('#trainCell');
        const trainAllBtn = this.shadowRoot.querySelector('#trainAll');
        const togglePredictionBtn = this.shadowRoot.querySelector('#togglePrediction');
        const toggleCellBoundsBtn = this.shadowRoot.querySelector('#toggleCellBounds');
        const saveDataBtn = this.shadowRoot.querySelector('#saveData');
        const loadDataBtn = this.shadowRoot.querySelector('#loadData');
        
        header.addEventListener('mousedown', (e) => this.startDragging(e));
        document.addEventListener('mousemove', (e) => this.drag(e));
        document.addEventListener('mouseup', () => this.stopDragging());

        closeBtn?.addEventListener('click', () => this.close());
        minimizeBtn?.addEventListener('click', () => this.minimize());

        placeObserverBtn?.addEventListener('click', () => {
            eventBus.emit('kilovisinet:setPlacementMode', 'observer');
        });
        
        clearBtn?.addEventListener('click', () => {
            eventBus.emit('kilovisinet:clear');
            this.gridCells.clear();
            this.currentCell = null;
            this.displayCellBounds = false;
            this.updateStatistics();
        });

        raySlider?.addEventListener('input', (e) => {
            if (this.useModelPrediction) return;
            this.numRays = parseInt(e.target.value);
            rayValue.textContent = this.numRays;
            localStorage.setItem('kilovisinet:numRays', this.numRays);
            eventBus.emit('kilovisinet:updateRayCount', this.numRays);
        });

        cellSizeSlider?.addEventListener('input', (e) => {
            this.cellSize = parseInt(e.target.value);
            cellSizeValue.textContent = this.cellSize;
            localStorage.setItem('kilovisinet:cellSize', this.cellSize);
            this.updateCellSizeDisplay();
        });

        generateDataBtn?.addEventListener('click', () => this.generateTrainingData());
        trainCellBtn?.addEventListener('click', () => this.trainCurrentCell());
        trainAllBtn?.addEventListener('click', () => this.trainAllCells());
        togglePredictionBtn?.addEventListener('click', () => this.togglePrediction());
        toggleCellBoundsBtn?.addEventListener('click', () => this.toggleCellBounds());
        saveDataBtn?.addEventListener('click', () => this.saveAllData());
        loadDataBtn?.addEventListener('click', () => this.loadAllData());

        // Listen for observer position updates
        eventBus.on('kilovisinet:observerMoved', (position) => {
            this.updateCurrentCell(position);
            
            if (this.useModelPrediction) {
                this.predictAndUpdateRays(position);
            } else {
                eventBus.emit('kilovisinet:computeVisibility', { 
                    position, 
                    numRays: this.numRays 
                });
            }
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
        eventBus.emit('kilovisinet:windowClosed');
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

    getGridCell(point) {
        const cellX = Math.floor(point.x / this.cellSize);
        const cellY = Math.floor(point.y / this.cellSize);
        return { cellX, cellY };
    }

    getCellKey(cellX, cellY) {
        return `${cellX},${cellY}`;
    }

    updateCurrentCell(position) {
        const { cellX, cellY } = this.getGridCell(position);
        const cellKey = this.getCellKey(cellX, cellY);
        this.currentCell = { cellX, cellY, key: cellKey };
        
        // Update UI
        const cellInfo = this.shadowRoot.querySelector('#currentCellInfo');
        const cellData = this.gridCells.get(cellKey);
        
        if (cellInfo) {
            const status = cellData && cellData.model ? '✓ Trained' : 
                          cellData && cellData.trainingData.length > 0 ? '📊 Has Data' : 
                          '⚪ Empty';
            const samples = cellData ? cellData.trainingData.length : 0;
            
            cellInfo.innerHTML = `
                <div style="font-size: 0.75rem; padding: 8px; background: rgba(33, 150, 243, 0.08); border-radius: 6px;">
                    <div style="font-weight: 600; color: #2196F3; margin-bottom: 4px;">📍 Current Cell</div>
                    <div style="font-family: monospace; line-height: 1.6;">
                        <div>Cell: (${cellX}, ${cellY})</div>
                        <div>Status: ${status}</div>
                        <div>Samples: ${samples}</div>
                    </div>
                </div>
            `;
        }
        
        // Enable/disable train current cell button
        const trainCellBtn = this.shadowRoot.querySelector('#trainCell');
        if (trainCellBtn) {
            if (cellData && cellData.trainingData.length >= 5 && !cellData.model) {
                trainCellBtn.removeAttribute('disabled');
            } else {
                trainCellBtn.setAttribute('disabled', '');
            }
        }
    }

    updateCellSizeDisplay() {
        eventBus.emit('kilovisinet:updateCellSize', this.cellSize);
    }

    toggleCellBounds() {
        this.displayCellBounds = !this.displayCellBounds;
        const btn = this.shadowRoot.querySelector('#toggleCellBounds');
        const icon = btn?.querySelector('md-icon');
        
        if (this.displayCellBounds) {
            if (icon) icon.textContent = 'grid_off';
            btn.textContent = '';
            if (icon) btn.appendChild(icon);
            btn.appendChild(document.createTextNode('Hide Grid'));
            eventBus.emit('kilovisinet:showCellBounds', { cellSize: this.cellSize, gridCells: Array.from(this.gridCells.keys()) });
        } else {
            if (icon) icon.textContent = 'grid_on';
            btn.textContent = '';
            if (icon) btn.appendChild(icon);
            btn.appendChild(document.createTextNode('Show Grid'));
            eventBus.emit('kilovisinet:hideCellBounds');
        }
    }

    async generateTrainingData() {
        this.updateTrainingStatus('Generating training data for all cells...');
        
        eventBus.emit('kilovisinet:requestEnvironment', (data) => {
            if (!data || !data.polygons || data.polygons.length === 0) {
                this.updateTrainingStatus('Error: No polygons found!');
                return;
            }
            
            const { polygons, bounds } = data;
            
            import('../services/KiloVisiNetService.js').then(module => {
                const service = module.kilovisinetService;
                service.cellSize = this.cellSize;
                
                // Sample all cells with fine grid (5px spacing within each cell)
                const cellSamples = service.sampleAllCells(polygons, bounds, 5);
                
                if (cellSamples.size === 0) {
                    this.updateTrainingStatus('Error: No free space found!');
                    return;
                }
                
                // For each cell, compute ray distances for each sample point
                let totalSamples = 0;
                for (const [cellKey, samples] of cellSamples) {
                    const trainingData = samples.map(point => {
                        const distances = service.getRayDistances(point, polygons, bounds, this.numRays);
                        return {
                            x: point.x,
                            y: point.y,
                            distances: distances
                        };
                    });
                    
                    const [cellX, cellY] = cellKey.split(',').map(Number);
                    
                    // Store data for this cell
                    if (!this.gridCells.has(cellKey)) {
                        this.gridCells.set(cellKey, {
                            cellX,
                            cellY,
                            bounds: {
                                minX: cellX * this.cellSize,
                                maxX: (cellX + 1) * this.cellSize,
                                minY: cellY * this.cellSize,
                                maxY: (cellY + 1) * this.cellSize
                            },
                            trainingData: [],
                            model: null,
                            normalizationParams: null
                        });
                    }
                    
                    this.gridCells.get(cellKey).trainingData = trainingData;
                    totalSamples += trainingData.length;
                }
                
                this.updateStatistics();
                this.updateTrainingStatus(`✓ Generated ${totalSamples} samples across ${cellSamples.size} cells! Click "Train All Cells" to train neural networks.`);
                
                // Enable train all button and show grid
                const trainAllBtn = this.shadowRoot.querySelector('#trainAll');
                console.log('KiloVisiNet: Train All button found:', !!trainAllBtn);
                if (trainAllBtn) {
                    trainAllBtn.removeAttribute('disabled');
                    console.log('KiloVisiNet: Train All button enabled!');
                    // Flash the button to draw attention
                    trainAllBtn.style.animation = 'pulse 1s ease-in-out 3';
                } else {
                    console.error('KiloVisiNet: Could not find #trainAll button in shadowRoot!');
                }
                
                // Auto-enable grid view to show cells
                if (!this.displayCellBounds) {
                    this.toggleCellBounds();
                }
            });
        });
    }

    async trainCurrentCell() {
        if (!this.currentCell) {
            this.updateTrainingStatus('No current cell selected');
            return;
        }
        
        const cellData = this.gridCells.get(this.currentCell.key);
        if (!cellData || cellData.trainingData.length < 5) {
            this.updateTrainingStatus('Need at least 5 samples in current cell');
            return;
        }
        
        this.isTraining = true;
        this.updateTrainingStatus(`Training cell (${this.currentCell.cellX}, ${this.currentCell.cellY})...`);
        
        try {
            const tf = await import('@tensorflow/tfjs');
            await this.trainCellModel(tf, this.currentCell.key, cellData);
            this.updateTrainingStatus(`Cell (${this.currentCell.cellX}, ${this.currentCell.cellY}) trained successfully!`);
            this.updateStatistics();
            
            // Enable prediction toggle
            const toggleBtn = this.shadowRoot.querySelector('#togglePrediction');
            if (toggleBtn) toggleBtn.removeAttribute('disabled');
            
        } catch (error) {
            console.error('Training error:', error);
            this.updateTrainingStatus(`Training failed: ${error.message}`);
        }
        
        this.isTraining = false;
    }

    async trainAllCells() {
        const cellsToTrain = Array.from(this.gridCells.entries())
            .filter(([key, data]) => data.trainingData.length >= 5);
        
        if (cellsToTrain.length === 0) {
            this.updateTrainingStatus('No cells with sufficient data to train');
            return;
        }
        
        this.isTraining = true;
        this.updateTrainingStatus(`Training ${cellsToTrain.length} cells...`);
        
        try {
            const tf = await import('@tensorflow/tfjs');
            
            for (let i = 0; i < cellsToTrain.length; i++) {
                const [cellKey, cellData] = cellsToTrain[i];
                const percent = Math.round(((i + 1) / cellsToTrain.length) * 100);
                this.updateTrainingStatus(`Training cell ${i + 1}/${cellsToTrain.length} (${percent}%)...`);
                await this.trainCellModel(tf, cellKey, cellData);
                
                // Update statistics periodically to show progress
                if (i % 5 === 0 || i === cellsToTrain.length - 1) {
                    this.updateStatistics();
                }
            }
            
            this.updateTrainingStatus(`All ${cellsToTrain.length} cells trained successfully!`);
            this.updateStatistics();
            
            // Enable prediction toggle
            const toggleBtn = this.shadowRoot.querySelector('#togglePrediction');
            console.log('KiloVisiNet: Toggle Prediction button found:', !!toggleBtn);
            if (toggleBtn) {
                toggleBtn.removeAttribute('disabled');
                console.log('KiloVisiNet: Use AI Prediction button enabled!');
            } else {
                console.error('KiloVisiNet: Could not find #togglePrediction button!');
            }
            
        } catch (error) {
            console.error('Training error:', error);
            this.updateTrainingStatus(`Training failed: ${error.message}`);
        }
        
        this.isTraining = false;
    }

    async trainCellModel(tf, cellKey, cellData) {
        const trainingData = cellData.trainingData;
        
        // Prepare training data
        const xs = trainingData.map(d => [d.x, d.y]);
        const ys = trainingData.map(d => d.distances);
        const outputSize = ys[0].length;
        
        // Normalize inputs - use cell bounds for local normalization
        const xMin = cellData.bounds.minX;
        const xMax = cellData.bounds.maxX;
        const yMin = cellData.bounds.minY;
        const yMax = cellData.bounds.maxY;
        
        const xsNorm = xs.map(([x, y]) => {
            const xNorm = 2 * (x - xMin) / (xMax - xMin || 1) - 1;
            const yNorm = 2 * (y - yMin) / (yMax - yMin || 1) - 1;
            return [xNorm, yNorm];
        });
        
        // Normalize outputs
        let dMin = Infinity, dMax = -Infinity;
        for (const sample of trainingData) {
            for (const d of sample.distances) {
                dMin = Math.min(dMin, d);
                dMax = Math.max(dMax, d);
            }
        }
        const ysNorm = ys.map(distances => 
            distances.map(d => (d - dMin) / (dMax - dMin || 1))
        );
        
        // Create tensors
        const xTensor = tf.tensor2d(xsNorm);
        const yTensor = tf.tensor2d(ysNorm);
        
        // Create smaller, local model (since each cell has smaller domain)
        // Architecture: 2 → 64 → 128 → 64 → outputSize
        const model = tf.sequential({
            layers: [
                tf.layers.dense({ inputShape: [2], units: 64, activation: 'relu' }),
                tf.layers.dense({ units: 128, activation: 'relu' }),
                tf.layers.dense({ units: 64, activation: 'relu' }),
                tf.layers.dense({ units: outputSize, activation: 'relu' })
            ]
        });
        
        model.compile({
            optimizer: tf.train.adam(0.005),
            loss: 'meanSquaredError',
            metrics: ['mae']
        });
        
        // Train with fewer epochs (smaller local problem)
        await model.fit(xTensor, yTensor, {
            epochs: 200,
            batchSize: Math.min(32, trainingData.length),
            validationSplit: 0.1,
            shuffle: true,
            verbose: 0
        });
        
        // Store model and normalization params
        cellData.model = model;
        cellData.normalizationParams = { xMin, xMax, yMin, yMax, dMin, dMax };
        
        // Clean up tensors
        xTensor.dispose();
        yTensor.dispose();
    }

    async predictAndUpdateRays(position) {
        const { cellX, cellY } = this.getGridCell(position);
        const cellKey = this.getCellKey(cellX, cellY);
        const cellData = this.gridCells.get(cellKey);
        
        console.log('KiloVisiNet: Predicting for cell', cellKey, 'has model:', !!cellData?.model);
        
        if (!cellData || !cellData.model || !cellData.normalizationParams) {
            // No model for this cell, fall back to ray casting
            console.warn('KiloVisiNet: No trained model for cell', cellKey, '- falling back to ray casting');
            eventBus.emit('kilovisinet:computeVisibility', { 
                position, 
                numRays: this.numRays 
            });
            return;
        }
        
        try {
            const tf = await import('@tensorflow/tfjs');
            const { xMin, xMax, yMin, yMax, dMin, dMax } = cellData.normalizationParams;
            
            // Normalize input
            const xNorm = 2 * (position.x - xMin) / (xMax - xMin || 1) - 1;
            const yNorm = 2 * (position.y - yMin) / (yMax - yMin || 1) - 1;
            
            // Clamp to valid range
            const xNormClamped = Math.max(-1, Math.min(1, xNorm));
            const yNormClamped = Math.max(-1, Math.min(1, yNorm));
            
            // Predict
            const inputTensor = tf.tensor2d([[xNormClamped, yNormClamped]]);
            const outputTensor = cellData.model.predict(inputTensor);
            const output = await outputTensor.data();
            
            // Denormalize distances
            const distances = Array.from(output).map(d => d * (dMax - dMin) + dMin);
            
            // Convert to visibility polygon
            const visibilityPoly = [];
            for (let i = 0; i < distances.length; i++) {
                const angle = (i / distances.length) * 2 * Math.PI;
                const dist = distances[i];
                visibilityPoly.push({
                    x: position.x + dist * Math.cos(angle),
                    y: position.y + dist * Math.sin(angle)
                });
            }
            
            console.log('KiloVisiNet: Predicted polygon with', visibilityPoly.length, 'vertices');
            // Clear regular visibility and show only prediction
            eventBus.emit('kilovisinet:clearRegularVisibility');
            eventBus.emit('kilovisinet:setPredictedVisibility', visibilityPoly);
            
            // Clean up
            inputTensor.dispose();
            outputTensor.dispose();
            
        } catch (error) {
            console.error('Prediction error:', error);
        }
    }

    togglePrediction() {
        this.useModelPrediction = !this.useModelPrediction;
        const btn = this.shadowRoot.querySelector('#togglePrediction');
        const raySlider = this.shadowRoot.querySelector('#raySlider');
        
        if (this.useModelPrediction) {
            btn.setAttribute('selected', '');
            btn.textContent = '✓ Using AI (Kilo)';
            raySlider?.setAttribute('disabled', '');
            
            console.log('KiloVisiNet: AI Prediction mode ENABLED');
            // Trigger immediate prediction
            eventBus.emit('kilovisinet:requestObserverPosition', (observerPos) => {
                if (observerPos) {
                    console.log('KiloVisiNet: Triggering prediction for', observerPos);
                    this.predictAndUpdateRays(observerPos);
                }
            });
        } else {
            btn.removeAttribute('selected');
            btn.textContent = '';
            const icon = document.createElement('md-icon');
            icon.setAttribute('slot', 'icon');
            icon.textContent = 'psychology';
            btn.appendChild(icon);
            btn.appendChild(document.createTextNode('Use AI Prediction'));
            raySlider?.removeAttribute('disabled');
            
            console.log('KiloVisiNet: AI Prediction mode DISABLED');
            eventBus.emit('kilovisinet:setPredictedVisibility', []);
            eventBus.emit('kilovisinet:clearRegularVisibility');
            eventBus.emit('kilovisinet:requestObserverPosition', (observerPos) => {
                if (observerPos) {
                    eventBus.emit('kilovisinet:computeVisibility', { 
                        position: observerPos, 
                        numRays: this.numRays 
                    });
                }
            });
        }
    }

    updateStatistics() {
        const statsDiv = this.shadowRoot.querySelector('#statistics');
        if (!statsDiv) return;
        
        let totalCells = this.gridCells.size;
        let trainedCells = 0;
        let totalSamples = 0;
        
        for (const [key, cell] of this.gridCells) {
            if (cell.model) trainedCells++;
            totalSamples += cell.trainingData.length;
        }
        
        const trainedPercent = totalCells > 0 ? Math.round((trainedCells / totalCells) * 100) : 0;
        const statusColor = trainedCells === 0 ? '#FF9800' : trainedCells === totalCells ? '#4CAF50' : '#2196F3';
        const statusIcon = trainedCells === 0 ? '⚪' : trainedCells === totalCells ? '✅' : '🔄';
        
        statsDiv.innerHTML = `
            <div style="font-size: 0.75rem; padding: 8px; background: rgba(76, 175, 80, 0.08); border-radius: 6px;">
                <div style="font-weight: 600; color: ${statusColor}; margin-bottom: 4px;">${statusIcon} Grid Statistics</div>
                <div style="font-family: monospace; line-height: 1.6;">
                    <div>Total Cells: ${totalCells}</div>
                    <div style="color: ${statusColor}; font-weight: 600;">Trained: ${trainedCells}/${totalCells} (${trainedPercent}%)</div>
                    <div>Total Samples: ${totalSamples.toLocaleString()}</div>
                    <div>Cell Size: ${this.cellSize}px</div>
                </div>
            </div>
        `;
    }

    updateTrainingStatus(message) {
        const status = this.shadowRoot.querySelector('#trainingStatus');
        if (status) {
            status.textContent = message;
        }
    }

    async saveAllData() {
        const hasTrainedModels = Array.from(this.gridCells.values()).some(cell => cell.model !== null);
        
        if (hasTrainedModels) {
            const saveModels = confirm(
                'Some cells have trained models.\n\n' +
                'Click OK to save ONLY training data (smaller file, requires retraining)\n' +
                'Click Cancel to save models too (larger, but no retraining needed)'
            );
            
            if (!saveModels) {
                await this.saveAllDataWithModels();
                return;
            }
        }
        
        // Save training data only
        const data = {
            cellSize: this.cellSize,
            numRays: this.numRays,
            gridCells: Array.from(this.gridCells.entries()).map(([key, cell]) => ({
                key,
                cellX: cell.cellX,
                cellY: cell.cellY,
                bounds: cell.bounds,
                trainingData: cell.trainingData,
                normalizationParams: cell.normalizationParams,
                hasTrained: cell.model !== null
            })),
            timestamp: new Date().toISOString()
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `kilovisinet-data-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        
        this.updateTrainingStatus('Data saved (models NOT included - will need retraining)');
    }
    
    async saveAllDataWithModels() {
        try {
            const tf = await import('@tensorflow/tfjs');
            this.updateTrainingStatus('Saving models... this may take a moment');
            
            // Save configuration and training data
            const configData = {
                cellSize: this.cellSize,
                numRays: this.numRays,
                gridCells: Array.from(this.gridCells.entries()).map(([key, cell]) => ({
                    key,
                    cellX: cell.cellX,
                    cellY: cell.cellY,
                    bounds: cell.bounds,
                    trainingData: cell.trainingData,
                    normalizationParams: cell.normalizationParams,
                    hasTrained: cell.model !== null
                })),
                timestamp: new Date().toISOString()
            };
            
            // Save each trained model
            const modelsData = {};
            for (const [key, cell] of this.gridCells) {
                if (cell.model) {
                    const modelJSON = await cell.model.save(tf.io.withSaveHandler(async (artifacts) => artifacts));
                    modelsData[key] = {
                        modelTopology: modelJSON.modelTopology,
                        weightSpecs: modelJSON.weightSpecs,
                        weightData: Array.from(new Uint8Array(modelJSON.weightData))
                    };
                }
            }
            
            // Combine everything
            const fullData = {
                config: configData,
                models: modelsData
            };
            
            const blob = new Blob([JSON.stringify(fullData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `kilovisinet-full-${Date.now()}.json`;
            a.click();
            URL.revokeObjectURL(url);
            
            this.updateTrainingStatus('✓ Data AND models saved successfully!');
        } catch (error) {
            console.error('Error saving models:', error);
            this.updateTrainingStatus('Error saving models: ' + error.message);
        }
    }

    async loadAllData() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            try {
                const text = await file.text();
                const data = JSON.parse(text);
                
                // Check if this is a full save with models or just data
                if (data.config && data.models) {
                    await this.loadAllDataWithModels(data);
                } else {
                    await this.loadDataOnly(data);
                }
                
            } catch (error) {
                console.error('Error loading data:', error);
                alert('Error loading data: ' + error.message);
            }
        };
        
        input.click();
    }
    
    async loadDataOnly(data) {
        this.cellSize = data.cellSize;
        this.numRays = data.numRays;
        
        // Restore grid cells (without models, just data)
        this.gridCells.clear();
        for (const cellInfo of data.gridCells) {
            this.gridCells.set(cellInfo.key, {
                cellX: cellInfo.cellX,
                cellY: cellInfo.cellY,
                bounds: cellInfo.bounds,
                trainingData: cellInfo.trainingData,
                normalizationParams: cellInfo.normalizationParams,
                model: null
            });
        }
        
        // Update UI
        const cellSizeSlider = this.shadowRoot.querySelector('#cellSizeSlider');
        const cellSizeValue = this.shadowRoot.querySelector('#cellSizeValue');
        const raySlider = this.shadowRoot.querySelector('#raySlider');
        const rayValue = this.shadowRoot.querySelector('#rayValue');
        
        if (cellSizeSlider) cellSizeSlider.value = this.cellSize;
        if (cellSizeValue) cellSizeValue.textContent = this.cellSize;
        if (raySlider) raySlider.value = this.numRays;
        if (rayValue) rayValue.textContent = this.numRays;
        
        this.updateStatistics();
        this.updateTrainingStatus(`Loaded ${this.gridCells.size} cells. Models need retraining.`);
        
        // Enable train all button
        const trainAllBtn = this.shadowRoot.querySelector('#trainAll');
        if (trainAllBtn) trainAllBtn.removeAttribute('disabled');
    }
    
    async loadAllDataWithModels(data) {
        try {
            const tf = await import('@tensorflow/tfjs');
            this.updateTrainingStatus('Loading models... this may take a moment');
            
            const config = data.config;
            this.cellSize = config.cellSize;
            this.numRays = config.numRays;
            
            // Restore grid cells with models
            this.gridCells.clear();
            let loadedModels = 0;
            
            for (const cellInfo of config.gridCells) {
                const cell = {
                    cellX: cellInfo.cellX,
                    cellY: cellInfo.cellY,
                    bounds: cellInfo.bounds,
                    trainingData: cellInfo.trainingData,
                    normalizationParams: cellInfo.normalizationParams,
                    model: null
                };
                
                // Load model if it exists
                if (data.models[cellInfo.key]) {
                    const modelData = data.models[cellInfo.key];
                    const weightData = new Uint8Array(modelData.weightData).buffer;
                    
                    cell.model = await tf.loadLayersModel(tf.io.fromMemory(
                        modelData.modelTopology,
                        modelData.weightSpecs,
                        weightData
                    ));
                    loadedModels++;
                }
                
                this.gridCells.set(cellInfo.key, cell);
            }
            
            // Update UI
            const cellSizeSlider = this.shadowRoot.querySelector('#cellSizeSlider');
            const cellSizeValue = this.shadowRoot.querySelector('#cellSizeValue');
            const raySlider = this.shadowRoot.querySelector('#raySlider');
            const rayValue = this.shadowRoot.querySelector('#rayValue');
            
            if (cellSizeSlider) cellSizeSlider.value = this.cellSize;
            if (cellSizeValue) cellSizeValue.textContent = this.cellSize;
            if (raySlider) raySlider.value = this.numRays;
            if (rayValue) rayValue.textContent = this.numRays;
            
            this.updateStatistics();
            this.updateTrainingStatus(`✓ Loaded ${this.gridCells.size} cells with ${loadedModels} trained models!`);
            
            // Enable prediction if models loaded
            if (loadedModels > 0) {
                const toggleBtn = this.shadowRoot.querySelector('#togglePrediction');
                if (toggleBtn) toggleBtn.removeAttribute('disabled');
            }
            
        } catch (error) {
            console.error('Error loading models:', error);
            this.updateTrainingStatus('Error loading models: ' + error.message);
        }
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
                    background: var(--floating-surface, #F0F4FF);
                    color: var(--floating-on-surface, #06304b);
                    border-radius: 12px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.12);
                    min-width: 320px;
                    max-width: 380px;
                    overflow: hidden;
                }
                .window-header {
                    background: linear-gradient(135deg, #2196F3, #1976D2);
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
                    max-height: 600px;
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
                .hint { 
                    font-size: 0.85rem; 
                    opacity: 0.8; 
                    margin-top: 8px;
                    line-height: 1.4;
                }
                .slider-group {
                    margin: 16px 0;
                    padding: 12px;
                    background: rgba(0,0,0,0.03);
                    border-radius: 8px;
                }
                .slider-label {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 8px;
                    font-size: 0.9rem;
                    font-weight: 500;
                }
                .slider-value {
                    font-weight: 600;
                    color: #2196F3;
                }
                input[type="range"] {
                    width: 100%;
                    height: 6px;
                    background: rgba(0,0,0,0.1);
                    border-radius: 3px;
                    outline: none;
                    -webkit-appearance: none;
                }
                input[type="range"]::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    appearance: none;
                    width: 18px;
                    height: 18px;
                    background: #2196F3;
                    border-radius: 50%;
                    cursor: pointer;
                }
                input[type="range"]::-moz-range-thumb {
                    width: 18px;
                    height: 18px;
                    background: #2196F3;
                    border-radius: 50%;
                    cursor: pointer;
                    border: none;
                }
                .training-section {
                    margin-top: 16px;
                    padding: 12px;
                    background: rgba(33, 150, 243, 0.05);
                    border-radius: 8px;
                    border: 1px solid rgba(33, 150, 243, 0.2);
                }
                .section-title {
                    font-weight: 600;
                    font-size: 0.875rem;
                    color: #2196F3;
                    margin-bottom: 12px;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                .training-status {
                    font-size: 0.8rem;
                    color: #2196F3;
                    margin: 8px 0;
                    min-height: 20px;
                    font-style: italic;
                }
                .tool-button[selected] {
                    background: #2196F3;
                    color: white;
                }
                @keyframes pulse {
                    0%, 100% { transform: scale(1); box-shadow: 0 2px 4px rgba(0,0,0,0.2); }
                    50% { transform: scale(1.05); box-shadow: 0 4px 12px rgba(33, 150, 243, 0.5); }
                }
            </style>
            <div class="window-container">
                <div class="window-header">
                    <div class="window-title">
                        <md-icon>grid_4x4</md-icon>
                        <span>Kilo VisiNet Training</span>
                    </div>
                    <div class="window-controls">
                        <button class="control-btn minimize-btn" title="Minimize"><md-icon>remove</md-icon></button>
                        <button class="control-btn close-btn" title="Close"><md-icon>close</md-icon></button>
                    </div>
                </div>
                <div class="window-content">
                    <md-filled-button id="placeObserver" class="tool-button">
                        <md-icon slot="icon">visibility</md-icon>
                        Place/Move Observer
                    </md-filled-button>
                    
                    <div class="slider-group">
                        <div class="slider-label">
                            <span>Cell Size (px)</span>
                            <span class="slider-value" id="cellSizeValue">50</span>
                        </div>
                        <input type="range" id="cellSizeSlider" min="20" max="200" value="50" step="10">
                    </div>
                    
                    <div class="slider-group">
                        <div class="slider-label">
                            <span>Number of Rays</span>
                            <span class="slider-value" id="rayValue">36</span>
                        </div>
                        <input type="range" id="raySlider" min="8" max="360" value="36" step="1">
                    </div>
                    
                    <md-outlined-button id="clearTraining" class="tool-button">
                        <md-icon slot="icon">clear</md-icon>
                        Clear All
                    </md-outlined-button>
                    
                    <div class="training-section">
                        <div class="section-title">Kilo-NeRF Style Training</div>
                        
                        <div class="hint" style="background: rgba(33, 150, 243, 0.1); padding: 8px; border-radius: 4px; margin-bottom: 12px; font-size: 0.8rem;">
                            <strong>📋 Quick Start:</strong><br>
                            1️⃣ Click "Generate Cell Data"<br>
                            2️⃣ Click "Train All Cells" (takes a few minutes)<br>
                            3️⃣ Place observer and enable "Use AI Prediction"
                        </div>
                        
                        <md-filled-tonal-button id="generateData" class="tool-button">
                            <md-icon slot="icon">grid_on</md-icon>
                            Generate Cell Data
                        </md-filled-tonal-button>
                        
                        <div id="statistics"></div>
                        <div id="currentCellInfo"></div>
                        
                        <md-filled-button id="trainCell" class="tool-button" disabled>
                            <md-icon slot="icon">cell_tower</md-icon>
                            Train Current Cell
                        </md-filled-button>
                        
                        <md-filled-button id="trainAll" class="tool-button" disabled>
                            <md-icon slot="icon">model_training</md-icon>
                            Train All Cells
                        </md-filled-button>
                        
                        <md-filled-tonal-button id="togglePrediction" class="tool-button" disabled>
                            <md-icon slot="icon">psychology</md-icon>
                            Use AI Prediction
                        </md-filled-tonal-button>
                        
                        <md-outlined-button id="toggleCellBounds" class="tool-button">
                            <md-icon slot="icon">grid_on</md-icon>
                            Show Grid
                        </md-outlined-button>
                        
                        <div class="training-status" id="trainingStatus"></div>
                        
                        <md-outlined-button id="saveData" class="tool-button">
                            <md-icon slot="icon">save</md-icon>
                            Save All Data
                        </md-outlined-button>
                        <md-outlined-button id="loadData" class="tool-button">
                            <md-icon slot="icon">upload</md-icon>
                            Load All Data
                        </md-outlined-button>
                    </div>
                    
                    <div class="hint">
                        <strong>💡 About Kilo-NeRF Approach:</strong><br>
                        Environment is divided into grid cells. Each cell trains its own small neural network on local data, 
                        enabling efficient distributed learning and inference.<br><br>
                        <strong>Train Current Cell:</strong> Only trains the cell containing the observer (fast, requires observer placement).<br>
                        <strong>Train All Cells:</strong> Trains all cells with data (slower but complete coverage).
                    </div>
                </div>
            </div>
        `;
    }
}

customElements.define('kilovisinet-training-window', KiloVisiNetTrainingWindow);
