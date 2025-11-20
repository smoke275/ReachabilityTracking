/**
 * VisibilityService
 * Computes visibility polygon from a point given polygon obstacles and bounds.
 * Algorithm: radial sweep of rays to all obstacle vertices (with epsilon offsets).
 */
import * as turf from '@turf/turf';

export class VisibilityService {
    constructor() {
        this.segmentEpsilon = 1e-9;
    }

    computeVisibility(point, polygons, bounds) {
        if (!point) return [];
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

        // Collect unique target angles to all vertices
        const angles = new Set();
        const vertices = [];
        for (const s of segments) {
            vertices.push(s.a, s.b);
        }
        for (const v of vertices) {
            const ang = Math.atan2(v.y - point.y, v.x - point.x);
            // Add small offsets to catch around corners
            angles.add(ang - 1e-7);
            angles.add(ang);
            angles.add(ang + 1e-7);
        }
        const sorted = Array.from(angles).sort((a,b)=>a-b);

        // For each angle, cast a ray and find closest intersection
        const intersections = [];
        for (const ang of sorted) {
            const dx = Math.cos(ang), dy = Math.sin(ang);
            let minT = Infinity;
            let ix = 0, iy = 0;
            for (const seg of segments) {
                const res = this.raySegmentIntersect(point.x, point.y, dx, dy, seg.a.x, seg.a.y, seg.b.x, seg.b.y);
                if (res && res.t >= 0 && res.u >= 0 && res.u <= 1 && res.t < minT) {
                    minT = res.t;
                    ix = res.x; iy = res.y;
                }
            }
            if (minT < Infinity) intersections.push({ angle: ang, x: ix, y: iy });
        }
        // Deduplicate near-identical consecutive points
        const result = [];
        for (let i = 0; i < intersections.length; i++) {
            const p = intersections[i];
            if (result.length === 0) {
                result.push({ x: p.x, y: p.y });
            } else {
                const q = result[result.length - 1];
                if ((p.x - q.x)**2 + (p.y - q.y)**2 > 1e-12) {
                    result.push({ x: p.x, y: p.y });
                }
            }
        }
        // Close polygon if first/last nearly identical
        if (result.length > 2) {
            const first = result[0], last = result[result.length-1];
            if ((first.x - last.x)**2 + (first.y - last.y)**2 < 1e-12) {
                result.pop();
            }
        }
        return result;
    }

    // Robust 2D ray (p + t*r, t>=0) vs segment (q + u*s, 0<=u<=1)
    raySegmentIntersect(px, py, rdx, rdy, x1, y1, x2, y2) {
        const rx = rdx, ry = rdy;
        const sx = x2 - x1, sy = y2 - y1;
        const qpx = x1 - px, qpy = y1 - py;
        const cross = (ax, ay, bx, by) => ax * by - ay * bx;
        const den = cross(rx, ry, sx, sy);
        if (Math.abs(den) < this.segmentEpsilon) return null; // parallel or collinear
        const t = cross(qpx, qpy, sx, sy) / den;
        const u = cross(qpx, qpy, rx, ry) / den;
        return { t, u, x: px + rx * t, y: py + ry * t };
    }

    /**
     * Compute the difference between two visibility polygons using Turf.js
     * Returns endPoly - startPoly (areas visible from end but not from start)
     * @param {Array} startPoly - Array of {x, y} points
     * @param {Array} endPoly - Array of {x, y} points
     * @returns {Array} Array of polygons representing the difference
     */
    computeVisibilityDifference(startPoly, endPoly) {
        if (!startPoly || startPoly.length < 3 || !endPoly || endPoly.length < 3) {
            return [];
        }

        try {
            // Convert to Turf.js format: [lon, lat] coordinates, closed ring
            const startCoords = startPoly.map(p => [p.x, p.y]);
            startCoords.push(startCoords[0]); // Close the ring
            const endCoords = endPoly.map(p => [p.x, p.y]);
            endCoords.push(endCoords[0]); // Close the ring

            // Create Turf.js polygons
            const startTurfPoly = turf.polygon([startCoords]);
            const endTurfPoly = turf.polygon([endCoords]);

            // Compute difference: areas in end but not in start
            const difference = turf.difference(turf.featureCollection([endTurfPoly, startTurfPoly]));

            if (!difference) {
                return [];
            }

            // Convert back to our format
            const result = [];
            if (difference.geometry.type === 'Polygon') {
                // Single polygon result
                const coords = difference.geometry.coordinates[0];
                result.push(coords.slice(0, -1).map(c => ({ x: c[0], y: c[1] })));
            } else if (difference.geometry.type === 'MultiPolygon') {
                // Multiple polygons result
                for (const poly of difference.geometry.coordinates) {
                    const coords = poly[0];
                    result.push(coords.slice(0, -1).map(c => ({ x: c[0], y: c[1] })));
                }
            }

            return result;
        } catch (error) {
            console.warn('Error computing visibility difference:', error);
            return [];
        }
    }

    /**
     * Filter difference polygons by ray casting from a point
     * Shoots rays in 360 degrees and keeps only the closest polygon hit by each ray
     * @param {Array} differencePolygons - Array of polygons (each polygon is an array of {x, y})
     * @param {Object} endPoint - Point {x, y} to shoot rays from
     * @param {number} numRays - Number of rays to cast (default 360)
     * @returns {Array} Filtered array of polygons (only those hit first by rays)
     */
    filterDifferenceByRayCast(differencePolygons, endPoint, numRays = 360) {
        if (!differencePolygons || differencePolygons.length === 0 || !endPoint) {
            return [];
        }

        // If only one polygon, return it as-is
        if (differencePolygons.length === 1) {
            return differencePolygons;
        }

        // Track which polygons are hit first by any ray
        const firstHitPolygons = new Set();

        // Cast rays in all directions
        for (let i = 0; i < numRays; i++) {
            const angle = (i / numRays) * Math.PI * 2;
            const dx = Math.cos(angle);
            const dy = Math.sin(angle);

            let minDistance = Infinity;
            let closestPolyIndex = -1;

            // Check intersection with each polygon
            differencePolygons.forEach((poly, polyIndex) => {
                if (poly.length < 3) return;

                // Check each edge of the polygon
                for (let j = 0; j < poly.length; j++) {
                    const v1 = poly[j];
                    const v2 = poly[(j + 1) % poly.length];

                    const result = this.raySegmentIntersect(
                        endPoint.x, endPoint.y, dx, dy,
                        v1.x, v1.y, v2.x, v2.y
                    );

                    if (result && result.t > 0 && result.u >= 0 && result.u <= 1) {
                        if (result.t < minDistance) {
                            minDistance = result.t;
                            closestPolyIndex = polyIndex;
                        }
                    }
                }
            });

            // Mark the closest polygon as a first-hit
            if (closestPolyIndex >= 0) {
                firstHitPolygons.add(closestPolyIndex);
            }
        }

        // Return only polygons that were hit first by at least one ray
        return differencePolygons.filter((_, index) => firstHitPolygons.has(index));
    }
}

export default VisibilityService;
