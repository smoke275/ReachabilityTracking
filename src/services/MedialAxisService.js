/**
 * MedialAxisService
 * Generates medial axis skeleton using Voronoi diagrams from polygon edge samples
 */
import * as turf from '@turf/turf';

export class MedialAxisService {
    constructor() {
        this.sampleDistance = 10; // Distance between samples along edges
        this.minDistance = 5; // Minimum distance to avoid duplicate points
        this.reductionLevel = 0; // 0-100, how aggressively to reduce skeleton vertices
    }

    /**
     * Generate medial axis skeleton from polygons
     * @param {Array} polygons - Array of polygon objects with vertices
     * @param {Object} canvasBounds - Canvas bounds {width, height}
     * @returns {Object} - Skeleton data with points and edges
     */
    generateMedialAxis(polygons, canvasBounds) {
        if (!polygons || polygons.length === 0) {
            throw new Error('No polygons provided');
        }

        // Step 1: Sample points along all polygon edges
        const sampledPoints = this.samplePolygonEdges(polygons);
        
        if (sampledPoints.length < 3) {
            throw new Error('Not enough sample points to generate Voronoi diagram');
        }

        // Step 2: Create Voronoi diagram
        const voronoiData = this.createVoronoiDiagram(sampledPoints, canvasBounds);

        // Step 3: Filter skeleton points (vertices of Voronoi cells within hull and outside obstacles)
        let skeletonPoints = this.extractSkeletonPoints(voronoiData, sampledPoints, polygons);

        // Step 4: Keep only Voronoi edges between retained skeleton vertices
        let skeletonEdges = this.createSkeletonEdgesFromVoronoi(skeletonPoints, voronoiData);

        // Step 5: Minimize degree-2 vertices (angular reduction) without losing connectivity
        const simplified = this.simplifyDegree2Skeleton(skeletonPoints, skeletonEdges);
        skeletonPoints = simplified.points;
        skeletonEdges = simplified.edges;

        return {
            points: skeletonPoints,
            edges: skeletonEdges,
            voronoi: voronoiData,
            samplePoints: sampledPoints,
            pointCount: skeletonPoints.length,
            edgeCount: skeletonEdges.length
        };
    }

    /**
     * Sample points along polygon edges
     * @param {Array} polygons - Array of polygon objects
     * @returns {Array} - Array of sampled point coordinates
     */
    samplePolygonEdges(polygons) {
        const allPoints = [];
        const pointSet = new Set();

        polygons.forEach(polygon => {
            const vertices = polygon.vertices || polygon.points;
            
            for (let i = 0; i < vertices.length; i++) {
                const start = vertices[i];
                const end = vertices[(i + 1) % vertices.length];

                // Sample points along this edge
                const edgePoints = this.sampleEdge(start, end);
                
                edgePoints.forEach(point => {
                    // Create a unique key for this point location
                    const key = `${Math.round(point.x / this.minDistance)}_${Math.round(point.y / this.minDistance)}`;
                    
                    // Only add if we haven't seen this location before
                    if (!pointSet.has(key)) {
                        pointSet.add(key);
                        allPoints.push(point);
                    }
                });
            }
        });

        console.log('Sample points generated:', {
            totalPoints: allPoints.length,
            minX: Math.min(...allPoints.map(p => p.x)),
            maxX: Math.max(...allPoints.map(p => p.x)),
            minY: Math.min(...allPoints.map(p => p.y)),
            maxY: Math.max(...allPoints.map(p => p.y))
        });

        return allPoints;
    }    /**
     * Sample points along a single edge
     * @param {Object} start - Start point {x, y}
     * @param {Object} end - End point {x, y}
     * @returns {Array} - Array of sampled points
     */
    sampleEdge(start, end) {
        const points = [];
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        
        if (length === 0) return [];

        // Calculate number of samples based on edge length
        const numSamples = Math.ceil(length / this.sampleDistance);
        
        for (let i = 0; i <= numSamples; i++) {
            const t = i / numSamples;
            points.push({
                x: start.x + dx * t,
                y: start.y + dy * t
            });
        }

        return points;
    }

    /**
     * Create Voronoi diagram using Turf.js
     * @param {Array} points - Array of sample points
     * @param {Object} bounds - Canvas bounds
     * @returns {Object} - Voronoi diagram data
     */
    createVoronoiDiagram(points, bounds) {
        // Convert points to GeoJSON feature collection
        const features = points.map(pt => turf.point([pt.x, pt.y]));
        const pointsCollection = turf.featureCollection(features);

        // Determine bbox from provided bounds (supports world-space)
        // Fallback to 0..width/height for older callers
        const hasWorld = typeof bounds?.minX === 'number' && typeof bounds?.minY === 'number' && typeof bounds?.maxX === 'number' && typeof bounds?.maxY === 'number';
        const bbox = hasWorld
            ? [bounds.minX, bounds.minY, bounds.maxX, bounds.maxY]
            : [0, 0, bounds.width, bounds.height];

        console.log('Creating Voronoi with:', {
            pointCount: points.length,
            bbox: bbox,
            canvasBounds: bounds
        });

        try {
            // Generate Voronoi diagram
            const voronoiPolygons = turf.voronoi(pointsCollection, { bbox });

            console.log('Voronoi cells generated:', voronoiPolygons.features.length);

            return {
                polygons: voronoiPolygons,
                bbox: bbox
            };
        } catch (error) {
            console.error('Error creating Voronoi diagram:', error);
            throw new Error('Failed to create Voronoi diagram: ' + error.message);
        }
    }

    /**
     * Extract skeleton points from Voronoi diagram
     * @param {Object} voronoiData - Voronoi diagram data
     * @param {Array} samplePoints - Original sample points
     * @param {Array} polygons - Original polygons to filter against
     * @returns {Array} - Filtered skeleton points
     */
    extractSkeletonPoints(voronoiData, samplePoints, polygons) {
        const skeletonPoints = [];
        const pointSet = new Set();

        if (!voronoiData.polygons || !voronoiData.polygons.features) {
            return [];
        }

        // Prepare geometry for filters
        const hull = this.computeConvexHullFromPolygons(polygons);
        const polygonFeatures = this.polygonsToTurf(polygons);

        // Extract ALL vertices from Voronoi cells, then filter
        voronoiData.polygons.features.forEach(feature => {
            if (feature.geometry && feature.geometry.coordinates) {
                const coordinates = feature.geometry.coordinates[0]; // Polygon exterior ring
                
                coordinates.forEach(coord => {
                    const point = { x: coord[0], y: coord[1] };
                    const key = `${Math.round(point.x)}_${Math.round(point.y)}`;
                    if (pointSet.has(key)) return;

                    const turfPoint = turf.point([point.x, point.y]);

                    // 1) Must be inside convex hull (if available)
                    if (hull) {
                        const inHull = turf.booleanPointInPolygon(turfPoint, hull, { ignoreBoundary: false });
                        if (!inHull) return; // outside hull -> drop
                    }

                    // 2) Must NOT be inside any polygon (treat boundary as outside for this test)
                    let insideAny = false;
                    for (const poly of polygonFeatures) {
                        if (turf.booleanPointInPolygon(turfPoint, poly, { ignoreBoundary: true })) {
                            insideAny = true;
                            break;
                        }
                    }
                    if (insideAny) return; // inside obstacle -> drop

                    pointSet.add(key);
                    skeletonPoints.push(point);
                });
            }
        });

        return skeletonPoints;
    }

    /**
     * Convert app polygons to Turf.js Polygon features
     */
    polygonsToTurf(polygons) {
        return polygons.map(p => {
            const ring = p.vertices.map(v => [v.x, v.y]);
            // Ensure closed ring
            if (ring.length > 0) {
                const first = ring[0];
                const last = ring[ring.length - 1];
                if (first[0] !== last[0] || first[1] !== last[1]) {
                    ring.push([first[0], first[1]]);
                }
            }
            return turf.polygon([ring]);
        });
    }

    /**
     * Compute convex hull polygon from all vertices across all polygons
     * Returns a Turf.js Polygon feature or null if not enough points
     */
    computeConvexHullFromPolygons(polygons) {
        const pts = [];
        polygons.forEach(p => {
            (p.vertices || p.points || []).forEach(v => pts.push(turf.point([v.x, v.y])));
        });
        if (pts.length < 3) return null;
        const fc = turf.featureCollection(pts);
        const hull = turf.convex(fc);
        return hull || null;
    }

    /**
     * Calculate distance to nearest point in a set
     * @param {Object} point - Point to measure from
     * @param {Array} points - Array of points
     * @returns {number} - Distance to nearest point
     */
    distanceToNearestPoint(point, points) {
        let minDist = Infinity;
        
        points.forEach(p => {
            const dist = Math.sqrt((point.x - p.x) ** 2 + (point.y - p.y) ** 2);
            if (dist < minDist) {
                minDist = dist;
            }
        });

        return minDist;
    }

    /**
     * Create skeleton edges directly from Voronoi polygon borders.
     * Keeps only segments whose endpoints are both retained skeleton vertices.
     * @param {Array} skeletonPoints - Filtered Voronoi vertices
     * @param {Object} voronoiData - Voronoi polygons FeatureCollection
     * @returns {Array} - Array of edges { start: {x,y}, end: {x,y} }
     */
    createSkeletonEdgesFromVoronoi(skeletonPoints, voronoiData) {
        const edges = [];
        const edgeSet = new Set();
        const vset = new Set(skeletonPoints.map(p => `${Math.round(p.x)}_${Math.round(p.y)}`));

        if (!voronoiData?.polygons?.features?.length) return edges;

        const addEdge = (a, b) => {
            const ka = `${Math.round(a.x)}_${Math.round(a.y)}`;
            const kb = `${Math.round(b.x)}_${Math.round(b.y)}`;
            if (!vset.has(ka) || !vset.has(kb)) return; // endpoints must be retained vertices
            // undirected unique key
            const key = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
            if (edgeSet.has(key)) return;
            edgeSet.add(key);
            edges.push({ start: a, end: b });
        };

        voronoiData.polygons.features.forEach(feature => {
            const geom = feature.geometry;
            if (!geom || !geom.coordinates) return;
            // Iterate all rings (first is exterior, others are holes if present)
            geom.coordinates.forEach(ringCoords => {
                if (!Array.isArray(ringCoords) || ringCoords.length < 2) return;
                for (let i = 0; i < ringCoords.length - 1; i++) {
                    const a = { x: ringCoords[i][0], y: ringCoords[i][1] };
                    const b = { x: ringCoords[i + 1][0], y: ringCoords[i + 1][1] };
                    addEdge(a, b);
                }
                // Close ring if not already closed
                const first = ringCoords[0];
                const last = ringCoords[ringCoords.length - 1];
                if (first[0] !== last[0] || first[1] !== last[1]) {
                    const a = { x: last[0], y: last[1] };
                    const b = { x: first[0], y: first[1] };
                    addEdge(a, b);
                }
            });
        });

        return edges;
    }

    /**
     * Reduce skeleton vertices based on reductionLevel by clustering
     * nearby vertices within a radius. Keeps the first encountered vertex in a cluster.
     * @param {Array<{x:number,y:number}>} points
     * @returns {Array<{x:number,y:number}>}
     */
    reduceSkeletonVertices(points) {
        const level = Math.max(0, Math.min(100, this.reductionLevel || 0));
        if (level <= 0 || points.length <= 1) return points;

        // Map level (0..100) to pixel radius (e.g., 0..25px)
        const radius = (level / 100) * 25;
        const radius2 = radius * radius;

        const kept = [];
        // Simple greedy clustering
        points.forEach(p => {
            for (let i = 0; i < kept.length; i++) {
                const q = kept[i];
                const dx = p.x - q.x;
                const dy = p.y - q.y;
                if (dx * dx + dy * dy <= radius2) {
                    return; // too close to an existing kept vertex -> drop p
                }
            }
            kept.push(p);
        });
        return kept;
    }

    /**
     * Set the vertex reduction level (0-100)
     */
    setReductionLevel(level) {
        this.reductionLevel = Math.max(0, Math.min(100, Number(level) || 0));
    }

    /**
     * Get the vertex reduction level
     */
    getReductionLevel() {
        return this.reductionLevel || 0;
    }

    /**
     * Set sample distance for edge sampling
     * @param {number} distance - Distance between samples
     */
    setSampleDistance(distance) {
        this.sampleDistance = Math.max(5, distance);
    }

    /**
     * Get current sample distance
     * @returns {number} - Current sample distance
     */
    getSampleDistance() {
        return this.sampleDistance;
    }

    /**
     * Cluster vertices within a radius determined by reductionLevel and
     * rebuild edges to connect cluster representatives. Prevents connection loss.
     * @param {Array<{x:number,y:number}>} points
     * @param {Array<{start:{x:number,y:number}, end:{x:number,y:number}}>} edges
     * @returns {{points:Array, edges:Array}}
     */
    clusterSkeletonGraph(points, edges) {
        const level = Math.max(0, Math.min(100, this.reductionLevel || 0));
        if (level <= 0 || !points || points.length === 0) {
            return { points: points || [], edges: edges || [] };
        }

        // Map level (0..100) to pixel radius (e.g., 0..20px)
        const radius = (level / 100) * 20;
        const r2 = radius * radius;

        const reps = [];
        const repKeys = [];
        const pKey = (p) => `${Math.round(p.x)}_${Math.round(p.y)}`;

        // Greedy clustering: choose first as rep, merge subsequent within radius
        const mapToRep = new Map(); // original key -> rep index
        points.forEach(p => {
            let assigned = -1;
            for (let i = 0; i < reps.length; i++) {
                const q = reps[i];
                const dx = p.x - q.x; const dy = p.y - q.y;
                if (dx * dx + dy * dy <= r2) { assigned = i; break; }
            }
            if (assigned === -1) {
                reps.push({ x: p.x, y: p.y });
                repKeys.push(pKey(p));
                assigned = reps.length - 1;
            }
            mapToRep.set(pKey(p), assigned);
        });

        // Remap edges to rep indices
        const edgeSet = new Set();
        const newEdges = [];
        const keyForIdx = (i) => repKeys[i] || pKey(reps[i]);

        (edges || []).forEach(e => {
            const ks = pKey(e.start), ke = pKey(e.end);
            const is = mapToRep.has(ks) ? mapToRep.get(ks) : (function(){
                // if a point appears only in edges, add it as its own rep
                reps.push({ x: e.start.x, y: e.start.y });
                const idx = reps.length - 1; repKeys.push(ks); mapToRep.set(ks, idx); return idx;
            })();
            const ie = mapToRep.has(ke) ? mapToRep.get(ke) : (function(){
                reps.push({ x: e.end.x, y: e.end.y });
                const idx = reps.length - 1; repKeys.push(ke); mapToRep.set(ke, idx); return idx;
            })();
            if (is === ie) return; // skip loops
            const a = Math.min(is, ie), b = Math.max(is, ie);
            const ek = `${a}|${b}`;
            if (edgeSet.has(ek)) return;
            edgeSet.add(ek);
            newEdges.push({ start: reps[a], end: reps[b] });
        });

        // Keep only representative points that are used by at least one edge
        const used = new Set();
        newEdges.forEach(e => { used.add(pKey(e.start)); used.add(pKey(e.end)); });
        const newPoints = reps.filter(p => used.has(pKey(p)));

        return { points: newPoints, edges: newEdges };
    }

    /**
     * Simplify skeleton by removing degree-2 vertices, merging their two incident
     * edges when the turn angle is within a tolerance derived from reductionLevel.
     * - reductionLevel 0 => no simplification
     * - 100 => allow up to ~45° deviation from straight when collapsing
     * @param {Array<{x:number,y:number}>} points
     * @param {Array<{start:{x:number,y:number}, end:{x:number,y:number}}} edges
     * @returns {{points:Array, edges:Array}}
     */
    simplifyDegree2Skeleton(points, edges) {
        const level = Math.max(0, Math.min(100, this.reductionLevel || 0));
        if (level === 0 || !edges || edges.length === 0) {
            return { points, edges };
        }

        // Helper key functions
        const pKey = (p) => `${Math.round(p.x)}_${Math.round(p.y)}`;
        const keyToPoint = new Map();
        // Seed with provided points
        (points || []).forEach(p => keyToPoint.set(pKey(p), { x: p.x, y: p.y }));
        // Ensure endpoints of edges are present
        edges.forEach(e => {
            const ks = pKey(e.start), ke = pKey(e.end);
            if (!keyToPoint.has(ks)) keyToPoint.set(ks, { x: e.start.x, y: e.start.y });
            if (!keyToPoint.has(ke)) keyToPoint.set(ke, { x: e.end.x, y: e.end.y });
        });

        // Build adjacency
        const neighbors = new Map(); // key -> Set(keys)
        const edgeSet = new Set();   // undirected keys 'a|b' sorted
        const addNeighbor = (ka, kb) => {
            if (ka === kb) return;
            const a = neighbors.get(ka) || new Set();
            a.add(kb);
            neighbors.set(ka, a);
            const b = neighbors.get(kb) || new Set();
            b.add(ka);
            neighbors.set(kb, b);
            const edgeKey = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
            edgeSet.add(edgeKey);
        };
        edges.forEach(e => addNeighbor(pKey(e.start), pKey(e.end)));

        // Angle tolerance: from 0 to 45 degrees based on level
        const tolDeg = (level / 100) * 45;
        const tolRad = (tolDeg * Math.PI) / 180;
        const maxPasses = Math.max(1, Math.ceil(level / 25));

        const angleOK = (k, ka, kb) => {
            const p = keyToPoint.get(k);
            const a = keyToPoint.get(ka);
            const b = keyToPoint.get(kb);
            const v1x = a.x - p.x, v1y = a.y - p.y;
            const v2x = b.x - p.x, v2y = b.y - p.y;
            const n1 = Math.hypot(v1x, v1y), n2 = Math.hypot(v2x, v2y);
            if (n1 === 0 || n2 === 0) return false;
            const dot = (v1x * v2x + v1y * v2y) / (n1 * n2);
            const clamped = Math.max(-1, Math.min(1, dot));
            const angle = Math.acos(clamped); // angle at vertex p between neighbors
            // For a straight line, angle ~ pi. We accept if (pi - angle) <= tol
            return (Math.PI - angle) <= tolRad;
        };

        const removeEdge = (ka, kb) => {
            const edgeKey = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
            edgeSet.delete(edgeKey);
            const na = neighbors.get(ka); if (na) na.delete(kb);
            const nb = neighbors.get(kb); if (nb) nb.delete(ka);
        };
        const addEdge = (ka, kb) => {
            if (ka === kb) return;
            const edgeKey = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
            if (edgeSet.has(edgeKey)) return;
            const na = neighbors.get(ka) || new Set(); na.add(kb); neighbors.set(ka, na);
            const nb = neighbors.get(kb) || new Set(); nb.add(ka); neighbors.set(kb, nb);
            edgeSet.add(edgeKey);
        };

        let changed = false;
        for (let pass = 0; pass < maxPasses; pass++) {
            let passChanged = false;
            // Collect candidates to avoid modifying while iterating
            const candidates = [];
            neighbors.forEach((nbrs, k) => {
                if (nbrs.size === 2) {
                    const arr = Array.from(nbrs);
                    if (angleOK(k, arr[0], arr[1])) {
                        candidates.push({ k, a: arr[0], b: arr[1] });
                    }
                }
            });

            if (candidates.length === 0) break;

            candidates.forEach(({ k, a, b }) => {
                // Re-validate degrees as graph might have changed
                const nbrs = neighbors.get(k);
                if (!nbrs || nbrs.size !== 2) return;
                if (!neighbors.get(a)?.has(k) || !neighbors.get(b)?.has(k)) return;
                if (!angleOK(k, a, b)) return;
                // Remove edges (a-k) and (k-b), then add (a-b)
                removeEdge(a, k);
                removeEdge(k, b);
                addEdge(a, b);
                // Remove k from neighbors map
                neighbors.delete(k);
                passChanged = true;
            });

            changed = changed || passChanged;
            if (!passChanged) break;
        }

        if (!changed) {
            // Nothing changed
            return { points, edges };
        }

        // Build final edges array and point list from edgeSet
        const newEdges = [];
        const usedKeys = new Set();
        edgeSet.forEach(edgeKey => {
            const [ka, kb] = edgeKey.split('|');
            const a = keyToPoint.get(ka);
            const b = keyToPoint.get(kb);
            if (!a || !b) return;
            newEdges.push({ start: { x: a.x, y: a.y }, end: { x: b.x, y: b.y } });
            usedKeys.add(ka); usedKeys.add(kb);
        });
        const newPoints = Array.from(usedKeys).map(k => keyToPoint.get(k));

        return { points: newPoints, edges: newEdges };
    }
}
