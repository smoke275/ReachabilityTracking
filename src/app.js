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

// Import Core modules
import { PolygonCanvasController } from './controllers/PolygonCanvasController.js';
import { StorageService } from './services/StorageService.js';
import { FileService } from './services/FileService.js';
import { eventBus } from './utils/EventBus.js';

/**
 * Main App class
 * Initializes and coordinates the entire application
 */
class App {
    constructor() {
        this.storageService = new StorageService();
        this.fileService = new FileService();
        this.canvasController = null;
        
        this.init();
    }

    async init() {
        // Wait for components to be ready
        await this.waitForComponents();
        
        // Initialize canvas controller
        const canvasComponent = document.querySelector('polygon-canvas');
        const canvas = canvasComponent.getCanvas();
        this.canvasController = new PolygonCanvasController(canvas);
        
        // Setup event handlers
        this.setupEventHandlers();
        
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
            'stats-section'
        ];

        await Promise.all(
            componentNames.map(name => customElements.whenDefined(name))
        );
    }

    setupEventHandlers() {
        // Drawing actions
        eventBus.on('action:startDrawing', () => this.canvasController.startDrawingMode());
        eventBus.on('action:completePolygon', () => this.canvasController.completePolygon());
        eventBus.on('action:cancelDrawing', () => this.canvasController.cancelDrawing());
        
        // Shape creation actions
        eventBus.on('action:createTriangle', () => this.canvasController.createTriangle());
        eventBus.on('action:createRectangle', () => this.canvasController.createRectangle());
        eventBus.on('action:createHexagon', () => this.canvasController.createHexagon());
        eventBus.on('action:createRandom', () => this.canvasController.createRandomPolygon());
        
        // Color changes
        eventBus.on('color:fillChanged', (color) => this.canvasController.setDefaultColor(color));
        eventBus.on('color:strokeChanged', (color) => this.canvasController.setDefaultStrokeColor(color));
        
        // File operations
        eventBus.on('action:save', () => this.handleSave());
        eventBus.on('action:load', () => this.handleLoad());
        eventBus.on('action:export', () => this.handleExport());
        eventBus.on('action:import', (file) => this.handleImport(file));
        
        // Other actions
        eventBus.on('action:deleteSelected', () => this.canvasController.deleteSelected());
        eventBus.on('action:clearAll', () => this.canvasController.clearAll());
        
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
            } catch (error) {
                this.showNotification('Error loading polygons: ' + error.message, 'error');
            }
        } else {
            this.showNotification(result.error || 'No saved polygons found!', 'error');
        }
    }

    handleExport() {
        const data = this.canvasController.exportData();
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
                } else {
                    this.showNotification('Invalid file format: ' + validation.error, 'error');
                }
            }
        } catch (error) {
            this.showNotification('Error importing file: ' + error.message, 'error');
        }
    }

    showNotification(message, type = 'info') {
        // Only show error messages
        if (type === 'error') {
            alert(message);
        }
        console.log(`[${type.toUpperCase()}] ${message}`);
    }

    resizeCanvas() {
        const canvasComponent = document.querySelector('polygon-canvas');
        if (!canvasComponent) return;
        
        const canvas = canvasComponent.getCanvas();
        const container = canvasComponent.shadowRoot.querySelector('.canvas-container');
        
        if (!canvas || !container) return;
        
        const width = Math.min(container.clientWidth - 40, 1200);
        const height = Math.min(600, window.innerHeight - 300);
        
        canvas.width = width;
        canvas.height = height;
        
        this.canvasController?.redraw();
    }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new App());
} else {
    new App();
}

export { App };
