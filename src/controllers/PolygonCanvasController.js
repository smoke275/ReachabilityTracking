/**
 * PolygonCanvasController
 * Manages polygon creation, interaction, and rendering on the canvas
 */
import { Polygon } from '../models/Polygon.js';
import { eventBus } from '../utils/EventBus.js';

export class PolygonCanvasController {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.polygons = [];
        this.selectedPolygon = null;
        this.isDragging = false;
        this.lastMousePos = { x: 0, y: 0 };
        this.defaultColor = '#6750A4';
        this.defaultStrokeColor = '#21005D';
        
        // Drawing mode properties
        this.drawingMode = false;
        this.drawingPoints = [];

        // Camera/View properties
        this.camera = {
            x: 0,
            y: 0,
            zoom: 1.0
        };
        this.isPanning = false;

        this.setupEventListeners();
    }

    setupEventListeners() {
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.canvas.addEventListener('mouseleave', (e) => this.handleMouseUp(e));
        this.canvas.addEventListener('contextmenu', (e) => this.handleRightClick(e));
        this.canvas.addEventListener('wheel', (e) => this.handleWheel(e));

        // Touch support
        this.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e));
        this.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e));
        this.canvas.addEventListener('touchend', (e) => this.handleTouchEnd(e));

        // Listen for zoom events from UI
        eventBus.on('canvas:zoom', (zoom) => {
            this.camera.zoom = zoom;
            this.redraw();
        });
    }

    handleWheel(e) {
        e.preventDefault();
        
        // Zoom with mouse wheel
        const zoomSpeed = 0.1;
        const delta = e.deltaY > 0 ? -zoomSpeed : zoomSpeed;
        
        this.camera.zoom = Math.max(0.25, Math.min(2.0, this.camera.zoom + delta));
        
        // Update zoom slider in UI
        eventBus.emit('camera:zoomChanged', this.camera.zoom);
        
        this.redraw();
    }

    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Convert screen coordinates to world coordinates
        return this.screenToWorld(x, y);
    }

    getTouchPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.touches[0].clientX - rect.left;
        const y = e.touches[0].clientY - rect.top;
        
        // Convert screen coordinates to world coordinates
        return this.screenToWorld(x, y);
    }

    screenToWorld(screenX, screenY) {
        return {
            x: (screenX - this.canvas.width / 2) / this.camera.zoom - this.camera.x + this.canvas.width / 2,
            y: (screenY - this.canvas.height / 2) / this.camera.zoom - this.camera.y + this.canvas.height / 2
        };
    }

    worldToScreen(worldX, worldY) {
        return {
            x: (worldX - this.canvas.width / 2 + this.camera.x) * this.camera.zoom + this.canvas.width / 2,
            y: (worldY - this.canvas.height / 2 + this.camera.y) * this.camera.zoom + this.canvas.height / 2
        };
    }

    handleMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        const worldPos = this.screenToWorld(screenX, screenY);
        
        this.lastMousePos = worldPos;
        this.lastScreenPos = { x: screenX, y: screenY };

        // Middle mouse button or Shift+click for panning
        if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
            this.isPanning = true;
            this.canvas.style.cursor = 'grabbing';
            return;
        }

        if (this.drawingMode) {
            this.addDrawingPoint(worldPos);
            return;
        }

        // Check if clicking on a polygon
        let clickedPolygon = false;
        for (let i = this.polygons.length - 1; i >= 0; i--) {
            if (this.polygons[i].containsPoint(worldPos.x, worldPos.y)) {
                this.selectPolygon(this.polygons[i]);
                this.isDragging = true;
                clickedPolygon = true;
                return;
            }
        }

        // If not clicking on a polygon, start panning
        if (!clickedPolygon) {
            this.isPanning = true;
            this.canvas.style.cursor = 'grab';
            this.deselectPolygon();
        }
    }

    handleRightClick(e) {
        e.preventDefault();
        
        if (this.drawingMode && this.drawingPoints.length > 0) {
            this.removeLastDrawingPoint();
        }
        
        return false;
    }

    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        const worldPos = this.screenToWorld(screenX, screenY);

        if (this.isPanning) {
            // Pan based on screen space movement for more intuitive control
            const dx = (screenX - this.lastScreenPos.x) / this.camera.zoom;
            const dy = (screenY - this.lastScreenPos.y) / this.camera.zoom;
            
            this.camera.x += dx;
            this.camera.y += dy;
            
            this.lastScreenPos = { x: screenX, y: screenY };
            this.redraw();
            return;
        }

        if (this.isDragging && this.selectedPolygon) {
            const dx = worldPos.x - this.lastMousePos.x;
            const dy = worldPos.y - this.lastMousePos.y;
            
            this.selectedPolygon.translate(dx, dy);
            this.lastMousePos = worldPos;
            this.redraw();
        }
    }

    handleMouseUp(e) {
        this.isDragging = false;
        this.isPanning = false;
        
        if (this.drawingMode) {
            this.canvas.style.cursor = 'crosshair';
        } else {
            this.canvas.style.cursor = 'default';
        }
    }

    handleTouchStart(e) {
        e.preventDefault();
        const pos = this.getTouchPos(e);
        this.lastMousePos = pos;

        for (let i = this.polygons.length - 1; i >= 0; i--) {
            if (this.polygons[i].containsPoint(pos.x, pos.y)) {
                this.selectPolygon(this.polygons[i]);
                this.isDragging = true;
                return;
            }
        }

        this.deselectPolygon();
    }

    handleTouchMove(e) {
        e.preventDefault();
        if (this.isDragging && this.selectedPolygon) {
            const pos = this.getTouchPos(e);
            const dx = pos.x - this.lastMousePos.x;
            const dy = pos.y - this.lastMousePos.y;
            
            this.selectedPolygon.translate(dx, dy);
            this.lastMousePos = pos;
            this.redraw();
        }
    }

    handleTouchEnd(e) {
        e.preventDefault();
        this.isDragging = false;
    }

    selectPolygon(polygon) {
        if (this.selectedPolygon) {
            this.selectedPolygon.selected = false;
        }
        this.selectedPolygon = polygon;
        polygon.selected = true;
        this.redraw();
        eventBus.emit('polygon:selected', polygon);
    }

    deselectPolygon() {
        if (this.selectedPolygon) {
            this.selectedPolygon.selected = false;
            this.selectedPolygon = null;
            this.redraw();
            eventBus.emit('polygon:deselected');
        }
    }

    addPolygon(polygon) {
        this.polygons.push(polygon);
        this.redraw();
        eventBus.emit('polygon:added', polygon);
    }

    createDefaultPolygon() {
        const vertices = this.generateCenteredPolygonVertices(3, 80);
        this.addPolygon(new Polygon(vertices, this.defaultColor, this.defaultStrokeColor));
    }

    createRectangle() {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        const width = 120;
        const height = 80;

        const vertices = [
            { x: centerX - width/2, y: centerY - height/2 },
            { x: centerX + width/2, y: centerY - height/2 },
            { x: centerX + width/2, y: centerY + height/2 },
            { x: centerX - width/2, y: centerY + height/2 }
        ];

        this.addPolygon(new Polygon(vertices, this.defaultColor, this.defaultStrokeColor));
    }

    createTriangle() {
        const vertices = this.generateCenteredPolygonVertices(3, 80);
        this.addPolygon(new Polygon(vertices, this.defaultColor, this.defaultStrokeColor));
    }

    createHexagon() {
        const vertices = this.generateCenteredPolygonVertices(6, 70);
        this.addPolygon(new Polygon(vertices, this.defaultColor, this.defaultStrokeColor));
    }

    createRandomPolygon() {
        const centerX = Math.random() * (this.canvas.width - 200) + 100;
        const centerY = Math.random() * (this.canvas.height - 200) + 100;
        const sides = Math.floor(Math.random() * 5) + 3;
        const radius = Math.random() * 60 + 40;

        const vertices = [];
        for (let i = 0; i < sides; i++) {
            const angle = (i / sides) * Math.PI * 2;
            const r = radius + (Math.random() * 30 - 15);
            vertices.push({
                x: centerX + Math.cos(angle) * r,
                y: centerY + Math.sin(angle) * r
            });
        }

        const colors = ['#6750A4', '#1976D2', '#388E3C', '#F57C00', '#C2185B', '#00796B'];
        const strokeColors = ['#21005D', '#0D47A1', '#1B5E20', '#E65100', '#880E4F', '#004D40'];
        const colorIndex = Math.floor(Math.random() * colors.length);

        this.addPolygon(new Polygon(vertices, colors[colorIndex], strokeColors[colorIndex]));
    }

    generateCenteredPolygonVertices(sides, radius) {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        const vertices = [];

        for (let i = 0; i < sides; i++) {
            const angle = (i / sides) * Math.PI * 2 - Math.PI / 2;
            vertices.push({
                x: centerX + Math.cos(angle) * radius,
                y: centerY + Math.sin(angle) * radius
            });
        }

        return vertices;
    }

    deleteSelected() {
        if (this.selectedPolygon) {
            const index = this.polygons.indexOf(this.selectedPolygon);
            if (index > -1) {
                this.polygons.splice(index, 1);
            }
            this.selectedPolygon = null;
            this.redraw();
            eventBus.emit('polygon:deleted');
        }
    }

    clearAll() {
        this.polygons = [];
        this.selectedPolygon = null;
        this.redraw();
        eventBus.emit('polygons:cleared');
    }

    setDefaultColor(color) {
        this.defaultColor = color;
    }

    setDefaultStrokeColor(color) {
        this.defaultStrokeColor = color;
    }

    exportData() {
        return {
            version: '1.0',
            polygons: this.polygons.map(p => p.toJSON()),
            camera: {
                x: this.camera.x,
                y: this.camera.y,
                zoom: this.camera.zoom
            }
        };
    }

    importData(data) {
        if (!data || !data.polygons) {
            throw new Error('Invalid data format');
        }

        this.clearAll();
        data.polygons.forEach(polyData => {
            const polygon = Polygon.fromJSON(polyData);
            this.polygons.push(polygon);
        });
        
        // Restore camera settings if they exist
        if (data.camera) {
            this.camera.x = data.camera.x || 0;
            this.camera.y = data.camera.y || 0;
            this.camera.zoom = data.camera.zoom || 1.0;
            
            // Update UI zoom slider
            eventBus.emit('camera:zoomChanged', this.camera.zoom);
        }
        
        this.redraw();
        eventBus.emit('polygons:imported', { count: this.polygons.length });
    }

    getPolygonCount() {
        return this.polygons.length;
    }

    getTotalVertices() {
        return this.polygons.reduce((sum, p) => sum + p.vertices.length, 0);
    }

    getSelectedPolygon() {
        return this.selectedPolygon;
    }

    redraw() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Save context state
        this.ctx.save();
        
        // Apply camera transformation
        this.ctx.translate(this.canvas.width / 2, this.canvas.height / 2);
        this.ctx.scale(this.camera.zoom, this.camera.zoom);
        this.ctx.translate(-this.canvas.width / 2 + this.camera.x, -this.canvas.height / 2 + this.camera.y);
        
        // Draw all polygons
        this.polygons.forEach(polygon => {
            polygon.draw(this.ctx);
        });

        if (this.drawingMode && this.drawingPoints.length > 0) {
            this.drawDrawingPoints();
        }
        
        // Restore context state
        this.ctx.restore();
    }

    // Drawing mode methods
    startDrawingMode() {
        this.drawingMode = true;
        this.drawingPoints = [];
        this.deselectPolygon();
        this.redraw();
        eventBus.emit('drawing:started');
    }

    isDrawingMode() {
        return this.drawingMode;
    }

    getDrawingPointCount() {
        return this.drawingPoints.length;
    }

    addDrawingPoint(point) {
        this.drawingPoints.push({ x: point.x, y: point.y });
        this.redraw();
        eventBus.emit('drawing:pointAdded', { count: this.drawingPoints.length });
    }

    removeLastDrawingPoint() {
        if (this.drawingPoints.length > 0) {
            this.drawingPoints.pop();
            this.redraw();
            eventBus.emit('drawing:pointRemoved', { count: this.drawingPoints.length });
        }
    }

    drawDrawingPoints() {
        if (this.drawingPoints.length === 0) return;

        const ctx = this.ctx;

        if (this.drawingPoints.length > 1) {
            ctx.beginPath();
            ctx.moveTo(this.drawingPoints[0].x, this.drawingPoints[0].y);
            
            for (let i = 1; i < this.drawingPoints.length; i++) {
                ctx.lineTo(this.drawingPoints[i].x, this.drawingPoints[i].y);
            }
            
            if (this.drawingPoints.length >= 3) {
                ctx.strokeStyle = 'rgba(103, 80, 164, 0.5)';
                ctx.setLineDash([5, 5]);
                ctx.lineTo(this.drawingPoints[0].x, this.drawingPoints[0].y);
            } else {
                ctx.strokeStyle = this.defaultStrokeColor;
                ctx.setLineDash([]);
            }
            
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.setLineDash([]);
        }

        this.drawingPoints.forEach((point, index) => {
            ctx.beginPath();
            ctx.arc(point.x, point.y, 6, 0, Math.PI * 2);
            ctx.fillStyle = index === 0 ? '#4CAF50' : '#6750A4';
            ctx.fill();
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 2;
            ctx.stroke();

            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 10px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText((index + 1).toString(), point.x, point.y);
        });
    }

    completePolygon() {
        if (!this.drawingMode || this.drawingPoints.length < 3) {
            return;
        }

        const polygon = new Polygon(
            [...this.drawingPoints],
            this.defaultColor,
            this.defaultStrokeColor
        );
        
        this.polygons.push(polygon);
        this.drawingMode = false;
        this.drawingPoints = [];
        this.redraw();
        eventBus.emit('drawing:completed', polygon);
    }

    cancelDrawing() {
        this.drawingMode = false;
        this.drawingPoints = [];;
        this.redraw();
        eventBus.emit('drawing:cancelled');
    }
}
