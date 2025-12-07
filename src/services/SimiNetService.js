/**
 * SimiNetService
 * Generates training data for SimiNet (Similarity Network).
 * Generates pairs of points, computes their visibility polygons,
 * and calculates the Monte Carlo similarity between them.
 */

import { eventBus } from '../utils/EventBus.js';
import { visibilnetService } from './VisibilNetService.js';
import { similarityCalculatorService } from './SimilarityCalculatorService.js';
import * as tf from '@tensorflow/tfjs';

// Define custom layer for Signed Difference (to preserve directionality)
class DiffLayer extends tf.layers.Layer {
    constructor(config) {
        super(config || {});
    }

    computeOutputShape(inputShape) {
        return inputShape[0];
    }

    call(inputs) {
        return tf.tidy(() => {
            const [a, b] = inputs;
            return tf.sub(a, b);
        });
    }

    static get className() {
        return 'DiffLayer';
    }
}
tf.serialization.registerClass(DiffLayer);

class GeometricFeaturesLayer extends tf.layers.Layer {
    constructor(config) {
        super(config || {});
    }

    computeOutputShape(inputShape) {
        // inputShape is [batch, 2] for both inputs
        // Output is [batch, 4] (dist, angle, diffX, diffY)
        return [inputShape[0][0], 4];
    }

    call(inputs) {
        return tf.tidy(() => {
            const [a, b] = inputs;
            // 1. Cartesian Difference
            // a, b are [-1, 1]. diff is [-2, 2].
            const diff = tf.sub(b, a);
            // Normalize to [-1, 1]
            const diffNorm = tf.div(diff, 2.0);
            
            // 2. Euclidean Distance
            // Max dist in [-1, 1] square is sqrt(2^2 + 2^2) = 2.828
            const dist = tf.norm(diff, 'euclidean', -1, true);
            const distNorm = tf.div(dist, 2.828);
            
            // 3. Angle
            // atan2(y, x) -> [-PI, PI]
            const dy = tf.slice(diff, [0, 1], [-1, 1]);
            const dx = tf.slice(diff, [0, 0], [-1, 1]);
            const angle = tf.atan2(dy, dx);
            const angleNorm = tf.div(angle, Math.PI); // [-1, 1]
            
            return tf.concat([distNorm, angleNorm, diffNorm], -1);
        });
    }

    static get className() {
        return 'GeometricFeaturesLayer';
    }
}
tf.serialization.registerClass(GeometricFeaturesLayer);

export class SimiNetService {
    constructor() {
        this.polygons = [];
        this.bounds = null;
        this.trainingData = [];
        this.isGenerating = false;
        this.shouldStop = false;
        this.convexHull = null; // Convex hull of the environment
    }

    setEnvironment(polygons, bounds) {
        this.polygons = polygons;
        this.convexHull = null; // Reset hull when environment changes
        // Normalize bounds to minX, maxX, minY, maxY
        if (bounds) {
            this.bounds = {
                minX: bounds.minX !== undefined ? bounds.minX : bounds.x_min,
                maxX: bounds.maxX !== undefined ? bounds.maxX : bounds.x_max,
                minY: bounds.minY !== undefined ? bounds.minY : bounds.y_min,
                maxY: bounds.maxY !== undefined ? bounds.maxY : bounds.y_max
            };
        } else {
            this.bounds = null;
        }
    }

    /**
     * Generate training data
     * @param {number} count - Number of samples to generate
     * @param {number} numRays - Number of rays for visibility computation
     */
    async generateData(count, numRays = 36) {
        if (!this.polygons || this.polygons.length === 0) {
            console.error('No environment set for SimiNet data generation');
            return;
        }

        this.isGenerating = true;
        this.shouldStop = false;
        let generatedCount = 0;
        let zeroSimilarityCount = 0;
        const maxZeroPercent = 0.05;
        let nonLOSCount = 0;
        const maxNonLOSPercent = 0.40; // At least 60% must have LOS

        console.log(`Starting SimiNet data generation: ${count} samples`);

        while (generatedCount < count && !this.shouldStop) {
            // 1. Generate two random valid points
            const p1 = this.getRandomPoint();
            const p2 = this.getRandomPoint();

            if (!p1 || !p2) continue;

            // Check Line of Sight
            const hasLOS = this.hasLineOfSight(p1, p2);
            
            if (!hasLOS) {
                // If we haven't generated any samples yet, we must reject non-LOS ones
                // to ensure we start with good data or at least don't violate the ratio immediately
                if (generatedCount === 0 || (nonLOSCount + 2) / (generatedCount + 2) > maxNonLOSPercent) {
                    continue;
                }
            }

            // 2. Compute visibility polygons (using ray-based method as requested)
            const poly1 = visibilnetService.computeRayBasedVisibility(p1, this.polygons, this.bounds, numRays);
            const poly2 = visibilnetService.computeRayBasedVisibility(p2, this.polygons, this.bounds, numRays);

            // 3. Calculate MC Similarity
            // We need to use the similarity service's logic but adapted for direct use
            // Or we can use the service if it exposes a direct method.
            // Looking at SimilarityCalculatorService, calculateSimilarity is instance method.
            // We can instantiate a temporary observer object structure to pass to it.
            
            const obs1 = { x: p1.x, y: p1.y, polygon: poly1 };
            const obs2 = { x: p2.x, y: p2.y, polygon: poly2 };

            // We need a way to get the result synchronously or via promise
            // Since SimilarityCalculatorService uses events, we might want to extract the logic
            // or add a direct method to it. 
            // For now, let's implement a local MC calculation to avoid event overhead in a loop
            
            const mcResult1 = this.calculateMCSimilarity(poly1, poly2, 2000, this.bounds);
            const mcResult2 = this.calculateMCSimilarity(poly2, poly1, 2000, this.bounds);

            // Check if we should accept this sample based on zero similarity threshold
            const isZero = (mcResult1 === 0 && mcResult2 === 0);
            
            if (isZero) {
                // Check if adding 2 zero samples would exceed the limit
                // If we haven't generated any samples yet, we must reject zero similarity ones
                // to avoid division by zero or starting with 100% zero similarity
                if (generatedCount === 0 || (zeroSimilarityCount + 2) / (generatedCount + 2) > maxZeroPercent) {
                    continue;
                }
                zeroSimilarityCount += 2;
            }
            
            if (!hasLOS) {
                nonLOSCount += 2;
            }

            // 4. Store data
            // Format: { p1: {x,y}, p2: {x,y}, s12: float, s21: float }
            // The user requested: a,b,s(a,b) and b,a,s(b,a)
            
            this.trainingData.push({
                p1: p1,
                p2: p2,
                similarity: mcResult1
            });
            
            this.trainingData.push({
                p1: p2,
                p2: p1,
                similarity: mcResult2
            });

            generatedCount += 2; // We added two samples

            // Yield to UI every 10 samples
            if (generatedCount % 10 === 0) {
                eventBus.emit('siminet:generationProgress', { 
                    current: generatedCount, 
                    total: count 
                });
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }

        this.isGenerating = false;
        eventBus.emit('siminet:generationComplete', { count: this.trainingData.length });
        console.log(`SimiNet data generation complete. Total samples: ${this.trainingData.length}`);
    }

    stopGeneration() {
        this.shouldStop = true;
    }

    clearData() {
        this.trainingData = [];
        eventBus.emit('siminet:dataCleared');
    }

    saveData() {
        if (this.trainingData.length === 0) {
            console.warn('No training data to save');
            return;
        }
        
        // Save with metadata including bounds for correct normalization later
        const exportData = {
            timestamp: new Date().toISOString(),
            bounds: this.bounds,
            sampleCount: this.trainingData.length,
            samples: this.trainingData
        };
        
        const dataStr = JSON.stringify(exportData, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `siminet_training_data_${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    loadData(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    
                    // Handle legacy array format
                    if (Array.isArray(data)) {
                        this.trainingData = data;
                        console.warn('Loaded legacy data format (no bounds). Using current environment bounds.');
                        this.dataBounds = null;
                        eventBus.emit('siminet:dataLoaded', { count: this.trainingData.length });
                        resolve(this.trainingData);
                    } 
                    // Handle new object format with metadata
                    else if (data.samples && Array.isArray(data.samples)) {
                        this.trainingData = data.samples;
                        
                        // Store bounds from data to ensure correct normalization during training
                        // even if the current environment has changed
                        if (data.bounds) {
                            this.dataBounds = data.bounds;
                            console.log('Loaded data bounds:', this.dataBounds);
                        } else {
                            this.dataBounds = null;
                        }
                        
                        eventBus.emit('siminet:dataLoaded', { count: this.trainingData.length });
                        resolve(this.trainingData);
                    } else {
                        reject(new Error('Invalid data format: expected array or object with samples array'));
                    }
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = () => reject(new Error('File read error'));
            reader.readAsText(file);
        });
    }

    async loadBackbone(files) {
        console.log('Step 1: loadBackbone called with', files.length, 'files');
        
        if (!files || files.length === 0) {
            throw new Error('No files selected');
        }

        // Log file names for debugging
        const fileNames = Array.from(files).map(f => f.name);
        console.log('Selected files:', fileNames);

        // Check if model.json is present
        // Prioritize files that don't have "params" in the name to avoid picking up the metadata file
        let jsonFile = Array.from(files).find(f => f.name.endsWith('.json') && !f.name.includes('params'));
        
        // Fallback: if no non-params json file found, just take the first json file
        if (!jsonFile) {
            jsonFile = Array.from(files).find(f => f.name.endsWith('.json'));
        }

        if (!jsonFile) {
            throw new Error('Missing model.json file. Please select both the JSON model file and the binary weight files.');
        }
        console.log('Step 2: Identified model file:', jsonFile.name);

        // Check for params file
        const paramsFile = Array.from(files).find(f => f.name.includes('params') && f.name.endsWith('.json'));
        if (paramsFile) {
            try {
                const text = await paramsFile.text();
                const params = JSON.parse(text);
                if (params.normalizationParams) {
                    this.backboneNormalizationParams = params.normalizationParams;
                    console.log('Loaded backbone normalization params:', this.backboneNormalizationParams);
                }
            } catch (e) {
                console.warn('Failed to load normalization params:', e);
            }
        } else {
            console.warn('No normalization params file found. Using default bounds.');
            this.backboneNormalizationParams = null;
        }

        try {
            // Dynamic import of TensorFlow.js
            console.log('Step 3: Importing TensorFlow.js...');
            const tf = await import('@tensorflow/tfjs');
            console.log('Step 4: TensorFlow.js imported');

            await tf.ready();
            console.log('Step 4.5: TensorFlow.js ready, backend:', tf.getBackend());

            // Pre-validate weight files
            try {
                const text = await jsonFile.text();
                const json = JSON.parse(text);
                if (json.weightsManifest) {
                    const expectedFiles = json.weightsManifest.flatMap(m => m.paths);
                    const missing = expectedFiles.filter(name => !fileNames.includes(name));
                    
                    if (missing.length > 0) {
                        throw new Error(`Missing weight files: ${missing.join(', ')}. \n\nExpected filenames: ${expectedFiles.join(', ')}\nSelected filenames: ${fileNames.join(', ')}\n\nNote: Filenames must match EXACTLY. If you renamed files (e.g. "model (1).json"), please rename them back.`);
                    }
                }
            } catch (e) {
                console.warn('Failed to validate weights manifest:', e);
                // Continue and let TFJS try to load, maybe it's a different format
            }
            console.log('Step 5: Validation passed');

            // Use tf.io.browserFiles to load from FileList
            // Convert FileList to Array as tf.io.browserFiles expects File[]
            // Filter files to include only the identified model.json and any binary files
            // This prevents TFJS from trying to load the params.json as the model
            // IMPORTANT: The JSON file MUST be first in the array for tf.io.browserFiles
            const binaryFiles = Array.from(files).filter(f => f.name.endsWith('.bin'));
            const modelFiles = [jsonFile, ...binaryFiles];
            
            console.log('Step 6: Loading model with files (ordered):', modelFiles.map(f => f.name));
            
            // Add a timeout to prevent infinite hanging
            const loadPromise = tf.loadLayersModel(tf.io.browserFiles(modelFiles));
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Model loading timed out after 30 seconds')), 30000)
            );
            
            this.backboneModel = await Promise.race([loadPromise, timeoutPromise]);
            
            console.log('Step 7: Backbone model loaded successfully');
            this.backboneModel.summary();
            
            return true;
        } catch (error) {
            console.error('Failed to load backbone model:', error);
            throw error; // Propagate error to UI
        }
    }

    getRandomPoint() {
        if (!this.bounds) return null;
        
        let p = null;
        let valid = false;
        let attempts = 0;
        
        while (!valid && attempts < 100) {
            const x = this.bounds.minX + Math.random() * (this.bounds.maxX - this.bounds.minX);
            const y = this.bounds.minY + Math.random() * (this.bounds.maxY - this.bounds.minY);
            p = { x, y };
            
            // Check 1: Must not be inside any obstacle
            if (this.isPointInObstacle(p)) {
                attempts++;
                continue;
            }

            // Check 2: Must be inside the convex hull of the environment
            // This ensures points are not in "dead space" outside the map layout
            if (!this.isPointInConvexHull(p)) {
                attempts++;
                continue;
            }

            valid = true;
        }
        
        return valid ? p : null;
    }

    isPointInConvexHull(point) {
        // If we don't have a hull calculated, calculate it once
        if (!this.convexHull) {
            this.calculateConvexHull();
        }
        
        if (!this.convexHull || this.convexHull.length < 3) return true; // Fallback if hull fails
        
        return this.pointInPolygon(point, this.convexHull);
    }

    calculateConvexHull() {
        // Collect all vertices from all polygons
        let points = [];
        for (const poly of this.polygons) {
            points.push(...poly.vertices);
        }
        
        if (points.length < 3) {
            this.convexHull = null;
            return;
        }
        
        // Graham scan or Monotone Chain algorithm
        points.sort((a, b) => a.x === b.x ? a.y - b.y : a.x - b.x);
        
        const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
        
        const lower = [];
        for (const p of points) {
            while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
                lower.pop();
            }
            lower.push(p);
        }
        
        const upper = [];
        for (let i = points.length - 1; i >= 0; i--) {
            const p = points[i];
            while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
                upper.pop();
            }
            upper.push(p);
        }
        
        upper.pop();
        lower.pop();
        this.convexHull = lower.concat(upper);
    }

    isPointInObstacle(point) {
        // Simple point-in-polygon check for all obstacles
        for (const poly of this.polygons) {
            if (this.pointInPolygon(point, poly.vertices)) {
                return true;
            }
        }
        return false;
    }

    pointInPolygon(point, vs) {
        let inside = false;
        for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
            const xi = vs[i].x, yi = vs[i].y;
            const xj = vs[j].x, yj = vs[j].y;
            
            const intersect = ((yi > point.y) !== (yj > point.y))
                && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    }

    hasLineOfSight(p1, p2) {
        for (const poly of this.polygons) {
            const v = poly.vertices;
            for (let i = 0; i < v.length; i++) {
                const a = v[i];
                const b = v[(i + 1) % v.length];
                if (this.segmentsIntersect(p1, p2, a, b)) {
                    return false;
                }
            }
        }
        return true;
    }

    segmentsIntersect(p1, p2, p3, p4) {
        const det = (p2.x - p1.x) * (p4.y - p3.y) - (p4.x - p3.x) * (p2.y - p1.y);
        if (det === 0) {
            return false;
        } else {
            const lambda = ((p4.y - p3.y) * (p4.x - p1.x) + (p3.x - p4.x) * (p4.y - p1.y)) / det;
            const gamma = ((p1.y - p2.y) * (p4.x - p1.x) + (p2.x - p1.x) * (p4.y - p1.y)) / det;
            return (0 < lambda && lambda < 1) && (0 < gamma && gamma < 1);
        }
    }

    /**
     * Calculate Monte Carlo Similarity S(a,b) = Area(Va ∩ Vb) / Area(Vb)
     * @param {Array} polyA - Vertices of visibility polygon A
     * @param {Array} polyB - Vertices of visibility polygon B
     * @param {number} samples - Number of MC samples
     * @param {Object} bounds - Bounding box for sampling
     */
    calculateMCSimilarity(polyA, polyB, samples, bounds) {
        // 1. Calculate Area(Vb) using standard polygon area formula
        const areaB = this.calculatePolygonArea(polyB);
        
        if (areaB <= 0) return 0;

        // 2. Generate random points inside Vb
        // To do this efficiently:
        // - Get bounding box of Vb
        // - Generate points in BB
        // - Check if in Vb
        // - If in Vb, check if in Va
        
        const bb = this.getPolygonBounds(polyB);
        let pointsInB = 0;
        let pointsInIntersection = 0;
        
        // We need exactly 'samples' points inside Vb to estimate the ratio correctly?
        // Actually, the formula is Area(Intersection) / Area(B).
        // MC estimation:
        // Generate N points inside Vb.
        // Count k points that are also in Va.
        // Ratio = k / N.
        // Since we are sampling uniformly from Vb, the probability of a point being in Va is Area(Va ∩ Vb) / Area(Vb).
        // So Similarity = k / N.
        
        // Rejection sampling to get points in Vb
        let attempts = 0;
        const maxAttempts = samples * 10; // Safety break
        
        while (pointsInB < samples && attempts < maxAttempts) {
            const x = bb.minX + Math.random() * (bb.maxX - bb.minX);
            const y = bb.minY + Math.random() * (bb.maxY - bb.minY);
            const p = { x, y };
            
            if (this.pointInPolygon(p, polyB)) {
                pointsInB++;
                if (this.pointInPolygon(p, polyA)) {
                    pointsInIntersection++;
                }
            }
            attempts++;
        }
        
        if (pointsInB === 0) return 0;
        
        return pointsInIntersection / pointsInB;
    }

    calculatePolygonArea(vertices) {
        let area = 0;
        for (let i = 0; i < vertices.length; i++) {
            const j = (i + 1) % vertices.length;
            area += vertices[i].x * vertices[j].y;
            area -= vertices[j].x * vertices[i].y;
        }
        return Math.abs(area) / 2;
    }

    getPolygonBounds(vertices) {
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const v of vertices) {
            minX = Math.min(minX, v.x);
            maxX = Math.max(maxX, v.x);
            minY = Math.min(minY, v.y);
            maxY = Math.max(maxY, v.y);
        }
        return { minX, maxX, minY, maxY };
    }

    // ============================================================================
    // Neural Network Implementation (Siamese Network with Shadow Net Backbone)
    // ============================================================================

    /**
     * Normalize coordinates to [-1, 1] range
     * @param {number} x 
     * @param {number} y 
     * @param {Object} [customBounds] - Optional bounds to use instead of current environment bounds
     * @returns {Array} [normX, normY]
     */
    normalizeCoordinates(x, y, customBounds = null) {
        // If we have backbone normalization params, use them to match VisibilNet exactly
        if (this.backboneNormalizationParams) {
            const { xMin, xMax, yMin, yMax } = this.backboneNormalizationParams;
            const xNorm = 2 * (x - xMin) / (xMax - xMin || 1) - 1;
            const yNorm = 2 * (y - yMin) / (yMax - yMin || 1) - 1;
            return [xNorm, yNorm];
        }

        // Fallback to environment bounds if no params loaded
        const bounds = customBounds || this.bounds;
        if (!bounds) return [0, 0];
        
        const width = bounds.maxX - bounds.minX;
        const height = bounds.maxY - bounds.minY;
        
        // Normalize to [0, 1]
        const nx = (x - bounds.minX) / width;
        const ny = (y - bounds.minY) / height;
        
        // Scale to [-1, 1] exactly as in VisibilNet
        return [nx * 2 - 1, ny * 2 - 1];
    }

    /**
     * Positional Encoding (Fourier Features) - Matches VisibilNet exactly
     * @param {number} x - Normalized x coordinate
     * @param {number} y - Normalized y coordinate
     * @returns {Array} Encoded vector of size 24 (6 frequencies * 4 components)
     */
    positionalEncoding(x, y) {
        const features = [];
        const numBands = 6; // Matches VisibilNet default
        
        for (let k = 0; k < numBands; k++) {
            const freq = Math.pow(2, k) * Math.PI;
            features.push(Math.sin(freq * x));
            features.push(Math.cos(freq * x));
            features.push(Math.sin(freq * y));
            features.push(Math.cos(freq * y));
        }
        
        return features; // Size: 24
    }

    /**
     * Create the Siamese Network Head
     * Uses the loaded backbone as a frozen feature extractor
     */
    async createSiameseModel() {
        if (!this.backboneModel) {
            console.error('Backbone model not loaded. Cannot create Siamese network.');
            return null;
        }

        const tf = await import('@tensorflow/tfjs');
        console.log('Creating Siamese Network...');

        // 1. Prepare the Backbone
        // We need to extract the penultimate layer (256 units)
        // Assuming the backbone structure matches the spec: 
        // Dense(256) -> Dense(512) -> Dense(512) -> Dense(256) -> Output
        
        // Find the layer with 256 units that is the feature vector
        // In a typical Keras model, we can look at layers by index or name.
        // If the user trained the backbone, they should have named the layer or we assume structure.
        // Let's assume the second to last dense layer is the one.
        
        // Freeze backbone layers
        for (const layer of this.backboneModel.layers) {
            layer.trainable = false;
        }

        // Get the feature layer. 
        // If the model was saved with the output layer, we want the output of the layer BEFORE the final one.
        // Let's try to find a layer with output shape [null, 256] that is deep in the network.
        let featureLayerIndex = this.backboneModel.layers.length - 2;
        
        // Create a new model that outputs the feature vector
        const backboneFeatures = tf.model({
            inputs: this.backboneModel.inputs,
            outputs: this.backboneModel.layers[featureLayerIndex].output,
            name: 'backbone_features_extractor'
        });

        // 2. Define Inputs
        // Input size is 24 (6 frequencies * 4 components)
        const inputA = tf.input({shape: [24]});
        const inputB = tf.input({shape: [24]});
        
        // Coordinate Inputs (Normalized [-1, 1])
        const coordInputA = tf.input({shape: [2]});
        const coordInputB = tf.input({shape: [2]});

        // 3. Feature Extraction
        const embedA = backboneFeatures.apply(inputA);
        const embedB = backboneFeatures.apply(inputB);

        // 4. Feature Engineering (Level 3 Features - 1073 dims)
        // Construct features: [input_a, input_b, embed_a * embed_b, abs(embed_a - embed_b), min, max, cos_sim]
        
        // Element-wise multiplication
        const multiply = tf.layers.multiply().apply([embedA, embedB]);
        
        // Signed difference: a - b
        // using custom DiffLayer
        const diff = new DiffLayer().apply([embedA, embedB]);
        
        // Minimum and Maximum
        const min = tf.layers.minimum().apply([embedA, embedB]);
        const max = tf.layers.maximum().apply([embedA, embedB]);
        
        // Cosine Similarity
        const cosSim = tf.layers.dot({axes: 1, normalize: true}).apply([embedA, embedB]);

        // Geometric Features
        const geometricFeatures = new GeometricFeaturesLayer().apply([coordInputA, coordInputB]);
        
        // Concatenate all features
        const concatenated = tf.layers.concatenate().apply([
            inputA, 
            inputB, 
            multiply, 
            diff, 
            min, 
            max, 
            cosSim,
            geometricFeatures
        ]);

        // 5. Head Architecture (The Comparator) - ResNet Style
        // 1. Initial Expansion
        let x = tf.layers.batchNormalization({name: 'head_bn_input'}).apply(concatenated);
        x = tf.layers.dense({units: 1024, activation: 'swish', name: 'head_dense_1'}).apply(x);

        // 2. Residual Block A (The "Deep Thought" Block)
        let skipA = x; 
        x = tf.layers.dense({units: 1024, activation: 'swish', name: 'res_a_dense_1'}).apply(x);
        x = tf.layers.batchNormalization({name: 'res_a_bn'}).apply(x);
        x = tf.layers.dropout({rate: 0.1, name: 'res_a_dropout'}).apply(x);
        x = tf.layers.dense({units: 1024, activation: 'swish', name: 'res_a_dense_2'}).apply(x);
        x = tf.layers.add({name: 'res_a_add'}).apply([x, skipA]); 

        // 3. Residual Block B (Refinement)
        let skipB = x;
        x = tf.layers.dense({units: 1024, activation: 'swish', name: 'res_b_dense_1'}).apply(x);
        x = tf.layers.batchNormalization({name: 'res_b_bn'}).apply(x);
        x = tf.layers.dense({units: 1024, activation: 'swish', name: 'res_b_dense_2'}).apply(x);
        x = tf.layers.add({name: 'res_b_add'}).apply([x, skipB]);

        // 4. Compression
        x = tf.layers.dense({units: 512, activation: 'swish', name: 'head_compress_1'}).apply(x);
        x = tf.layers.dense({units: 256, activation: 'swish', name: 'head_compress_2'}).apply(x);

        // 5. Output (Linear Logits)
        const output = tf.layers.dense({units: 1, activation: 'linear', name: 'siamese_head_output'}).apply(x);

        // 6. Create Model
        const siameseModel = tf.model({
            inputs: [inputA, inputB, coordInputA, coordInputB],
            outputs: output,
            name: 'siamese_network'
        });

        // Custom metrics for logits
        const accuracy = (yTrue, yPred) => tf.metrics.binaryAccuracy(yTrue, tf.sigmoid(yPred));
        const mse = (yTrue, yPred) => tf.metrics.meanSquaredError(yTrue, tf.sigmoid(yPred));

        siameseModel.compile({
            optimizer: tf.train.adam(0.001),
            loss: tf.losses.sigmoidCrossEntropy,
            metrics: [mse, accuracy]
        });

        console.log('Siamese Network created:', siameseModel.summary());
        this.siameseModel = siameseModel;
        return siameseModel;
    }

    /**
     * Train the Siamese Network
     * @param {Function} onEpochEnd - Callback for progress updates
     * @param {number} epochs - Number of epochs to train
     */
    async trainSiameseModel(onEpochEnd, epochs = 50) {
        if (!this.siameseModel) {
            await this.createSiameseModel();
        }
        
        if (!this.trainingData || this.trainingData.length === 0) {
            console.error('No training data available');
            return;
        }

        const tf = await import('@tensorflow/tfjs');
        console.log('Preparing training data...');

        // Use bounds from loaded data if available, otherwise current environment bounds
        const boundsToUse = this.dataBounds || this.bounds;
        if (!boundsToUse) {
            console.error('No bounds available for normalization. Cannot train.');
            return;
        }

        // Prepare tensors
        const inputsA = [];
        const inputsB = [];
        const coordsA = [];
        const coordsB = [];
        const labels = [];

        for (const sample of this.trainingData) {
            // Normalize and Encode
            const normP1 = this.normalizeCoordinates(sample.p1.x, sample.p1.y, boundsToUse);
            const normP2 = this.normalizeCoordinates(sample.p2.x, sample.p2.y, boundsToUse);
            
            const encP1 = this.positionalEncoding(normP1[0], normP1[1]);
            const encP2 = this.positionalEncoding(normP2[0], normP2[1]);
            
            inputsA.push(encP1);
            inputsB.push(encP2);
            coordsA.push(normP1);
            coordsB.push(normP2);
            labels.push(sample.similarity);
        }

        const tensorA = tf.tensor2d(inputsA);
        const tensorB = tf.tensor2d(inputsB);
        const tensorCoordsA = tf.tensor2d(coordsA);
        const tensorCoordsB = tf.tensor2d(coordsB);
        const tensorLabels = tf.tensor2d(labels, [labels.length, 1]);

        console.log('Starting training...');
        
        const history = await this.siameseModel.fit([tensorA, tensorB, tensorCoordsA, tensorCoordsB], tensorLabels, {
            epochs: epochs,
            batchSize: 128, // Increased batch size for better gradient estimates
            shuffle: true,
            validationSplit: 0.2,
            callbacks: [
                // Early stopping removed to prevent premature completion
                {
                    onEpochEnd: (epoch, logs) => {
                        console.log(`Epoch ${epoch}: loss=${logs.loss.toFixed(4)} val_loss=${logs.val_loss ? logs.val_loss.toFixed(4) : 'N/A'}`);
                        
                        // Learning Rate Decay: Reduce by 10% every 10 epochs
                        if (epoch > 0 && epoch % 10 === 0) {
                            const currentLr = this.siameseModel.optimizer.learningRate;
                            const newLr = Math.max(currentLr * 0.9, 1e-6); // Min LR 1e-6
                            this.siameseModel.optimizer.learningRate = newLr;
                            console.log(`Decaying learning rate to ${newLr.toFixed(6)}`);
                        }

                        if (onEpochEnd) {
                            onEpochEnd(epoch, {
                                ...logs,
                                learningRate: this.siameseModel.optimizer.learningRate
                            });
                        }
                    }
                }
            ]
        });

        console.log('Training complete');
        console.log('Final Stats:', {
            epochs: history.epoch.length,
            finalLoss: history.history.loss[history.history.loss.length - 1],
            finalValLoss: history.history.val_loss ? history.history.val_loss[history.history.val_loss.length - 1] : 'N/A'
        });
        
        eventBus.emit('siminet:trainingComplete', {
            epochs: history.epoch.length,
            history: history.history
        });
        
        // Cleanup tensors
        tensorA.dispose();
        tensorB.dispose();
        tensorCoordsA.dispose();
        tensorCoordsB.dispose();
        tensorLabels.dispose();
    }

    /**
     * Continue training the existing Siamese Network
     * @param {Function} onEpochEnd - Callback for progress updates
     * @param {number} epochs - Number of epochs to train
     */
    async continueTraining(onEpochEnd, epochs = 50) {
        if (!this.siameseModel) {
            throw new Error('No model to continue training. Train a new model or load one first.');
        }
        
        if (!this.trainingData || this.trainingData.length === 0) {
            throw new Error('No training data available');
        }

        console.log('Preparing training data for continuation...');

        // Use bounds from loaded data if available, otherwise current environment bounds
        const boundsToUse = this.dataBounds || this.bounds;
        if (!boundsToUse) {
            throw new Error('No bounds available for normalization. Cannot train.');
        }

        // Prepare tensors (same as trainSiameseModel)
        const inputsA = [];
        const inputsB = [];
        const coordsA = [];
        const coordsB = [];
        const labels = [];

        for (const sample of this.trainingData) {
            const normP1 = this.normalizeCoordinates(sample.p1.x, sample.p1.y, boundsToUse);
            const normP2 = this.normalizeCoordinates(sample.p2.x, sample.p2.y, boundsToUse);
            
            const encP1 = this.positionalEncoding(normP1[0], normP1[1]);
            const encP2 = this.positionalEncoding(normP2[0], normP2[1]);
            
            inputsA.push(encP1);
            inputsB.push(encP2);
            coordsA.push(normP1);
            coordsB.push(normP2);
            labels.push(sample.similarity);
        }

        const tensorA = tf.tensor2d(inputsA);
        const tensorB = tf.tensor2d(inputsB);
        const tensorCoordsA = tf.tensor2d(coordsA);
        const tensorCoordsB = tf.tensor2d(coordsB);
        const tensorLabels = tf.tensor2d(labels, [labels.length, 1]);

        console.log('Continuing training...');
        
        await this.siameseModel.fit([tensorA, tensorB, tensorCoordsA, tensorCoordsB], tensorLabels, {
            epochs: epochs,
            batchSize: 32,
            shuffle: true,
            validationSplit: 0.2,
            callbacks: {
                onEpochEnd: (epoch, logs) => {
                    console.log(`Cont. Epoch ${epoch}: loss=${logs.loss.toFixed(4)}`);
                    if (onEpochEnd) {
                        onEpochEnd(epoch, {
                            ...logs,
                            learningRate: this.siameseModel.optimizer.learningRate
                        });
                    }
                }
            }
        });

        console.log('Training continuation complete');
        
        tensorA.dispose();
        tensorB.dispose();
        tensorCoordsA.dispose();
        tensorCoordsB.dispose();
        tensorLabels.dispose();
    }

    async saveModel() {
        if (!this.siameseModel) {
            throw new Error('No model to save');
        }
        
        // Save using browser download
        await this.siameseModel.save('downloads://siminet_siamese_model');

        // Also save the normalization params if they exist
        // This ensures the model can be used standalone without reloading the backbone params separately
        if (this.backboneNormalizationParams) {
            const params = {
                normalizationParams: this.backboneNormalizationParams,
                timestamp: new Date().toISOString()
            };
            
            const blob = new Blob([JSON.stringify(params, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'siminet-model-params.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    }

    async loadModel(files) {
        console.log('Loading Siamese model from files:', files);
        try {
            const filesArray = Array.from(files);
            
            // Check for params file
            const paramsFile = filesArray.find(f => f.name.includes('params') && f.name.endsWith('.json'));
            if (paramsFile) {
                try {
                    const text = await paramsFile.text();
                    const params = JSON.parse(text);
                    if (params.normalizationParams) {
                        this.backboneNormalizationParams = params.normalizationParams;
                        console.log('Loaded SimiNet normalization params:', this.backboneNormalizationParams);
                    }
                } catch (e) {
                    console.warn('Failed to load SimiNet params:', e);
                }
            }

            // Filter out the params file so TFJS doesn't try to load it
            let modelFiles = filesArray.filter(f => f !== paramsFile);

            // Ensure we only have one JSON file (the model topology)
            const jsonFiles = modelFiles.filter(f => f.name.toLowerCase().endsWith('.json'));
            if (jsonFiles.length > 1) {
                console.warn('Multiple JSON files selected. Using the first one:', jsonFiles[0].name);
                // Keep only the first JSON file and all binary files
                const firstJson = jsonFiles[0];
                const binaryFiles = modelFiles.filter(f => !f.name.toLowerCase().endsWith('.json'));
                modelFiles = [firstJson, ...binaryFiles];
            }

            // Ensure the JSON model file is first in the array for tf.io.browserFiles
            modelFiles.sort((a, b) => {
                const aIsJson = a.name.toLowerCase().endsWith('.json');
                const bIsJson = b.name.toLowerCase().endsWith('.json');
                if (aIsJson && !bIsJson) return -1;
                if (!aIsJson && bIsJson) return 1;
                return 0;
            });

            this.siameseModel = await tf.loadLayersModel(tf.io.browserFiles(modelFiles));
            
            // Custom metrics for logits
            const accuracy = (yTrue, yPred) => tf.metrics.binaryAccuracy(yTrue, tf.sigmoid(yPred));
            const mse = (yTrue, yPred) => tf.metrics.meanSquaredError(yTrue, tf.sigmoid(yPred));

            // Recompile the model to ensure it's ready for training/prediction
            this.siameseModel.compile({
                optimizer: tf.train.adam(0.001),
                loss: tf.losses.sigmoidCrossEntropy,
                metrics: [mse, accuracy]
            });
            
            console.log('Siamese model loaded:', this.siameseModel.summary());
            return true;
        } catch (error) {
            console.error('Failed to load Siamese model:', error);
            throw error;
        }
    }

    /**
     * Predict similarity between two points using the trained model
     */
    predictSimilarity(p1, p2) {
        if (!this.siameseModel) return 0;

        return tf.tidy(() => {
            const normP1 = this.normalizeCoordinates(p1.x, p1.y);
            const normP2 = this.normalizeCoordinates(p2.x, p2.y);
            
            const encP1 = this.positionalEncoding(normP1[0], normP1[1]);
            const encP2 = this.positionalEncoding(normP2[0], normP2[1]);
            
            const tensorA = tf.tensor2d([encP1]);
            const tensorB = tf.tensor2d([encP2]);
            const tensorCoordA = tf.tensor2d([normP1]);
            const tensorCoordB = tf.tensor2d([normP2]);
            
            const logits = this.siameseModel.predict([tensorA, tensorB, tensorCoordA, tensorCoordB]);
            const prediction = tf.sigmoid(logits);
            return prediction.dataSync()[0];
        });
    }

    /**
     * Generate a pair of points with direct Line of Sight
     */
    generateLOSPair() {
        let p1, p2;
        let attempts = 0;
        while (attempts < 100) {
            p1 = this.getRandomPoint();
            if (!p1) continue;
            
            // Try to find a visible p2
            p2 = this.getRandomPoint();
            if (!p2) continue;
            
            if (this.hasLineOfSight(p1, p2)) {
                return [p1, p2];
            }
            attempts++;
        }
        return null;
    }

    /**
     * Generate a pair of points within a certain radius (Near-Miss)
     * @param {number} radius - Radius in coordinate units (approx 5 meters)
     */
    generateNearPair(radius = 50) { // Assuming 50 units is roughly 5 meters in this scale
        let p1, p2;
        let attempts = 0;
        while (attempts < 100) {
            p1 = this.getRandomPoint();
            if (!p1) continue;
            
            // Generate p2 within radius
            const angle = Math.random() * 2 * Math.PI;
            const r = Math.random() * radius;
            const x = p1.x + r * Math.cos(angle);
            const y = p1.y + r * Math.sin(angle);
            
            p2 = { x, y };
            
            // Check if p2 is valid (inside bounds and not in obstacle)
            if (p2.x >= this.bounds.minX && p2.x <= this.bounds.maxX &&
                p2.y >= this.bounds.minY && p2.y <= this.bounds.maxY &&
                !this.isPointInObstacle(p2)) {
                return [p1, p2];
            }
            attempts++;
        }
        return null;
    }

    /**
     * Generate a random pair of points (Global Negative)
     */
    generateRandomPair() {
        const p1 = this.getRandomPoint();
        const p2 = this.getRandomPoint();
        if (p1 && p2) return [p1, p2];
        return null;
    }

    /**
     * Generate a balanced batch of training data
     * @param {number} batchSize - Size of the batch (e.g., 1024)
     */
    async generateBalancedBatch(batchSize = 1024) {
        const batch = [];
        const numLOS = Math.floor(batchSize * 0.4);
        const numNear = Math.floor(batchSize * 0.4);
        const numRandom = batchSize - numLOS - numNear;
        
        // Helper to process a pair
        const processPair = (p1, p2) => {
            const poly1 = visibilnetService.computeRayBasedVisibility(p1, this.polygons, this.bounds, 36);
            const poly2 = visibilnetService.computeRayBasedVisibility(p2, this.polygons, this.bounds, 36);
            
            // Calculate similarity (Symmetric IoU for SimiNet usually, or directional?)
            // SimiNet usually predicts IoU or directional similarity.
            // Let's assume symmetric IoU for now as per previous code context
            // Actually, previous code calculated both directions.
            // Let's stick to the format: { p1, p2, similarity }
            // where similarity is likely the average or one direction.
            // Let's check generateData implementation...
            // It pushes TWO samples: p1->p2 and p2->p1
            
            const mcResult1 = this.calculateMCSimilarity(poly1, poly2, 2000, this.bounds);
            const mcResult2 = this.calculateMCSimilarity(poly2, poly1, 2000, this.bounds);

            return [
                { p1, p2, similarity: mcResult1 },
                { p1: p2, p2: p1, similarity: mcResult2 }
            ];
        };

        // Generate LOS pairs
        for (let i = 0; i < numLOS / 2; i++) { // /2 because each pair generates 2 samples
            const pair = this.generateLOSPair();
            if (pair) batch.push(...processPair(pair[0], pair[1]));
        }

        // Generate Near pairs
        for (let i = 0; i < numNear / 2; i++) {
            const pair = this.generateNearPair(100); // Adjust radius as needed
            if (pair) batch.push(...processPair(pair[0], pair[1]));
        }

        // Generate Random pairs
        for (let i = 0; i < numRandom / 2; i++) {
            const pair = this.generateRandomPair();
            if (pair) batch.push(...processPair(pair[0], pair[1]));
        }
        
        return batch;
    }

    /**
     * Train the Siamese Network using Infinite Generator (3-Bucket Strategy)
     * @param {Function} onEpochEnd - Callback for progress updates
     * @param {number} epochs - Number of epochs to train
     * @param {number} batchSize - Size of each batch (default 1024)
     */
    async trainSiameseModelInfinite(onEpochEnd, epochs = 50, batchSize = 1024) {
        if (!this.siameseModel) {
            await this.createSiameseModel();
        }
        
        const tf = await import('@tensorflow/tfjs');
        console.log(`Starting Infinite Training: ${epochs} epochs, batch size ${batchSize}`);

        // Use bounds from loaded data if available, otherwise current environment bounds
        // For infinite generation, we usually use the current environment bounds
        const boundsToUse = this.bounds;
        if (!boundsToUse) {
            console.error('No environment bounds available. Cannot generate data.');
            return;
        }

        // Adaptive Learning Rate State
        let bestValLoss = Infinity;
        let patienceCounter = 0;
        const patience = 15; // Increased patience to 15 to handle noise in generated batches

        const fullHistory = {
            loss: [],
            val_loss: [],
            val_mse: []
        };

        for (let epoch = 0; epoch < epochs; epoch++) {
            // 1. Generate a balanced batch on the fly
            // Note: This is synchronous/blocking for now, might need to be async or web worker
            // to avoid freezing UI if batch size is large.
            // For 1024 samples, it might take a second or two.
            
            // Allow UI to update before generation
            await tf.nextFrame();
            
            const batchData = await this.generateBalancedBatch(batchSize);
            
            // 2. Prepare tensors
            const inputsA = [];
            const inputsB = [];
            const coordsA = [];
            const coordsB = [];
            const labels = [];

            for (const sample of batchData) {
                const normP1 = this.normalizeCoordinates(sample.p1.x, sample.p1.y, boundsToUse);
                const normP2 = this.normalizeCoordinates(sample.p2.x, sample.p2.y, boundsToUse);
                
                const encP1 = this.positionalEncoding(normP1[0], normP1[1]);
                const encP2 = this.positionalEncoding(normP2[0], normP2[1]);
                
                inputsA.push(encP1);
                inputsB.push(encP2);
                coordsA.push(normP1);
                coordsB.push(normP2);
                labels.push(sample.similarity);
            }

            const tensorA = tf.tensor2d(inputsA);
            const tensorB = tf.tensor2d(inputsB);
            const tensorCoordsA = tf.tensor2d(coordsA);
            const tensorCoordsB = tf.tensor2d(coordsB);
            const tensorLabels = tf.tensor2d(labels, [labels.length, 1]);

            // 3. Train on this batch (1 epoch)
            const history = await this.siameseModel.fit([tensorA, tensorB, tensorCoordsA, tensorCoordsB], tensorLabels, {
                epochs: 1,
                batchSize: 128, // Increased batch size
                shuffle: true,
                validationSplit: 0.2, // We can split this batch for validation
                verbose: 0
            });
            
            const loss = history.history.loss[0];
            const valLoss = history.history.val_loss ? history.history.val_loss[0] : null;
            const mse = history.history.mse ? history.history.mse[0] : null;
            const valMse = history.history.val_mse ? history.history.val_mse[0] : null;
            
            fullHistory.loss.push(loss);
            if (valLoss !== null) fullHistory.val_loss.push(valLoss);
            if (valMse !== null) fullHistory.val_mse.push(valMse);
            
            console.log(`Epoch ${epoch}: loss=${loss.toFixed(4)} val_loss=${valLoss ? valLoss.toFixed(4) : 'N/A'}`);
            
            // Adaptive Learning Rate for Infinite Training
            if (valLoss !== null) {
                if (valLoss < bestValLoss) {
                    bestValLoss = valLoss;
                    patienceCounter = 0;
                } else {
                    patienceCounter++;
                    if (patienceCounter >= patience) {
                        const currentLr = this.siameseModel.optimizer.learningRate;
                        const newLr = Math.max(currentLr * 0.8, 1e-6); // Reduce by 20%, min 1e-6
                        this.siameseModel.optimizer.learningRate = newLr;
                        console.log(`Validation loss plateaued. Reducing LR to ${newLr.toFixed(6)}`);
                        patienceCounter = 0; // Reset patience after reduction
                    }
                }
            }
            
            if (onEpochEnd) {
                onEpochEnd(epoch, { 
                    loss, 
                    val_loss: valLoss,
                    mse,
                    val_mse: valMse,
                    learningRate: this.siameseModel.optimizer.learningRate
                });
            }

            // Cleanup
            tensorA.dispose();
            tensorB.dispose();
            tensorCoordsA.dispose();
            tensorCoordsB.dispose();
            tensorLabels.dispose();
        }

        console.log('Infinite Training complete');
        console.log('Final Stats:', {
            epochs: epochs,
            finalLoss: fullHistory.loss[fullHistory.loss.length - 1],
            finalValLoss: fullHistory.val_loss.length > 0 ? fullHistory.val_loss[fullHistory.val_loss.length - 1] : 'N/A'
        });

        eventBus.emit('siminet:trainingComplete', {
            epochs: epochs,
            history: fullHistory
        });
    }

    /**
     * Train using Hard Example Mining
     * 1. Generate 4x data
     * 2. Predict and calculate error
     * 3. Select top 1x data with highest error
     * 4. Train on that
     * @param {Function} onEpochEnd - Callback for progress updates
     * @param {number} epochs - Number of epochs to train
     * @param {number} batchSize - Size of each batch (default 1024)
     */
    async trainHardMining(onEpochEnd, epochs = 50, batchSize = 1024) {
        if (!this.siameseModel) {
            await this.createSiameseModel();
        }
        
        const tf = await import('@tensorflow/tfjs');
        console.log(`Starting Hard Mining Training: ${epochs} epochs, target batch size ${batchSize}`);

        const boundsToUse = this.bounds;
        if (!boundsToUse) {
            console.error('No environment bounds available.');
            return;
        }

        // Adaptive Learning Rate State
        let bestValLoss = Infinity;
        let patienceCounter = 0;
        const patience = 15;

        const fullHistory = {
            loss: [],
            val_loss: [],
            val_mse: []
        };

        for (let epoch = 0; epoch < epochs; epoch++) {
            // Step 1: Wide Generation (4x batch size)
            await tf.nextFrame();
            const candidateCount = batchSize * 4;
            // generateBalancedBatch returns an array of objects {p1, p2, similarity}
            const candidates = await this.generateBalancedBatch(candidateCount);
            
            // Step 2: Quick Check (Inference)
            // Prepare tensors for all candidates
            const inputsA = [];
            const inputsB = [];
            const coordsA = [];
            const coordsB = [];
            const truths = [];

            for (const sample of candidates) {
                const normP1 = this.normalizeCoordinates(sample.p1.x, sample.p1.y, boundsToUse);
                const normP2 = this.normalizeCoordinates(sample.p2.x, sample.p2.y, boundsToUse);
                
                const encP1 = this.positionalEncoding(normP1[0], normP1[1]);
                const encP2 = this.positionalEncoding(normP2[0], normP2[1]);
                
                inputsA.push(encP1);
                inputsB.push(encP2);
                coordsA.push(normP1);
                coordsB.push(normP2);
                truths.push(sample.similarity);
            }

            const tensorA_all = tf.tensor2d(inputsA);
            const tensorB_all = tf.tensor2d(inputsB);
            const tensorCoordsA_all = tf.tensor2d(coordsA);
            const tensorCoordsB_all = tf.tensor2d(coordsB);
            
            // Predict without tracking gradients
            const predictions = tf.tidy(() => {
                const logits = this.siameseModel.predict([tensorA_all, tensorB_all, tensorCoordsA_all, tensorCoordsB_all]);
                return tf.sigmoid(logits).dataSync();
            });
            
            // Step 3: Hard Sort
            const errors = [];
            for (let i = 0; i < candidates.length; i++) {
                const pred = predictions[i];
                const truth = truths[i];
                const error = Math.abs(pred - truth);
                errors.push({ index: i, error: error });
            }
            
            // Sort by error descending
            errors.sort((a, b) => b.error - a.error);
            
            // Select top batchSize
            const topIndices = errors.slice(0, batchSize).map(e => e.index);
            
            // Step 4: Targeted Train
            // Construct training batch
            const trainInputsA = [];
            const trainInputsB = [];
            const trainCoordsA = [];
            const trainCoordsB = [];
            const trainLabels = [];
            
            for (const idx of topIndices) {
                trainInputsA.push(inputsA[idx]);
                trainInputsB.push(inputsB[idx]);
                trainCoordsA.push(coordsA[idx]);
                trainCoordsB.push(coordsB[idx]);
                trainLabels.push(truths[idx]);
            }
            
            const trainTensorA = tf.tensor2d(trainInputsA);
            const trainTensorB = tf.tensor2d(trainInputsB);
            const trainTensorCoordsA = tf.tensor2d(trainCoordsA);
            const trainTensorCoordsB = tf.tensor2d(trainCoordsB);
            const trainTensorLabels = tf.tensor2d(trainLabels, [trainLabels.length, 1]);
            
            // Train
            const history = await this.siameseModel.fit([trainTensorA, trainTensorB, trainTensorCoordsA, trainTensorCoordsB], trainTensorLabels, {
                epochs: 1,
                batchSize: 128, // Internal batch size for the update
                shuffle: true,
                validationSplit: 0.2,
                verbose: 0
            });
            
            // Cleanup
            tensorA_all.dispose();
            tensorB_all.dispose();
            tensorCoordsA_all.dispose();
            tensorCoordsB_all.dispose();
            trainTensorA.dispose();
            trainTensorB.dispose();
            trainTensorCoordsA.dispose();
            trainTensorCoordsB.dispose();
            trainTensorLabels.dispose();
            
            // Logging and LR adjustment
            const loss = history.history.loss[0];
            const valLoss = history.history.val_loss ? history.history.val_loss[0] : null;
            const mse = history.history.mse ? history.history.mse[0] : null;
            const valMse = history.history.val_mse ? history.history.val_mse[0] : null;
            
            fullHistory.loss.push(loss);
            if (valLoss !== null) fullHistory.val_loss.push(valLoss);
            if (valMse !== null) fullHistory.val_mse.push(valMse);
            
            console.log(`Epoch ${epoch}: loss=${loss.toFixed(4)} val_loss=${valLoss ? valLoss.toFixed(4) : 'N/A'} (Hard Mining)`);
            
            if (valLoss !== null) {
                if (valLoss < bestValLoss) {
                    bestValLoss = valLoss;
                    patienceCounter = 0;
                } else {
                    patienceCounter++;
                    if (patienceCounter >= patience) {
                        const currentLr = this.siameseModel.optimizer.learningRate;
                        const newLr = Math.max(currentLr * 0.8, 1e-6);
                        this.siameseModel.optimizer.learningRate = newLr;
                        console.log(`Validation loss plateaued. Reducing LR to ${newLr.toFixed(6)}`);
                        patienceCounter = 0;
                    }
                }
            }
            
            if (onEpochEnd) {
                onEpochEnd(epoch, { 
                    loss, 
                    val_loss: valLoss,
                    mse,
                    val_mse: valMse,
                    learningRate: this.siameseModel.optimizer.learningRate
                });
            }
        }
        
        console.log('Hard Mining Training complete');
        eventBus.emit('siminet:trainingComplete', {
            epochs: epochs,
            history: fullHistory
        });
    }
}

export const siminetService = new SimiNetService();
