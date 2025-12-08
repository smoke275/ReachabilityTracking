/**
 * Main Application Entry Point
 * Coordinates all components, services, and the canvas controller
 */

// Import Material Web Components
import '@material/web/button/filled-button.js';
import '@material/web/button/filled-tonal-button.js';
import '@material/web/button/outlined-button.js';
import '@material/web/button/text-button.js';
import '@material/web/icon/icon.js';
import '@material/web/iconbutton/icon-button.js';
import '@material/web/iconbutton/filled-icon-button.js';
import '@material/web/textfield/filled-text-field.js';
import '@material/web/textfield/outlined-text-field.js';
import '@material/web/slider/slider.js';
import '@material/web/divider/divider.js';
import '@material/web/chips/chip-set.js';
import '@material/web/chips/filter-chip.js';

// Import Web Components
import './components/AppHeader.js';
import './components/CanvasToolbar.js';
import './components/PolygonCanvas.js';
import './components/DrawToolsSection.js';
import './components/CustomizeSection.js';
import './components/FileOperationsSection.js';
import './components/ActionsSection.js';
import './components/StatsSection.js';
import './components/ToolboxSection.js';
import './components/AnalysisWindow.js';
import './components/EvaderWindow.js';
import './components/AgentsWindow.js';
import './components/EvaderFutureSetWindow.js';
import './components/VisibilityWindow.js';
import './components/RRTWindow.js';
import './components/VisibilNetTrainingWindow.js';
import './components/KiloVisiNetTrainingWindow.js';
import './components/SimilarityCalculatorWindow.js';
import './components/SimiNetTrainingWindow.js';
import { ActiveTrackingWindow } from './components/ActiveTrackingWindow.js';
import { RealTimeTrackingWindow } from './components/RealTimeTrackingWindow.js';
import { SimilarityMPPITrackingWindow } from './components/SimilarityMPPITrackingWindow.js';

// Import Core modules
import { PolygonCanvasController } from './controllers/PolygonCanvasController.js';
import { StorageService } from './services/StorageService.js';
import { FileService } from './services/FileService.js';
import { rrtStarService } from './services/RRTStarService.js';
import { MedialAxisService } from './services/MedialAxisService.js';
import { EvaderService } from './services/EvaderService.js';
import { EvaderFutureSetService } from './services/EvaderFutureSetService.js';
import { IntruderService } from './services/IntruderService.js';
import { SensorModelService } from './services/SensorModelService.js';
import { visibilnetService } from './services/VisibilNetService.js';
import { kilovisinetService } from './services/KiloVisiNetService.js';
import { similarityCalculatorService } from './services/SimilarityCalculatorService.js';
import { siminetService } from './services/SimiNetService.js';
import { activeTrackingService } from './services/ActiveTrackingService.js';
import { realTimeTrackingService } from './services/RealTimeTrackingService.js';
import { sdfService } from './services/SDFService.js';
import { eventBus } from './utils/EventBus.js';

/**
 * Main App class
 * Initializes and coordinates the entire application
 */
class App {
    constructor() {
        this.storageService = new StorageService();
        this.fileService = new FileService();
        this.medialAxisService = new MedialAxisService();
        this.evaderService = new EvaderService();
        this.evaderFutureSetService = new EvaderFutureSetService();
        this.intruderService = new IntruderService();
        this.sensorModelService = new SensorModelService();
        this.similarityCalculatorService = similarityCalculatorService;
        this.siminetService = siminetService;
        this.canvasController = null;
        this.analysisWindow = null;
        this.evaderWindow = null;
        this.agentsWindow = null;
        this.evaderFutureSetWindow = null;
        this.visibilityWindow = null;
        this.visibilnetWindow = null;
        this.kilovisinetWindow = null;
        this.similarityWindow = null;
        this.rrtWindow = null;
        this.activeTrackingWindow = null;
        this.realTimeTrackingWindow = null;
        this.similarityMPPITrackingWindow = null;
        this.evaderRenderLoopId = null;
        
        // Evader manual control state
        this.evaderManualControl = null;
        this.evaderKeyDownHandler = null;
        this.evaderKeyUpHandler = null;
        
        this.init();
    }

    async init() {
        // Wait for components to be ready
        await this.waitForComponents();
        
        // Initialize canvas controller
        const canvasComponent = document.querySelector('polygon-canvas');
        const canvas = canvasComponent.getCanvas();
        this.canvasController = new PolygonCanvasController(canvas);
        
        // Set sensor model service in canvas controller for visualization
        this.canvasController.setSensorModelService(this.sensorModelService);
        
        // Initialize analysis window
        console.log('Creating analysis window...');
        this.analysisWindow = document.createElement('analysis-window');
        document.body.appendChild(this.analysisWindow);
        console.log('Analysis window created and appended:', this.analysisWindow);
        
        // Initialize evader window
        console.log('Creating evader window...');
        this.evaderWindow = document.createElement('evader-window');
        document.body.appendChild(this.evaderWindow);
        console.log('Evader window created and appended:', this.evaderWindow);
        
        // Initialize agents window
        console.log('Creating agents window...');
        this.agentsWindow = document.createElement('agents-window');
        document.body.appendChild(this.agentsWindow);
        console.log('Agents window created and appended:', this.agentsWindow);
        
        // Initialize evader future set window
        console.log('Creating evader future set window...');
        this.evaderFutureSetWindow = document.createElement('evader-future-set-window');
        document.body.appendChild(this.evaderFutureSetWindow);
        console.log('Evader future set window created and appended:', this.evaderFutureSetWindow);

        // Initialize visibility window
        console.log('Creating visibility window...');
        this.visibilityWindow = document.createElement('visibility-window');
        document.body.appendChild(this.visibilityWindow);
        console.log('Visibility window created and appended:', this.visibilityWindow);

        // Initialize VisibilNet Training window
        console.log('Creating VisibilNet Training window...');
        this.visibilnetWindow = document.createElement('visibilnet-training-window');
        document.body.appendChild(this.visibilnetWindow);
        console.log('VisibilNet Training window created and appended:', this.visibilnetWindow);

        // Initialize KiloVisiNet Training window
        console.log('Creating KiloVisiNet Training window...');
        this.kilovisinetWindow = document.createElement('kilovisinet-training-window');
        document.body.appendChild(this.kilovisinetWindow);
        console.log('KiloVisiNet Training window created and appended:', this.kilovisinetWindow);

        // Initialize Similarity Calculator window
        console.log('Creating Similarity Calculator window...');
        this.similarityWindow = document.createElement('similarity-calculator-window');
        console.log('Similarity Calculator window element created:', this.similarityWindow);
        document.body.appendChild(this.similarityWindow);
        console.log('Similarity Calculator window created and appended:', this.similarityWindow);

        // Initialize SimiNet Training window
        console.log('Creating SimiNet Training window...');
        this.siminetWindow = document.createElement('siminet-training-window');
        document.body.appendChild(this.siminetWindow);
        console.log('SimiNet Training window created and appended:', this.siminetWindow);

        // Initialize RRT window
        console.log('Creating RRT window...');
        this.rrtWindow = document.createElement('rrt-window');
        document.body.appendChild(this.rrtWindow);
        console.log('RRT window created and appended:', this.rrtWindow);
        
        // Initialize Active Tracking window (Web Component)
        console.log('Creating Active Tracking window...');
        this.activeTrackingWindow = document.createElement('active-tracking-window');
        document.body.appendChild(this.activeTrackingWindow);
        console.log('Active Tracking window created:', this.activeTrackingWindow);
        
        // Initialize Real-Time Tracking window (Web Component)
        console.log('Creating Real-Time Tracking window...');
        this.realTimeTrackingWindow = document.createElement('real-time-tracking-window');
        document.body.appendChild(this.realTimeTrackingWindow);
        console.log('Real-Time Tracking window created:', this.realTimeTrackingWindow);

        // Initialize Similarity MPPI Tracking window (Web Component)
        console.log('Creating Similarity MPPI Tracking window...');
        this.similarityMPPITrackingWindow = document.createElement('similarity-mppi-tracking-window');
        document.body.appendChild(this.similarityMPPITrackingWindow);
        console.log('Similarity MPPI Tracking window created:', this.similarityMPPITrackingWindow);
        
        // Setup event handlers
        this.setupEventHandlers();
        
        // Load saved analysis settings if they exist
        this.loadAnalysisSettings();
        
        // Setup resize handler
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        
        console.log('Polygon Studio initialized successfully');
    }

    async waitForComponents() {
        // Wait for all custom elements to be defined
        const componentNames = [
            'app-header',
            'canvas-toolbar',
            'polygon-canvas',
            'draw-tools-section',
            'customize-section',
            'file-operations-section',
            'actions-section',
            'stats-section',
            'analysis-window',
            'evader-window',
            'agents-window',
            'evader-future-set-window',
            'visibility-window'
        ];

        await Promise.all(
            componentNames.map(name => customElements.whenDefined(name))
        );
    }

    loadAnalysisSettings() {
        try {
            const result = this.storageService.load();
            if (result.success && result.data.analysis) {
                const level = result.data.analysis.vertexReductionLevel;
                if (typeof level === 'number') {
                    this.medialAxisService.setReductionLevel(level);
                    eventBus.emit('analysis:reductionLevelRestored', level);
                    console.log('Analysis settings restored: vertex reduction =', level);
                }
            }
            // Also load evader settings
            if (result.success && result.data.evader) {
                this.loadEvaderSettings(result.data.evader);
            }
        } catch (error) {
            console.error('Error loading analysis settings:', error);
        }
    }

    loadEvaderSettings(evaderData) {
        try {
            if (evaderData.mode) {
                this.evaderService.setMode(evaderData.mode);
            }
            if (typeof evaderData.speed === 'number') {
                this.evaderService.setSpeed(evaderData.speed);
            }
            if (typeof evaderData.angularSpeed === 'number') {
                this.evaderService.setAngularSpeed(evaderData.angularSpeed);
            }
            // Emit event to restore UI state
            eventBus.emit('evader:settingsRestored', evaderData);
            console.log('Evader settings restored:', evaderData);
        } catch (error) {
            console.error('Error loading evader settings:', error);
        }
    }

    setupEventHandlers() {
        // Drawing actions
        eventBus.on('action:startDrawing', () => this.canvasController.startDrawingMode());
        eventBus.on('action:completePolygon', () => {
            this.canvasController.completePolygon();
            this.updateObstaclesForAllServices(); // Update obstacles after creating polygon
        });
        eventBus.on('action:cancelDrawing', () => this.canvasController.cancelDrawing());
        
        // Shape creation actions
        eventBus.on('action:createTriangle', () => {
            this.canvasController.createTriangle();
            this.updateObstaclesForAllServices(); // Update obstacles after creating shape
        });
        eventBus.on('action:createRectangle', () => {
            this.canvasController.createRectangle();
            this.updateObstaclesForAllServices(); // Update obstacles after creating shape
        });
        eventBus.on('action:createHexagon', () => {
            this.canvasController.createHexagon();
            this.updateObstaclesForAllServices(); // Update obstacles after creating shape
        });
        eventBus.on('action:createRandom', () => {
            this.canvasController.createRandomPolygon();
            this.updateObstaclesForAllServices(); // Update obstacles after creating shape
        });
        
        // Color changes
        eventBus.on('color:fillChanged', (color) => this.canvasController.setDefaultColor(color));
        eventBus.on('color:strokeChanged', (color) => this.canvasController.setDefaultStrokeColor(color));
        
        // File operations
        eventBus.on('action:save', () => this.handleSave());
        eventBus.on('action:load', () => this.handleLoad());
        eventBus.on('action:export', () => this.handleExport());
        eventBus.on('action:import', (file) => this.handleImport(file));
        
        // Other actions
        eventBus.on('action:duplicateSelected', () => {
            this.canvasController.duplicateSelected();
            this.updateObstaclesForAllServices(); // Update obstacles after duplicating
        });
        eventBus.on('action:rotateSelected', () => {
            this.canvasController.rotateSelected(15); // Rotate by 15 degrees
            this.updateObstaclesForAllServices(); // Update obstacles after rotating
        });
        eventBus.on('action:rotateEnvironment180', () => {
            this.canvasController.rotateEnvironment180();
            this.updateObstaclesForAllServices(); // Update obstacles after rotating environment
        });
        eventBus.on('action:deleteSelected', () => {
            this.canvasController.deleteSelected();
            this.updateObstaclesForAllServices(); // Update obstacles after deleting
        });
        eventBus.on('action:clearAll', () => {
            this.canvasController.clearAll();
            this.updateObstaclesForAllServices(); // Update obstacles after clearing
        });
        
        // Analysis actions
        eventBus.on('action:environmentAnalysis', () => this.showAnalysisWindow());
        eventBus.on('analysis:generateMedialAxis', () => this.generateMedialAxis());
        eventBus.on('analysis:toggleSkeleton', () => this.canvasController.toggleSkeletonVisibility());

        // Visibility actions
        eventBus.on('action:visibilityAnalysis', () => this.showVisibilityWindow());
        eventBus.on('action:visibilnetTraining', () => this.showVisibilNetWindow());
        eventBus.on('action:kilovisinetTraining', () => this.showKiloVisiNetWindow());
        eventBus.on('action:similarityCalculator', () => this.showSimilarityWindow());
        eventBus.on('action:siminetTraining', () => this.showSimiNetWindow());

        // RRT tracking actions
        eventBus.on('action:rrtTracking', () => this.showRRTWindow());
        eventBus.on('rrt:requestPolygons', () => {
            // Provide polygons to RRT service
            if (this.canvasController) {
                const polygons = this.canvasController.getPolygons();
                rrtStarService.obstacles = polygons || [];
                console.log('RRT: Updated obstacles, count:', polygons.length);
                
                // Also update obstacles for agent services
                this.evaderService.setObstacles(polygons);
                this.intruderService.setObstacles(polygons);
            }
        });
        eventBus.on('rrt:requestTrees', (data) => {
            // Provide RRT trees to requesting components
            if (data.callback && typeof data.callback === 'function') {
                data.callback({
                    pursuerTree: rrtStarService.pursuerTree,
                    evaderTree: rrtStarService.evaderTree
                });
            }
        });

        // Active tracking actions
        eventBus.on('action:activeTracking', () => this.showActiveTrackingWindow());

        // Real-time tracking actions
        eventBus.on('action:realTimeTracking', () => this.showRealTimeTrackingWindow());
        eventBus.on('realTimeTracking:requestStates', (callback) => {
            if (callback && typeof callback === 'function') {
                callback({
                    pursuerState: this.intruderService.getState(),
                    evaderState: this.evaderService.getState()
                });
            }
        });

        // Similarity MPPI tracking actions
        eventBus.on('action:similarityMPPITracking', () => this.showSimilarityMPPITrackingWindow());
        eventBus.on('similarityMPPITracking:update', (data) => {
            // console.log('MPPI Update:', data.trajectories ? data.trajectories.length : 0);
            if (this.canvasController && data.trajectories) {
                this.canvasController.setMPPITrajectories(data.trajectories);
            }
        });
        eventBus.on('similarityMPPITracking:toggleVisualization', (show) => {
            if (this.canvasController) {
                this.canvasController.toggleMPPITrajectories(show);
            }
        });

        // Evader simulation actions
        eventBus.on('action:evaderSimulation', () => this.showEvaderWindow());
        eventBus.on('evader:start', (data) => this.startEvaderSimulation(data));
        eventBus.on('evader:stop', () => {
            this.evaderService.stop();
            // Update visualization one more time to show paused state
            this.updateEvaderVisualizationOnce();
        });
        eventBus.on('evader:reset', () => {
            this.evaderService.reset();
            // Clear visualization after reset
            if (this.canvasController) {
                this.canvasController.clearEvaderState();
                this.canvasController.redraw();
            }
        });
        eventBus.on('evader:setSpeed', (speed) => {
            this.evaderService.setSpeed(speed);
            this.autoSaveEvaderSettings();
        });
        eventBus.on('evader:setAngularSpeed', (omega) => {
            this.evaderService.setAngularSpeed(omega);
            this.autoSaveEvaderSettings();
        });
        eventBus.on('evader:setMode', (mode) => {
            this.evaderService.setMode(mode);
            this.autoSaveEvaderSettings();
        });
        eventBus.on('evader:positionUpdate', (data) => this.updateEvaderVisualization(data));

        // Agents window actions
        eventBus.on('action:agents', () => this.showAgentsWindow());
        eventBus.on('agents:enablePursuerPlacement', () => {
            // User is in placement mode - enable canvas click handler for pursuer
            this.enablePursuerPlacement();
        });
        eventBus.on('agents:enableEvaderPlacement', () => {
            // User is in placement mode - enable canvas click handler for evader
            this.enableEvaderPlacement();
        });
        eventBus.on('agents:activatePursuer', () => {
            // Activate intruder for keyboard control
            this.intruderService.activate();
            this.deactivateEvaderManualControl();
        });
        eventBus.on('agents:deactivatePursuer', () => {
            // Deactivate intruder keyboard control
            this.intruderService.deactivate();
        });
        eventBus.on('agents:activateEvader', () => {
            // Activate evader for keyboard control
            this.activateEvaderKeyboardControl();
            this.intruderService.deactivate();
        });
        eventBus.on('agents:deactivateEvader', () => {
            // Deactivate evader keyboard control
            this.deactivateEvaderManualControl();
        });

        // Evader future set actions
        eventBus.on('action:evaderFutureSet', () => this.showEvaderFutureSetWindow());
        eventBus.on('evaderFutureSet:compute', (data) => this.computeEvaderFutureSet(data));
        eventBus.on('evaderFutureSet:clear', () => this.clearEvaderFutureSet());

        // Intruder events
        eventBus.on('intruder:positionUpdate', (state) => {
            this.updateIntruderVisualization(state);
            this.autoSavePursuerSettings();
        });
        eventBus.on('intruder:initialized', (state) => {
            if (this.canvasController) {
                this.canvasController.setIntruderState(state);
                this.canvasController.redraw();
            }
            this.autoSavePursuerSettings();
        });
        eventBus.on('intruder:reset', () => {
            if (this.canvasController) {
                this.canvasController.clearIntruderState();
                this.canvasController.redraw();
            }
            // Clear pursuer from saved state
            this.clearPursuerFromStorage();
        });
        eventBus.on('canvas:placeIntruder', (position) => {
            this.intruderService.initialize(position.x, position.y, 0);
            this.autoSavePursuerSettings();
        });
        eventBus.on('intruder:setSpeed', (speed) => {
            this.intruderService.setSpeed(speed);
            this.autoSavePursuerSettings();
        });
        eventBus.on('intruder:setAngularSpeed', (omega) => {
            this.intruderService.setAngularSpeed(omega);
            this.autoSavePursuerSettings();
        });

        // Reduction level from AnalysisWindow slider
        eventBus.on('analysis:setReductionLevel', (level) => {
            this.medialAxisService.setReductionLevel(level);
            // Auto-save the reduction level to localStorage
            this.autoSaveAnalysisSettings();
            // live update: if skeleton exists, regenerate with new reduction
            if (this.canvasController?.medialAxisSkeleton) {
                this.generateMedialAxis();
            }
        });
        
        // Regenerate Voronoi on pan end so bbox follows viewport
        eventBus.on('camera:panEnded', () => {
            if (this.canvasController?.medialAxisSkeleton) {
                this.generateMedialAxis();
            }
        });

        // Regenerate Voronoi on zoom changes as well
        eventBus.on('camera:zoomChanged', () => {
            if (this.canvasController?.medialAxisSkeleton) {
                this.generateMedialAxis();
            }
        });
        
        // Data requests from components
        eventBus.on('request:polygonCount', (callback) => {
            callback(this.canvasController.getPolygonCount());
        });
        
        eventBus.on('request:stats', (callback) => {
            callback({
                polygonCount: this.canvasController.getPolygonCount(),
                totalVertices: this.canvasController.getTotalVertices()
            });
        });
    }

    handleSave() {
        const data = this.canvasController.exportData();
        // Add analysis settings to the export
        data.analysis = {
            vertexReductionLevel: this.medialAxisService.getReductionLevel()
        };
        // Add evader settings to the export
        const evaderState = this.evaderService.getState();
        data.evader = {
            mode: evaderState.mode,
            speed: evaderState.speed,
            angularSpeed: evaderState.angularSpeed
        };
        // Add agent (pursuer & evader) positional states
        const intruderState = this.intruderService.getState();
        if (intruderState?.position) {
            data.agents = data.agents || {};
            data.agents.pursuer = {
                position: intruderState.position,
                heading: intruderState.heading,
                speed: intruderState.speed,
                angularSpeed: intruderState.angularSpeed
            };
        } else {
            // Explicitly ensure pursuer is not in saved data if position is null
            if (data.agents?.pursuer) {
                delete data.agents.pursuer;
            }
        }
        if (evaderState?.position) {
            data.agents = data.agents || {};
            data.agents.evader = {
                position: evaderState.position,
                heading: evaderState.heading
            };
        }
        
        // Save all slider states across the application
        data.sliders = this.getAllSliderStates();
        
        const result = this.storageService.save(data);
        
        if (!result.success) {
            this.showNotification('Error saving polygons: ' + result.error, 'error');
        }
    }

    handleLoad() {
        const result = this.storageService.load();
        
        if (result.success) {
            try {
                this.canvasController.importData(result.data);
                
                // Update obstacles for all services after loading
                this.updateObstaclesForAllServices();
                
                // Restore analysis settings if they exist
                if (result.data.analysis && typeof result.data.analysis.vertexReductionLevel === 'number') {
                    const level = result.data.analysis.vertexReductionLevel;
                    this.medialAxisService.setReductionLevel(level);
                    eventBus.emit('analysis:reductionLevelRestored', level);
                }
                // Restore evader settings if they exist
                if (result.data.evader) {
                    this.loadEvaderSettings(result.data.evader);
                }
                // Restore agent positional states and speeds
                if (result.data.agents) {
                    const pursuer = result.data.agents.pursuer;
                    if (pursuer?.position) {
                        // Initialize intruder at saved position
                        this.intruderService.initialize(
                            pursuer.position.x,
                            pursuer.position.y,
                            pursuer.heading || 0
                        );
                        // Restore speeds if available
                        if (pursuer.speed !== undefined) {
                            this.intruderService.setSpeed(pursuer.speed);
                        }
                        if (pursuer.angularSpeed !== undefined) {
                            this.intruderService.setAngularSpeed(pursuer.angularSpeed);
                        }
                    }
                    const savedEvader = result.data.agents.evader;
                    if (savedEvader?.position) {
                        this.evaderService.setManualPosition(
                            savedEvader.position.x,
                            savedEvader.position.y,
                            savedEvader.heading || 0
                        );
                        // Ensure canvas updates immediately
                        this.updateEvaderVisualizationOnce();
                    }
                }
                
                // Restore all slider states
                if (result.data.sliders) {
                    // Use setTimeout to ensure all windows are initialized
                    setTimeout(() => {
                        this.restoreAllSliderStates(result.data.sliders);
                    }, 500);
                }
            } catch (error) {
                this.showNotification('Error loading polygons: ' + error.message, 'error');
            }
        } else {
            this.showNotification(result.error || 'No saved polygons found!', 'error');
        }
    }

    /**
     * Update obstacles for all services that need collision detection
     */
    updateObstaclesForAllServices() {
        if (!this.canvasController) return;
        
        const polygons = this.canvasController.getPolygons();
        const bounds = this.calculateWorkspaceBounds(polygons);
        
        // Update all services that need obstacle information
        // MedialAxisService is stateless regarding polygons, passed in generate call
        this.evaderService.setObstacles(polygons);
        // EvaderFutureSetService receives polygons in compute() call
        this.intruderService.setObstacles(polygons);
        this.sensorModelService.setObstacles(polygons);
        this.similarityCalculatorService.setEnvironment(polygons, bounds);
        this.siminetService.setEnvironment(polygons, bounds);
        // VisibilNetService and KiloVisiNetService are stateless regarding environment
        activeTrackingService.setObstacles(polygons);
        realTimeTrackingService.obstacles = polygons;
        rrtStarService.obstacles = polygons;
        rrtStarService.config.bounds = bounds;
        sdfService.setObstacles(polygons, bounds);
        
        console.log('Updated obstacles for all services, count:', polygons.length);
    }

    handleExport() {
        const data = this.canvasController.exportData();
        // Add analysis settings to the export
        data.analysis = {
            vertexReductionLevel: this.medialAxisService.getReductionLevel()
        };
        // Add evader settings to the export
        const evaderState = this.evaderService.getState();
        data.evader = {
            mode: evaderState.mode,
            speed: evaderState.speed,
            angularSpeed: evaderState.angularSpeed
        };
        // Add agent positional states
        const intruderState = this.intruderService.getState();
        if (intruderState?.position) {
            data.agents = data.agents || {};
            data.agents.pursuer = {
                position: intruderState.position,
                heading: intruderState.heading,
                speed: intruderState.speed,
                angularSpeed: intruderState.angularSpeed
            };
        } else {
            // Explicitly ensure pursuer is not in exported data if position is null
            if (data.agents?.pursuer) {
                delete data.agents.pursuer;
            }
        }
        if (evaderState?.position) {
            data.agents = data.agents || {};
            data.agents.evader = {
                position: evaderState.position,
                heading: evaderState.heading
            };
        }
        
        // Save all slider states
        data.sliders = this.getAllSliderStates();
        
        const result = this.fileService.exportToJSON(data);
        
        if (!result.success) {
            this.showNotification('Error exporting polygons: ' + result.error, 'error');
        }
    }

    async handleImport(file) {
        try {
            const result = await this.fileService.importFromJSON(file);
            
            if (result.success) {
                const validation = this.fileService.validatePolygonData(result.data);
                
                if (validation.valid) {
                    this.canvasController.importData(result.data);
                    
                    // Update obstacles for all services after importing
                    this.updateObstaclesForAllServices();
                    
                    // Restore analysis settings if they exist
                    if (result.data.analysis && typeof result.data.analysis.vertexReductionLevel === 'number') {
                        const level = result.data.analysis.vertexReductionLevel;
                        this.medialAxisService.setReductionLevel(level);
                        eventBus.emit('analysis:reductionLevelRestored', level);
                    }
                    // Restore evader settings if they exist
                    if (result.data.evader) {
                        this.loadEvaderSettings(result.data.evader);
                    }
                    // Restore agent positional states and speeds
                    if (result.data.agents) {
                        const pursuer = result.data.agents.pursuer;
                        if (pursuer?.position) {
                            this.intruderService.initialize(
                                pursuer.position.x,
                                pursuer.position.y,
                                pursuer.heading || 0
                            );
                            // Restore speeds if available
                            if (pursuer.speed !== undefined) {
                                this.intruderService.setSpeed(pursuer.speed);
                            }
                            if (pursuer.angularSpeed !== undefined) {
                                this.intruderService.setAngularSpeed(pursuer.angularSpeed);
                            }
                        }
                        const savedEvader = result.data.agents.evader;
                        if (savedEvader?.position) {
                            this.evaderService.setManualPosition(
                                savedEvader.position.x,
                                savedEvader.position.y,
                                savedEvader.heading || 0
                            );
                            this.updateEvaderVisualizationOnce();
                        }
                    }
                    
                    // Restore all slider states
                    if (result.data.sliders) {
                        // Use setTimeout to ensure all windows are initialized
                        setTimeout(() => {
                            this.restoreAllSliderStates(result.data.sliders);
                        }, 500);
                    }
                } else {
                    this.showNotification('Invalid file format: ' + validation.error, 'error');
                }
            }
        } catch (error) {
            this.showNotification('Error importing file: ' + error.message, 'error');
        }
    }

    autoSaveAnalysisSettings() {
        try {
            // Load existing data to preserve polygons and camera settings
            const existingData = this.storageService.load();
            if (existingData.success) {
                // Update the analysis settings
                existingData.data.analysis = {
                    vertexReductionLevel: this.medialAxisService.getReductionLevel()
                };
                // Save back to localStorage
                this.storageService.save(existingData.data);
            } else {
                // If no existing data, create minimal data with just analysis settings
                const data = {
                    version: '1.0',
                    polygons: [],
                    camera: { x: 0, y: 0, zoom: 1.0 },
                    analysis: {
                        vertexReductionLevel: this.medialAxisService.getReductionLevel()
                    }
                };
                this.storageService.save(data);
            }
        } catch (error) {
            console.error('Error auto-saving analysis settings:', error);
        }
    }

    autoSaveEvaderSettings() {
        try {
            // Load existing data to preserve polygons and other settings
            const existingData = this.storageService.load();
            const evaderSettings = {
                mode: this.evaderService.getState().mode,
                speed: this.evaderService.getState().speed,
                angularSpeed: this.evaderService.getState().angularSpeed
            };
            
            if (existingData.success) {
                // Update the evader settings
                existingData.data.evader = evaderSettings;
                // Save back to localStorage
                this.storageService.save(existingData.data);
            } else {
                // If no existing data, create minimal data with just evader settings
                const data = {
                    version: '1.0',
                    polygons: [],
                    camera: { x: 0, y: 0, zoom: 1.0 },
                    evader: evaderSettings
                };
                this.storageService.save(data);
            }
            console.log('Evader settings auto-saved:', evaderSettings);
        } catch (error) {
            console.error('Error auto-saving evader settings:', error);
        }
    }

    autoSavePursuerSettings() {
        try {
            // Load existing data to preserve polygons and other settings
            const existingData = this.storageService.load();
            const intruderState = this.intruderService.getState();
            
            if (!intruderState?.position) {
                // No pursuer placed yet, nothing to save
                return;
            }
            
            const pursuerSettings = {
                position: intruderState.position,
                heading: intruderState.heading,
                speed: intruderState.speed,
                angularSpeed: intruderState.angularSpeed
            };
            
            if (existingData.success) {
                // Update the pursuer settings
                existingData.data.agents = existingData.data.agents || {};
                existingData.data.agents.pursuer = pursuerSettings;
                // Save back to localStorage
                this.storageService.save(existingData.data);
            } else {
                // If no existing data, create minimal data with just pursuer settings
                const data = {
                    version: '1.0',
                    polygons: [],
                    camera: { x: 0, y: 0, zoom: 1.0 },
                    agents: {
                        pursuer: pursuerSettings
                    }
                };
                this.storageService.save(data);
            }
            console.log('Pursuer settings auto-saved:', pursuerSettings);
        } catch (error) {
            console.error('Error auto-saving pursuer settings:', error);
        }
    }

    clearPursuerFromStorage() {
        try {
            // Load existing data to preserve other settings
            const existingData = this.storageService.load();
            
            if (existingData.success && existingData.data.agents?.pursuer) {
                // Remove pursuer from saved data
                delete existingData.data.agents.pursuer;
                
                // If agents object is now empty, remove it too
                if (Object.keys(existingData.data.agents).length === 0) {
                    delete existingData.data.agents;
                }
                
                // Save back to localStorage
                this.storageService.save(existingData.data);
                console.log('Pursuer cleared from storage');
            }
        } catch (error) {
            console.error('Error clearing pursuer from storage:', error);
        }
    }

    showNotification(message, type = 'info') {
        // Only show error messages
        if (type === 'error') {
            alert(message);
        }
        console.log(`[${type.toUpperCase()}] ${message}`);
    }

    showAnalysisWindow() {
        console.log('showAnalysisWindow called');
        console.log('analysisWindow element:', this.analysisWindow);
        if (this.analysisWindow) {
            try {
                this.analysisWindow.show();
                console.log('Analysis window shown, display:', this.analysisWindow.style.display);
            } catch (error) {
                console.error('Error showing analysis window:', error);
            }
        } else {
            console.error('Analysis window not initialized');
            alert('Analysis window not initialized. Please refresh the page.');
        }
    }

    showEvaderWindow() {
        console.log('showEvaderWindow called');
        console.log('evaderWindow element:', this.evaderWindow);
        if (this.evaderWindow) {
            try {
                this.evaderWindow.show();
                console.log('Evader window shown');
            } catch (error) {
                console.error('Error showing evader window:', error);
            }
        } else {
            console.error('Evader window not initialized');
            alert('Evader window not initialized. Please refresh the page.');
        }
    }

    showAgentsWindow() {
        console.log('showAgentsWindow called');
        console.log('agentsWindow element:', this.agentsWindow);
        if (this.agentsWindow) {
            try {
                this.agentsWindow.show();
                console.log('Agents window shown');
            } catch (error) {
                console.error('Error showing agents window:', error);
            }
        } else {
            console.error('Agents window not initialized');
            alert('Agents window not initialized. Please refresh the page.');
        }
    }

    showEvaderFutureSetWindow() {
        console.log('showEvaderFutureSetWindow called');
        console.log('evaderFutureSetWindow element:', this.evaderFutureSetWindow);
        if (this.evaderFutureSetWindow) {
            try {
                this.evaderFutureSetWindow.show();
                console.log('Evader future set window shown');
            } catch (error) {
                console.error('Error showing evader future set window:', error);
            }
        } else {
            console.error('Evader future set window not initialized');
            alert('Evader future set window not initialized. Please refresh the page.');
        }
    }

    showVisibilityWindow() {
        if (this.visibilityWindow) {
            try {
                this.visibilityWindow.show();
            } catch (error) {
                console.error('Error showing visibility window:', error);
            }
        } else {
            console.error('Visibility window not initialized');
            alert('Visibility window not initialized. Please refresh the page.');
        }
    }

    showVisibilNetWindow() {
        if (this.visibilnetWindow) {
            try {
                this.visibilnetWindow.show();
            } catch (error) {
                console.error('Error showing VisibilNet window:', error);
            }
        } else {
            console.error('VisibilNet window not initialized');
            alert('VisibilNet window not initialized. Please refresh the page.');
        }
    }

    showKiloVisiNetWindow() {
        if (this.kilovisinetWindow) {
            try {
                this.kilovisinetWindow.show();
            } catch (error) {
                console.error('Error showing KiloVisiNet window:', error);
            }
        } else {
            console.error('KiloVisiNet window not initialized');
            alert('KiloVisiNet window not initialized. Please refresh the page.');
        }
    }

    showSimilarityWindow() {
        console.log('showSimilarityWindow called');
        console.log('similarityWindow:', this.similarityWindow);
        if (this.similarityWindow) {
            try {
                this.similarityWindow.show();
                console.log('Similarity Calculator window shown');
            } catch (error) {
                console.error('Error showing Similarity Calculator window:', error);
            }
        } else {
            console.error('Similarity Calculator window not initialized');
            alert('Similarity Calculator window not initialized. Please refresh the page.');
        }
    }

    showSimiNetWindow() {
        console.log('showSimiNetWindow called');
        if (this.siminetWindow) {
            try {
                // Check if show method exists (it might be a web component property)
                if (typeof this.siminetWindow.show === 'function') {
                    this.siminetWindow.show();
                } else {
                    this.siminetWindow.setAttribute('visible', '');
                }
                console.log('SimiNet Training window shown');
            } catch (error) {
                console.error('Error showing SimiNet Training window:', error);
            }
        } else {
            console.error('SimiNet Training window not initialized');
            alert('SimiNet Training window not initialized. Please refresh the page.');
        }
    }

    showRRTWindow() {
        console.log('showRRTWindow called');
        console.log('rrtWindow element:', this.rrtWindow);
        if (this.rrtWindow) {
            try {
                this.rrtWindow.show();
                console.log('RRT window shown');
            } catch (error) {
                console.error('Error showing RRT window:', error);
            }
        } else {
            console.error('RRT window not initialized');
            alert('RRT window not initialized. Please refresh the page.');
        }
    }

    showActiveTrackingWindow() {
        console.log('showActiveTrackingWindow called');
        if (this.activeTrackingWindow) {
            try {
                // Initialize active tracking service with obstacles and sensor model service
                const polygons = this.canvasController.getPolygons();
                activeTrackingService.setObstacles(polygons);
                activeTrackingService.setSensorModelService(this.sensorModelService);
                
                // Calculate and set workspace bounds (critical for RRT* tree building)
                const bounds = this.calculateWorkspaceBounds(polygons);
                rrtStarService.config.bounds = bounds;
                console.log('Active Tracking: Workspace bounds set:', bounds);
                
                this.activeTrackingWindow.show();
                console.log('Active Tracking window shown');
            } catch (error) {
                console.error('Error showing Active Tracking window:', error);
            }
        } else {
            console.error('Active Tracking window not initialized');
            alert('Active Tracking window not initialized. Please refresh the page.');
        }
    }

    showRealTimeTrackingWindow() {
        console.log('showRealTimeTrackingWindow called');
        if (this.realTimeTrackingWindow) {
            try {
                // Initialize services with obstacles
                const polygons = this.canvasController.getPolygons();
                activeTrackingService.setObstacles(polygons);
                activeTrackingService.setSensorModelService(this.sensorModelService);
                rrtStarService.obstacles = polygons || [];
                realTimeTrackingService.obstacles = polygons;
                
                // Calculate and set workspace bounds (critical for RRT* tree building)
                const bounds = this.calculateWorkspaceBounds(polygons);
                rrtStarService.config.bounds = bounds;
                console.log('Real-Time Tracking: Workspace bounds set:', bounds);
                
                this.realTimeTrackingWindow.show();
                console.log('Real-Time Tracking window shown');
            } catch (error) {
                console.error('Error showing Real-Time Tracking window:', error);
            }
        } else {
            console.error('Real-Time Tracking window not initialized');
            alert('Real-Time Tracking window not initialized. Please refresh the page.');
        }
    }

    showSimilarityMPPITrackingWindow() {
        console.log('showSimilarityMPPITrackingWindow called');
        if (this.similarityMPPITrackingWindow) {
            try {
                this.similarityMPPITrackingWindow.show();
                console.log('Similarity MPPI Tracking window shown');
            } catch (error) {
                console.error('Error showing Similarity MPPI Tracking window:', error);
            }
        } else {
            console.error('Similarity MPPI Tracking window not initialized');
            alert('Similarity MPPI Tracking window not initialized. Please refresh the page.');
        }
    }

    /**
     * Calculate workspace bounds from polygon bounding box
     * @param {Array} obstacles - Array of polygon obstacles
     * @returns {Object} Bounds {x_min, x_max, y_min, y_max}
     */
    calculateWorkspaceBounds(obstacles) {
        // Default bounds if no obstacles
        const defaultBounds = {
            x_min: -500,
            x_max: 1500,
            y_min: -500,
            y_max: 1500
        };
        
        if (!obstacles || obstacles.length === 0) {
            console.log('No obstacles, using default bounds');
            return defaultBounds;
        }
        
        // Calculate bounding box of all polygons
        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;
        
        for (const polygon of obstacles) {
            if (!polygon.vertices || polygon.vertices.length === 0) continue;
            
            for (const vertex of polygon.vertices) {
                minX = Math.min(minX, vertex.x);
                maxX = Math.max(maxX, vertex.x);
                minY = Math.min(minY, vertex.y);
                maxY = Math.max(maxY, vertex.y);
            }
        }
        
        // Add margin around obstacles for exploration (20% of size, minimum 200)
        const width = maxX - minX;
        const height = maxY - minY;
        const margin = Math.max(200, Math.max(width, height) * 0.2);
        
        // Include agent positions in bounds calculation
        const pursuer = rrtStarService.pursuerState;
        const evader = rrtStarService.evaderState;
        
        if (pursuer) {
            minX = Math.min(minX, pursuer.x);
            maxX = Math.max(maxX, pursuer.x);
            minY = Math.min(minY, pursuer.y);
            maxY = Math.max(maxY, pursuer.y);
        }
        
        if (evader) {
            minX = Math.min(minX, evader.x);
            maxX = Math.max(maxX, evader.x);
            minY = Math.min(minY, evader.y);
            maxY = Math.max(maxY, evader.y);
        }
        
        const bounds = {
            x_min: minX - margin,
            x_max: maxX + margin,
            y_min: minY - margin,
            y_max: maxY + margin,
            // Add camelCase aliases for compatibility with SDFService and TensorFlowMPPIService
            minX: minX - margin,
            maxX: maxX + margin,
            minY: minY - margin,
            maxY: maxY + margin
        };
        
        console.log('Calculated workspace bounds:', bounds);
        return bounds;
    }

    /**
     * Collect all slider states from all windows/components
     * @returns {Object} Slider states organized by component
     */
    getAllSliderStates() {
        const sliders = {};
        
        // RRT Window sliders
        if (this.rrtWindow && this.rrtWindow.shadowRoot) {
            const rrtSliders = {};
            const sliderIds = ['vMax', 'omegaMax', 'maxNodes', 'planningTimeLimit', 'steerTime', 'dt', 'goalSampleRate', 'rewireRadius', 'robotRadius'];
            sliderIds.forEach(id => {
                const slider = this.rrtWindow.shadowRoot.querySelector(`#${id}`);
                if (slider) {
                    rrtSliders[id] = parseFloat(slider.value) || slider.value;
                }
            });
            sliders.rrtWindow = rrtSliders;
        }
        
        // Real-Time Tracking Window sliders
        // Real-Time Tracking Window sliders
        if (this.realTimeTrackingWindow && this.realTimeTrackingWindow.shadowRoot) {
            const rttSliders = {};
            const sliderIds = ['maxNodesSlider', 'maxPlanningTimeSlider', 'steerTimeSlider', 'dtSlider', 'goalSampleRateSlider', 'rewireRadiusSlider', 'robotRadiusSlider', 
                              'vMaxSlider', 'vMinSlider', 'omegaMaxSlider', 'pursuerRMinSlider', 'pursuerRMaxSlider', 'pursuerFOVSlider', 'updateIntervalSlider'];
            sliderIds.forEach(id => {
                const slider = this.realTimeTrackingWindow.shadowRoot.querySelector(`#${id}`);
                if (slider) {
                    rttSliders[id] = parseFloat(slider.value) || slider.value;
                }
            });
            // Also save strategy selector
            const strategySelector = this.realTimeTrackingWindow.shadowRoot.querySelector('#strategySelector');
            if (strategySelector) rttSliders.strategy = strategySelector.value;
            const pursuerSensorEnabled = this.realTimeTrackingWindow.shadowRoot.querySelector('#pursuerSensorEnabled');
            if (pursuerSensorEnabled) rttSliders.pursuerSensorEnabled = pursuerSensorEnabled.checked;
            sliders.realTimeTrackingWindow = rttSliders;
        }
        
        // Active Tracking Window (no sliders to save, but save visualization options)
        if (this.activeTrackingWindow && this.activeTrackingWindow.shadowRoot) {
            const atOptions = {};
            const showVisLines = this.activeTrackingWindow.shadowRoot.querySelector('#showVisibilityLines');
            const highlightVisible = this.activeTrackingWindow.shadowRoot.querySelector('#highlightVisible');
            const showIndices = this.activeTrackingWindow.shadowRoot.querySelector('#showNodeIndices');
            if (showVisLines) atOptions.showVisibilityLines = showVisLines.checked;
            if (highlightVisible) atOptions.highlightVisible = highlightVisible.checked;
            if (showIndices) atOptions.showNodeIndices = showIndices.checked;
            sliders.activeTrackingWindow = atOptions;
        }
        
        // Evader Window sliders
        if (this.evaderWindow && this.evaderWindow.shadowRoot) {
            const evaderSliders = {};
            const speedSlider = this.evaderWindow.shadowRoot.querySelector('#speedSlider');
            const angularSpeedSlider = this.evaderWindow.shadowRoot.querySelector('#angularSpeedSlider');
            if (speedSlider) evaderSliders.speed = parseFloat(speedSlider.value);
            if (angularSpeedSlider) evaderSliders.angularSpeed = parseFloat(angularSpeedSlider.value);
            sliders.evaderWindow = evaderSliders;
        }
        
        // Evader Future Set Window sliders
        if (this.evaderFutureSetWindow && this.evaderFutureSetWindow.shadowRoot) {
            const efsSliders = {};
            const timeHorizonSlider = this.evaderFutureSetWindow.shadowRoot.querySelector('#timeHorizonSlider');
            const speedSlider = this.evaderFutureSetWindow.shadowRoot.querySelector('#intruderSpeedSlider');
            const angularSpeedSlider = this.evaderFutureSetWindow.shadowRoot.querySelector('#intruderAngularSpeedSlider');
            if (timeHorizonSlider) efsSliders.timeHorizon = parseFloat(timeHorizonSlider.value);
            if (speedSlider) efsSliders.speed = parseFloat(speedSlider.value);
            if (angularSpeedSlider) efsSliders.angularSpeed = parseFloat(angularSpeedSlider.value);
            sliders.evaderFutureSetWindow = efsSliders;
        }
        
        // Agents Window sensor sliders
        if (this.agentsWindow && this.agentsWindow.shadowRoot) {
            const agentSliders = {};
            const sliderIds = ['pursuerRmaxSlider', 'pursuerRminSlider', 'pursuerFovSlider', 'evaderRmaxSlider', 'evaderRminSlider', 'evaderFovSlider',
                              'pursuerSpeedSlider', 'pursuerAngularSpeedSlider', 'evaderSpeedSlider', 'evaderAngularSpeedSlider'];
            sliderIds.forEach(id => {
                const slider = this.agentsWindow.shadowRoot.querySelector(`#${id}`);
                if (slider) {
                    agentSliders[id] = parseFloat(slider.value) || slider.value;
                }
            });
            sliders.agentsWindow = agentSliders;
        }
        
        // Analysis Window sliders
        if (this.analysisWindow && this.analysisWindow.shadowRoot) {
            const analysisSliders = {};
            const reductionSlider = this.analysisWindow.shadowRoot.querySelector('#reductionSlider');
            if (reductionSlider) analysisSliders.vertexReduction = parseFloat(reductionSlider.value);
            sliders.analysisWindow = analysisSliders;
        }
        
        // Canvas Toolbar zoom slider
        const canvasToolbar = document.querySelector('canvas-toolbar');
        if (canvasToolbar && canvasToolbar.shadowRoot) {
            const toolbarSliders = {};
            const zoomSlider = canvasToolbar.shadowRoot.querySelector('#zoomSlider');
            if (zoomSlider) toolbarSliders.zoom = parseFloat(zoomSlider.value);
            sliders.canvasToolbar = toolbarSliders;
        }
        
        console.log('Collected slider states:', sliders);
        return sliders;
    }

    /**
     * Restore all slider states to their saved values
     * @param {Object} sliders - Slider states organized by component
     */
    restoreAllSliderStates(sliders) {
        if (!sliders) return;
        
        console.log('Restoring slider states:', sliders);
        
        // RRT Window sliders
        if (sliders.rrtWindow && this.rrtWindow && this.rrtWindow.shadowRoot) {
            Object.entries(sliders.rrtWindow).forEach(([id, value]) => {
                const slider = this.rrtWindow.shadowRoot.querySelector(`#${id}`);
                if (slider) {
                    slider.value = value;
                    // Trigger input event to update the value display and configuration
                    slider.dispatchEvent(new Event('input', { bubbles: true }));
                }
            });
        }
        
        // Real-Time Tracking Window sliders
        if (sliders.realTimeTrackingWindow && this.realTimeTrackingWindow && this.realTimeTrackingWindow.shadowRoot) {
            Object.entries(sliders.realTimeTrackingWindow).forEach(([id, value]) => {
                if (id === 'strategy') {
                    const strategySelector = this.realTimeTrackingWindow.shadowRoot.querySelector('#strategySelector');
                    if (strategySelector) {
                        strategySelector.value = value;
                    }
                } else if (id === 'pursuerSensorEnabled') {
                    const checkbox = this.realTimeTrackingWindow.shadowRoot.querySelector('#pursuerSensorEnabled');
                    if (checkbox) {
                        checkbox.checked = value;
                    }
                } else {
                    const slider = this.realTimeTrackingWindow.shadowRoot.querySelector(`#${id}`);
                    if (slider) {
                        slider.value = value;
                        // Trigger input event to update the value display
                        slider.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                }
            });
        }
        
        // Active Tracking Window (restore visualization options)
        if (sliders.activeTrackingWindow && this.activeTrackingWindow && this.activeTrackingWindow.shadowRoot) {
            if (sliders.activeTrackingWindow.showVisibilityLines !== undefined) {
                const checkbox = this.activeTrackingWindow.shadowRoot.querySelector('#showVisibilityLines');
                if (checkbox) checkbox.checked = sliders.activeTrackingWindow.showVisibilityLines;
            }
            if (sliders.activeTrackingWindow.highlightVisible !== undefined) {
                const checkbox = this.activeTrackingWindow.shadowRoot.querySelector('#highlightVisible');
                if (checkbox) checkbox.checked = sliders.activeTrackingWindow.highlightVisible;
            }
            if (sliders.activeTrackingWindow.showNodeIndices !== undefined) {
                const checkbox = this.activeTrackingWindow.shadowRoot.querySelector('#showNodeIndices');
                if (checkbox) checkbox.checked = sliders.activeTrackingWindow.showNodeIndices;
            }
        }
        
        // Evader Window sliders
        if (sliders.evaderWindow && this.evaderWindow && this.evaderWindow.shadowRoot) {
            if (sliders.evaderWindow.speed !== undefined) {
                const speedSlider = this.evaderWindow.shadowRoot.querySelector('#speedSlider');
                if (speedSlider) {
                    speedSlider.value = sliders.evaderWindow.speed;
                    speedSlider.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }
            if (sliders.evaderWindow.angularSpeed !== undefined) {
                const angularSpeedSlider = this.evaderWindow.shadowRoot.querySelector('#angularSpeedSlider');
                if (angularSpeedSlider) {
                    angularSpeedSlider.value = sliders.evaderWindow.angularSpeed;
                    angularSpeedSlider.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }
        }
        
        // Evader Future Set Window sliders
        if (sliders.evaderFutureSetWindow && this.evaderFutureSetWindow && this.evaderFutureSetWindow.shadowRoot) {
            if (sliders.evaderFutureSetWindow.timeHorizon !== undefined) {
                const timeHorizonSlider = this.evaderFutureSetWindow.shadowRoot.querySelector('#timeHorizonSlider');
                if (timeHorizonSlider) {
                    timeHorizonSlider.value = sliders.evaderFutureSetWindow.timeHorizon;
                    timeHorizonSlider.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }
            if (sliders.evaderFutureSetWindow.speed !== undefined) {
                const speedSlider = this.evaderFutureSetWindow.shadowRoot.querySelector('#intruderSpeedSlider');
                if (speedSlider) {
                    speedSlider.value = sliders.evaderFutureSetWindow.speed;
                    speedSlider.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }
            if (sliders.evaderFutureSetWindow.angularSpeed !== undefined) {
                const angularSpeedSlider = this.evaderFutureSetWindow.shadowRoot.querySelector('#intruderAngularSpeedSlider');
                if (angularSpeedSlider) {
                    angularSpeedSlider.value = sliders.evaderFutureSetWindow.angularSpeed;
                    angularSpeedSlider.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }
        }
        
        // Agents Window sensor sliders
        if (sliders.agentsWindow && this.agentsWindow && this.agentsWindow.shadowRoot) {
            Object.entries(sliders.agentsWindow).forEach(([id, value]) => {
                const slider = this.agentsWindow.shadowRoot.querySelector(`#${id}`);
                if (slider) {
                    slider.value = value;
                    slider.dispatchEvent(new Event('input', { bubbles: true }));
                }
            });
        }
        
        // Analysis Window sliders
        if (sliders.analysisWindow && this.analysisWindow && this.analysisWindow.shadowRoot) {
            if (sliders.analysisWindow.vertexReduction !== undefined) {
                const reductionSlider = this.analysisWindow.shadowRoot.querySelector('#reductionSlider');
                if (reductionSlider) {
                    reductionSlider.value = sliders.analysisWindow.vertexReduction;
                    reductionSlider.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }
        }
        
        // Canvas Toolbar zoom slider
        if (sliders.canvasToolbar) {
            const canvasToolbar = document.querySelector('canvas-toolbar');
            if (canvasToolbar && canvasToolbar.shadowRoot && sliders.canvasToolbar.zoom !== undefined) {
                const zoomSlider = canvasToolbar.shadowRoot.querySelector('#zoomSlider');
                if (zoomSlider) {
                    zoomSlider.value = sliders.canvasToolbar.zoom;
                    zoomSlider.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }
        }
        
        console.log('Slider states restored');
    }

    computeEvaderFutureSet(data) {
        try {
            console.log('Computing evader future set with time horizon:', data.timeHorizon);
            
            // Check if evader is placed - if so, use its position
            const evaderState = this.evaderService.getState();
            let startState;
            let motionParams;
            
            if (evaderState && evaderState.position) {
                // Use evader's position and parameters
                console.log('Using evader position for future set computation');
                startState = {
                    x: evaderState.position.x,
                    y: evaderState.position.y,
                    theta: evaderState.heading || 0
                };
                motionParams = {
                    v_max: evaderState.speed,
                    omega_max: evaderState.angularSpeed
                };
            } else {
                // Fall back to intruder position
                console.log('Evader not placed, using intruder position for future set computation');
                const intruderState = this.intruderService.getState();
                if (!intruderState || !intruderState.position) {
                    eventBus.emit('evaderFutureSet:error', { 
                        message: 'Please place an evader or intruder first. Use the Agents window to place an agent.' 
                    });
                    return;
                }
                
                startState = {
                    x: intruderState.position.x,
                    y: intruderState.position.y,
                    theta: intruderState.heading
                };
                motionParams = {
                    v_max: intruderState.speed,
                    omega_max: intruderState.angularSpeed
                };
            }

            // Get polygons (obstacles)
            const polygons = this.canvasController.getPolygons();

            // Compute reachability asynchronously
            this.evaderFutureSetService.compute(
                startState,
                polygons,
                data.timeHorizon,
                motionParams
            ).then(result => {
                if (result.success) {
                    // Update canvas visualization
                    if (this.canvasController) {
                        this.canvasController.setFutureSet(result.futureSet, result.gridPoints);
                        this.canvasController.redraw();
                    }
                    
                    eventBus.emit('evaderFutureSet:computed', {
                        count: result.futureSet.length,
                        computationTime: result.computationTime,
                        expansions: result.expansions
                    });
                    
                    console.log('Future set computed successfully:', result);
                } else {
                    eventBus.emit('evaderFutureSet:error', { 
                        message: result.message || 'Computation failed' 
                    });
                }
            }).catch(error => {
                console.error('Error in future set computation:', error);
                eventBus.emit('evaderFutureSet:error', { message: error.message });
            });
            
        } catch (error) {
            console.error('Error computing evader future set:', error);
            eventBus.emit('evaderFutureSet:error', { message: error.message });
        }
    }

    clearEvaderFutureSet() {
        try {
            console.log('Clearing evader future set');
            
            // Clear service data
            this.evaderFutureSetService.clear();
            
            // Clear canvas visualization
            if (this.canvasController) {
                this.canvasController.clearFutureSet();
                this.canvasController.redraw();
            }
            
            eventBus.emit('evaderFutureSet:cleared');
            
            console.log('Future set cleared');
        } catch (error) {
            console.error('Error clearing evader future set:', error);
            eventBus.emit('evaderFutureSet:error', { message: error.message });
        }
    }

    startEvaderSimulation(data) {
        try {
            // Check if skeleton exists
            const skeleton = this.canvasController?.medialAxisSkeleton;
            if (!skeleton || !skeleton.points || skeleton.points.length === 0) {
                eventBus.emit('evader:noSkeleton');
                return;
            }

            // Initialize evader service with skeleton data
            this.evaderService.initialize(skeleton);
            
            // Start simulation
            this.evaderService.start(data.mode);
            
            // Start render loop to update visualization
            this.startEvaderRenderLoop();
            
            console.log('Evader simulation started:', data);
        } catch (error) {
            console.error('Error starting evader simulation:', error);
            eventBus.emit('evader:error', error.message);
        }
    }

    startEvaderRenderLoop() {
        // Stop any existing render loop
        if (this.evaderRenderLoopId) {
            cancelAnimationFrame(this.evaderRenderLoopId);
        }
        
        const updateLoop = () => {
            const state = this.evaderService.getState();
            
            if (this.evaderService.isRunning) {
                // Update canvas visualization
                if (this.canvasController) {
                    this.canvasController.setEvaderState(state);
                    this.canvasController.redraw();
                }
                
                // Emit position update for other components
                eventBus.emit('evader:positionUpdate', state);
                
                // Continue loop
                this.evaderRenderLoopId = requestAnimationFrame(updateLoop);
            } else {
                // When paused, keep showing the evader at its current position
                // Only clear if there's no position (i.e., it was reset)
                if (this.canvasController) {
                    if (state.position) {
                        // Paused - keep showing current state
                        this.canvasController.setEvaderState(state);
                        this.canvasController.redraw();
                    } else {
                        // Reset - clear visualization
                        this.canvasController.clearEvaderState();
                        this.canvasController.redraw();
                    }
                }
                this.evaderRenderLoopId = null;
            }
        };
        
        updateLoop();
    }

    updateEvaderVisualization(data) {
        // Update canvas with evader position
        if (this.canvasController) {
            this.canvasController.setEvaderState(data);
        }
    }

    updateEvaderVisualizationOnce() {
        // Update visualization once (for paused state)
        const state = this.evaderService.getState();
        if (this.canvasController && state.position) {
            this.canvasController.setEvaderState(state);
            this.canvasController.redraw();
        }
    }

    updateIntruderVisualization(state) {
        // Update canvas with intruder position
        if (this.canvasController) {
            this.canvasController.setIntruderState(state);
            this.canvasController.redraw();
        }
    }

    enableEvaderPlacement() {
        // Set up temporary click handler for placing evader
        const clickHandler = (e) => {
            const rect = this.canvasController.canvas.getBoundingClientRect();
            const screenX = e.clientX - rect.left;
            const screenY = e.clientY - rect.top;
            const worldPos = this.canvasController.screenToWorld(screenX, screenY);
            
            // Place evader at this position
            if (this.evaderService) {
                // Stop any running simulation first
                this.evaderService.stop();
                
                // Deactivate manual control if active
                this.deactivateEvaderManualControl();
                
                // Set evader position manually
                this.evaderService.setManualPosition(worldPos.x, worldPos.y, 0);
                
                // Emit event to notify AgentsWindow
                eventBus.emit('canvas:placeEvader', worldPos);
                
                // Update visualization
                this.updateEvaderVisualizationOnce();
            }
            
            // Remove this temporary handler
            this.canvasController.canvas.removeEventListener('click', clickHandler);
        };
        
        // Add temporary click handler
        this.canvasController.canvas.addEventListener('click', clickHandler, { once: true });
    }

    enablePursuerPlacement() {
        // Set up temporary click handler for placing pursuer
        const clickHandler = (e) => {
            const rect = this.canvasController.canvas.getBoundingClientRect();
            const screenX = e.clientX - rect.left;
            const screenY = e.clientY - rect.top;
            const worldPos = this.canvasController.screenToWorld(screenX, screenY);
            
            // Place pursuer at this position
            if (this.intruderService) {
                // Deactivate first to clear any previous state
                this.intruderService.deactivate();
                
                // Initialize intruder at clicked position
                this.intruderService.initialize(worldPos.x, worldPos.y, 0);
                
                // Emit event to notify AgentsWindow
                eventBus.emit('canvas:placeIntruder', worldPos);
            }
            
            // Remove this temporary handler
            this.canvasController.canvas.removeEventListener('click', clickHandler);
        };
        
        // Add temporary click handler
        this.canvasController.canvas.addEventListener('click', clickHandler, { once: true });
    }

    activateEvaderKeyboardControl() {
        // Stop any running evader simulation
        if (this.evaderService.isRunning) {
            this.evaderService.stop();
        }
        
        // Activate manual evader control with keyboard
        this.evaderManualControl = {
            isActive: true,
            keysPressed: new Set(),
            movementInterval: null
        };
        
        // Set up keyboard listeners
        this.evaderKeyDownHandler = (e) => {
            if (!this.evaderManualControl.isActive) return;
            // Ignore if modifier keys are pressed (Ctrl, Alt, Cmd/Meta) - these are for shortcuts
            if (e.ctrlKey || e.altKey || e.metaKey) return;
            const moveKeys = ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d','W','A','S','D'];
            if (moveKeys.includes(e.key)) {
                e.preventDefault();
                this.evaderManualControl.keysPressed.add(e.key);
                if (!this.evaderManualControl.movementInterval) {
                    this.startEvaderContinuousMovement();
                }
            }
        };
        
        this.evaderKeyUpHandler = (e) => {
            if (!this.evaderManualControl.isActive) return;
            const moveKeys = ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d','W','A','S','D'];
            if (moveKeys.includes(e.key)) {
                this.evaderManualControl.keysPressed.delete(e.key);
                if (this.evaderManualControl.keysPressed.size === 0) {
                    this.stopEvaderContinuousMovement();
                }
            }
        };
        
        window.addEventListener('keydown', this.evaderKeyDownHandler);
        window.addEventListener('keyup', this.evaderKeyUpHandler);
        
        console.log('Evader keyboard control activated');
    }

    deactivateEvaderManualControl() {
        if (!this.evaderManualControl) return;
        
        this.evaderManualControl.isActive = false;
        this.stopEvaderContinuousMovement();
        
        // Remove keyboard listeners
        if (this.evaderKeyDownHandler) {
            window.removeEventListener('keydown', this.evaderKeyDownHandler);
            this.evaderKeyDownHandler = null;
        }
        if (this.evaderKeyUpHandler) {
            window.removeEventListener('keyup', this.evaderKeyUpHandler);
            this.evaderKeyUpHandler = null;
        }
        
        console.log('Evader keyboard control deactivated');
    }

    startEvaderContinuousMovement() {
        if (!this.evaderManualControl || this.evaderManualControl.movementInterval) return;
        
        this.evaderManualControl.movementInterval = setInterval(() => {
            this.handleEvaderMovement();
        }, 16); // ~60fps
    }

    stopEvaderContinuousMovement() {
        if (!this.evaderManualControl || !this.evaderManualControl.movementInterval) return;
        
        clearInterval(this.evaderManualControl.movementInterval);
        this.evaderManualControl.movementInterval = null;
    }

    handleEvaderMovement() {
        if (!this.evaderManualControl || this.evaderManualControl.keysPressed.size === 0) return;
        
        const evaderState = this.evaderService.getState();
        if (!evaderState || !evaderState.position) return;

        const moveSpeed = 5; // pixels per frame
        const turnSpeed = 0.15; // radians per frame
        
        let newX = evaderState.position.x;
        let newY = evaderState.position.y;
        let newHeading = evaderState.heading || 0;
        let moved = false;

        const hasKey = (k) => this.evaderManualControl.keysPressed.has(k);
        const leftTurn = hasKey('ArrowLeft') || hasKey('a') || hasKey('A');
        const rightTurn = hasKey('ArrowRight') || hasKey('d') || hasKey('D');
        const forward = hasKey('ArrowUp') || hasKey('w') || hasKey('W');
        const backward = hasKey('ArrowDown') || hasKey('s') || hasKey('S');

        if (leftTurn) {
            newHeading -= turnSpeed;
            moved = true;
        }
        if (rightTurn) {
            newHeading += turnSpeed;
            moved = true;
        }

        while (newHeading > Math.PI) newHeading -= 2 * Math.PI;
        while (newHeading < -Math.PI) newHeading += 2 * Math.PI;

        if (forward) {
            newX += Math.cos(newHeading) * moveSpeed;
            newY += Math.sin(newHeading) * moveSpeed;
            moved = true;
        }
        if (backward) {
            newX -= Math.cos(newHeading) * moveSpeed;
            newY -= Math.sin(newHeading) * moveSpeed;
            moved = true;
        }

        if (moved) {
            this.evaderService.setManualPosition(newX, newY, newHeading);
            this.updateEvaderVisualizationOnce();
        }
    }

    generateMedialAxis() {
        try {
            // Get all polygons from canvas
            const polygons = this.canvasController.getPolygons();
            
            if (polygons.length === 0) {
                eventBus.emit('analysis:error', 'No polygons to analyze. Please draw some polygons first.');
                return;
            }

            // Use current world-space viewport bounds so Voronoi fills the visible area
            const view = this.canvasController.getWorldViewBounds();
            const canvasBounds = {
                minX: view.minX,
                minY: view.minY,
                maxX: view.maxX,
                maxY: view.maxY,
                width: view.width,
                height: view.height
            };

            // Generate medial axis skeleton
            const skeletonData = this.medialAxisService.generateMedialAxis(polygons, canvasBounds);
            
            // Visualize the skeleton on canvas
            this.canvasController.setMedialAxisSkeleton(skeletonData);
            
            // Notify analysis window with detailed info
            eventBus.emit('analysis:medialAxisGenerated', {
                pointCount: skeletonData.pointCount,
                edgeCount: skeletonData.edgeCount,
                samplePointCount: skeletonData.samplePoints.length,
                voronoiCellCount: skeletonData.voronoi.polygons.features.length
            });
            
            console.log('Medial axis skeleton generated:', skeletonData);
            console.log(`Sample points: ${skeletonData.samplePoints.length}`);
            console.log(`Voronoi cells: ${skeletonData.voronoi.polygons.features.length}`);
            console.log(`Skeleton points: ${skeletonData.pointCount}`);
            console.log(`Skeleton edges: ${skeletonData.edgeCount}`);
        } catch (error) {
            console.error('Error generating medial axis:', error);
            eventBus.emit('analysis:error', error.message);
        }
    }

    resizeCanvas() {
        const canvasComponent = document.querySelector('polygon-canvas');
        if (!canvasComponent) return;
        
        const canvas = canvasComponent.getCanvas();
        const container = canvasComponent.shadowRoot.querySelector('.canvas-container');
        
        if (!canvas || !container) return;
        
        const width = Math.min(container.clientWidth - 40, 1200);
        const height = Math.min(600, window.innerHeight - 300);
        
        const sizeChanged = canvas.width !== width || canvas.height !== height;
        canvas.width = width;
        canvas.height = height;
        
        this.canvasController?.redraw();

        // If size changed and we have a skeleton, regenerate Voronoi to fill viewport
        if (sizeChanged && this.canvasController?.medialAxisSkeleton) {
            try {
                this.generateMedialAxis();
            } catch {}
        }
    }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new App());
} else {
    new App();
}

export { App };
