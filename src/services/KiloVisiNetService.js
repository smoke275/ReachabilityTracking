/**
 * KiloVisiNetService
 * Grid-based visibility computation inspired by Kilo-NeRF architecture.
 * Divides environment into small cells, each with its own local neural network.
 */

import { visibilnetService } from './VisibilNetService.js';

export class KiloVisiNetService {
    constructor() {
        this.segmentEpsilon = 1e-9;
        this.gridCells = new Map(); // Map of "x,y" -> {bounds, model, trainingData}
        this.cellSize = 50; // Default cell size in pixels
    }

    /**
     * Determine which grid cell a point belongs to
     * @param {Object} point - Point {x, y}
     * @returns {Object} Grid cell coordinates {cellX, cellY}
     */
    getGridCell(point) {
        const cellX = Math.floor(point.x / this.cellSize);
        const cellY = Math.floor(point.y / this.cellSize);
        return { cellX, cellY };
    }

    /**
     * Get cell key for Map storage
     * @param {number} cellX - Cell X coordinate
     * @param {number} cellY - Cell Y coordinate
     * @returns {string} Cell key
     */
    getCellKey(cellX, cellY) {
        return `${cellX},${cellY}`;
    }

    /**
     * Initialize a grid cell with bounds
     * @param {number} cellX - Cell X coordinate
     * @param {number} cellY - Cell Y coordinate
     * @returns {Object} Cell data
     */
    initializeCell(cellX, cellY) {
        const key = this.getCellKey(cellX, cellY);
        if (!this.gridCells.has(key)) {
            this.gridCells.set(key, {
                cellX,
                cellY,
                bounds: {
                    minX: cellX * this.cellSize,
                    maxX: (cellX + 1) * this.cellSize,
                    minY: cellY * this.cellSize,
                    maxY: (cellY + 1) * this.cellSize
                },
                model: null,
                trainingData: [],
                normalizationParams: null
            });
        }
        return this.gridCells.get(key);
    }

    /**
     * Get all grid cells that overlap with bounds
     * @param {Object} bounds - Bounding box {minX, maxX, minY, maxY}
     * @returns {Array} Array of cell keys
     */
    getCellsInBounds(bounds) {
        const minCellX = Math.floor(bounds.minX / this.cellSize);
        const maxCellX = Math.floor(bounds.maxX / this.cellSize);
        const minCellY = Math.floor(bounds.minY / this.cellSize);
        const maxCellY = Math.floor(bounds.maxY / this.cellSize);

        const cells = [];
        for (let cx = minCellX; cx <= maxCellX; cx++) {
            for (let cy = minCellY; cy <= maxCellY; cy++) {
                cells.push(this.getCellKey(cx, cy));
            }
        }
        return cells;
    }

    /**
     * Compute visibility polygon using fixed number of rays (delegates to VisibilNetService)
     * @param {Object} point - Observer point {x, y}
     * @param {Array} polygons - Array of polygon obstacles
     * @param {Object} bounds - Bounding box {minX, maxX, minY, maxY}
     * @param {number} numRays - Number of rays to cast (evenly distributed)
     * @returns {Array} Visibility polygon vertices
     */
    computeRayBasedVisibility(point, polygons, bounds, numRays = 36) {
        return visibilnetService.computeRayBasedVisibility(point, polygons, bounds, numRays);
    }

    /**
     * Get ray distances for neural network input (delegates to VisibilNetService)
     * @param {Object} point - Observer point
     * @param {Array} polygons - Polygon obstacles
     * @param {Object} bounds - Bounding box
     * @param {number} numRays - Number of rays
     * @returns {Array} Array of distances (one per ray)
     */
    getRayDistances(point, polygons, bounds, numRays = 36) {
        return visibilnetService.getRayDistances(point, polygons, bounds, numRays);
    }

    /**
     * Check if point is inside polygon using ray casting
     */
    isPointInPolygon(point, polygon) {
        const vertices = polygon.vertices;
        let inside = false;
        
        for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
            const xi = vertices[i].x, yi = vertices[i].y;
            const xj = vertices[j].x, yj = vertices[j].y;
            
            const intersect = ((yi > point.y) !== (yj > point.y))
                && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        
        return inside;
    }

    /**
     * Sample points within a specific grid cell
     * @param {number} cellX - Cell X coordinate
     * @param {number} cellY - Cell Y coordinate
     * @param {Array} polygons - Array of polygon obstacles
     * @param {number} gridSize - Grid spacing for sampling
     * @returns {Array} Array of free space points {x, y} within this cell
     */
    sampleCellFreeSpace(cellX, cellY, polygons, gridSize = 5) {
        const cellData = this.initializeCell(cellX, cellY);
        const samples = [];
        
        // Sample within cell bounds
        for (let x = cellData.bounds.minX; x < cellData.bounds.maxX; x += gridSize) {
            for (let y = cellData.bounds.minY; y < cellData.bounds.maxY; y += gridSize) {
                const point = { x, y };
                
                // Check if point is not inside any obstacle
                let isFree = true;
                for (const poly of polygons) {
                    if (this.isPointInPolygon(point, poly)) {
                        isFree = false;
                        break;
                    }
                }
                
                if (isFree) {
                    samples.push(point);
                }
            }
        }
        
        return samples;
    }

    /**
     * Sample all cells in the environment
     * @param {Array} polygons - Array of polygon obstacles
     * @param {Object} bounds - Bounding box {minX, maxX, minY, maxY}
     * @param {number} gridSize - Grid spacing for sampling
     * @returns {Object} Map of cell keys to sample arrays
     */
    sampleAllCells(polygons, bounds, gridSize = 5) {
        const cellKeys = this.getCellsInBounds(bounds);
        const cellSamples = new Map();
        
        for (const key of cellKeys) {
            const [cellX, cellY] = key.split(',').map(Number);
            const samples = this.sampleCellFreeSpace(cellX, cellY, polygons, gridSize);
            if (samples.length > 0) {
                cellSamples.set(key, samples);
            }
        }
        
        return cellSamples;
    }

    /**
     * Clear all grid cells and models
     */
    clearAllCells() {
        this.gridCells.clear();
    }

    /**
     * Get statistics about grid cells
     * @returns {Object} Statistics
     */
    getStatistics() {
        let totalCells = this.gridCells.size;
        let trainedCells = 0;
        let totalSamples = 0;

        for (const [key, cell] of this.gridCells) {
            if (cell.model) trainedCells++;
            totalSamples += cell.trainingData.length;
        }

        return {
            totalCells,
            trainedCells,
            totalSamples,
            cellSize: this.cellSize
        };
    }
}

export const kilovisinetService = new KiloVisiNetService();
