/**
 * Polygon class to represent individual polygons
 */
export class Polygon {
    constructor(vertices, color = '#6750A4', strokeColor = '#21005D') {
        this.vertices = vertices; // Array of {x, y} points
        this.color = color;
        this.strokeColor = strokeColor;
        this.fillColor = this.hexToRgba(color, 0.3);
        this.selected = false;
        this.dragging = false;
        this.dragOffset = { x: 0, y: 0 };
    }

    hexToRgba(hex, alpha) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    draw(ctx) {
        if (this.vertices.length < 3) return;

        ctx.beginPath();
        ctx.moveTo(this.vertices[0].x, this.vertices[0].y);
        
        for (let i = 1; i < this.vertices.length; i++) {
            ctx.lineTo(this.vertices[i].x, this.vertices[i].y);
        }
        
        ctx.closePath();

        // Fill
        ctx.fillStyle = this.fillColor;
        ctx.fill();

        // Stroke
        ctx.strokeStyle = this.selected ? '#B3261E' : this.strokeColor;
        ctx.lineWidth = this.selected ? 3 : 2;
        ctx.stroke();

        // Draw vertices if selected
        if (this.selected) {
            this.vertices.forEach(vertex => {
                ctx.beginPath();
                ctx.arc(vertex.x, vertex.y, 5, 0, Math.PI * 2);
                ctx.fillStyle = '#B3261E';
                ctx.fill();
                ctx.strokeStyle = '#FFFFFF';
                ctx.lineWidth = 2;
                ctx.stroke();
            });
        }
    }

    containsPoint(x, y) {
        // Ray casting algorithm for point in polygon
        let inside = false;
        for (let i = 0, j = this.vertices.length - 1; i < this.vertices.length; j = i++) {
            const xi = this.vertices[i].x;
            const yi = this.vertices[i].y;
            const xj = this.vertices[j].x;
            const yj = this.vertices[j].y;

            const intersect = ((yi > y) !== (yj > y)) &&
                            (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    }

    translate(dx, dy) {
        this.vertices = this.vertices.map(v => ({
            x: v.x + dx,
            y: v.y + dy
        }));
    }

    getBounds() {
        const xs = this.vertices.map(v => v.x);
        const ys = this.vertices.map(v => v.y);
        return {
            minX: Math.min(...xs),
            maxX: Math.max(...xs),
            minY: Math.min(...ys),
            maxY: Math.max(...ys)
        };
    }
}

/**
 * PolygonCanvas class to manage the canvas and polygons
 */
export class PolygonCanvas {
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

        this.setupEventListeners();
    }

    setupEventListeners() {
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.canvas.addEventListener('mouseleave', (e) => this.handleMouseUp(e));
        this.canvas.addEventListener('contextmenu', (e) => this.handleRightClick(e));

        // Touch support
        this.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e));
        this.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e));
        this.canvas.addEventListener('touchend', (e) => this.handleTouchEnd(e));
    }

    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }

    getTouchPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: e.touches[0].clientX - rect.left,
            y: e.touches[0].clientY - rect.top
        };
    }

    handleMouseDown(e) {
        const pos = this.getMousePos(e);
        this.lastMousePos = pos;

        // If in drawing mode, add a point
        if (this.drawingMode) {
            this.addDrawingPoint(pos);
            return;
        }

        // Check if clicking on existing polygon
        for (let i = this.polygons.length - 1; i >= 0; i--) {
            if (this.polygons[i].containsPoint(pos.x, pos.y)) {
                this.selectPolygon(this.polygons[i]);
                this.isDragging = true;
                return;
            }
        }

        // Deselect if clicking on empty space
        this.deselectPolygon();
    }

    handleRightClick(e) {
        e.preventDefault();
        
        // If in drawing mode, remove last point
        if (this.drawingMode && this.drawingPoints.length > 0) {
            this.removeLastDrawingPoint();
        }
        
        return false;
    }

    handleMouseMove(e) {
        if (this.isDragging && this.selectedPolygon) {
            const pos = this.getMousePos(e);
            const dx = pos.x - this.lastMousePos.x;
            const dy = pos.y - this.lastMousePos.y;
            
            this.selectedPolygon.translate(dx, dy);
            this.lastMousePos = pos;
            this.redraw();
        }
    }

    handleMouseUp(e) {
        this.isDragging = false;
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
        this.canvas.dispatchEvent(new CustomEvent('polygonSelected', { detail: polygon }));
    }

    deselectPolygon() {
        if (this.selectedPolygon) {
            this.selectedPolygon.selected = false;
            this.selectedPolygon = null;
            this.redraw();
            this.canvas.dispatchEvent(new CustomEvent('polygonDeselected'));
        }
    }

    addPolygon(polygon) {
        this.polygons.push(polygon);
        this.redraw();
        this.canvas.dispatchEvent(new CustomEvent('polygonAdded', { detail: polygon }));
    }

    createDefaultPolygon() {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        const size = 80;

        const vertices = [
            { x: centerX, y: centerY - size },
            { x: centerX + size, y: centerY + size },
            { x: centerX - size, y: centerY + size }
        ];

        const polygon = new Polygon(vertices, this.defaultColor, this.defaultStrokeColor);
        this.addPolygon(polygon);
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

        const polygon = new Polygon(vertices, this.defaultColor, this.defaultStrokeColor);
        this.addPolygon(polygon);
    }

    createTriangle() {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        const size = 80;

        const vertices = [
            { x: centerX, y: centerY - size },
            { x: centerX + size, y: centerY + size },
            { x: centerX - size, y: centerY + size }
        ];

        const polygon = new Polygon(vertices, this.defaultColor, this.defaultStrokeColor);
        this.addPolygon(polygon);
    }

    createHexagon() {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        const radius = 70;
        const sides = 6;

        const vertices = [];
        for (let i = 0; i < sides; i++) {
            const angle = (i / sides) * Math.PI * 2 - Math.PI / 2;
            vertices.push({
                x: centerX + Math.cos(angle) * radius,
                y: centerY + Math.sin(angle) * radius
            });
        }

        const polygon = new Polygon(vertices, this.defaultColor, this.defaultStrokeColor);
        this.addPolygon(polygon);
    }

    createRandomPolygon() {
        const centerX = Math.random() * (this.canvas.width - 200) + 100;
        const centerY = Math.random() * (this.canvas.height - 200) + 100;
        const sides = Math.floor(Math.random() * 5) + 3; // 3 to 7 sides
        const radius = Math.random() * 60 + 40;

        const vertices = [];
        for (let i = 0; i < sides; i++) {
            const angle = (i / sides) * Math.PI * 2;
            const r = radius + (Math.random() * 30 - 15); // Add some variation
            vertices.push({
                x: centerX + Math.cos(angle) * r,
                y: centerY + Math.sin(angle) * r
            });
        }

        // Random color
        const colors = ['#6750A4', '#1976D2', '#388E3C', '#F57C00', '#C2185B', '#00796B'];
        const color = colors[Math.floor(Math.random() * colors.length)];
        const strokeColors = ['#21005D', '#0D47A1', '#1B5E20', '#E65100', '#880E4F', '#004D40'];
        const strokeColor = strokeColors[Math.floor(Math.random() * strokeColors.length)];

        const polygon = new Polygon(vertices, color, strokeColor);
        this.addPolygon(polygon);
    }

    deleteSelected() {
        if (this.selectedPolygon) {
            const index = this.polygons.indexOf(this.selectedPolygon);
            if (index > -1) {
                this.polygons.splice(index, 1);
            }
            this.selectedPolygon = null;
            this.redraw();
        }
    }

    clearAll() {
        this.polygons = [];
        this.selectedPolygon = null;
        this.redraw();
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
            polygons: this.polygons.map(p => ({
                vertices: p.vertices,
                color: p.color,
                strokeColor: p.strokeColor
            }))
        };
    }

    importData(data) {
        if (!data || !data.polygons) {
            throw new Error('Invalid data format');
        }

        this.clearAll();
        data.polygons.forEach(polyData => {
            const polygon = new Polygon(
                polyData.vertices,
                polyData.color || this.defaultColor,
                polyData.strokeColor || this.defaultStrokeColor
            );
            this.polygons.push(polygon);
        });
        this.redraw();
    }

    getPolygonCount() {
        return this.polygons.length;
    }

    getSelectedPolygon() {
        return this.selectedPolygon;
    }

    redraw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.polygons.forEach(polygon => {
            polygon.draw(this.ctx);
        });

        // Draw current drawing points
        if (this.drawingMode && this.drawingPoints.length > 0) {
            this.drawDrawingPoints();
        }
    }

    // Drawing mode methods
    startDrawingMode() {
        this.drawingMode = true;
        this.drawingPoints = [];
        this.deselectPolygon();
        this.redraw();
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
        this.canvas.dispatchEvent(new CustomEvent('drawingPointAdded'));
    }

    removeLastDrawingPoint() {
        if (this.drawingPoints.length > 0) {
            this.drawingPoints.pop();
            this.redraw();
            this.canvas.dispatchEvent(new CustomEvent('drawingPointRemoved'));
        }
    }

    drawDrawingPoints() {
        if (this.drawingPoints.length === 0) return;

        const ctx = this.ctx;

        // Draw lines between points
        if (this.drawingPoints.length > 1) {
            ctx.beginPath();
            ctx.moveTo(this.drawingPoints[0].x, this.drawingPoints[0].y);
            
            for (let i = 1; i < this.drawingPoints.length; i++) {
                ctx.lineTo(this.drawingPoints[i].x, this.drawingPoints[i].y);
            }
            
            // Draw preview line to close polygon if we have 3+ points
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

        // Draw points
        this.drawingPoints.forEach((point, index) => {
            ctx.beginPath();
            ctx.arc(point.x, point.y, 6, 0, Math.PI * 2);
            ctx.fillStyle = index === 0 ? '#4CAF50' : '#6750A4'; // First point green
            ctx.fill();
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Draw point number
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
        this.canvas.dispatchEvent(new CustomEvent('polygonAdded', { detail: polygon }));
    }

    cancelDrawing() {
        this.drawingMode = false;
        this.drawingPoints = [];
        this.redraw();
    }
}
