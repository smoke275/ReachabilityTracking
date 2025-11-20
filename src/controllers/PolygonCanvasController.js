/**
 * PolygonCanvasController
 * Manages polygon creation, interaction, and rendering on the canvas
 */
import { Polygon } from '../models/Polygon.js';
import { eventBus } from '../utils/EventBus.js';
import { VisibilityService } from '../services/VisibilityService.js';

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

        // Medial axis skeleton
        this.medialAxisSkeleton = null;
        this.showSkeleton = true;
        this.showVoronoiOverlay = false; // hide unfiltered Voronoi by default
        this.showGeneratorSites = false; // hide generator sites (sample points)

        // Evader simulation state
        this.evaderState = null;

        // Intruder state
        this.intruderState = null;

        // Sensor model service reference
        this.sensorModelService = null;

        // Future set visualization
        this.futureSet = []; // Array of {x, y, score}
        this.futureSetGridPoints = [];
        this.showFutureSet = true;

        // RRT trees visualization
        this.rrtTrees = {
            pursuer: null,
            evader: null,
            showPursuer: true,
            showEvader: true
        };

        // Active tracking visualization
        this.activeTrackingVisualization = {
            node: null,
            type: null, // 'pursuer' or 'evader'
            strategy: null
        };

        this.activeTrackingData = {
            pursuerNodes: [],
            evaderNodes: [],
            Ne: [],
            Np: [],
            highlightedNode: null, // { type: 'pursuer'/'evader', index: number }
        };

        // Real-time tracking visualization
        this.realTimeTrackingData = {
            pursuerWinningNode: null,
            evaderWinningNode: null,
            strategy: null
        };

        // Visibility analysis state
        this.visibility = {
            start: null, // {x,y}
            end: null,   // {x,y}
            startPoly: [],
            endPoly: [],
            activeDrag: null, // 'start' | 'end' | null
            live: true,
            showDifference: false,
            differencePoly: [], // Array of polygons representing the difference
            rayFilter: false // Whether to apply ray-based filtering
        };
        // Service instance
        this.visibilityService = new VisibilityService();
        
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
            eventBus.emit('camera:zoomChanged', this.camera.zoom);
        });

        // Listen for visibility control events
        eventBus.on('visibility:setPlacementMode', (mode) => {
            this.visibility.activeDrag = mode; // begin placing on next click
        });
        eventBus.on('visibility:clear', () => {
            this.visibility.start = null;
            this.visibility.end = null;
            this.visibility.startPoly = [];
            this.visibility.endPoly = [];
            this.visibility.activeDrag = null;
            this.visibility.differencePoly = [];
            this.redraw();
        });
        eventBus.on('visibility:toggleLive', () => {
            this.visibility.live = !this.visibility.live;
        });
        eventBus.on('visibility:toggleDifference', (show) => {
            this.visibility.showDifference = show;
            if (show) {
                this.computeVisibilityDifference();
            }
            this.redraw();
        });
        eventBus.on('visibility:toggleRayFilter', (enable) => {
            this.visibility.rayFilter = enable;
            if (this.visibility.showDifference) {
                this.computeVisibilityDifference();
            }
            this.redraw();
        });
        // Recompute on camera changes if live and points exist
        eventBus.on('camera:panEnded', () => this.recomputeVisibilityIfNeeded());
        eventBus.on('camera:zoomChanged', () => this.recomputeVisibilityIfNeeded());

        // Listen for RRT tree updates
        eventBus.on('rrt:treesBuilt', (data) => {
            this.rrtTrees.pursuer = data.pursuerTree;
            this.rrtTrees.evader = data.evaderTree;
            this.redraw();
        });
        eventBus.on('rrt:reset', () => {
            this.rrtTrees.pursuer = null;
            this.rrtTrees.evader = null;
            this.redraw();
        });
        eventBus.on('rrt:togglePursuerTree', (show) => {
            this.rrtTrees.showPursuer = show;
            this.redraw();
        });
        eventBus.on('rrt:toggleEvaderTree', (show) => {
            this.rrtTrees.showEvader = show;
            this.redraw();
        });

        // Listen for agent position updates to redraw sensor visualization
        eventBus.on('intruder:positionUpdate', (state) => {
            this.intruderState = state;
            this.redraw();
        });

        eventBus.on('evader:positionUpdate', (data) => {
            if (data && data.position) {
                this.evaderState = data;
                this.redraw();
            }
        });

        // Listen for explicit redraw requests (e.g., from sensor model updates)
        eventBus.on('canvas:requestRedraw', () => {
            this.redraw();
        });

        // Listen for active tracking visualization events
        eventBus.on('activeTracking:visualizeNode', (data) => {
            this.activeTrackingVisualization = data;
            this.redraw();
        });

        eventBus.on('activeTracking:clearVisualizations', () => {
            this.activeTrackingVisualization = { node: null, type: null, strategy: null };
            this.activeTrackingData.highlightedNode = null; // Also clear manual highlights
            this.redraw();
        });

        eventBus.on('activeTracking:visibilityComputed', (data) => {
            this.activeTrackingData.pursuerNodes = data.pursuerNodes || [];
            this.activeTrackingData.evaderNodes = data.evaderNodes || [];
            this.activeTrackingData.Ne = data.Ne || [];
            this.activeTrackingData.Np = data.Np || [];
        });

        eventBus.on('activeTracking:highlightNode', (data) => {
            this.activeTrackingData.highlightedNode = {
                type: data.type,
                index: data.index
            };
            this.redraw();
        });

        // Listen for real-time tracking updates
        eventBus.on('realTimeTracking:update', (data) => {
            // Update RRT trees
            this.rrtTrees.pursuer = data.pursuerTree;
            this.rrtTrees.evader = data.evaderTree;
            this.rrtTrees.showPursuer = true;
            this.rrtTrees.showEvader = true;
            
            // Store winning node info for visualization
            this.realTimeTrackingData = {
                pursuerWinningNode: data.pursuerWinningNode,
                evaderWinningNode: data.evaderWinningNode,
                strategy: data.strategy
            };
            
            this.redraw();
        });

        eventBus.on('realTimeTracking:stopped', () => {
            // Clear real-time tracking visualization
            this.realTimeTrackingData = {
                pursuerWinningNode: null,
                evaderWinningNode: null,
                strategy: null
            };
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

    /**
     * Get current visible world-space bounds based on camera and canvas size
     * @returns {{minX:number, minY:number, maxX:number, maxY:number, width:number, height:number}}
     */
    getWorldViewBounds() {
        const tl = this.screenToWorld(0, 0);
        const br = this.screenToWorld(this.canvas.width, this.canvas.height);
        const minX = Math.min(tl.x, br.x);
        const minY = Math.min(tl.y, br.y);
        const maxX = Math.max(tl.x, br.x);
        const maxY = Math.max(tl.y, br.y);
        return {
            minX,
            minY,
            maxX,
            maxY,
            width: maxX - minX,
            height: maxY - minY
        };
    }

    handleMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        const worldPos = this.screenToWorld(screenX, screenY);
        
        this.lastMousePos = worldPos;
        this.lastScreenPos = { x: screenX, y: screenY };

        // Check for click on RRT nodes for active tracking visualization
        if (e.button === 0 && !e.shiftKey && !e.ctrlKey) {
            if (this.handleClickOnNode(worldPos)) {
                return; // Handled by node click
            }
        }

        // If visibility placement mode is active or clicking near existing point, handle that first
        const v = this.visibility;
        const hit = (p) => p && ((p.x - worldPos.x)**2 + (p.y - worldPos.y)**2) <= 10*10;
        if (e.button === 0) {
            if (hit(v.start)) {
                v.activeDrag = 'start';
                return;
            }
            if (hit(v.end)) {
                v.activeDrag = 'end';
                return;
            }
            if (v.activeDrag === 'start') {
                v.start = { x: worldPos.x, y: worldPos.y };
                this.computeVisibilityFor('start');
                // keep activeDrag to allow dragging on this gesture
                return;
            } else if (v.activeDrag === 'end') {
                v.end = { x: worldPos.x, y: worldPos.y };
                this.computeVisibilityFor('end');
                // keep activeDrag to allow dragging on this gesture
                return;
            }
        }

        // Ctrl+Click to place/move intruder
        if (e.button === 0 && e.ctrlKey) {
            eventBus.emit('canvas:placeIntruder', worldPos);
            return;
        }

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
            // Clear active tracking highlight if clicking on empty space
            if (this.activeTrackingData.highlightedNode) {
                this.activeTrackingData.highlightedNode = null;
                this.redraw();
            }
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

        // Drag visibility points
        if (this.visibility.activeDrag === 'start' && e.buttons & 1) {
            this.visibility.start = { x: worldPos.x, y: worldPos.y };
            this.computeVisibilityFor('start');
            return;
        }
        if (this.visibility.activeDrag === 'end' && e.buttons & 1) {
            this.visibility.end = { x: worldPos.x, y: worldPos.y };
            this.computeVisibilityFor('end');
            return;
        }

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
            this.recomputeVisibilityIfNeeded();
        }
    }

    handleMouseUp(e) {
        const wasPanning = this.isPanning;
        // Stop dragging visibility points
        if (this.visibility.activeDrag === 'start' || this.visibility.activeDrag === 'end') {
            this.visibility.activeDrag = null;
        }
        this.isDragging = false;
        this.isPanning = false;
        
        if (this.drawingMode) {
            this.canvas.style.cursor = 'crosshair';
        } else {
            this.canvas.style.cursor = 'default';
        }

        if (wasPanning) {
            eventBus.emit('camera:panEnded');
        }
    }

    handleClickOnNode(worldPos) {
        const { pursuerNodes, evaderNodes } = this.activeTrackingData;
        const clickRadius = 10 / this.camera.zoom; // Adjust click radius based on zoom

        // Check pursuer nodes
        for (let i = 0; i < pursuerNodes.length; i++) {
            const node = pursuerNodes[i];
            const dist = Math.hypot(node.state.x - worldPos.x, node.state.y - worldPos.y);
            if (dist < clickRadius) {
                this.activeTrackingData.highlightedNode = { type: 'pursuer', index: i };
                this.redraw();
                return true;
            }
        }

        // Check evader nodes
        for (let i = 0; i < evaderNodes.length; i++) {
            const node = evaderNodes[i];
            const dist = Math.hypot(node.state.x - worldPos.x, node.state.y - worldPos.y);
            if (dist < clickRadius) {
                this.activeTrackingData.highlightedNode = { type: 'evader', index: i };
                this.redraw();
                return true;
            }
        }

        return false;
    }

    // Helper to recompute both visibility polygons
    recomputeVisibilityIfNeeded() {
        if (!this.visibility.live) return;
        const bounds = this.getWorldViewBounds();
        const polygons = this.getPolygons();
        if (this.visibility.start) {
            this.visibility.startPoly = this.visibilityService.computeVisibility(this.visibility.start, polygons, bounds);
        }
        if (this.visibility.end) {
            this.visibility.endPoly = this.visibilityService.computeVisibility(this.visibility.end, polygons, bounds);
        }
        if (this.visibility.start || this.visibility.end) this.redraw();
    }

    // Compute and redraw for a specific endpoint
    computeVisibilityFor(which) {
        const bounds = this.getWorldViewBounds();
        const polygons = this.getPolygons();
        if (which === 'start' && this.visibility.start) {
            this.visibility.startPoly = this.visibilityService.computeVisibility(this.visibility.start, polygons, bounds);
        }
        if (which === 'end' && this.visibility.end) {
            this.visibility.endPoly = this.visibilityService.computeVisibility(this.visibility.end, polygons, bounds);
        }
        // Recompute difference if enabled
        if (this.visibility.showDifference) {
            this.computeVisibilityDifference();
        }
        this.redraw();
    }

    /**
     * Compute the difference between end and start visibility polygons
     */
    computeVisibilityDifference() {
        if (this.visibility.startPoly.length > 2 && this.visibility.endPoly.length > 2) {
            let differencePoly = this.visibilityService.computeVisibilityDifference(
                this.visibility.startPoly,
                this.visibility.endPoly
            );
            
            // Apply ray filter if enabled and we have an end point
            if (this.visibility.rayFilter && this.visibility.end && differencePoly.length > 0) {
                differencePoly = this.visibilityService.filterDifferenceByRayCast(
                    differencePoly,
                    this.visibility.end
                );
            }
            
            this.visibility.differencePoly = differencePoly;
        } else {
            this.visibility.differencePoly = [];
        }
    }

    addPolygon(polygon) {
        this.polygons.push(polygon);
        this.redraw();
        eventBus.emit('polygon:added', polygon);
        this.recomputeVisibilityIfNeeded();
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
            this.recomputeVisibilityIfNeeded();
        }
    }

    clearAll() {
        this.polygons = [];
        this.selectedPolygon = null;
        this.redraw();
        eventBus.emit('polygons:cleared');
        this.recomputeVisibilityIfNeeded();
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
        this.recomputeVisibilityIfNeeded();
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

        // Draw medial axis skeleton if available
        if (this.medialAxisSkeleton && this.showSkeleton) {
            this.drawMedialAxisSkeleton();
        }

        // Draw future set if available
        if (this.futureSet.length > 0 && this.showFutureSet) {
            this.drawFutureSet();
        }

        // Draw evader if active
        if (this.evaderState) {
            this.drawEvader();
        }

        // Draw intruder if active
        if (this.intruderState && this.intruderState.position) {
            this.drawIntruder();
        }

        // Draw sensor visualization (ranges, FOV, LOS)
        this.drawSensorVisualization();

        if (this.drawingMode && this.drawingPoints.length > 0) {
            this.drawDrawingPoints();
        }
        
        // Draw visibility polygons underneath points but above obstacles fill
        this.drawVisibility();

        // Draw RRT trees if available
        if (this.rrtTrees.pursuer && this.rrtTrees.showPursuer) {
            this.drawRRTTree(this.rrtTrees.pursuer, '#2196F3', 0.6); // Blue for pursuer
        }
        if (this.rrtTrees.evader && this.rrtTrees.showEvader) {
            this.drawRRTTree(this.rrtTrees.evader, '#C2185B', 0.6); // Pink for evader
        }
        
        // Draw active tracking winning node
        if (this.activeTrackingVisualization.node) {
            this.drawWinningNode();
        }

        // Draw active tracking manual highlight
        if (this.activeTrackingData.highlightedNode) {
            this.drawActiveTrackingHighlight();
        }

        // Draw real-time tracking winning nodes
        if (this.realTimeTrackingData.pursuerWinningNode || this.realTimeTrackingData.evaderWinningNode) {
            this.drawRealTimeTrackingWinningNodes();
        }

        // Restore context state
        this.ctx.restore();

        // Draw highlighted node info on top of everything, in screen space
        if (this.activeTrackingData.highlightedNode) {
            this.drawHighlightedNodeInfo();
        }
    }

    drawActiveTrackingHighlight() {
        const { highlightedNode, pursuerNodes, evaderNodes, Ne, Np } = this.activeTrackingData;
        if (!highlightedNode) return;

        const ctx = this.ctx;
        ctx.save();
        ctx.lineWidth = 1.5;

        if (highlightedNode.type === 'pursuer') {
            const pursuerNode = pursuerNodes[highlightedNode.index];
            if (!pursuerNode) return;

            // Highlight the selected pursuer node
            this.drawHighlightCircle(pursuerNode.state.x, pursuerNode.state.y, '#2196F3');

            // Find visible evader nodes
            const nonVisibleIndices = new Set(Ne[highlightedNode.index]);
            for (let j = 0; j < evaderNodes.length; j++) {
                if (!nonVisibleIndices.has(j)) {
                    const evaderNode = evaderNodes[j];
                    // Draw line and highlight visible evader node
                    this.drawVisibilityLine(pursuerNode.state, evaderNode.state, '#81D4FA');
                    this.drawHighlightCircle(evaderNode.state.x, evaderNode.state.y, '#81D4FA', 4);
                }
            }
        } else { // evader
            const evaderNode = evaderNodes[highlightedNode.index];
            if (!evaderNode) return;

            // Highlight the selected evader node
            this.drawHighlightCircle(evaderNode.state.x, evaderNode.state.y, '#C2185B');

            // Find pursuer nodes that can see it
            const visiblePursuerIndices = Np[highlightedNode.index] || [];
            for (const i of visiblePursuerIndices) {
                const pursuerNode = pursuerNodes[i];
                // Draw line and highlight visible pursuer node
                this.drawVisibilityLine(evaderNode.state, pursuerNode.state, '#F48FB1');
                this.drawHighlightCircle(pursuerNode.state.x, pursuerNode.state.y, '#F48FB1', 4);
            }
        }

        ctx.restore();
    }

    drawHighlightCircle(x, y, color, radius = 8) {
        const ctx = this.ctx;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.fillStyle = color.replace(')', ', 0.3)');
        ctx.fill();
    }

    drawVisibilityLine(from, to, color) {
        const ctx = this.ctx;
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.strokeStyle = color;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    drawWinningNode() {
        const { node, type, strategy } = this.activeTrackingVisualization;
        if (!node || !node.state) return;

        const ctx = this.ctx;
        const { x, y } = node.state;

        const color = type === 'pursuer' ? '#2196F3' : '#C2185B';
        const label = `${strategy.toUpperCase()} WINNER`;

        ctx.save();

        // Pulsating outer circle
        const pulseRadius = 15 + Math.sin(performance.now() / 200) * 5;
        ctx.beginPath();
        ctx.arc(x, y, pulseRadius, 0, Math.PI * 2);
        ctx.fillStyle = color.replace(')', ', 0.3)'); // Make it transparent
        ctx.fill();

        // Solid inner circle
        ctx.beginPath();
        ctx.arc(x, y, 10, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Label
        this.drawPillLabel(label, x + 20, y, color);

        ctx.restore();
    }

    drawRealTimeTrackingWinningNodes() {
        const { pursuerWinningNode, evaderWinningNode, strategy } = this.realTimeTrackingData;
        const ctx = this.ctx;

        ctx.save();

        // Draw pursuer winning node
        if (pursuerWinningNode && pursuerWinningNode.state) {
            const { x, y } = pursuerWinningNode.state;
            const color = '#2196F3'; // Blue for pursuer

            // Pulsating outer circle
            const pulseRadius = 15 + Math.sin(performance.now() / 200) * 5;
            ctx.beginPath();
            ctx.arc(x, y, pulseRadius, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(33, 150, 243, 0.3)';
            ctx.fill();

            // Solid inner circle
            ctx.beginPath();
            ctx.arc(x, y, 10, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 3;
            ctx.stroke();

            // Label
            const label = strategy ? `${strategy.toUpperCase()} P` : 'PURSUER TARGET';
            this.drawPillLabel(label, x + 20, y, color);
        }

        // Draw evader winning node (if it's moving)
        if (evaderWinningNode && evaderWinningNode.state) {
            const { x, y } = evaderWinningNode.state;
            const color = '#C2185B'; // Pink for evader

            // Pulsating outer circle (offset phase for visual distinction)
            const pulseRadius = 15 + Math.sin(performance.now() / 200 + Math.PI) * 5;
            ctx.beginPath();
            ctx.arc(x, y, pulseRadius, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(194, 24, 91, 0.3)';
            ctx.fill();

            // Solid inner circle
            ctx.beginPath();
            ctx.arc(x, y, 10, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 3;
            ctx.stroke();

            // Label
            const label = 'EVADER TARGET';
            this.drawPillLabel(label, x + 20, y, color);
        }

        ctx.restore();
    }

    drawVisibility() {
        const ctx = this.ctx;
        const v = this.visibility;
        
        // If showing difference, draw that prominently
        if (v.showDifference && v.differencePoly && v.differencePoly.length > 0) {
            ctx.save();
            // Draw each polygon in the difference (can be multiple)
            for (const poly of v.differencePoly) {
                if (poly.length > 2) {
                    ctx.beginPath();
                    ctx.moveTo(poly[0].x, poly[0].y);
                    for (let i = 1; i < poly.length; i++) {
                        ctx.lineTo(poly[i].x, poly[i].y);
                    }
                    ctx.closePath();
                    // Orange/yellow color for difference - areas visible from end but not start
                    ctx.fillStyle = 'rgba(255, 152, 0, 0.4)';
                    ctx.strokeStyle = 'rgba(230, 126, 0, 0.9)';
                    ctx.lineWidth = 3;
                    ctx.fill();
                    ctx.stroke();
                }
            }
            ctx.restore();
            
            // Still draw the original polygons but more transparent
            // Start visibility polygon (green tint, faded)
            if (v.startPoly && v.startPoly.length > 2) {
                ctx.save();
                ctx.beginPath();
                ctx.moveTo(v.startPoly[0].x, v.startPoly[0].y);
                for (let i = 1; i < v.startPoly.length; i++) ctx.lineTo(v.startPoly[i].x, v.startPoly[i].y);
                ctx.closePath();
                ctx.fillStyle = 'rgba(76, 175, 80, 0.1)';
                ctx.strokeStyle = 'rgba(56, 142, 60, 0.4)';
                ctx.lineWidth = 1;
                ctx.fill();
                ctx.stroke();
                ctx.restore();
            }
            // End visibility polygon (blue tint, faded)
            if (v.endPoly && v.endPoly.length > 2) {
                ctx.save();
                ctx.beginPath();
                ctx.moveTo(v.endPoly[0].x, v.endPoly[0].y);
                for (let i = 1; i < v.endPoly.length; i++) ctx.lineTo(v.endPoly[i].x, v.endPoly[i].y);
                ctx.closePath();
                ctx.fillStyle = 'rgba(33, 150, 243, 0.1)';
                ctx.strokeStyle = 'rgba(25, 118, 210, 0.4)';
                ctx.lineWidth = 1;
                ctx.fill();
                ctx.stroke();
                ctx.restore();
            }
        } else {
            // Normal mode: show start and end visibility polygons
            // Start visibility polygon (green tint)
            if (v.startPoly && v.startPoly.length > 2) {
                ctx.save();
                ctx.beginPath();
                ctx.moveTo(v.startPoly[0].x, v.startPoly[0].y);
                for (let i = 1; i < v.startPoly.length; i++) ctx.lineTo(v.startPoly[i].x, v.startPoly[i].y);
                ctx.closePath();
                ctx.fillStyle = 'rgba(76, 175, 80, 0.25)';
                ctx.strokeStyle = 'rgba(56, 142, 60, 0.9)';
                ctx.lineWidth = 2;
                ctx.fill();
                ctx.stroke();
                ctx.restore();
            }
            // End visibility polygon (blue tint)
            if (v.endPoly && v.endPoly.length > 2) {
                ctx.save();
                ctx.beginPath();
                ctx.moveTo(v.endPoly[0].x, v.endPoly[0].y);
                for (let i = 1; i < v.endPoly.length; i++) ctx.lineTo(v.endPoly[i].x, v.endPoly[i].y);
                ctx.closePath();
                ctx.fillStyle = 'rgba(33, 150, 243, 0.25)';
                ctx.strokeStyle = 'rgba(25, 118, 210, 0.9)';
                ctx.lineWidth = 2;
                ctx.fill();
                ctx.stroke();
                ctx.restore();
            }
        }
        // Draw points on top
        if (v.start) this.drawHandle(v.start.x, v.start.y, '#4CAF50', 'Start');
        if (v.end) this.drawHandle(v.end.x, v.end.y, '#2196F3', 'End');
    }

    drawHandle(x, y, color, label) {
        const ctx = this.ctx;
        ctx.save();
        // Point marker (bigger with stronger outline)
        ctx.beginPath();
        ctx.arc(x, y, 10, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 3;
        ctx.stroke();

        // High-contrast pill label next to the point
        this.drawPillLabel(label, x + 16, y, color);
        ctx.restore();
    }

    // Draw a pill-shaped label left-anchored at (leftX, centerY)
    drawPillLabel(text, leftX, centerY, bgColor) {
        const ctx = this.ctx;
        ctx.save();
        ctx.font = 'bold 14px sans-serif';
        const paddingX = 8;
        const paddingY = 4;
        const radius = 10;
        const metrics = ctx.measureText(text);
        const textWidth = metrics.width;
        const textHeight = (metrics.actualBoundingBoxAscent || 10) + (metrics.actualBoundingBoxDescent || 4);
        const w = Math.ceil(textWidth + paddingX * 2);
        const h = Math.ceil(Math.max(18, textHeight + paddingY * 2));
        const x = leftX;
        const y = Math.round(centerY - h / 2);

        // Background pill
        ctx.beginPath();
        const r = Math.min(radius, h / 2);
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
        ctx.fillStyle = bgColor;
        ctx.shadowColor = 'rgba(0,0,0,0.45)';
        ctx.shadowBlur = 4;
        ctx.fill();

        // Text
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, x + paddingX, centerY);
        ctx.restore();
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

    // Medial axis skeleton methods
    setMedialAxisSkeleton(skeletonData) {
        this.medialAxisSkeleton = skeletonData;
        this.showSkeleton = true;
        this.redraw();
    }

    clearMedialAxisSkeleton() {
        this.medialAxisSkeleton = null;
        this.redraw();
    }

    toggleSkeletonVisibility() {
        this.showSkeleton = !this.showSkeleton;
        this.redraw();
    }

    drawMedialAxisSkeleton() {
        if (!this.medialAxisSkeleton) return;

        const ctx = this.ctx;

        console.log('Drawing skeleton:', {
            samplePoints: this.medialAxisSkeleton.samplePoints?.length,
            voronoiCells: this.medialAxisSkeleton.voronoi?.polygons?.features?.length,
            skeletonPoints: this.medialAxisSkeleton.points?.length,
            skeletonEdges: this.medialAxisSkeleton.edges?.length
        });

        // Precompute node degrees from edges for leaf highlighting
        const degree = new Map();
        const pKey = (p) => `${Math.round(p.x)}_${Math.round(p.y)}`;
        if (this.medialAxisSkeleton.edges) {
            this.medialAxisSkeleton.edges.forEach(e => {
                const ks = pKey(e.start);
                const ke = pKey(e.end);
                degree.set(ks, (degree.get(ks) || 0) + 1);
                degree.set(ke, (degree.get(ke) || 0) + 1);
            });
        }

        // Draw generator sites (original Voronoi sites) - disabled by default
        if (this.showGeneratorSites && this.medialAxisSkeleton.samplePoints) {
            ctx.fillStyle = 'rgba(0, 255, 0, 0.6)';
            ctx.strokeStyle = 'rgba(0, 100, 0, 0.8)';
            ctx.lineWidth = 1;
            this.medialAxisSkeleton.samplePoints.forEach(point => {
                ctx.beginPath();
                ctx.arc(point.x, point.y, 3, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            });
        }

        // Draw Voronoi diagram edges (optional overlay)
        if (this.showVoronoiOverlay && this.medialAxisSkeleton.voronoi && this.medialAxisSkeleton.voronoi.polygons) {
            ctx.strokeStyle = 'rgba(100, 100, 255, 0.4)';
            ctx.lineWidth = 1;
            ctx.setLineDash([2, 2]);
            this.medialAxisSkeleton.voronoi.polygons.features.forEach(feature => {
                if (feature.geometry && feature.geometry.coordinates) {
                    const coordinates = feature.geometry.coordinates[0];
                    ctx.beginPath();
                    coordinates.forEach((coord, index) => {
                        if (index === 0) ctx.moveTo(coord[0], coord[1]);
                        else ctx.lineTo(coord[0], coord[1]);
                    });
                    ctx.closePath();
                    ctx.stroke();
                }
            });
            ctx.setLineDash([]);
        }

        // Draw skeleton edges (filtered graph) - more prominent
        if (this.medialAxisSkeleton.edges) {
            ctx.save();
            ctx.strokeStyle = '#FF1744';
            ctx.lineWidth = 4;
            ctx.setLineDash([]);
            ctx.shadowColor = 'rgba(255, 23, 68, 0.5)';
            ctx.shadowBlur = 6;
            this.medialAxisSkeleton.edges.forEach(edge => {
                ctx.beginPath();
                ctx.moveTo(edge.start.x, edge.start.y);
                ctx.lineTo(edge.end.x, edge.end.y);
                ctx.stroke();
            });
            ctx.restore();
        }

        // Draw skeleton points (filtered Voronoi vertices)
        if (this.medialAxisSkeleton.points) {
            // Base node style
            ctx.fillStyle = 'rgba(255, 0, 0, 0.9)';
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.lineWidth = 2;
            this.medialAxisSkeleton.points.forEach(point => {
                ctx.beginPath();
                ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            });

            // Highlight leaf nodes (degree == 1)
            ctx.save();
            ctx.fillStyle = '#FFEB3B'; // yellow
            ctx.strokeStyle = '#1A1A1A';
            ctx.lineWidth = 2;
            ctx.shadowColor = 'rgba(255, 235, 59, 0.6)';
            ctx.shadowBlur = 8;
            this.medialAxisSkeleton.points.forEach(point => {
                const k = pKey(point);
                if ((degree.get(k) || 0) === 1) {
                    ctx.beginPath();
                    ctx.arc(point.x, point.y, 7, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.stroke();
                }
            });
            ctx.restore();
        }
    }

    // Getter for polygons
    getPolygons() {
        return this.polygons;
    }

    // Evader simulation methods
    setEvaderState(state) {
        this.evaderState = state;
        this.redraw();
    }

    clearEvaderState() {
        this.evaderState = null;
        this.redraw();
    }

    drawEvader() {
        if (!this.evaderState || !this.evaderState.position) return;

        const ctx = this.ctx;
        const pos = this.evaderState.position;
        const target = this.evaderState.target;
        const path = this.evaderState.path || [];
        const pathEdges = this.evaderState.pathEdges || [];
        const currentWaypointIndex = this.evaderState.currentWaypointIndex || 0;

        // Draw the complete path with edges
        if (pathEdges.length > 0) {
            ctx.save();
            
            // Draw all path edges
            pathEdges.forEach((edge, index) => {
                // Determine if this edge has been traversed
                const isTraversed = index < currentWaypointIndex - 1;
                const isCurrentSegment = index === currentWaypointIndex - 1;
                
                ctx.strokeStyle = isTraversed 
                    ? 'rgba(76, 175, 80, 0.6)'  // Green for traversed
                    : isCurrentSegment 
                        ? 'rgba(255, 193, 7, 0.8)'  // Amber for current
                        : 'rgba(194, 24, 91, 0.5)';  // Pink for upcoming
                
                ctx.lineWidth = isCurrentSegment ? 6 : 4;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                
                // Add glow effect for current segment
                if (isCurrentSegment) {
                    ctx.shadowColor = 'rgba(255, 193, 7, 0.8)';
                    ctx.shadowBlur = 10;
                } else {
                    ctx.shadowBlur = 0;
                }
                
                ctx.beginPath();
                ctx.moveTo(edge.start.x, edge.start.y);
                ctx.lineTo(edge.end.x, edge.end.y);
                ctx.stroke();
            });
            
            ctx.restore();
        }

        // Draw waypoint markers
        if (path.length > 0) {
            ctx.save();
            
            path.forEach((waypoint, index) => {
                const isStart = index === 0;
                const isEnd = index === path.length - 1;
                const isPassed = index < currentWaypointIndex;
                const isCurrent = index === currentWaypointIndex;
                
                // Skip drawing if it's a passed waypoint (except start/end)
                if (isPassed && !isStart) return;
                
                // Start marker (green)
                if (isStart) {
                    ctx.fillStyle = 'rgba(76, 175, 80, 0.3)';
                    ctx.strokeStyle = '#4CAF50';
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    ctx.arc(waypoint.x, waypoint.y, 10, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.stroke();
                    
                    // Visible Start label
                    this.drawPillLabel('Start', waypoint.x + 16, waypoint.y, '#4CAF50');
                }
                // End marker (red)
                else if (isEnd) {
                    ctx.fillStyle = 'rgba(244, 67, 54, 0.3)';
                    ctx.strokeStyle = '#F44336';
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    ctx.arc(waypoint.x, waypoint.y, 10, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.stroke();
                    
                    // Visible End label
                    this.drawPillLabel('End', waypoint.x + 16, waypoint.y, '#F44336');
                }
                // Current target waypoint (amber)
                else if (isCurrent) {
                    ctx.fillStyle = 'rgba(255, 193, 7, 0.4)';
                    ctx.strokeStyle = '#FFC107';
                    ctx.lineWidth = 2;
                    ctx.shadowColor = 'rgba(255, 193, 7, 0.6)';
                    ctx.shadowBlur = 8;
                    ctx.beginPath();
                    ctx.arc(waypoint.x, waypoint.y, 8, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.stroke();
                }
            });
            
            ctx.restore();
        }

        // Draw evader agent (on top of everything)
        ctx.save();
        
        // Main body
        ctx.fillStyle = '#C2185B';
        ctx.strokeStyle = '#880E4F';
        ctx.lineWidth = 3;
        ctx.shadowColor = 'rgba(194, 24, 91, 0.6)';
        ctx.shadowBlur = 10;
        
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // Direction indicator - show heading arrow for both modes but more prominent in unicycle
        const heading = this.evaderState.heading !== undefined ? this.evaderState.heading : 0;
        const isUnicycle = this.evaderState.mode === 'unicycle';
        
        if (isUnicycle) {
            // For unicycle mode, draw prominent arrow showing heading
            const arrowLength = 20;
            const arrowWidth = 9;
            
            ctx.fillStyle = '#FFFFFF';
            ctx.strokeStyle = '#880E4F';
            ctx.lineWidth = 2;
            ctx.shadowBlur = 5;
            
            // Calculate arrow points
            const tipX = pos.x + Math.cos(heading) * arrowLength;
            const tipY = pos.y + Math.sin(heading) * arrowLength;
            
            const baseAngle1 = heading + Math.PI * 0.75;
            const baseAngle2 = heading - Math.PI * 0.75;
            
            const base1X = pos.x + Math.cos(baseAngle1) * arrowWidth;
            const base1Y = pos.y + Math.sin(baseAngle1) * arrowWidth;
            const base2X = pos.x + Math.cos(baseAngle2) * arrowWidth;
            const base2Y = pos.y + Math.sin(baseAngle2) * arrowWidth;
            
            ctx.beginPath();
            ctx.moveTo(tipX, tipY);
            ctx.lineTo(base1X, base1Y);
            ctx.lineTo(pos.x, pos.y);
            ctx.lineTo(base2X, base2Y);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        } else {
            // For holonomic mode, draw simple velocity indicator (points toward target)
            ctx.fillStyle = '#FFFFFF';
            ctx.shadowBlur = 0;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, 4, 0, Math.PI * 2);
            ctx.fill();
        }
        
        ctx.restore();
        
        // Draw "EVADER" label below the agent
        this.drawAgentLabel('EVADER', pos.x, pos.y + 25, '#C2185B');
    }

    // Future Set visualization methods
    setFutureSet(futureSet, gridPoints) {
        this.futureSet = futureSet || [];
        this.futureSetGridPoints = gridPoints || [];
        console.log(`Future set updated: ${this.futureSet.length} points`);
    }

    clearFutureSet() {
        this.futureSet = [];
        this.futureSetGridPoints = [];
    }

    toggleFutureSetVisibility() {
        this.showFutureSet = !this.showFutureSet;
        return this.showFutureSet;
    }

    drawFutureSet() {
        if (this.futureSet.length === 0) return;

        const ctx = this.ctx;
        ctx.save();

        // Find max score for normalization
        const maxScore = Math.max(...this.futureSet.map(p => p.score));

        // Draw reachable points with color gradient
        this.futureSet.forEach(point => {
            const normalizedScore = point.score / maxScore;
            
            // Color gradient: green (low) -> yellow -> red (high)
            let r, g, b;
            if (normalizedScore < 0.5) {
                // Green to Yellow
                const t = normalizedScore * 2;
                r = Math.floor(255 * t);
                g = 255;
                b = 0;
            } else {
                // Yellow to Red
                const t = (normalizedScore - 0.5) * 2;
                r = 255;
                g = Math.floor(255 * (1 - t));
                b = 0;
            }

            // Alpha based on score (more transparent for lower scores)
            const alpha = 0.3 + normalizedScore * 0.7;

            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
            ctx.beginPath();
            ctx.arc(point.x, point.y, 3, 0, Math.PI * 2);
            ctx.fill();
        });

        // Draw max reachable radius circle (if intruder state available)
        if (this.intruderState && this.intruderState.position) {
            const pos = this.intruderState.position;
            // Estimate max radius from grid points
            if (this.futureSetGridPoints.length > 0) {
                const maxDist = Math.max(...this.futureSetGridPoints.map(p => 
                    Math.sqrt((p.x - pos.x) ** 2 + (p.y - pos.y) ** 2)
                ));

                ctx.strokeStyle = 'rgba(0, 255, 255, 0.3)';
                ctx.lineWidth = 2;
                ctx.setLineDash([5, 5]);
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, maxDist, 0, Math.PI * 2);
                ctx.stroke();
                ctx.setLineDash([]);
            }
        }

        ctx.restore();
    }

    // Intruder state management
    setIntruderState(state) {
        this.intruderState = state;
    }

    clearIntruderState() {
        this.intruderState = null;
    }

    drawIntruder() {
        if (!this.intruderState || !this.intruderState.position) return;

        const ctx = this.ctx;
        const pos = this.intruderState.position;
        const heading = this.intruderState.heading || 0;

        ctx.save();
        
        // Main body (different color from evader)
        ctx.fillStyle = '#2196F3'; // Blue
        ctx.strokeStyle = '#0D47A1';
        ctx.lineWidth = 3;
        ctx.shadowColor = 'rgba(33, 150, 243, 0.6)';
        ctx.shadowBlur = 10;
        
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // Direction indicator - prominent arrow showing heading
        const arrowLength = 20;
        const arrowWidth = 9;
        
        ctx.fillStyle = '#FFFFFF';
        ctx.strokeStyle = '#0D47A1';
        ctx.lineWidth = 2;
        ctx.shadowBlur = 5;
        
        // Calculate arrow points
        const tipX = pos.x + Math.cos(heading) * arrowLength;
        const tipY = pos.y + Math.sin(heading) * arrowLength;
        
        const baseAngle1 = heading + Math.PI * 0.75;
        const baseAngle2 = heading - Math.PI * 0.75;
        
        const base1X = pos.x + Math.cos(baseAngle1) * arrowWidth;
        const base1Y = pos.y + Math.sin(baseAngle1) * arrowWidth;
        const base2X = pos.x + Math.cos(baseAngle2) * arrowWidth;
        const base2Y = pos.y + Math.sin(baseAngle2) * arrowWidth;
        
        ctx.beginPath();
        ctx.moveTo(tipX, tipY);
        ctx.lineTo(base1X, base1Y);
        ctx.lineTo(pos.x, pos.y);
        ctx.lineTo(base2X, base2Y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        ctx.restore();
        
        // Draw "PURSUER" label below the agent
        this.drawAgentLabel('PURSUER', pos.x, pos.y + 25, '#2196F3');
    }

    /**
     * Draw a label for an agent on the canvas
     * @param {string} text - Label text
     * @param {number} x - X position (center)
     * @param {number} y - Y position (center)
     * @param {string} color - Color for the label
     */
    drawAgentLabel(text, x, y, color) {
        const ctx = this.ctx;
        ctx.save();
        
        // Set font and measure text
        ctx.font = 'bold 12px Arial, sans-serif';
        const textMetrics = ctx.measureText(text);
        const textWidth = textMetrics.width;
        const textHeight = 12;
        
        // Background pill dimensions
        const padding = 6;
        const pillWidth = textWidth + padding * 2;
        const pillHeight = textHeight + padding * 1.5;
        const radius = pillHeight / 2;
        
        // Draw background pill
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetY = 2;
        
        // Rounded rectangle (pill shape)
        const pillX = x - pillWidth / 2;
        const pillY = y - pillHeight / 2;
        
        ctx.beginPath();
        ctx.moveTo(pillX + radius, pillY);
        ctx.lineTo(pillX + pillWidth - radius, pillY);
        ctx.quadraticCurveTo(pillX + pillWidth, pillY, pillX + pillWidth, pillY + radius);
        ctx.lineTo(pillX + pillWidth, pillY + pillHeight - radius);
        ctx.quadraticCurveTo(pillX + pillWidth, pillY + pillHeight, pillX + pillWidth - radius, pillY + pillHeight);
        ctx.lineTo(pillX + radius, pillY + pillHeight);
        ctx.quadraticCurveTo(pillX, pillY + pillHeight, pillX, pillY + pillHeight - radius);
        ctx.lineTo(pillX, pillY + radius);
        ctx.quadraticCurveTo(pillX, pillY, pillX + radius, pillY);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        // Draw text
        ctx.shadowBlur = 0;
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, x, y);
        
        ctx.restore();
    }

    /**
     * Draw RRT tree on the canvas
     * @param {RRTNode} root - Root node of the tree
     * @param {string} color - Color for the tree edges
     * @param {number} alpha - Opacity (0-1)
     */
    drawRRTTree(root, color, alpha = 0.6) {
        if (!root) return;
        
        const ctx = this.ctx;
        ctx.save();
        
        // Convert hex color to rgba
        const r = parseInt(color.slice(1, 3), 16);
        const g = parseInt(color.slice(3, 5), 16);
        const b = parseInt(color.slice(5, 7), 16);
        const edgeColor = `rgba(${r}, ${g}, ${b}, ${alpha * 0.4})`;
        const nodeColor = `rgba(${r}, ${g}, ${b}, ${alpha * 0.8})`;
        
        // Draw all edges first (BFS traversal)
        const queue = [root];
        const visited = new Set();
        
        ctx.strokeStyle = edgeColor;
        ctx.lineWidth = 1.5;
        
        while (queue.length > 0) {
            const node = queue.shift();
            const nodeKey = `${node.state.x},${node.state.y}`;
            
            if (visited.has(nodeKey)) continue;
            visited.add(nodeKey);
            
            // Draw edges to children
            if (node.children && node.children.length > 0) {
                for (const child of node.children) {
                    ctx.beginPath();
                    ctx.moveTo(node.state.x, node.state.y);
                    ctx.lineTo(child.state.x, child.state.y);
                    ctx.stroke();
                    
                    queue.push(child);
                }
            }
        }
        
        // Draw all nodes (smaller circles)
        visited.clear();
        queue.push(root);
        
        ctx.fillStyle = nodeColor;
        
        while (queue.length > 0) {
            const node = queue.shift();
            const nodeKey = `${node.state.x},${node.state.y}`;
            
            if (visited.has(nodeKey)) continue;
            visited.add(nodeKey);
            
            // Draw node
            ctx.beginPath();
            ctx.arc(node.state.x, node.state.y, 2, 0, Math.PI * 2);
            ctx.fill();
            
            // Add children to queue
            if (node.children && node.children.length > 0) {
                for (const child of node.children) {
                    queue.push(child);
                }
            }
        }
        
        // Draw root node larger
        ctx.fillStyle = color;
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(root.state.x, root.state.y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // Draw heading indicator for root
        const arrowLen = 15;
        const tipX = root.state.x + Math.cos(root.state.theta) * arrowLen;
        const tipY = root.state.y + Math.sin(root.state.theta) * arrowLen;
        
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(root.state.x, root.state.y);
        ctx.lineTo(tipX, tipY);
        ctx.stroke();
        
        // Arrow head
        const arrowAngle = 0.3;
        const arrowSize = 6;
        const angle1 = root.state.theta + Math.PI - arrowAngle;
        const angle2 = root.state.theta + Math.PI + arrowAngle;
        
        ctx.beginPath();
        ctx.moveTo(tipX, tipY);
        ctx.lineTo(tipX + Math.cos(angle1) * arrowSize, tipY + Math.sin(angle1) * arrowSize);
        ctx.moveTo(tipX, tipY);
        ctx.lineTo(tipX + Math.cos(angle2) * arrowSize, tipY + Math.sin(angle2) * arrowSize);
        ctx.stroke();
        
        ctx.restore();
    }

    /**
     * Set the sensor model service for visualization
     * @param {SensorModelService} sensorService - The sensor model service instance
     */
    setSensorModelService(sensorService) {
        this.sensorModelService = sensorService;
    }

    /**
     * Draw sensor ranges and line-of-sight for both agents
     */
    drawSensorVisualization() {
        if (!this.sensorModelService) return;

        const ctx = this.ctx;

        // Draw pursuer sensor
        if (this.intruderState && this.intruderState.position) {
            const pursuerParams = this.sensorModelService.getSensorParams('pursuer');
            if (pursuerParams && pursuerParams.enabled) {
                this.sensorModelService.drawSensorRange(
                    ctx,
                    this.intruderState,
                    pursuerParams,
                    '#2196F3' // Blue for pursuer
                );
            }
        }

        // Draw evader sensor
        if (this.evaderState && this.evaderState.position) {
            const evaderParams = this.sensorModelService.getSensorParams('evader');
            if (evaderParams && evaderParams.enabled) {
                this.sensorModelService.drawSensorRange(
                    ctx,
                    this.evaderState,
                    evaderParams,
                    '#E91E63' // Pink for evader
                );
            }
        }

        // Draw line-of-sight and detection results
        if (this.intruderState && this.evaderState && 
            this.intruderState.position && this.evaderState.position) {
            
            // Compute visibility
            const result = this.sensorModelService.computeVisibility(
                this.intruderState,
                this.evaderState
            );

            // Emit detection result for UI display
            eventBus.emit('sensor:detectionResult', result);

            // Draw LOS lines
            if (result.pursuerLOS) {
                this.sensorModelService.drawLOS(
                    ctx,
                    result.pursuerLOS.from,
                    result.pursuerLOS.to,
                    '#4CAF50', // Green for detected
                    result.pursuerSeesEvader
                );
            }

            if (result.evaderLOS) {
                this.sensorModelService.drawLOS(
                    ctx,
                    result.evaderLOS.from,
                    result.evaderLOS.to,
                    '#FF9800', // Orange for evader LOS
                    result.evaderSeesPursuer
                );
            }

            // Draw detection status indicators (now shown in AgentsWindow instead)
            // this.drawDetectionStatus(result);
        }
    }

    /**
     * Draw detection status indicators on the canvas
     * @param {Object} result - Detection result from sensor service
     */
    drawDetectionStatus(result) {
        const ctx = this.ctx;
        ctx.save();

        // Reset transform to draw in screen space
        ctx.setTransform(1, 0, 0, 1, 0, 0);

        // Draw status box in top-right corner
        const boxWidth = 200;
        const boxHeight = 80;
        const margin = 10;
        const x = this.canvas.width - boxWidth - margin;
        const y = margin;

        // Background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(x, y, boxWidth, boxHeight);

        // Border
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, boxWidth, boxHeight);

        // Text
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'left';

        // Pursuer detection
        const pursuerStatus = result.pursuerSeesEvader ? '✓ DETECTED' : '✗ NOT DETECTED';
        const pursuerColor = result.pursuerSeesEvader ? '#4CAF50' : '#F44336';
        ctx.fillStyle = '#ffffff';
        ctx.fillText('Pursuer:', x + 10, y + 25);
        ctx.fillStyle = pursuerColor;
        ctx.fillText(pursuerStatus, x + 80, y + 25);

        // Evader detection
        const evaderStatus = result.evaderSeesPursuer ? '✓ DETECTED' : '✗ NOT DETECTED';
        const evaderColor = result.evaderSeesPursuer ? '#FF9800' : '#F44336';
        ctx.fillStyle = '#ffffff';
        ctx.fillText('Evader:', x + 10, y + 50);
        ctx.fillStyle = evaderColor;
        ctx.fillText(evaderStatus, x + 80, y + 50);

        // Distance
        if (result.distance !== null) {
            ctx.fillStyle = '#ffffff';
            ctx.font = '10px Arial';
            ctx.fillText(`Distance: ${Math.round(result.distance)}px`, x + 10, y + 70);
        }

        ctx.restore();
    }

    drawHighlightedNodeInfo() {
        const { highlightedNode, pursuerNodes, evaderNodes } = this.activeTrackingData;
        if (!highlightedNode) return;

        const { type, index } = highlightedNode;
        let node;
        let label;

        if (type === 'pursuer' && index < pursuerNodes.length) {
            node = pursuerNodes[index];
            label = `Pursuer Node ${index}`;
        } else if (type === 'evader' && index < evaderNodes.length) {
            node = evaderNodes[index];
            label = `Evader Node ${index}`;
        }

        if (!node) return;

        const state = node.state;
        const screenPos = this.worldToScreen(state.x, state.y);

        const ctx = this.ctx;
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);

        const infoBoxX = screenPos.x + 15;
        const infoBoxY = screenPos.y - 30;
        const infoBoxWidth = 180;
        const infoBoxHeight = 70;

        // Draw info box
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.strokeStyle = type === 'pursuer' ? '#2196F3' : '#E91E63';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.rect(infoBoxX, infoBoxY, infoBoxWidth, infoBoxHeight);
        ctx.fill();
        ctx.stroke();

        // Draw text
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 12px Arial';
        ctx.fillText(label, infoBoxX + 10, infoBoxY + 20);

        ctx.font = '11px Arial';
        ctx.fillText(`x: ${state.x.toFixed(2)}`, infoBoxX + 10, infoBoxY + 40);
        ctx.fillText(`y: ${state.y.toFixed(2)}`, infoBoxX + 10, infoBoxY + 55);
        
        const degrees = (state.theta * 180 / Math.PI).toFixed(1);
        ctx.fillText(`θ: ${degrees}°`, infoBoxX + 90, infoBoxY + 40);

        // Draw direction arrow
        ctx.save();
        ctx.translate(infoBoxX + 145, infoBoxY + 55);
        ctx.rotate(state.theta);
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-7, 0);
        ctx.lineTo(7, 0);
        ctx.lineTo(3, -4);
        ctx.moveTo(7, 0);
        ctx.lineTo(3, 4);
        ctx.stroke();
        ctx.restore();


        ctx.restore();
    }
}
