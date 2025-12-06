/**
 * SimilarityCalculatorService
 * Handles visibility polygon computation and similarity calculation for two observers
 */

import { eventBus } from '../utils/EventBus.js';
import { visibilityService } from './VisibilityService.js';

export class SimilarityCalculatorService {
    constructor() {
        this.polygons = [];
        this.bounds = null;
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Listen for visibility computation requests
        eventBus.on('similarity:computeVisibility', (data) => {
            this.computeVisibility(data.observer, data.position, data.numRays);
        });

        // Listen for similarity calculation requests
        eventBus.on('similarity:requestCalculation', (data) => {
            this.calculateSimilarity(data.observer1, data.observer2, { 
                enableGeometric: data.enableGeometric,
                enableMonteCarlo: data.enableMonteCarlo
            });
        });
    }

    /**
     * Set the environment polygons and bounds
     */
    setEnvironment(polygons, bounds) {
        this.polygons = polygons;
        this.bounds = bounds;
    }

    /**
     * Compute visibility polygon for an observer using ray casting
     */
    computeVisibility(observer, position, numRays) {
        if (!this.polygons || this.polygons.length === 0) {
            console.error('No polygons set for similarity calculator');
            return;
        }

        // Use the visibility service to compute the visibility polygon
        const visibilityPolygon = visibilityService.computeVisibility(
            position,
            this.polygons,
            this.bounds
        );

        // Emit the computed polygon back to the window
        eventBus.emit('similarity:visibilityComputed', {
            observer,
            polygon: visibilityPolygon
        });
    }

    /**
     * Calculate similarity between two visibility polygons
     * Using formula: S(a,b) = Area(V_a ∩ V_b) / Area(V_b)
     * This measures how much of observer b's visibility is covered by observer a
     */
    calculateSimilarity(observer1, observer2, options = {}) {
        if (!observer1.polygon || !observer2.polygon) {
            console.error('Both observers need visibility polygons');
            return;
        }

        const startTime = performance.now();

        const poly1 = observer1.polygon;
        const poly2 = observer2.polygon;

        // Calculate areas
        const area1 = this.calculatePolygonArea(poly1);
        const area2 = this.calculatePolygonArea(poly2);

        let intersectionArea = 0;
        let similarity = null;
        let calculationTime = 0;

        // Only run geometric calculation if enabled
        if (options.enableGeometric) {
            // Calculate intersection area using geometric sampling
            intersectionArea = this.calculateIntersectionArea(poly1, poly2);

            // Calculate similarity: S(a,b) = Area(V_a ∩ V_b) / Area(V_b)
            similarity = area2 > 0 ? intersectionArea / area2 : 0;

            const endTime = performance.now();
            calculationTime = endTime - startTime;
        }

        // Monte Carlo Integration
        let mcResult = { similarity: undefined, samples: 0, pointsInA: 0 };
        let mcTime = 0;

        if (options.enableMonteCarlo !== false) { // Default to true if undefined
            const mcStartTime = performance.now();
            mcResult = this.calculateSimilarityMonteCarlo(observer1, observer2, 2000);
            const mcEndTime = performance.now();
            mcTime = mcEndTime - mcStartTime;
        }

        // Emit the result
        eventBus.emit('similarity:calculationComplete', {
            similarity,
            area1,
            area2,
            intersectionArea,
            calculationTime,
            
            // Monte Carlo results
            mcSimilarity: mcResult.similarity,
            mcTime: mcTime,
            mcSamples: mcResult.samples,
            
            formula: 'S(a,b) = Area(V_a ∩ V_b) / Area(V_b)'
        });
    }

    /**
     * Calculate similarity using Monte Carlo Integration
     * S(a,b) = Points(Inside A) / Total Points(Sampled in B)
     * Uses Triangle-based sampling for correct uniform distribution
     */
    calculateSimilarityMonteCarlo(observer1, observer2, numSamples = 2000) {
        if (!observer1.polygon || !observer2.polygon) return { similarity: 0, samples: 0, pointsInA: 0 };

        let pointsInA = 0;
        const poly2 = observer2.polygon;
        const center = { x: observer2.x, y: observer2.y };

        // 1. Pre-calculate triangles and their cumulative areas (CDF) for Observer 2
        // This ensures we sample more points in larger "slices" of the polygon
        const triangles = [];
        let totalArea = 0;
        const cdf = [];

        for (let i = 0; i < poly2.length; i++) {
            const p1 = poly2[i];
            const p2 = poly2[(i + 1) % poly2.length];
            
            // Area of triangle (Center, p1, p2) = 0.5 * |x1(y2 - y3) + x2(y3 - y1) + x3(y1 - y2)|
            // Here x3,y3 is center
            const triArea = 0.5 * Math.abs(
                p1.x * (p2.y - center.y) + 
                p2.x * (center.y - p1.y) + 
                center.x * (p1.y - p2.y)
            );

            triangles.push({ p1, p2, area: triArea });
            totalArea += triArea;
            cdf.push(totalArea);
        }

        // 2. Monte Carlo Sampling
        for (let i = 0; i < numSamples; i++) {
            // A. Select a triangle based on area weight
            const rArea = Math.random() * totalArea;
            let triIndex = 0;
            // Binary search could be faster for large N, but linear is fine for N~100
            while (triIndex < cdf.length - 1 && rArea > cdf[triIndex]) {
                triIndex++;
            }
            const tri = triangles[triIndex];

            // B. Sample uniformly inside the triangle (Center, p1, p2)
            // P = (1 - sqrt(r1)) * A + (sqrt(r1) * (1 - r2)) * B + (sqrt(r1) * r2) * C
            const r1 = Math.random();
            const r2 = Math.random();
            const sqrtR1 = Math.sqrt(r1);
            
            const wCenter = 1 - sqrtR1;
            const wP1 = sqrtR1 * (1 - r2);
            const wP2 = sqrtR1 * r2;

            const P = {
                x: wCenter * center.x + wP1 * tri.p1.x + wP2 * tri.p2.x,
                y: wCenter * center.y + wP1 * tri.p1.y + wP2 * tri.p2.y
            };
            
            // C. Check if P is inside A
            // Vector v = P - A
            const dx = P.x - observer1.x;
            const dy = P.y - observer1.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            const alpha = Math.atan2(dy, dx);
            
            // Get R_A(alpha)
            const rMaxA = this.getRadialDistance(observer1, alpha);
            
            if (dist < rMaxA) {
                pointsInA++;
            }
        }
        
        return {
            similarity: pointsInA / numSamples,
            samples: numSamples,
            pointsInA: pointsInA
        };
    }

    /**
     * Get the radial distance from observer to polygon boundary at given angle
     */
    getRadialDistance(observer, angle) {
        const poly = observer.polygon;
        const cx = observer.x;
        const cy = observer.y;
        const dx = Math.cos(angle);
        const dy = Math.sin(angle);
        
        const n = poly.length;
        for (let i = 0; i < n; i++) {
            const p1 = poly[i];
            const p2 = poly[(i + 1) % n];
            
            // Ray-Segment intersection
            // Ray: O + t D
            // Segment: P1 + u (P2 - P1)
            
            const v1x = p1.x - cx;
            const v1y = p1.y - cy;
            const v2x = p2.x - p1.x;
            const v2y = p2.y - p1.y;
            
            // Solve: t*dx - u*v2x = v1x
            //        t*dy - u*v2y = v1y
            
            const det = dx * (-v2y) - dy * (-v2x);
            if (Math.abs(det) < 1e-9) continue;
            
            const t = (v1x * (-v2y) - v1y * (-v2x)) / det;
            const u = (dx * v1y - dy * v1x) / det;
            
            if (t >= 0 && u >= -1e-9 && u <= 1.000000001) {
                return t;
            }
        }
        return 0;
    }

    /**
     * Calculate the area of a polygon using the Shoelace formula
     */
    calculatePolygonArea(polygon) {
        if (!polygon || polygon.length < 3) return 0;

        let area = 0;
        for (let i = 0; i < polygon.length; i++) {
            const j = (i + 1) % polygon.length;
            area += polygon[i].x * polygon[j].y;
            area -= polygon[j].x * polygon[i].y;
        }
        return Math.abs(area) / 2;
    }

    /**
     * Calculate intersection area (simplified using point-in-polygon)
     * This is a simplified approach - for accurate results, you'd need proper polygon clipping
     */
    calculateIntersectionArea(poly1, poly2) {
        // For now, use a sampling approach
        // Sample points from both polygons and check if they're in the intersection
        
        // Get bounding box of both polygons
        const bounds = this.getPolygonBounds([...poly1, ...poly2]);
        
        // Sample grid points
        const sampleSize = 2; // pixels between samples
        let intersectionCount = 0;
        let totalSamples = 0;

        for (let x = bounds.minX; x <= bounds.maxX; x += sampleSize) {
            for (let y = bounds.minY; y <= bounds.maxY; y += sampleSize) {
                const point = { x, y };
                if (this.pointInPolygon(point, poly1) && this.pointInPolygon(point, poly2)) {
                    intersectionCount++;
                }
                totalSamples++;
            }
        }

        // Approximate the intersection area
        const totalArea = (bounds.maxX - bounds.minX) * (bounds.maxY - bounds.minY);
        return (intersectionCount / totalSamples) * totalArea;
    }

    /**
     * Get bounding box of polygon points
     */
    getPolygonBounds(points) {
        if (points.length === 0) {
            return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
        }

        let minX = points[0].x;
        let minY = points[0].y;
        let maxX = points[0].x;
        let maxY = points[0].y;

        for (const point of points) {
            minX = Math.min(minX, point.x);
            minY = Math.min(minY, point.y);
            maxX = Math.max(maxX, point.x);
            maxY = Math.max(maxY, point.y);
        }

        return { minX, minY, maxX, maxY };
    }

    /**
     * Check if a point is inside a polygon using ray casting algorithm
     */
    pointInPolygon(point, polygon) {
        if (!polygon || polygon.length < 3) return false;

        let inside = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const xi = polygon[i].x, yi = polygon[i].y;
            const xj = polygon[j].x, yj = polygon[j].y;

            const intersect = ((yi > point.y) !== (yj > point.y))
                && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }

        return inside;
    }
}

// Create singleton instance
export const similarityCalculatorService = new SimilarityCalculatorService();
