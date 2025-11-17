// Import Material Web Components
import '@material/web/button/filled-button.js';
import '@material/web/button/filled-tonal-button.js';
import '@material/web/button/outlined-button.js';
import '@material/web/list/list.js';
import '@material/web/list/list-item.js';
import '@material/web/icon/icon.js';

import { PolygonCanvas } from './polygon-canvas.js';

// Initialize the application
class App {
    constructor() {
        this.canvas = document.getElementById('polygonCanvas');
        this.polygonCanvas = new PolygonCanvas(this.canvas);
        
        this.setupEventListeners();
        this.updateUI();
        
        // Resize canvas to fit container
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    setupEventListeners() {
        // Start drawing mode (point by point)
        document.getElementById('startDrawing')?.addEventListener('click', () => {
            this.polygonCanvas.startDrawingMode();
            this.updateDrawingUI();
        });

        // Complete polygon
        document.getElementById('completePolygon')?.addEventListener('click', () => {
            this.polygonCanvas.completePolygon();
            this.updateDrawingUI();
            this.updateUI();
        });

        // Cancel drawing
        document.getElementById('cancelDrawing')?.addEventListener('click', () => {
            this.polygonCanvas.cancelDrawing();
            this.updateDrawingUI();
        });

        // Draw polygon button (creates preset triangle)
        document.getElementById('drawPolygon')?.addEventListener('click', () => {
            this.polygonCanvas.createDefaultPolygon();
            this.updateUI();
        });

        // Shape buttons
        document.getElementById('addRectangle')?.addEventListener('click', () => {
            this.polygonCanvas.createRectangle();
            this.updateUI();
        });

        document.getElementById('addTriangle')?.addEventListener('click', () => {
            this.polygonCanvas.createTriangle();
            this.updateUI();
        });

        document.getElementById('addHexagon')?.addEventListener('click', () => {
            this.polygonCanvas.createHexagon();
            this.updateUI();
        });

        // Random polygon button
        document.getElementById('randomPolygon')?.addEventListener('click', () => {
            this.polygonCanvas.createRandomPolygon();
            this.updateUI();
        });

        // Delete selected polygon
        document.getElementById('deleteSelected')?.addEventListener('click', () => {
            this.polygonCanvas.deleteSelected();
            this.updateUI();
        });

        // Clear canvas button
        document.getElementById('clearCanvas')?.addEventListener('click', () => {
            if (confirm('Are you sure you want to clear all polygons?')) {
                this.polygonCanvas.clearAll();
                this.updateUI();
            }
        });

        // Color pickers
        document.getElementById('polygonColor')?.addEventListener('change', (e) => {
            this.polygonCanvas.setDefaultColor(e.target.value);
        });

        document.getElementById('strokeColor')?.addEventListener('change', (e) => {
            this.polygonCanvas.setDefaultStrokeColor(e.target.value);
        });

        // Save polygons
        document.getElementById('savePolygons')?.addEventListener('click', () => {
            this.saveToLocalStorage();
        });

        // Load polygons
        document.getElementById('loadPolygons')?.addEventListener('click', () => {
            this.loadFromLocalStorage();
        });

        // Export to JSON file
        document.getElementById('exportJSON')?.addEventListener('click', () => {
            this.exportToJSON();
        });

        // Import from JSON file
        const fileInput = document.getElementById('fileInput');
        document.getElementById('loadPolygons')?.addEventListener('click', () => {
            fileInput.click();
        });

        fileInput?.addEventListener('change', (e) => {
            this.importFromJSON(e.target.files[0]);
        });

        // Canvas events for updating UI
        this.canvas.addEventListener('polygonAdded', () => this.updateUI());
        this.canvas.addEventListener('polygonSelected', () => this.updateUI());
        this.canvas.addEventListener('polygonDeselected', () => this.updateUI());
        this.canvas.addEventListener('drawingPointAdded', () => this.updateDrawingUI());
        this.canvas.addEventListener('drawingPointRemoved', () => this.updateDrawingUI());
    }

    updateDrawingUI() {
        const isDrawing = this.polygonCanvas.isDrawingMode();
        const pointCount = this.polygonCanvas.getDrawingPointCount();

        // Update button states
        const startButton = document.getElementById('startDrawing');
        const completeButton = document.getElementById('completePolygon');
        const cancelButton = document.getElementById('cancelDrawing');

        if (startButton) startButton.disabled = isDrawing;
        if (completeButton) completeButton.disabled = !isDrawing || pointCount < 3;
        if (cancelButton) cancelButton.disabled = !isDrawing;

        // Update canvas class
        if (isDrawing) {
            this.canvas.classList.add('drawing-mode');
        } else {
            this.canvas.classList.remove('drawing-mode');
        }

        // Update info
        const selectedElement = document.getElementById('selectedInfo');
        if (selectedElement && isDrawing) {
            selectedElement.textContent = `Drawing: ${pointCount} point${pointCount !== 1 ? 's' : ''} (${pointCount >= 3 ? 'Ready' : 'Need ' + (3 - pointCount) + ' more'})`;
        }
    }

    updateUI() {
        const polygonCount = this.polygonCanvas.getPolygonCount();
        const selectedPolygon = this.polygonCanvas.getSelectedPolygon();

        // Update polygon count in toolbar
        const countElement = document.getElementById('polygonCount');
        if (countElement) {
            countElement.textContent = `${polygonCount} polygon${polygonCount !== 1 ? 's' : ''}`;
        }

        // Update stats
        const totalPolygonsElement = document.getElementById('totalPolygons');
        if (totalPolygonsElement) {
            totalPolygonsElement.textContent = polygonCount;
        }

        // Calculate total vertices
        let totalVertices = 0;
        for (let i = 0; i < this.polygonCanvas.polygons.length; i++) {
            totalVertices += this.polygonCanvas.polygons[i].vertices.length;
        }
        const totalVerticesElement = document.getElementById('totalVertices');
        if (totalVerticesElement) {
            totalVerticesElement.textContent = totalVertices;
        }

        // Update selected info
        const selectedElement = document.getElementById('selectedInfo');
        if (selectedElement) {
            if (selectedPolygon) {
                const vertexCount = selectedPolygon.vertices.length;
                selectedElement.textContent = `Selected: ${vertexCount} vertices`;
            } else {
                selectedElement.textContent = 'None selected';
            }
        }
    }

    saveToLocalStorage() {
        const data = this.polygonCanvas.exportData();
        localStorage.setItem('polygonData', JSON.stringify(data));
        alert('Polygons saved successfully!');
    }

    loadFromLocalStorage() {
        const data = localStorage.getItem('polygonData');
        if (data) {
            try {
                this.polygonCanvas.importData(JSON.parse(data));
                this.updateUI();
                alert('Polygons loaded successfully!');
            } catch (e) {
                alert('Error loading polygons: ' + e.message);
            }
        } else {
            alert('No saved polygons found!');
        }
    }

    exportToJSON() {
        const data = this.polygonCanvas.exportData();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `polygons-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    importFromJSON(file) {
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                this.polygonCanvas.importData(data);
                this.updateUI();
                alert('Polygons imported successfully!');
            } catch (err) {
                alert('Error importing file: ' + err.message);
            }
        };
        reader.readAsText(file);
    }

    resizeCanvas() {
        const container = document.querySelector('.canvas-container');
        const width = Math.min(container.clientWidth - 40, 1200);
        const height = Math.min(600, window.innerHeight - 300);
        
        this.canvas.width = width;
        this.canvas.height = height;
        
        this.polygonCanvas.redraw();
    }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new App());
} else {
    new App();
}
