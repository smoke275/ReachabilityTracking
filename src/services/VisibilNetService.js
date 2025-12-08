/**
 * VisibilNetService
 * Ray-based visibility computation for neural network training data generation.
 * Uses fixed number of evenly-spaced rays to compute visibility polygon.
 */

import { VisibilNetConfig } from '../config/VisibilNetConfig.js';

let wasmModule = null;
let wasmService = null;

// Attempt to load WASM
(async () => {
    try {
        // Try to load the WASM module
        // Note: The path depends on your build setup. Adjust if necessary.
        wasmModule = await import('../../pkg/reachability_wasm.js');
        await wasmModule.default(); // Initialize
        if (wasmModule.VisibilNetWasmService) {
            wasmService = new wasmModule.VisibilNetWasmService();
            console.log('VisibilNet WASM Service loaded successfully');
        }
    } catch (e) {
        console.warn('VisibilNet WASM not available, falling back to JS', e);
    }
})();

export class VisibilNetService {
    constructor() {
        this.segmentEpsilon = 1e-9;
        this.preferredBackend = VisibilNetConfig.computeBackend; // 'wasm' or 'js'
    }

    /**
     * Check if WASM backend is available
     * @returns {boolean}
     */
    isWasmAvailable() {
        return !!wasmService;
    }

    /**
     * Set the preferred backend
     * @param {string} backend - 'wasm' or 'js'
     */
    setBackend(backend) {
        if (backend === 'wasm' && !this.isWasmAvailable()) {
            console.warn('WASM backend requested but not available. Keeping current backend.');
            return;
        }
        this.preferredBackend = backend;
        VisibilNetConfig.computeBackend = backend; // Update config object too
        console.log(`VisibilNet backend set to: ${backend}`);
    }

    /**
     * Get the current active backend
     * @returns {string} 'wasm' or 'js'
     */
    getBackend() {
        if (this.preferredBackend === 'wasm' && this.isWasmAvailable()) {
            return 'wasm';
        }
        return 'js';
    }

    /**
     * Compute visibility polygon using fixed number of rays
     * @param {Object} point - Observer point {x, y}
     * @param {Array} polygons - Array of polygon obstacles
     * @param {Object} bounds - Bounding box {minX, maxX, minY, maxY}
     * @param {number} numRays - Number of rays to cast (evenly distributed)
     * @returns {Array} Visibility polygon vertices
     */
    computeRayBasedVisibility(point, polygons, bounds, numRays = 36) {
        if (!point) return [];

        // Use WASM if preferred and available
        if (this.preferredBackend === 'wasm' && wasmService) {
            try {
                return wasmService.compute_ray_based_visibility(point, polygons, bounds, numRays);
            } catch (e) {
                console.warn('WASM computeRayBasedVisibility failed, falling back to JS:', e);
            }
        }
        
        // Build list of segments from polygon edges
        const segments = [];
        for (const poly of polygons) {
            const v = poly.vertices;
            for (let i = 0; i < v.length; i++) {
                const a = v[i];
                const b = v[(i + 1) % v.length];
                segments.push({ a, b });
            }
        }
        
        // Add bounding box rectangle as segments so rays terminate
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

        // Generate evenly-spaced angles (0 to 2π)
        const intersections = [];
        for (let i = 0; i < numRays; i++) {
            const ang = (i / numRays) * 2 * Math.PI;
            const dx = Math.cos(ang);
            const dy = Math.sin(ang);
            
            // Find closest intersection for this ray
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
        
        // Return the points in order
        return intersections.map(p => ({ x: p.x, y: p.y }));
    }

    /**
     * Ray-segment intersection test
     * Ray: p + t*r where t >= 0
     * Segment: q + u*s where 0 <= u <= 1
     */
    raySegmentIntersect(px, py, rdx, rdy, x1, y1, x2, y2) {
        const rx = rdx, ry = rdy;
        const sx = x2 - x1, sy = y2 - y1;
        const qpx = x1 - px, qpy = y1 - py;
        
        const cross = (ax, ay, bx, by) => ax * by - ay * bx;
        const den = cross(rx, ry, sx, sy);
        
        if (Math.abs(den) < this.segmentEpsilon) return null; // parallel or collinear
        
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

        // Use WASM if preferred and available
        if (this.preferredBackend === 'wasm' && wasmService) {
            try {
                const result = wasmService.get_ray_distances(point, polygons, bounds, numRays);
                return Array.from(result);
            } catch (e) {
                console.warn('WASM getRayDistances failed, falling back to JS:', e);
            }
        }
        
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
     * Get ray distances for a batch of points (optimized for WASM)
     * @param {Array} points - Array of observer points {x, y}
     * @param {Array} polygons - Polygon obstacles
     * @param {Object} bounds - Bounding box
     * @param {number} numRays - Number of rays
     * @returns {Array} Array of distance arrays
     */
    /**
     * Update the environment (polygons and bounds) in the WASM backend.
     * @param {Array} polygons 
     * @param {Object} bounds 
     */
    updateEnvironment(polygons, bounds) {
        if (wasmService && wasmService.update_environment) {
            try {
                wasmService.update_environment(polygons, bounds);
            } catch (e) {
                console.warn('WASM updateEnvironment failed:', e);
            }
        }
    }

    /**
     * Compute visibility for a batch of points.
     * Optimized to use WASM batch processing with flat arrays and environment caching.
     * @param {Array} points - Array of observer points {x, y}
     * @param {Array} polygons - Polygon obstacles
     * @param {Object} bounds - Bounding box
     * @param {number} numRays - Number of rays
     * @returns {Array} Array of distance arrays (Float64Array)
     */
    getBatchRayDistances(points, polygons, bounds, numRays = 36) {
        if (!points || points.length === 0) return [];

        // Use WASM if preferred and available
        if (this.preferredBackend === 'wasm' && wasmService && wasmService.get_batch_ray_distances_optimized) {
            try {
                // Check if environment needs update
                if (this.lastPolygons !== polygons || this.lastBounds !== bounds) {
                    console.log('Updating WASM environment...');
                    const t0 = performance.now();
                    this.updateEnvironment(polygons, bounds);
                    const t1 = performance.now();
                    console.log(`Environment update took ${t1 - t0}ms`);
                    this.lastPolygons = polygons;
                    this.lastBounds = bounds;
                }

                // Flatten points to Float64Array [x1, y1, x2, y2, ...]
                const flatPoints = new Float64Array(points.length * 2);
                for (let i = 0; i < points.length; i++) {
                    flatPoints[i * 2] = points[i].x;
                    flatPoints[i * 2 + 1] = points[i].y;
                }

                const tStart = performance.now();
                const flatDistances = wasmService.get_batch_ray_distances_optimized(flatPoints, numRays);
                const tEnd = performance.now();
                // console.log(`WASM batch exec: ${tEnd - tStart}ms for ${points.length} points`);
                
                // Convert flat distances back to array of arrays
                const result = [];
                for (let i = 0; i < points.length; i++) {
                    const start = i * numRays;
                    const end = start + numRays;
                    result.push(flatDistances.subarray(start, end));
                }
                return result;

            } catch (e) {
                console.warn('WASM getBatchRayDistances failed, falling back to JS loop:', e);
            }
        }
        
        // Fallback to JS loop (Optimized Batch)
        
        // 1. Prepare Segments (once)
        const segments = [];
        for (const poly of polygons) {
            const v = poly.vertices;
            const len = v.length;
            for (let i = 0; i < len; i++) {
                segments.push({ 
                    x1: v[i].x, y1: v[i].y, 
                    x2: v[(i + 1) % len].x, y2: v[(i + 1) % len].y 
                });
            }
        }
        if (bounds) {
             segments.push({ x1: bounds.minX, y1: bounds.minY, x2: bounds.maxX, y2: bounds.minY });
             segments.push({ x1: bounds.maxX, y1: bounds.minY, x2: bounds.maxX, y2: bounds.maxY });
             segments.push({ x1: bounds.maxX, y1: bounds.maxY, x2: bounds.minX, y2: bounds.maxY });
             segments.push({ x1: bounds.minX, y1: bounds.maxY, x2: bounds.minX, y2: bounds.minY });
        }

        // 2. Precompute Ray Directions (once)
        const rayDirs = [];
        for (let i = 0; i < numRays; i++) {
            const angle = (i / numRays) * 2 * Math.PI;
            rayDirs.push({ dx: Math.cos(angle), dy: Math.sin(angle) });
        }

        const result = [];
        const numSegments = segments.length;

        // 3. Process Points
        for (let i = 0; i < points.length; i++) {
            const p = points[i];
            const px = p.x;
            const py = p.y;
            const pointDistances = new Float64Array(numRays);

            for (let r = 0; r < numRays; r++) {
                const { dx, dy } = rayDirs[r];
                let minT = Infinity;

                for (let s = 0; s < numSegments; s++) {
                    const seg = segments[s];
                    const x1 = seg.x1;
                    const y1 = seg.y1;
                    const x2 = seg.x2;
                    const y2 = seg.y2;

                    // Inline intersection logic
                    const sx = x2 - x1;
                    const sy = y2 - y1;

                    const rx_sy = dx * sy;
                    const ry_sx = dy * sx;
                    const den = rx_sy - ry_sx;

                    if (Math.abs(den) < 1e-9) continue;

                    const qpx = x1 - px;
                    const qpy = y1 - py;

                    const t = (qpx * sy - qpy * sx) / den;
                    
                    // Optimization: check t first
                    if (t >= 0 && t < minT) {
                        const u = (qpx * dy - qpy * dx) / den;
                        if (u >= 0 && u <= 1) {
                            minT = t;
                        }
                    }
                }
                pointDistances[r] = (minT < Infinity) ? minT : 0;
            }
            result.push(pointDistances);
        }
        return result;
    }

    /**
     * Compute convex hull of all polygon vertices using Graham scan
     * @param {Array} polygons - Array of polygon obstacles
     * @returns {Array} Convex hull points
     */
    computeConvexHull(polygons) {
        if (!polygons || polygons.length === 0) return [];
        
        // Collect all vertices
        const points = [];
        for (const poly of polygons) {
            points.push(...poly.vertices);
        }
        
        if (points.length < 3) return points;
        
        // Find bottom-most point (or leftmost if tie)
        let start = points[0];
        for (const p of points) {
            if (p.y < start.y || (p.y === start.y && p.x < start.x)) {
                start = p;
            }
        }
        
        // Sort by polar angle with respect to start point
        const angle = (p) => Math.atan2(p.y - start.y, p.x - start.x);
        const dist = (p) => Math.hypot(p.x - start.x, p.y - start.y);
        
        const sorted = points
            .filter(p => p !== start)
            .sort((a, b) => {
                const angleA = angle(a);
                const angleB = angle(b);
                if (Math.abs(angleA - angleB) < 1e-9) {
                    return dist(a) - dist(b);
                }
                return angleA - angleB;
            });
        
        // Graham scan
        const hull = [start];
        for (const p of sorted) {
            while (hull.length > 1) {
                const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
                if (cross(hull[hull.length - 2], hull[hull.length - 1], p) > 0) break;
                hull.pop();
            }
            hull.push(p);
        }
        
        return hull;
    }

    /**
     * Check if point is inside polygon using ray casting
     * @param {Object} point - Point {x, y}
     * @param {Object} polygon - Polygon with vertices array
     * @returns {boolean} True if inside
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
     * Check if point is inside convex hull
     * @param {Object} point - Point {x, y}
     * @param {Array} hull - Convex hull vertices
     * @returns {boolean} True if inside
     */
    isPointInConvexHull(point, hull) {
        if (hull.length < 3) return false;
        
        const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
        
        for (let i = 0; i < hull.length; i++) {
            const j = (i + 1) % hull.length;
            if (cross(hull[i], hull[j], point) < 0) {
                return false;
            }
        }
        return true;
    }

    /**
     * Check if point is in free space (inside convex hull but not inside any polygon)
     * @param {Object} point - Point {x, y}
     * @param {Array} polygons - Array of polygon obstacles
     * @param {Array} convexHull - Convex hull of all polygons
     * @returns {boolean} True if in free space
     */
    isPointInFreeSpace(point, polygons, convexHull) {
        // Must be inside convex hull
        if (!this.isPointInConvexHull(point, convexHull)) {
            return false;
        }
        
        // Must not be inside any polygon
        for (const poly of polygons) {
            if (this.isPointInPolygon(point, poly)) {
                return false;
            }
        }
        
        return true;
    }

    /**
     * Sample points in free space within convex hull
     * @param {Array} polygons - Array of polygon obstacles
     * @param {Object} bounds - Bounding box {minX, maxX, minY, maxY}
     * @param {number} gridSize - Grid spacing for sampling
     * @returns {Array} Array of free space points {x, y}
     */
    sampleFreeSpace(polygons, bounds, gridSize = 20) {
        if (!polygons || polygons.length === 0) return [];
        
        const convexHull = this.computeConvexHull(polygons);
        if (convexHull.length < 3) return [];
        
        const samples = [];
        
        // Grid sampling within bounds
        for (let x = bounds.minX; x <= bounds.maxX; x += gridSize) {
            for (let y = bounds.minY; y <= bounds.maxY; y += gridSize) {
                const point = { x, y };
                if (this.isPointInFreeSpace(point, polygons, convexHull)) {
                    samples.push(point);
                }
            }
        }
        
        return samples;
    }
}

export const visibilnetService = new VisibilNetService();
