/**
 * SDFService
 * Computes and stores Signed Distance Field (SDF) for the environment.
 * Used for fast collision checking and distance queries.
 */

import { eventBus } from '../utils/EventBus.js';

export class SDFService {
    constructor() {
        this.grid = null; // 2D array of distances
        this.width = 0;
        this.height = 0;
        this.resolution = 2; // pixels per cell (Higher resolution for better accuracy)
        this.bounds = { minX: 0, maxX: 800, minY: 0, maxY: 600 };
        this.obstacles = [];
        this.isReady = false;
        
        this.setupListeners();
    }

    setupListeners() {
        // Listen for obstacle updates
        // We'll need to manually call setObstacles from App.js or listen to a new event
        // For now, we'll expose setObstacles method
    }

    setObstacles(obstacles, bounds) {
        this.obstacles = obstacles;
        if (bounds) {
            this.bounds = bounds;
        }
        this.updateSDF();
    }

    updateSDF() {
        if (!this.obstacles) return;

        const startTime = performance.now();

        // 1. Determine grid dimensions
        const width = this.bounds.maxX - this.bounds.minX;
        const height = this.bounds.maxY - this.bounds.minY;
        
        this.cols = Math.ceil(width / this.resolution);
        this.rows = Math.ceil(height / this.resolution);
        
        // Initialize grid with Infinity
        this.grid = new Float32Array(this.cols * this.rows);
        
        // 2. Compute SDF (Brute force for now, can be optimized with jump flooding or similar)
        // For each grid cell
        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                const worldX = this.bounds.minX + x * this.resolution;
                const worldY = this.bounds.minY + y * this.resolution;
                const point = { x: worldX, y: worldY };
                
                let globalMinDist = Infinity;
                let isInside = false;

                // Check against all obstacles
                if (this.obstacles.length === 0) {
                    globalMinDist = 10000; // Large safe distance if no obstacles
                } else {
                    for (const poly of this.obstacles) {
                        // Always compute distance to nearest edge
                        const dist = this.distanceToPolygon(point, poly);
                        if (dist < globalMinDist) {
                            globalMinDist = dist;
                        }

                        // Check if inside (only if not already confirmed inside)
                        if (!isInside && this.pointInPolygon(point, poly)) {
                            isInside = true;
                        }
                    }
                }

                // Store signed distance: negative if inside, positive if outside
                this.grid[y * this.cols + x] = isInside ? -globalMinDist : globalMinDist;
            }
        }

        this.isReady = true;
        const time = performance.now() - startTime;
        console.log(`SDF computed in ${time.toFixed(2)}ms. Grid: ${this.cols}x${this.rows}`);
        eventBus.emit('sdf:updated');
    }

    getDistance(x, y) {
        // If not ready, assume safe (Infinity) so we don't paralyze the agent
        if (!this.isReady || !this.grid) return 10000;

        // Map world coordinates to grid coordinates
        const gridX = (x - this.bounds.minX) / this.resolution;
        const gridY = (y - this.bounds.minY) / this.resolution;

        // Check bounds - treat out of bounds as collision (0 distance)
        if (gridX < 0 || gridX >= this.cols - 1 || gridY < 0 || gridY >= this.rows - 1) {
            return 0; 
        }

        // Bilinear interpolation
        const x0 = Math.floor(gridX);
        const y0 = Math.floor(gridY);
        const x1 = x0 + 1;
        const y1 = y0 + 1;

        const wx = gridX - x0;
        const wy = gridY - y0;

        const v00 = this.grid[y0 * this.cols + x0];
        const v10 = this.grid[y0 * this.cols + x1];
        const v01 = this.grid[y1 * this.cols + x0];
        const v11 = this.grid[y1 * this.cols + x1];

        const top = v00 * (1 - wx) + v10 * wx;
        const bottom = v01 * (1 - wx) + v11 * wx;

        return top * (1 - wy) + bottom * wy;
    }

    // --- Geometry Helpers ---

    pointInPolygon(p, poly) {
        const vertices = poly.vertices;
        let inside = false;
        for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
            const xi = vertices[i].x, yi = vertices[i].y;
            const xj = vertices[j].x, yj = vertices[j].y;
            const intersect = ((yi > p.y) !== (yj > p.y)) &&
                (p.x < (xj - xi) * (p.y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    }

    distanceToPolygon(p, poly) {
        let minDist = Infinity;
        const vertices = poly.vertices;
        for (let i = 0; i < vertices.length; i++) {
            const v1 = vertices[i];
            const v2 = vertices[(i + 1) % vertices.length];
            const dist = this.pointToSegmentDistance(p, v1, v2);
            if (dist < minDist) minDist = dist;
        }
        return minDist;
    }

    pointToSegmentDistance(p, v1, v2) {
        const dx = v2.x - v1.x;
        const dy = v2.y - v1.y;
        const lengthSq = dx * dx + dy * dy;
        if (lengthSq === 0) return Math.sqrt((p.x - v1.x) ** 2 + (p.y - v1.y) ** 2);
        
        let t = ((p.x - v1.x) * dx + (p.y - v1.y) * dy) / lengthSq;
        t = Math.max(0, Math.min(1, t));
        
        const projX = v1.x + t * dx;
        const projY = v1.y + t * dy;
        
        return Math.sqrt((p.x - projX) ** 2 + (p.y - projY) ** 2);
    }
}

export const sdfService = new SDFService();
