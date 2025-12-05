/**
 * KiloVisiNetService
 * Grid-based visibility computation inspired by Kilo-NeRF architecture.
 * Divides environment into small cells, each with its own local neural network.
 */

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
     * Compute visibility polygon using fixed number of rays (same as VisibilNet)
     * @param {Object} point - Observer point {x, y}
     * @param {Array} polygons - Array of polygon obstacles
     * @param {Object} bounds - Bounding box {minX, maxX, minY, maxY}
     * @param {number} numRays - Number of rays to cast (evenly distributed)
     * @returns {Array} Visibility polygon vertices
     */
    computeRayBasedVisibility(point, polygons, bounds, numRays = 36) {
        if (!point) return [];
        
        const segments = [];
        for (const poly of polygons) {
            const v = poly.vertices;
            for (let i = 0; i < v.length; i++) {
                const a = v[i];
                const b = v[(i + 1) % v.length];
                segments.push({ a, b });
            }
        }
        
        if (bounds) {
            const bb = [
                { x: bounds.minX, y: bounds.minY },
                { x: bounds.maxX, y: bounds.minY },
                { x: bounds.maxX, y: bounds.maxY },
                { x: bounds.minX, y: bounds.maxY },
            ];
            for (let i = 0; i < 4; i++) {
                segments.push({ a: bb[i], b: bb[(i+1)%4] });
            }
        }

        const intersections = [];
        for (let i = 0; i < numRays; i++) {
            const ang = (i / numRays) * 2 * Math.PI;
            const dx = Math.cos(ang);
            const dy = Math.sin(ang);
            
            let minT = Infinity;
            let ix = point.x;
            let iy = point.y;
            
            for (const seg of segments) {
                const res = this.raySegmentIntersect(
                    point.x, point.y, dx, dy, 
                    seg.a.x, seg.a.y, seg.b.x, seg.b.y
                );
                if (res && res.t >= 0 && res.u >= 0 && res.u <= 1 && res.t < minT) {
                    minT = res.t;
                    ix = res.x;
                    iy = res.y;
                }
            }
            
            if (minT < Infinity) {
                intersections.push({ x: ix, y: iy, angle: ang });
            }
        }
        
        return intersections.map(p => ({ x: p.x, y: p.y }));
    }

    /**
     * Ray-segment intersection test
     */
    raySegmentIntersect(px, py, rdx, rdy, x1, y1, x2, y2) {
        const rx = rdx, ry = rdy;
        const sx = x2 - x1, sy = y2 - y1;
        const qpx = x1 - px, qpy = y1 - py;
        
        const cross = (ax, ay, bx, by) => ax * by - ay * bx;
        const den = cross(rx, ry, sx, sy);
        
        if (Math.abs(den) < this.segmentEpsilon) return null;
        
        const t = cross(qpx, qpy, sx, sy) / den;
        const u = cross(qpx, qpy, rx, ry) / den;
        
        if (t >= 0 && u >= 0 && u <= 1) {
            return {
                t: t,
                u: u,
                x: px + t * rx,
                y: py + t * ry
            };
        }
        return null;
    }

    /**
     * Get ray distances for neural network input
     * @param {Object} point - Observer point
     * @param {Array} polygons - Polygon obstacles
     * @param {Object} bounds - Bounding box
     * @param {number} numRays - Number of rays
     * @returns {Array} Array of distances (one per ray)
     */
    getRayDistances(point, polygons, bounds, numRays = 36) {
        if (!point) return Array(numRays).fill(0);
        
        const segments = [];
        for (const poly of polygons) {
            const v = poly.vertices;
            for (let i = 0; i < v.length; i++) {
                const a = v[i];
                const b = v[(i + 1) % v.length];
                segments.push({ a, b });
            }
        }
        
        if (bounds) {
            const bb = [
                { x: bounds.minX, y: bounds.minY },
                { x: bounds.maxX, y: bounds.minY },
                { x: bounds.maxX, y: bounds.maxY },
                { x: bounds.minX, y: bounds.maxY },
            ];
            for (let i = 0; i < 4; i++) {
                segments.push({ a: bb[i], b: bb[(i+1)%4] });
            }
        }

        const distances = [];
        for (let i = 0; i < numRays; i++) {
            const ang = (i / numRays) * 2 * Math.PI;
            const dx = Math.cos(ang);
            const dy = Math.sin(ang);
            
            let minT = Infinity;
            for (const seg of segments) {
                const res = this.raySegmentIntersect(
                    point.x, point.y, dx, dy, 
                    seg.a.x, seg.a.y, seg.b.x, seg.b.y
                );
                if (res && res.t >= 0 && res.u >= 0 && res.u <= 1 && res.t < minT) {
                    minT = res.t;
                }
            }
            distances.push(minT < Infinity ? minT : 0);
        }
        
        return distances;
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
