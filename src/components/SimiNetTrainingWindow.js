/**
 * SimiNetTrainingWindow Web Component
 * Floating window for SimiNet training data generation and model management
 */
import { eventBus } from '../utils/EventBus.js';
import { siminetService } from '../services/SimiNetService.js';

export class SimiNetTrainingWindow extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };
        this.position = { x: 200, y: 200 };
        
        // Observer state
        this.observer1 = null;
        this.observer2 = null;
        this.activeObserver = null;
        this.mcSimilarity = null;
        
        // Training state
        this.trainingData = [];
        this.isTraining = false;
        this.useModelPrediction = false;
        this.displaySamples = false;
        this.lossHistory = [];
        this.valLossHistory = [];
    }

    connectedCallback() {
        this.render();
        this.setupEventListeners();
        this.updatePosition();
        
        // Check if backbone is already loaded
        if (siminetService.backboneModel) {
            this.updateBackboneStatus(true);
        }
    }

    setupEventListeners() {
        const header = this.shadowRoot.querySelector('.window-header');
        const closeBtn = this.shadowRoot.querySelector('.close-btn');
        const minimizeBtn = this.shadowRoot.querySelector('.minimize-btn');
        
        // Observer controls
        const placeObserver1Btn = this.shadowRoot.querySelector('#placeObserver1');
        const placeObserver2Btn = this.shadowRoot.querySelector('#placeObserver2');
        const clearBtn = this.shadowRoot.querySelector('#clearObservers');
        
        // Training controls
        const generateDataBtn = this.shadowRoot.querySelector('#generateData');
        const displaySamplesBtn = this.shadowRoot.querySelector('#displaySamples');
        const trainModelBtn = this.shadowRoot.querySelector('#trainModel');
        const continueTrainingBtn = this.shadowRoot.querySelector('#continueTraining');
        const togglePredictionBtn = this.shadowRoot.querySelector('#togglePrediction');
        
        // Data/Model controls
        const saveDataBtn = this.shadowRoot.querySelector('#saveData');
        const loadDataBtn = this.shadowRoot.querySelector('#loadData');
        const saveModelBtn = this.shadowRoot.querySelector('#saveModel');
        const loadModelBtn = this.shadowRoot.querySelector('#loadModel');
        const loadBackboneBtn = this.shadowRoot.querySelector('#loadBackbone');
        const optionsBtn = this.shadowRoot.querySelector('#optionsBtn');
        
        // Window dragging
        header.addEventListener('mousedown', (e) => this.startDragging(e));
        document.addEventListener('mousemove', (e) => this.drag(e));
        document.addEventListener('mouseup', () => this.stopDragging());

        closeBtn?.addEventListener('click', () => this.close());
        minimizeBtn?.addEventListener('click', () => this.minimize());

        // Observer events
        placeObserver1Btn?.addEventListener('click', () => {
            this.activeObserver = 'observer1';
            eventBus.emit('similarity:setPlacementMode', { observer: 'observer1' });
            this.updateStatus('Click to place Observer 1');
        });

        placeObserver2Btn?.addEventListener('click', () => {
            this.activeObserver = 'observer2';
            eventBus.emit('similarity:setPlacementMode', { observer: 'observer2' });
            this.updateStatus('Click to place Observer 2');
        });
        
        clearBtn?.addEventListener('click', () => {
            this.observer1 = null;
            this.observer2 = null;
            this.mcSimilarity = null;
            eventBus.emit('similarity:clear');
            this.updateObserverDisplay();
            this.updateMCDisplay();
            this.updateStatus('Observers cleared');
        });

        // Training events
        generateDataBtn?.addEventListener('click', () => {
            const count = prompt('Enter number of samples to generate:', '1000');
            if (count && !isNaN(count)) {
                this.updateStatus(`Generating ${count} samples...`);
                siminetService.generateData(parseInt(count));
            }
        });

        displaySamplesBtn?.addEventListener('click', () => this.showSamples());
        
        trainModelBtn?.addEventListener('click', () => {
            this.startTraining(false);
        });

        continueTrainingBtn?.addEventListener('click', () => {
            this.startTraining(true);
        });

        togglePredictionBtn?.addEventListener('click', () => {
            this.useModelPrediction = !this.useModelPrediction;
            const icon = togglePredictionBtn.querySelector('md-icon');
            
            if (this.useModelPrediction) {
                togglePredictionBtn.classList.add('active');
                icon.textContent = 'visibility';
                this.updateStatus('Live prediction enabled');
                // Trigger prediction immediately if observers are placed
                if (this.observer1 && this.observer2) {
                    this.runPrediction();
                }
            } else {
                togglePredictionBtn.classList.remove('active');
                icon.textContent = 'preview';
                this.updateStatus('Live prediction disabled');
            }
        });
        
        saveDataBtn?.addEventListener('click', () => {
            siminetService.saveData();
            this.updateStatus('Data saved');
        });

        loadDataBtn?.addEventListener('click', () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.onchange = (e) => {
                const file = e.target.files[0];
                if (file) {
                    this.updateStatus('Loading data...');
                    siminetService.loadData(file).then(data => {
                        this.updateStatus(`Loaded ${data.length} samples`);
                        this.updateSampleCount(data.length);
                    }).catch(err => {
                        console.error(err);
                        this.updateStatus('Error loading data');
                    });
                }
            };
            input.click();
        });

        saveModelBtn?.addEventListener('click', () => {
            this.updateStatus('Saving model...');
            siminetService.saveModel().then(() => {
                this.updateStatus('Model saved successfully');
            }).catch(err => {
                console.error(err);
                this.updateStatus('Error saving model');
            });
        });

        loadModelBtn?.addEventListener('click', () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json,.bin';
            input.multiple = true;
            input.onchange = (e) => {
                const files = e.target.files;
                if (files.length > 0) {
                    this.updateStatus('Loading model...');
                    siminetService.loadModel(files).then(() => {
                        this.updateStatus('Model loaded successfully');
                    }).catch(err => {
                        console.error(err);
                        this.updateStatus('Error loading model');
                    });
                }
            };
            input.click();
        });
        
        loadBackboneBtn?.addEventListener('click', () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json,.bin'; // TensorFlow.js model files
            input.multiple = true; // Need both json and bin files usually
            input.onchange = (e) => {
                const files = e.target.files;
                if (files.length > 0) {
                    this.updateStatus('Loading backbone...');
                    siminetService.loadBackbone(files).then(() => {
                        this.updateStatus('Backbone loaded successfully');
                        this.updateBackboneStatus(true);
                    }).catch(err => {
                        console.error(err);
                        const msg = err.message || err.toString();
                        this.updateStatus('Error: ' + msg);
                        this.updateBackboneStatus(false);
                    });
                }
            };
            input.click();
        });

        optionsBtn?.addEventListener('click', () => console.log('Options clicked'));

        // Listen for SimiNet service events
        eventBus.on('siminet:generationProgress', (data) => {
            this.updateStatus(`Generating: ${data.current}/${data.total}`);
            this.updateSampleCount(siminetService.trainingData.length);
        });

        eventBus.on('siminet:generationComplete', (data) => {
            this.updateStatus(`Generation complete: ${data.count} samples`);
            this.updateSampleCount(data.count);
        });

        eventBus.on('siminet:dataLoaded', (data) => {
            this.updateSampleCount(data.count);
        });

        // Listen for observer placement/movement (reusing similarity events for now)
        eventBus.on('similarity:observerPlaced', (data) => this.handleObserverUpdate(data));
        eventBus.on('similarity:observerMoved', (data) => this.handleObserverUpdate(data));
        
        // Listen for MC calculation results
        eventBus.on('similarity:calculationComplete', (result) => {
            if (result.mcSimilarity !== undefined) {
                this.mcSimilarity = result.mcSimilarity;
                this.updateMCDisplay();
            }
        });
    }

    handleObserverUpdate(data) {
        if (data.observer === 'observer1') {
            this.observer1 = { x: data.position.x, y: data.position.y };
        } else if (data.observer === 'observer2') {
            this.observer2 = { x: data.position.x, y: data.position.y };
        }
        this.updateObserverDisplay();
        
        if (this.useModelPrediction && this.observer1 && this.observer2) {
            this.runPrediction();
        }
    }

    runPrediction() {
        if (!this.observer1 || !this.observer2) return;
        
        try {
            const similarity = siminetService.predictSimilarity(this.observer1, this.observer2);
            
            // Update display with both MC and Model values
            const display = this.shadowRoot.querySelector('#mcDisplay');
            if (display) {
                const mcText = this.mcSimilarity !== null ? `${(this.mcSimilarity * 100).toFixed(2)}%` : '--';
                const modelText = `${(similarity * 100).toFixed(2)}%`;
                
                display.innerHTML = `
                    <div style="font-size: 0.8em; color: #666;">MC: ${mcText}</div>
                    <div style="color: #3F51B5;">Model: ${modelText}</div>
                `;
            }
        } catch (e) {
            console.error('Prediction failed:', e);
        }
    }

    updateObserverDisplay() {
        const obs1Display = this.shadowRoot.querySelector('#observer1Display');
        const obs2Display = this.shadowRoot.querySelector('#observer2Display');
        
        if (obs1Display) {
            obs1Display.textContent = this.observer1 
                ? `(${this.observer1.x.toFixed(1)}, ${this.observer1.y.toFixed(1)})` 
                : 'Not placed';
            obs1Display.style.color = this.observer1 ? '#2E7D32' : '#90A4AE';
        }
        
        if (obs2Display) {
            obs2Display.textContent = this.observer2 
                ? `(${this.observer2.x.toFixed(1)}, ${this.observer2.y.toFixed(1)})` 
                : 'Not placed';
            obs2Display.style.color = this.observer2 ? '#EF6C00' : '#90A4AE';
        }
    }

    updateMCDisplay() {
        if (this.useModelPrediction) {
            this.runPrediction();
        } else {
            const display = this.shadowRoot.querySelector('#mcDisplay');
            if (display) {
                display.textContent = this.mcSimilarity !== null 
                    ? `${(this.mcSimilarity * 100).toFixed(2)}%` 
                    : '--';
            }
        }
    }

    updateStatus(message) {
        const statusEl = this.shadowRoot.querySelector('#statusText');
        if (statusEl) {
            statusEl.textContent = message;
        }
        console.log(`SimiNet: ${message}`);
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
        this.updatePosition();
    }

    stopDragging() {
        this.isDragging = false;
        const container = this.shadowRoot.querySelector('.window-container');
        if (container) container.style.cursor = 'default';
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
    }

    minimize() {
        const content = this.shadowRoot.querySelector('.window-content');
        const icon = this.shadowRoot.querySelector('.minimize-btn md-icon');
        if (content.style.display === 'none') {
            content.style.display = 'block';
            icon.textContent = 'remove';
        } else {
            content.style.display = 'none';
            icon.textContent = 'add';
        }
    }

    updateSampleCount(count) {
        const countDisplay = this.shadowRoot.querySelector('#sampleCount');
        if (countDisplay) {
            countDisplay.textContent = count;
        }
    }

    showSamples() {
        const samples = siminetService.trainingData;
        if (!samples || samples.length === 0) {
            alert('No training data available. Generate or load data first.');
            return;
        }
        
        const sample = samples[0];
        const modal = this.shadowRoot.querySelector('#sampleModal');
        const content = this.shadowRoot.querySelector('#sampleData');
        const closeBtn = this.shadowRoot.querySelector('.modal-close');
        
        if (modal && content) {
            content.textContent = JSON.stringify(sample, null, 2);
            modal.classList.add('visible');
            
            const closeModal = () => {
                modal.classList.remove('visible');
            };
            
            if (closeBtn) closeBtn.onclick = closeModal;
            modal.onclick = (e) => {
                if (e.target === modal) closeModal();
            };
        }
    }

    updateBackboneStatus(loaded) {
        const statusEl = this.shadowRoot.querySelector('#backboneStatus');
        const icon = statusEl.querySelector('md-icon');
        const text = statusEl.querySelector('span');
        
        if (loaded) {
            statusEl.classList.add('loaded');
            icon.textContent = 'check_circle';
            text.textContent = 'Backbone loaded';
        } else {
            statusEl.classList.remove('loaded');
            icon.textContent = 'cancel';
            text.textContent = 'Backbone not loaded';
        }
    }

    startTraining(isContinue) {
        const graphContainer = this.shadowRoot.querySelector('#graphContainer');
        if (graphContainer) graphContainer.style.display = 'block';
        
        // Get epochs from input
        const epochInput = this.shadowRoot.querySelector('#epochInput');
        const epochs = epochInput ? parseInt(epochInput.value) : 50;

        if (!isContinue) {
            this.lossHistory = [];
            this.valLossHistory = [];
        }
        
        this.updateStatus(isContinue ? `Continuing training for ${epochs} epochs...` : `Starting training for ${epochs} epochs...`);
        
        const onEpochEnd = (epoch, logs) => {
            this.lossHistory.push(logs.loss);
            if (logs.val_loss) {
                this.valLossHistory.push(logs.val_loss);
            }
            
            const valText = logs.val_loss ? ` | Val: ${logs.val_loss.toFixed(4)}` : '';
            this.updateStatus(`Epoch ${epoch + 1}: Loss ${logs.loss.toFixed(4)}${valText}`);
            this.drawLossGraph();
        };
        
        // Determine which training method to use
        // If we have static training data loaded, use continueTraining (which trains on that data)
        // Otherwise, assume we want to continue infinite generation training
        let trainingPromise;
        if (siminetService.trainingData && siminetService.trainingData.length > 0) {
            trainingPromise = siminetService.continueTraining(onEpochEnd, epochs);
        } else {
            // If no static data, use infinite training (generates data on the fly)
            // This works for both "New" and "Continue" if we are in infinite mode
            trainingPromise = siminetService.trainSiameseModelInfinite(onEpochEnd, epochs);
        }
            
        trainingPromise.then(() => {
            this.updateStatus('Training complete!');
        }).catch(err => {
            console.error(err);
            this.updateStatus('Training failed: ' + err.message);
        });
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
        ctx.fillStyle = '#1c1b1f';
        ctx.fillRect(0, 0, width, height);
        
        // Find max loss for scaling (include validation loss)
        const allLosses = [...this.lossHistory, ...this.valLossHistory];
        const maxLoss = Math.max(...allLosses);
        const minLoss = Math.min(...allLosses);
        const lossRange = maxLoss - minLoss || 1;
        
        // Draw graph background
        ctx.fillStyle = '#121212';
        ctx.fillRect(0, 0, width, height);
        
        // Draw grid lines
        ctx.strokeStyle = '#444';
        ctx.lineWidth = 0.5;
        for (let i = 0; i <= 4; i++) {
            const y = padding.top + (graphHeight / 4) * i;
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(width - padding.right, y);
            ctx.stroke();
            
            // Y-axis labels
            ctx.fillStyle = '#aaa';
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'right';
            const val = maxLoss - (lossRange * i / 4);
            ctx.fillText(val.toFixed(4), padding.left - 5, y + 3);
        }
        
        // Draw training loss line (Green)
        ctx.beginPath();
        ctx.strokeStyle = '#4CAF50';
        ctx.lineWidth = 2;
        
        for (let i = 0; i < this.lossHistory.length; i++) {
            const x = padding.left + (i / (this.lossHistory.length - 1 || 1)) * graphWidth;
            const y = padding.top + graphHeight - ((this.lossHistory[i] - minLoss) / lossRange) * graphHeight;
            
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Draw validation loss line (Orange)
        if (this.valLossHistory.length > 0) {
            ctx.beginPath();
            ctx.strokeStyle = '#FF9800';
            ctx.lineWidth = 2;
            
            for (let i = 0; i < this.valLossHistory.length; i++) {
                const x = padding.left + (i / (this.valLossHistory.length - 1 || 1)) * graphWidth;
                const y = padding.top + graphHeight - ((this.valLossHistory[i] - minLoss) / lossRange) * graphHeight;
                
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
            
            // Legend
            ctx.fillStyle = '#4CAF50';
            ctx.fillText('Train', width - 50, 20);
            ctx.fillStyle = '#FF9800';
            ctx.fillText('Val', width - 10, 20);
        }
        
        // X-axis labels
        ctx.fillStyle = '#aaa';
        ctx.textAlign = 'center';
        ctx.fillText('0', padding.left, height - 5);
        ctx.fillText(this.lossHistory.length.toString(), width - padding.right, height - 5);
    }

    render() {
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    position: fixed;
                    z-index: 1000;
                    display: none;
                    pointer-events: none;
                    /* Floating palette overrides - Indigo Theme */
                    --floating-primary: #3F51B5;
                    --floating-on-primary: #FFFFFF;
                    --floating-surface: #E8EAF6;
                    --floating-on-surface: #1A237E;
                    --floating-on-surface-variant: #303F9F;
                }
                
                :host([visible]) {
                    display: block;
                    pointer-events: auto;
                }
                
                .window-container {
                    position: fixed;
                    background: var(--floating-surface, #E8EAF6);
                    color: var(--floating-on-surface, #1A237E);
                    border-radius: 12px;
                    box-shadow: 
                        0px 4px 8px rgba(0, 0, 0, 0.12),
                        0px 8px 16px rgba(0, 0, 0, 0.08);
                    min-width: 400px;
                    max-width: 450px;
                    overflow: hidden;
                }
                
                .window-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 12px 16px;
                    background: var(--floating-primary, #3F51B5);
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
                    color: var(--floating-primary, #3F51B5);
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
                
                .data-display {
                    background: rgba(0,0,0,0.03);
                    border-radius: 8px;
                    padding: 16px;
                    text-align: center;
                    margin-bottom: 12px;
                    border: 1px solid rgba(0,0,0,0.05);
                }
                
                .data-label {
                    font-size: 0.875rem;
                    color: var(--floating-on-surface-variant, #303F9F);
                    margin-bottom: 8px;
                    font-weight: 500;
                }
                
                .data-value {
                    font-size: 2rem;
                    font-weight: 700;
                    line-height: 1.2;
                    color: var(--floating-primary, #3F51B5);
                }
                
                .status-text {
                    font-size: 0.75rem;
                    color: var(--floating-on-surface-variant, #303F9F);
                    text-align: center;
                    margin-top: 12px;
                    opacity: 0.8;
                }

                .graph-container {
                    margin-top: 12px;
                    background: #1c1b1f;
                    border-radius: 8px;
                    padding: 8px;
                    display: none;
                }
                
                canvas {
                    width: 100%;
                    height: 150px;
                    display: block;
                }

                .backbone-status {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 0.75rem;
                    margin-bottom: 8px;
                    padding: 4px 8px;
                    border-radius: 4px;
                    background: rgba(0,0,0,0.05);
                }
                
                .backbone-status.loaded {
                    background: rgba(76, 175, 80, 0.1);
                    color: #2E7D32;
                }
                
                .backbone-status md-icon {
                    font-size: 16px;
                }

                .modal {
                    display: none;
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0,0,0,0.5);
                    z-index: 2000;
                    align-items: center;
                    justify-content: center;
                }
                
                .modal.visible {
                    display: flex;
                }
                
                .modal-content {
                    background: white;
                    padding: 20px;
                    border-radius: 8px;
                    max-width: 400px;
                    max-height: 400px;
                    overflow: auto;
                    position: relative;
                    color: black;
                    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                }
                
                .modal-close {
                    position: absolute;
                    top: 10px;
                    right: 10px;
                    cursor: pointer;
                    font-weight: bold;
                    font-size: 20px;
                    color: #666;
                }
                
                .modal-close:hover {
                    color: #000;
                }

                pre {
                    white-space: pre-wrap;
                    word-wrap: break-word;
                    font-size: 12px;
                    background: #f5f5f5;
                    padding: 10px;
                    border-radius: 4px;
                    margin-top: 10px;
                }
            </style>
            
            <div class="window-container">
                <div class="window-header">
                    <div class="window-title">
                        <md-icon>model_training</md-icon>
                        SimiNet Training
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
                            Observer Setup
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
                        
                        <div class="data-display" style="margin-bottom: 12px; background: rgba(63, 81, 181, 0.05);">
                            <div class="data-label">Current MC Similarity</div>
                            <div class="data-value" id="mcDisplay">--</div>
                        </div>

                        <md-outlined-button id="clearObservers" style="width: 100%;">
                            <md-icon slot="icon">clear</md-icon>
                            Clear Observers
                        </md-outlined-button>
                    </div>
                    
                    <div class="section">
                        <div class="section-title">
                            <md-icon>dataset</md-icon>
                            Training Data
                        </div>
                        <div class="data-display">
                            <div class="data-label">Samples Collected</div>
                            <div class="data-value" id="sampleCount">0</div>
                        </div>
                        <div class="button-group">
                            <md-filled-button id="generateData">
                                <md-icon slot="icon">playlist_add</md-icon>
                                Generate Data
                            </md-filled-button>
                            <md-filled-tonal-button id="displaySamples">
                                <md-icon slot="icon">visibility</md-icon>
                                Show Samples
                            </md-filled-tonal-button>
                        </div>
                        <div class="button-group">
                            <md-outlined-button id="saveData">
                                <md-icon slot="icon">save</md-icon>
                                Save Data
                            </md-outlined-button>
                            <md-outlined-button id="loadData">
                                <md-icon slot="icon">upload</md-icon>
                                Load Data
                            </md-outlined-button>
                        </div>
                    </div>
                    
                    <div class="section">
                        <div class="section-title">
                            <md-icon>psychology</md-icon>
                            Model Training
                        </div>
                        
                        <div style="margin-bottom: 12px;">
                            <md-outlined-text-field id="epochInput" label="Epochs" type="number" value="50" style="width: 100%;">
                            </md-outlined-text-field>
                        </div>

                        <div class="button-group">
                            <md-filled-button id="trainModel">
                                <md-icon slot="icon">play_arrow</md-icon>
                                Train New
                            </md-filled-button>
                            <md-filled-tonal-button id="continueTraining">
                                <md-icon slot="icon">fast_forward</md-icon>
                                Continue
                            </md-filled-tonal-button>
                        </div>
                        <div class="button-group">
                            <md-outlined-button id="saveModel">
                                <md-icon slot="icon">save</md-icon>
                                Save Model
                            </md-outlined-button>
                            <md-outlined-button id="loadModel">
                                <md-icon slot="icon">upload</md-icon>
                                Load Model
                            </md-outlined-button>
                        </div>
                        
                        <div class="backbone-status" id="backboneStatus">
                            <md-icon>cancel</md-icon>
                            <span>Backbone not loaded</span>
                        </div>
                        
                        <md-outlined-button id="loadBackbone" style="width: 100%; margin-bottom: 8px;">
                            <md-icon slot="icon">layers</md-icon>
                            Load Backbone (VisibilNet)
                        </md-outlined-button>
                        
                        <div class="graph-container" id="graphContainer">
                            <canvas id="lossGraph" width="400" height="150"></canvas>
                        </div>

                        <md-filled-tonal-button id="togglePrediction" style="width: 100%; margin-top: 8px;">
                            <md-icon slot="icon">preview</md-icon>
                            Toggle Live Prediction
                        </md-filled-tonal-button>
                    </div>

                    <div class="section">
                        <md-text-button id="optionsBtn" style="width: 100%;">
                            <md-icon slot="icon">settings</md-icon>
                            Advanced Options
                        </md-text-button>
                    </div>
                    
                    <div id="statusText" class="status-text">Ready</div>
                </div>
            </div>
            
            <div id="sampleModal" class="modal">
                <div class="modal-content">
                    <span class="modal-close">&times;</span>
                    <h3>Sample Data</h3>
                    <pre id="sampleData"></pre>
                </div>
            </div>
        `;
    }
}

customElements.define('siminet-training-window', SimiNetTrainingWindow);
