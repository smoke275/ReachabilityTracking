/**
 * VisibilNetTrainingWindow Web Component
 * Floating window for VisibilNet training data generation with ray-based visibility
 */
import { eventBus } from '../utils/EventBus.js';

export class VisibilNetTrainingWindow extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };
        this.position = { x: 140, y: 140 };
        // Load numRays from localStorage or default to 36
        const savedNumRays = localStorage.getItem('visibilnet:numRays');
        this.numRays = savedNumRays ? parseInt(savedNumRays) : 36;
        this.trainingData = []; // {x, y, distances: [d1, d2, ..., dm]}
        this.fullTrainingData = []; // Store complete dataset for filtering
        this.model = null;
        this.isTraining = false;
        this.useModelPrediction = false;
        this.lossHistory = [];
        this.valLossHistory = [];
        this.displaySamples = false;
    }

    connectedCallback() {
        this.render();
        this.setupEventListeners();
        this.updatePosition();
        // Initialize slider and display with saved value
        const raySlider = this.shadowRoot.querySelector('#raySlider');
        const rayValue = this.shadowRoot.querySelector('#rayValue');
        if (raySlider) raySlider.value = this.numRays;
        if (rayValue) rayValue.textContent = this.numRays;
    }

    setupEventListeners() {
        const header = this.shadowRoot.querySelector('.window-header');
        const closeBtn = this.shadowRoot.querySelector('.close-btn');
        const minimizeBtn = this.shadowRoot.querySelector('.minimize-btn');
        const placeObserverBtn = this.shadowRoot.querySelector('#placeObserver');
        const clearBtn = this.shadowRoot.querySelector('#clearTraining');
        const raySlider = this.shadowRoot.querySelector('#raySlider');
        const rayValue = this.shadowRoot.querySelector('#rayValue');
        const generateDataBtn = this.shadowRoot.querySelector('#generateData');
        const trainModelBtn = this.shadowRoot.querySelector('#trainModel');
        const togglePredictionBtn = this.shadowRoot.querySelector('#togglePrediction');
        const saveDataBtn = this.shadowRoot.querySelector('#saveData');
        const loadDataBtn = this.shadowRoot.querySelector('#loadData');
        const displaySamplesBtn = this.shadowRoot.querySelector('#displaySamples');
        const applyFilterBtn = this.shadowRoot.querySelector('#applyFilter');
        const resetFilterBtn = this.shadowRoot.querySelector('#resetFilter');
        
        header.addEventListener('mousedown', (e) => this.startDragging(e));
        document.addEventListener('mousemove', (e) => this.drag(e));
        document.addEventListener('mouseup', () => this.stopDragging());

        closeBtn?.addEventListener('click', () => this.close());
        minimizeBtn?.addEventListener('click', () => this.minimize());

        placeObserverBtn?.addEventListener('click', () => {
            eventBus.emit('visibilnet:setPlacementMode', 'observer');
        });
        
        clearBtn?.addEventListener('click', () => {
            eventBus.emit('visibilnet:clear');
            this.trainingData = [];
            this.fullTrainingData = [];
            this.displaySamples = false;
            this.updateDataCount();
            const displayBtn = this.shadowRoot.querySelector('#displaySamples');
            if (displayBtn) {
                displayBtn.setAttribute('disabled', '');
                const icon = displayBtn.querySelector('md-icon');
                if (icon) icon.textContent = 'scatter_plot';
            }
        });

        raySlider?.addEventListener('input', (e) => {
            if (this.useModelPrediction) return; // Don't update if using AI prediction
            this.numRays = parseInt(e.target.value);
            rayValue.textContent = this.numRays;
            // Persist to localStorage
            localStorage.setItem('visibilnet:numRays', this.numRays);
            eventBus.emit('visibilnet:updateRayCount', this.numRays);
        });

        generateDataBtn?.addEventListener('click', () => this.generateTrainingData());
        trainModelBtn?.addEventListener('click', () => this.trainModel());
        const continueTrainingBtn = this.shadowRoot.querySelector('#continueTraining');
        continueTrainingBtn?.addEventListener('click', () => this.continueTraining());
        togglePredictionBtn?.addEventListener('click', () => this.togglePrediction());
        saveDataBtn?.addEventListener('click', () => this.saveTrainingData());
        loadDataBtn?.addEventListener('click', () => this.loadTrainingData());
        
        applyFilterBtn?.addEventListener('click', () => this.applyDataFilter());
        resetFilterBtn?.addEventListener('click', () => this.resetDataFilter());

        const saveModelBtn = this.shadowRoot.querySelector('#saveModel');
        const loadModelBtn = this.shadowRoot.querySelector('#loadModel');
        saveModelBtn?.addEventListener('click', () => this.saveModel());
        loadModelBtn?.addEventListener('click', () => this.loadModel());
        displaySamplesBtn?.addEventListener('click', () => this.toggleDisplaySamples());

        // Listen for observer position updates
        eventBus.on('visibilnet:observerMoved', (position) => {
            // Display normalized values
            this.updateNormalizedDisplay(position);
            
            // Auto-recompute when observer is dragged
            if (this.useModelPrediction && this.model) {
                this.predictAndUpdateRays(position);
            } else {
                eventBus.emit('visibilnet:computeVisibility', { 
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
        eventBus.emit('visibilnet:windowClosed');
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

    async generateTrainingData() {
        this.updateTrainingStatus('Generating training data...');
        
        // Request polygons and bounds from canvas
        eventBus.emit('visibilnet:requestEnvironment', (data) => {
            if (!data || !data.polygons || data.polygons.length === 0) {
                this.updateTrainingStatus('Error: No polygons found!');
                return;
            }
            
            const { polygons, bounds } = data;
            
            // Import service dynamically to access sampling method
            import('../services/VisibilNetService.js').then(module => {
                const service = module.visibilnetService;
                
                // Sample free space with very dense grid (3px spacing for maximum coverage)
                const freeSpaceSamples = service.sampleFreeSpace(polygons, bounds, 3);
                
                if (freeSpaceSamples.length === 0) {
                    this.updateTrainingStatus('Error: No free space found!');
                    return;
                }
                
                // For each sample point, compute ray distances
                this.trainingData = freeSpaceSamples.map(point => {
                    const distances = service.getRayDistances(point, polygons, bounds, this.numRays);
                    return {
                        x: point.x,
                        y: point.y,
                        distances: distances
                    };
                });
                
                this.fullTrainingData = [...this.trainingData];
                this.updateFilterInputsFromData();
                this.updateDataCount();
                this.updateTrainingStatus(`Generated ${this.trainingData.length} samples (3px grid) with ${this.numRays} rays each`);
                
                // Enable train button and display samples button
                const trainBtn = this.shadowRoot.querySelector('#trainModel');
                if (trainBtn && this.trainingData.length >= 5) {
                    trainBtn.removeAttribute('disabled');
                }
                const displayBtn = this.shadowRoot.querySelector('#displaySamples');
                if (displayBtn && this.trainingData.length > 0) {
                    displayBtn.removeAttribute('disabled');
                }
            });
        });
    }

    async trainModel() {
        if (this.trainingData.length < 5) {
            this.updateTrainingStatus('Need at least 5 samples to train');
            return;
        }

        this.isTraining = true;
        this.updateTrainingStatus('Training model...');

        try {
            // Dynamically import TensorFlow.js
            const tf = await import('@tensorflow/tfjs');

            // Prepare training data
            const xs = this.trainingData.map(d => [d.x, d.y]);
            const ys = this.trainingData.map(d => d.distances); // Array of distance arrays
            const outputSize = ys[0].length; // Number of rays

            // Normalize inputs (min-max normalization) - separate for x and y
            // Use full dataset for normalization if available to maintain consistent scale
            const normalizationSource = (this.fullTrainingData && this.fullTrainingData.length > 0) 
                ? this.fullTrainingData 
                : this.trainingData;

            let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
            for (const sample of normalizationSource) {
                xMin = Math.min(xMin, sample.x);
                xMax = Math.max(xMax, sample.x);
                yMin = Math.min(yMin, sample.y);
                yMax = Math.max(yMax, sample.y);
            }
            
            // Normalize to [-1, 1] then apply Fourier encoding
            const xsNorm = xs.map(([x, y]) => {
                const xNorm = 2 * (x - xMin) / (xMax - xMin || 1) - 1;
                const yNorm = 2 * (y - yMin) / (yMax - yMin || 1) - 1;
                return this.fourierEncode(xNorm, yNorm, 6); // 6 frequencies = 24 features
            });
            
            const inputSize = xsNorm[0].length; // 24 features

            // Normalize outputs (distances) without flattening - iterate to avoid stack overflow
            let dMin = Infinity, dMax = -Infinity;
            for (const sample of normalizationSource) {
                for (const d of sample.distances) {
                    dMin = Math.min(dMin, d);
                    dMax = Math.max(dMax, d);
                }
            }
            const ysNorm = ys.map(distances => 
                distances.map(d => (d - dMin) / (dMax - dMin))
            );

            // Create tensors
            const xTensor = tf.tensor2d(xsNorm);
            const yTensor = tf.tensor2d(ysNorm);

            // Create larger model with Fourier features (24 input dimensions)
            // Architecture: 24 → 256 → 512 → 512 → 256 → outputSize
            const initialLR = 0.003;
            this.model = tf.sequential({
                layers: [
                    tf.layers.dense({ inputShape: [inputSize], units: 256, activation: 'elu' }),
                    tf.layers.dense({ units: 512, activation: 'elu' }),
                    tf.layers.dense({ units: 512, activation: 'elu' }),
                    tf.layers.dense({ units: 256, activation: 'elu' }),
                    tf.layers.dense({ units: outputSize, activation: 'relu' }) // ReLU ensures distances >= 0
                ]
            });

            // Compile model with initial learning rate
            this.model.compile({
                optimizer: tf.train.adam(initialLR),
                loss: 'meanSquaredError',
                metrics: ['mae']
            });
            
            // Display architecture info
            const modelInfo = this.shadowRoot.querySelector('#modelInfo');
            modelInfo.textContent = `Arch: ${inputSize}→256→512→512→256→${outputSize}(relu) | Init LR: ${initialLR} | Fourier Features`;

            // Train model with cosine annealing learning rate
            const epochInput = this.shadowRoot.querySelector('#epochInput');
            const epochs = epochInput ? parseInt(epochInput.value) : 1000;
            const minLR = 0.0001;
            const statusDiv = this.shadowRoot.querySelector('#trainingStatus');
            const canvas = this.shadowRoot.querySelector('#lossGraph');
            
            // Reset and show loss graph
            this.lossHistory = [];
            this.valLossHistory = [];
            if (canvas) canvas.style.display = 'block';
            
            await this.model.fit(xTensor, yTensor, {
                epochs: epochs,
                batchSize: Math.min(128, this.trainingData.length), // Larger batch with more data
                validationSplit: 0.15,
                shuffle: true,
                verbose: 0,
                callbacks: {
                    onEpochEnd: (epoch, logs) => {
                        // Cosine annealing learning rate schedule
                        const cosineDecay = minLR + 0.5 * (initialLR - minLR) * (1 + Math.cos(Math.PI * epoch / epochs));
                        tf.train.adam(cosineDecay); // Update optimizer LR
                        
                        // Track loss history
                        this.lossHistory.push(logs.loss);
                        this.valLossHistory.push(logs.val_loss);
                        
                        // Enable AI prediction after first epoch
                        if (epoch === 0) {
                            // Store normalization params early so prediction can work
                            this.normalizationParams = { xMin, xMax, yMin, yMax, dMin, dMax };
                            const toggleBtn = this.shadowRoot.querySelector('#togglePrediction');
                            if (toggleBtn) toggleBtn.removeAttribute('disabled');
                        }
                        
                        // Update every 10 epochs for progress visibility
                        if (epoch % 10 === 0 || epoch === epochs - 1) {
                            statusDiv.textContent = `Epoch ${epoch}/${epochs} | Loss: ${logs.loss.toFixed(6)} | Val: ${logs.val_loss.toFixed(6)} | LR: ${cosineDecay.toFixed(6)}`;
                            this.drawLossGraph();
                        }
                        
                        // If AI prediction is enabled, update visualization every 5 epochs for live feedback
                        if (this.useModelPrediction && epoch % 5 === 0) {
                            eventBus.emit('visibilnet:requestObserverPosition', (observerPos) => {
                                if (observerPos) {
                                    this.predictAndUpdateRays(observerPos);
                                }
                            });
                        }
                    }
                }
            });

            // Store normalization params (separate for x and y)
            this.normalizationParams = { xMin, xMax, yMin, yMax, dMin, dMax };

            // Clean up tensors
            xTensor.dispose();
            yTensor.dispose();

            this.updateTrainingStatus('Model trained successfully!');
            
            // Enable prediction toggle, save model, and continue training buttons
            const toggleBtn = this.shadowRoot.querySelector('#togglePrediction');
            if (toggleBtn) {
                toggleBtn.removeAttribute('disabled');
                toggleBtn.textContent = 'Use AI Prediction';
            }
            const saveModelBtn = this.shadowRoot.querySelector('#saveModel');
            if (saveModelBtn) saveModelBtn.removeAttribute('disabled');
            const continueBtn = this.shadowRoot.querySelector('#continueTraining');
            if (continueBtn) continueBtn.removeAttribute('disabled');

        } catch (error) {
            console.error('Training error:', error);
            this.updateTrainingStatus(`Training failed: ${error.message}`);
        }

        this.isTraining = false;
    }

    async predictAndUpdateRays(position) {
        if (!this.model || !this.normalizationParams) return;

        try {
            const tf = await import('@tensorflow/tfjs');
            const { xMin, xMax, yMin, yMax, dMin, dMax } = this.normalizationParams;

            // Normalize input to [-1, 1] with separate x/y ranges
            let xNorm = 2 * (position.x - xMin) / (xMax - xMin || 1) - 1;
            let yNorm = 2 * (position.y - yMin) / (yMax - yMin || 1) - 1;
            
            // Log when extrapolating outside training bounds
            if (xNorm < -1 || xNorm > 1 || yNorm < -1 || yNorm > 1) {
                console.warn(`⚠️ Observer outside training bounds!`, {
                    position: { x: position.x.toFixed(2), y: position.y.toFixed(2) },
                    normalized: { x: xNorm.toFixed(4), y: yNorm.toFixed(4) },
                    trainingBounds: { 
                        x: `[${xMin.toFixed(1)}, ${xMax.toFixed(1)}]`,
                        y: `[${yMin.toFixed(1)}, ${yMax.toFixed(1)}]`
                    }
                });
            }
            
            // CRITICAL: Clamp to [-1, 1] to prevent extrapolation outside training distribution
            // Neural networks behave unpredictably with out-of-range inputs
            xNorm = Math.max(-1, Math.min(1, xNorm));
            yNorm = Math.max(-1, Math.min(1, yNorm));
            
            // Apply Fourier encoding
            const fourierFeatures = this.fourierEncode(xNorm, yNorm, 6);

            // Predict ray distances
            const input = tf.tensor2d([fourierFeatures]);
            const prediction = this.model.predict(input);
            const normalizedDistances = await prediction.data();
            
            // Denormalize distances (output is already in original scale with linear activation)
            const distances = Array.from(normalizedDistances).map(d => 
                d * (dMax - dMin) + dMin
            );

            // Reconstruct visibility polygon from distances
            const visibilityPoly = [];
            for (let i = 0; i < distances.length; i++) {
                const angle = (i / distances.length) * 2 * Math.PI;
                const x = position.x + distances[i] * Math.cos(angle);
                const y = position.y + distances[i] * Math.sin(angle);
                visibilityPoly.push({ x, y });
            }

            // Send predicted visibility polygon to canvas
            eventBus.emit('visibilnet:setPredictedVisibility', visibilityPoly);

            // Clean up
            input.dispose();
            prediction.dispose();

        } catch (error) {
            console.error('Prediction error:', error);
        }
    }

    async continueTraining() {
        if (!this.model || !this.trainingData || this.trainingData.length < 5) {
            this.updateTrainingStatus('No model or data to continue training');
            return;
        }

        this.isTraining = true;
        this.updateTrainingStatus('Continuing training...');

        try {
            const tf = await import('@tensorflow/tfjs');

            // Compile model if not already compiled (e.g., after loading from file)
            if (!this.model.optimizer) {
                const learningRate = 0.001;
                this.model.compile({
                    optimizer: tf.train.adam(learningRate),
                    loss: 'meanSquaredError',
                    metrics: ['mae']
                });
            }

            // Prepare training data (reuse existing normalization params)
            const xs = this.trainingData.map(d => [d.x, d.y]);
            const ys = this.trainingData.map(d => d.distances);

            const { xMin, xMax, yMin, yMax, dMin, dMax } = this.normalizationParams;

            // Normalize to [-1, 1] with existing params and apply Fourier encoding
            const xsNorm = xs.map(([x, y]) => {
                const xNorm = 2 * (x - xMin) / (xMax - xMin || 1) - 1;
                const yNorm = 2 * (y - yMin) / (yMax - yMin || 1) - 1;
                return this.fourierEncode(xNorm, yNorm, 6);
            });
            const ysNorm = ys.map(distances => 
                distances.map(d => (d - dMin) / (dMax - dMin))
            );

            // Create tensors
            const xTensor = tf.tensor2d(xsNorm);
            const yTensor = tf.tensor2d(ysNorm);

            // Continue training for specified epochs
            const epochInput = this.shadowRoot.querySelector('#epochInput');
            const additionalEpochs = epochInput ? parseInt(epochInput.value) : 500;
            const initialLR = 0.001;
            const minLR = 0.0001;
            const statusDiv = this.shadowRoot.querySelector('#trainingStatus');
            const canvas = this.shadowRoot.querySelector('#lossGraph');
            
            // Show graph if hidden
            if (canvas) canvas.style.display = 'block';
            
            await this.model.fit(xTensor, yTensor, {
                epochs: additionalEpochs,
                batchSize: Math.min(128, this.trainingData.length),
                validationSplit: 0.15,
                shuffle: true,
                verbose: 0,
                callbacks: {
                    onEpochEnd: (epoch, logs) => {
                        // Cosine annealing for continue training
                        const cosineDecay = minLR + 0.5 * (initialLR - minLR) * (1 + Math.cos(Math.PI * epoch / additionalEpochs));
                        
                        // Append to existing loss history
                        this.lossHistory.push(logs.loss);
                        this.valLossHistory.push(logs.val_loss);
                        
                        if (epoch % 10 === 0 || epoch === additionalEpochs - 1) {
                            statusDiv.textContent = `Continue +${epoch}/${additionalEpochs} | Loss: ${logs.loss.toFixed(6)} | Val: ${logs.val_loss.toFixed(6)}`;
                            this.drawLossGraph();
                        }
                        
                        // If AI prediction is enabled, update visualization every 5 epochs
                        if (this.useModelPrediction && epoch % 5 === 0) {
                            eventBus.emit('visibilnet:requestObserverPosition', (observerPos) => {
                                if (observerPos) {
                                    this.predictAndUpdateRays(observerPos);
                                }
                            });
                        }
                    }
                }
            });

            // Clean up tensors
            xTensor.dispose();
            yTensor.dispose();

            this.updateTrainingStatus('Continued training complete!');
            this.isTraining = false;

        } catch (error) {
            console.error('Continue training error:', error);
            this.updateTrainingStatus('Error continuing training');
            this.isTraining = false;
        }
    }

    togglePrediction() {
        if (!this.model || !this.normalizationParams) {
            this.updateTrainingStatus('Train a model first!');
            return;
        }
        
        this.useModelPrediction = !this.useModelPrediction;
        const toggleBtn = this.shadowRoot.querySelector('#togglePrediction');
        const raySlider = this.shadowRoot.querySelector('#raySlider');

        if (this.useModelPrediction) {
            // Update button appearance
            const icon = toggleBtn?.querySelector('md-icon');
            if (icon) icon.textContent = 'psychology_alt';
            
            if (raySlider && !this.isTraining) raySlider.disabled = true;
            this.updateTrainingStatus('AI Prediction: ON');
            
            // Trigger immediate prediction if observer exists
            eventBus.emit('visibilnet:requestObserverPosition', (observerPos) => {
                if (observerPos) {
                    this.predictAndUpdateRays(observerPos);
                }
            });
        } else {
            // Revert button appearance
            const icon = toggleBtn?.querySelector('md-icon');
            if (icon) icon.textContent = 'psychology';
            
            if (raySlider) raySlider.disabled = false;
            this.updateTrainingStatus('AI Prediction: OFF');
            
            // Clear predicted visibility
            eventBus.emit('visibilnet:setPredictedVisibility', []);
        }
    }

    saveTrainingData() {
        if (this.trainingData.length === 0) {
            this.updateTrainingStatus('No data to save');
            return;
        }

        const dataStr = JSON.stringify(this.trainingData, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `visibilnet-training-data-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        this.updateTrainingStatus(`Saved ${this.trainingData.length} samples`);
    }

    loadTrainingData() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = JSON.parse(event.target.result);
                    if (Array.isArray(data) && data.length > 0) {
                        this.trainingData = data;
                        this.fullTrainingData = [...data];
                        this.updateFilterInputsFromData();
                        this.updateDataCount();
                        this.updateTrainingStatus(`Loaded ${data.length} samples`);
                        
                        // Enable train button and display samples button
                        const trainBtn = this.shadowRoot.querySelector('#trainModel');
                        if (trainBtn && this.trainingData.length >= 5) {
                            trainBtn.removeAttribute('disabled');
                        }
                        const displayBtn = this.shadowRoot.querySelector('#displaySamples');
                        if (displayBtn && this.trainingData.length > 0) {
                            displayBtn.removeAttribute('disabled');
                        }
                    } else {
                        this.updateTrainingStatus('Invalid data format');
                    }
                } catch (error) {
                    this.updateTrainingStatus(`Load failed: ${error.message}`);
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }

    toggleDisplaySamples() {
        this.displaySamples = !this.displaySamples;
        const btn = this.shadowRoot.querySelector('#displaySamples');
        
        if (this.displaySamples) {
            // Show samples - ensure we have at least some to display
            if (this.trainingData.length === 0) {
                this.updateTrainingStatus('No samples to display. Generate data first.');
                this.displaySamples = false;
                return;
            }
            
            // Always show exactly 200 random samples (or all if fewer than 200)
            let samplesToShow;
            if (this.trainingData.length <= 200) {
                samplesToShow = this.trainingData;
            } else {
                // Randomly select 200 samples
                const indices = new Set();
                while (indices.size < 200) {
                    indices.add(Math.floor(Math.random() * this.trainingData.length));
                }
                samplesToShow = Array.from(indices).map(i => this.trainingData[i]);
            }
            
            eventBus.emit('visibilnet:displaySamples', samplesToShow);
            const icon = btn?.querySelector('md-icon');
            if (icon) icon.textContent = 'visibility_off';
            this.updateTrainingStatus(`Displaying ${samplesToShow.length} of ${this.trainingData.length} samples (orange dots)`);
        } else {
            // Hide samples
            eventBus.emit('visibilnet:displaySamples', []);
            const icon = btn?.querySelector('md-icon');
            if (icon) icon.textContent = 'scatter_plot';
            this.updateTrainingStatus('Samples hidden');
        }
    }

    updateDataCount() {
        const dataCount = this.shadowRoot.querySelector('#dataCount');
        if (dataCount) {
            if (this.fullTrainingData && this.fullTrainingData.length > this.trainingData.length) {
                dataCount.textContent = `Data samples: ${this.trainingData.length} (Filtered from ${this.fullTrainingData.length})`;
            } else {
                dataCount.textContent = `Data samples: ${this.trainingData.length}`;
            }
        }
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

    drawLossGraph() {
        const canvas = this.shadowRoot.querySelector('#lossGraph');
        if (!canvas || this.lossHistory.length === 0) return;
        
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        const padding = { top: 10, right: 10, bottom: 25, left: 45 };
        const graphWidth = width - padding.left - padding.right;
        const graphHeight = height - padding.top - padding.bottom;
        
        // Clear canvas
        ctx.fillStyle = getComputedStyle(canvas).backgroundColor || '#1c1b1f';
        ctx.fillRect(0, 0, width, height);
        
        // Find max loss for scaling
        const allLosses = [...this.lossHistory, ...this.valLossHistory];
        const maxLoss = Math.max(...allLosses);
        const minLoss = Math.min(...allLosses);
        const lossRange = maxLoss - minLoss || 1;
        
        // Draw grid lines
        ctx.strokeStyle = '#444';
        ctx.lineWidth = 0.5;
        for (let i = 0; i <= 4; i++) {
            const y = padding.top + (graphHeight / 4) * i;
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(width - padding.right, y);
            ctx.stroke();
        }
        
        // Draw axes
        ctx.strokeStyle = '#888';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padding.left, padding.top);
        ctx.lineTo(padding.left, height - padding.bottom);
        ctx.lineTo(width - padding.right, height - padding.bottom);
        ctx.stroke();
        
        // Draw training loss
        if (this.lossHistory.length > 1) {
            ctx.strokeStyle = '#9C27B0'; // Purple
            ctx.lineWidth = 2;
            ctx.beginPath();
            this.lossHistory.forEach((loss, i) => {
                const x = padding.left + (i / (this.lossHistory.length - 1)) * graphWidth;
                const y = height - padding.bottom - ((loss - minLoss) / lossRange) * graphHeight;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            ctx.stroke();
        }
        
        // Draw validation loss
        if (this.valLossHistory.length > 1) {
            ctx.strokeStyle = '#00BCD4'; // Cyan
            ctx.lineWidth = 2;
            ctx.beginPath();
            this.valLossHistory.forEach((loss, i) => {
                const x = padding.left + (i / (this.valLossHistory.length - 1)) * graphWidth;
                const y = height - padding.bottom - ((loss - minLoss) / lossRange) * graphHeight;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            ctx.stroke();
        }
        
        // Draw labels
        ctx.fillStyle = '#ccc';
        ctx.font = '10px monospace';
        ctx.textAlign = 'right';
        // Y-axis labels
        for (let i = 0; i <= 4; i++) {
            const y = padding.top + (graphHeight / 4) * i;
            const val = maxLoss - (lossRange / 4) * i;
            ctx.fillText(val.toExponential(1), padding.left - 5, y + 3);
        }
        // X-axis label
        ctx.textAlign = 'center';
        ctx.fillText('Epochs', width / 2, height - 5);
        
        // Legend
        ctx.textAlign = 'left';
        ctx.fillStyle = '#9C27B0';
        ctx.fillRect(padding.left + 5, 5, 10, 2);
        ctx.fillStyle = '#ccc';
        ctx.fillText('Train', padding.left + 20, 10);
        ctx.fillStyle = '#00BCD4';
        ctx.fillRect(padding.left + 60, 5, 10, 2);
        ctx.fillStyle = '#ccc';
        ctx.fillText('Val', padding.left + 75, 10);
    }

    updateTrainingStatus(message) {
        const status = this.shadowRoot.querySelector('#trainingStatus');
        if (status) {
            status.textContent = message;
        }
    }

    updateNormalizedDisplay(position) {
        const display = this.shadowRoot.querySelector('#normalizedValues');
        if (!display) return;
        
        // Use full dataset for normalization reference if available
        const dataForBounds = (this.fullTrainingData && this.fullTrainingData.length > 0) 
            ? this.fullTrainingData 
            : this.trainingData;

        // If we have training data, use its min/max for normalization (like in actual training)
        if (dataForBounds.length > 0) {
            // Calculate min/max from training data (same as in trainModel)
            let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
            for (const sample of dataForBounds) {
                xMin = Math.min(xMin, sample.x);
                xMax = Math.max(xMax, sample.x);
                yMin = Math.min(yMin, sample.y);
                yMax = Math.max(yMax, sample.y);
            }
            
            // Normalize position to [-1, 1] using training data bounds
            const xNorm = 2 * (position.x - xMin) / (xMax - xMin || 1) - 1;
            const yNorm = 2 * (position.y - yMin) / (yMax - yMin || 1) - 1;
            
            // Check if outside training bounds
            const isOutsideBounds = position.x < xMin || position.x > xMax || 
                                   position.y < yMin || position.y > yMax;
            
            // Clamp to [-1, 1] like in prediction
            const xNormClamped = Math.max(-1, Math.min(1, xNorm));
            const yNormClamped = Math.max(-1, Math.min(1, yNorm));
            
            // Apply Fourier encoding like in training
            const fourierFeatures = this.fourierEncode(xNormClamped, yNormClamped, 6);
            
            // Warning message if outside bounds
            let warningMsg = '';
            if (isOutsideBounds) {
                warningMsg = `
                    <div style="margin-top: 8px; padding: 8px; background: rgba(255, 152, 0, 0.15); border-radius: 4px; border: 1px solid #FF9800;">
                        <div style="font-weight: 600; color: #F57C00; margin-bottom: 4px;">⚠️ OUTSIDE TRAINING BOUNDS!</div>
                        <div style="font-size: 0.7rem; line-height: 1.4; color: rgba(0,0,0,0.7);">
                            Observer is outside training data range. Predictions may be unreliable. 
                            Values clamped to [0,1] for neural network input.
                        </div>
                    </div>
                `;
            }
            
            // Check if using trained model params (for comparison)
            let trainedInfo = '';
            if (this.normalizationParams) {
                const trainedXMin = this.normalizationParams.xMin;
                const trainedXMax = this.normalizationParams.xMax;
                const trainedYMin = this.normalizationParams.yMin;
                const trainedYMax = this.normalizationParams.yMax;
                const trainedXNorm = 2 * (position.x - trainedXMin) / (trainedXMax - trainedXMin || 1) - 1;
                const trainedYNorm = 2 * (position.y - trainedYMin) / (trainedYMax - trainedYMin || 1) - 1;
                
                const boundsMatch = (Math.abs(xMin - trainedXMin) < 0.01 && Math.abs(xMax - trainedXMax) < 0.01 && 
                                   Math.abs(yMin - trainedYMin) < 0.01 && Math.abs(yMax - trainedYMax) < 0.01);
                
                trainedInfo = `
                    <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(156, 39, 176, 0.2);">
                        <div style="font-weight: 600; color: ${boundsMatch ? '#4CAF50' : '#FF9800'}; margin-bottom: 4px;">
                            ${boundsMatch ? '✓' : '⚠'} Trained Model ${boundsMatch ? '(Same Bounds)' : '(Different Bounds!)'}
                        </div>
                        ${!boundsMatch ? `<div style="margin-left: 8px; font-size: 0.7rem; color: #FF9800;">Model x_norm: ${trainedXNorm.toFixed(4)}, y_norm: ${trainedYNorm.toFixed(4)}</div>` : ''}
                    </div>
                `;
            }
            
            display.innerHTML = `
                <div style="font-size: 0.75rem; padding: 8px; background: rgba(156, 39, 176, 0.08); border-radius: 6px; margin: 8px 0;">
                    <div style="font-weight: 600; color: #9C27B0; margin-bottom: 6px;">📊 Normalized Coordinates (from Training Data)</div>
                    <div style="font-family: monospace; line-height: 1.6;">
                        <div><strong>Raw Position:</strong></div>
                        <div style="margin-left: 8px;">x: ${position.x.toFixed(2)}, y: ${position.y.toFixed(2)}</div>
                        <div style="margin-top: 4px;"><strong>Normalized:</strong></div>
                        <div style="margin-left: 8px;">x_norm: ${xNorm.toFixed(4)} → ${xNormClamped.toFixed(4)} ${xNorm !== xNormClamped ? '(clamped)' : ''}</div>
                        <div style="margin-left: 8px;">y_norm: ${yNorm.toFixed(4)} → ${yNormClamped.toFixed(4)} ${yNorm !== yNormClamped ? '(clamped)' : ''}</div>
                        <div style="margin-top: 4px;"><strong>Training Data Bounds:</strong></div>
                        <div style="margin-left: 8px;">x: [${xMin.toFixed(1)}, ${xMax.toFixed(1)}]</div>
                        <div style="margin-left: 8px;">y: [${yMin.toFixed(1)}, ${yMax.toFixed(1)}]</div>
                        <div style="margin-top: 4px;"><strong>Fourier Features:</strong> ${fourierFeatures.length} dims</div>
                        <div style="margin-left: 8px; font-size: 0.7rem; color: rgba(0,0,0,0.6); max-height: 60px; overflow-y: auto;">[${fourierFeatures.map(f => f.toFixed(3)).join(', ')}]</div>
                        ${warningMsg}
                        ${trainedInfo}
                    </div>
                </div>
            `;
        } else {
            display.innerHTML = `
                <div style="font-size: 0.75rem; padding: 8px; background: rgba(255, 152, 0, 0.1); border-radius: 6px; margin: 8px 0; color: rgba(0,0,0,0.6);">
                    <div style="font-style: italic;">ℹ️ Generate training data first to see normalized values</div>
                </div>
            `;
        }
    }

    updateFilterInputsFromData() {
        if (this.fullTrainingData.length === 0) return;

        let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
        for (const sample of this.fullTrainingData) {
            xMin = Math.min(xMin, sample.x);
            xMax = Math.max(xMax, sample.x);
            yMin = Math.min(yMin, sample.y);
            yMax = Math.max(yMax, sample.y);
        }

        const xMinInput = this.shadowRoot.querySelector('#xMinInput');
        const xMaxInput = this.shadowRoot.querySelector('#xMaxInput');
        const yMinInput = this.shadowRoot.querySelector('#yMinInput');
        const yMaxInput = this.shadowRoot.querySelector('#yMaxInput');

        if (xMinInput) xMinInput.value = Math.floor(xMin);
        if (xMaxInput) xMaxInput.value = Math.ceil(xMax);
        if (yMinInput) yMinInput.value = Math.floor(yMin);
        if (yMaxInput) yMaxInput.value = Math.ceil(yMax);
    }

    applyDataFilter() {
        if (this.fullTrainingData.length === 0) return;

        const xMin = parseFloat(this.shadowRoot.querySelector('#xMinInput').value);
        const xMax = parseFloat(this.shadowRoot.querySelector('#xMaxInput').value);
        const yMin = parseFloat(this.shadowRoot.querySelector('#yMinInput').value);
        const yMax = parseFloat(this.shadowRoot.querySelector('#yMaxInput').value);

        this.trainingData = this.fullTrainingData.filter(d => 
            d.x >= xMin && d.x <= xMax && d.y >= yMin && d.y <= yMax
        );

        this.updateDataCount();
        this.updateTrainingStatus(`Filtered to ${this.trainingData.length} samples`);
        
        // Update display if active
        if (this.displaySamples) {
            this.displaySamples = false; // Toggle off then on to refresh
            this.toggleDisplaySamples();
        }
    }

    resetDataFilter() {
        if (this.fullTrainingData.length === 0) return;
        
        this.trainingData = [...this.fullTrainingData];
        this.updateFilterInputsFromData();
        this.updateDataCount();
        this.updateTrainingStatus(`Reset to full dataset (${this.trainingData.length} samples)`);
        
        // Update display if active
        if (this.displaySamples) {
            this.displaySamples = false;
            this.toggleDisplaySamples();
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
                    background: var(--floating-surface, #EEF7FF);
                    color: var(--floating-on-surface, #06304b);
                    border-radius: 12px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.12);
                    min-width: 320px;
                    max-width: 380px;
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
                    color: var(--floating-primary, #1565C0);
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
                    background: var(--floating-primary, #1565C0);
                    border-radius: 50%;
                    cursor: pointer;
                }
                input[type="range"]::-moz-range-thumb {
                    width: 18px;
                    height: 18px;
                    background: var(--floating-primary, #1565C0);
                    border-radius: 50%;
                    cursor: pointer;
                    border: none;
                }
                .training-section {
                    margin-top: 16px;
                    padding: 12px;
                    background: rgba(156, 39, 176, 0.05);
                    border-radius: 8px;
                    border: 1px solid rgba(156, 39, 176, 0.2);
                }
                .section-title {
                    font-weight: 600;
                    font-size: 0.875rem;
                    color: #9C27B0;
                    margin-bottom: 12px;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                .data-count {
                    font-size: 0.875rem;
                    color: rgba(0,0,0,0.7);
                    margin: 8px 0;
                    padding: 6px;
                    background: rgba(0,0,0,0.03);
                    border-radius: 4px;
                    text-align: center;
                }
                .training-status {
                    font-size: 0.8rem;
                    color: #9C27B0;
                    margin: 8px 0;
                    min-height: 20px;
                    font-style: italic;
                }
                .tool-button[selected] {
                    background: var(--floating-primary, #1565C0);
                    color: white;
                }
            </style>
            <div class="window-container">
                <div class="window-header">
                    <div class="window-title">
                        <md-icon>school</md-icon>
                        <span>VisibilNet Training</span>
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
                            <span>Number of Rays</span>
                            <span class="slider-value" id="rayValue">36</span>
                        </div>
                        <input type="range" id="raySlider" min="8" max="360" value="36" step="1">
                    </div>
                    
                    <md-outlined-button id="clearTraining" class="tool-button">
                        <md-icon slot="icon">clear</md-icon>
                        Clear
                    </md-outlined-button>
                    
                    <div class="training-section">
                        <div class="section-title">Data Selection</div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px;">
                            <div>
                                <label style="font-size: 0.7rem; display: block; color: rgba(0,0,0,0.6);">X Min</label>
                                <input type="number" id="xMinInput" style="width: 100%; padding: 4px; border: 1px solid rgba(0,0,0,0.2); border-radius: 4px;">
                            </div>
                            <div>
                                <label style="font-size: 0.7rem; display: block; color: rgba(0,0,0,0.6);">X Max</label>
                                <input type="number" id="xMaxInput" style="width: 100%; padding: 4px; border: 1px solid rgba(0,0,0,0.2); border-radius: 4px;">
                            </div>
                            <div>
                                <label style="font-size: 0.7rem; display: block; color: rgba(0,0,0,0.6);">Y Min</label>
                                <input type="number" id="yMinInput" style="width: 100%; padding: 4px; border: 1px solid rgba(0,0,0,0.2); border-radius: 4px;">
                            </div>
                            <div>
                                <label style="font-size: 0.7rem; display: block; color: rgba(0,0,0,0.6);">Y Max</label>
                                <input type="number" id="yMaxInput" style="width: 100%; padding: 4px; border: 1px solid rgba(0,0,0,0.2); border-radius: 4px;">
                            </div>
                        </div>
                        <div style="display: flex; gap: 8px; margin-bottom: 12px;">
                            <md-outlined-button id="applyFilter" class="tool-button" style="flex: 1; margin-bottom: 0;">
                                <md-icon slot="icon">filter_alt</md-icon>
                                Filter
                            </md-outlined-button>
                            <md-outlined-button id="resetFilter" class="tool-button" style="flex: 1; margin-bottom: 0;">
                                <md-icon slot="icon">restart_alt</md-icon>
                                Reset
                            </md-outlined-button>
                        </div>

                        <div class="section-title">Neural Network Training</div>
                        <div style="margin-bottom: 12px;">
                            <label style="font-size: 0.8rem; font-weight: 500;">Epochs:</label>
                            <input type="number" id="epochInput" value="1000" min="10" step="10" style="width: 80px; padding: 4px; border: 1px solid rgba(0,0,0,0.2); border-radius: 4px; margin-left: 8px;">
                        </div>
                        <md-filled-tonal-button id="generateData" class="tool-button">
                            <md-icon slot="icon">grid_on</md-icon>
                            Generate Training Data
                        </md-filled-tonal-button>
                        <div class="data-count" id="dataCount">Data samples: 0</div>
                        <md-outlined-button id="displaySamples" class="tool-button" disabled>
                            <md-icon slot="icon">scatter_plot</md-icon>
                            Display Samples
                        </md-outlined-button>
                        <md-filled-button id="trainModel" class="tool-button" disabled>
                            <md-icon slot="icon">model_training</md-icon>
                            Train Model
                        </md-filled-button>
                        <md-filled-tonal-button id="continueTraining" class="tool-button" disabled>
                            <md-icon slot="icon">fast_forward</md-icon>
                            Continue Training
                        </md-filled-tonal-button>
                        <md-filled-tonal-button id="togglePrediction" class="tool-button" disabled>
                            <md-icon slot="icon">psychology</md-icon>
                            Use AI Prediction
                        </md-filled-tonal-button>
                        <div class="training-status" id="trainingStatus"></div>
                        <div id="normalizedValues"></div>
                        <canvas id="lossGraph" width="280" height="150" style="display: none; margin: 8px 0; border: 1px solid var(--md-sys-color-outline); border-radius: 8px; background: var(--md-sys-color-surface-container);"></canvas>
                        <md-outlined-button id="saveData" class="tool-button">
                            <md-icon slot="icon">save</md-icon>
                            Save Training Data
                        </md-outlined-button>
                        <md-outlined-button id="loadData" class="tool-button">
                            <md-icon slot="icon">upload</md-icon>
                            Load Training Data
                        </md-outlined-button>
                        <md-outlined-button id="saveModel" class="tool-button" disabled>
                            <md-icon slot="icon">download</md-icon>
                            Save Model
                        </md-outlined-button>
                        <md-outlined-button id="loadModel" class="tool-button">
                            <md-icon slot="icon">cloud_upload</md-icon>
                            Load Model
                        </md-outlined-button>
                        <div class="model-info" id="modelInfo" style="font-size: 11px; color: var(--md-sys-color-on-surface-variant); margin-top: 8px; font-family: monospace;"></div>
                    </div>
                    
                    <div class="hint">
                        Place an observer point and drag it around to see real-time visibility polygons generated using ray casting.
                        Adjust the number of rays, then click "Generate Training Data" to sample all free space points with the current ray count as target output.
                    </div>
                </div>
            </div>
        `;
    }
    
    async saveModel() {
        if (!this.model) {
            alert('No model to save. Train a model first.');
            return;
        }
        
        try {
            // Save model to downloads
            await this.model.save('downloads://visibilnet-model');
            
            // Also save normalization parameters
            const normData = {
                normalizationParams: this.normalizationParams,
                numRays: this.numRays,
                timestamp: new Date().toISOString()
            };
            
            const blob = new Blob([JSON.stringify(normData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'visibilnet-model-params.json';
            a.click();
            URL.revokeObjectURL(url);
            
            alert('Model saved! Check downloads for:\n- model.json\n- weights.bin\n- visibilnet-model-params.json');
        } catch (error) {
            console.error('Error saving model:', error);
            alert('Error saving model: ' + error.message);
        }
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
                    
                    const statusDiv = this.shadowRoot.querySelector('#trainingStatus');
                    statusDiv.textContent = 'Loading model...';
                    
                    // Load normalization params if available
                    if (paramsFile) {
                        const paramsText = await paramsFile.text();
                        const params = JSON.parse(paramsText);
                        this.normalizationParams = params.normalizationParams;
                        this.numRays = params.numRays;
                    } else {
                        console.warn('No params file found, normalization may not work correctly');
                    }
                    
                    // Load model
                    const tf = await import('@tensorflow/tfjs');
                    this.model = await tf.loadLayersModel(
                        tf.io.browserFiles([modelFile, weightsFile])
                    );
                    
                    // Update UI
                    const modelInfo = this.shadowRoot.querySelector('#modelInfo');
                    const layers = this.model.layers.map(l => l.units || '?').join('→');
                    modelInfo.textContent = `Loaded: ${layers} | Rays: ${this.numRays}`;
                    
                    const toggleBtn = this.shadowRoot.querySelector('#togglePrediction');
                    if (toggleBtn) toggleBtn.removeAttribute('disabled');
                    const saveModelBtn = this.shadowRoot.querySelector('#saveModel');
                    if (saveModelBtn) saveModelBtn.removeAttribute('disabled');
                    const continueBtn = this.shadowRoot.querySelector('#continueTraining');
                    if (continueBtn) continueBtn.removeAttribute('disabled');
                    
                    statusDiv.textContent = 'Model loaded successfully!';
                    
                } catch (error) {
                    console.error('Error loading model:', error);
                    const statusDiv = this.shadowRoot.querySelector('#trainingStatus');
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
}

customElements.define('visibilnet-training-window', VisibilNetTrainingWindow);
