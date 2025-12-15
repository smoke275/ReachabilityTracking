/**
 * SimilarityMPPITrackingService
 * Implements simple MPPI-based tracking of the evader
 */

import { eventBus } from '../utils/EventBus.js';
import { sdfService } from './SDFService.js';

export class SimilarityMPPITrackingService {
    constructor() {
        this.isTracking = false;
        this.animationFrameId = null;
        this.lastUpdateTime = 0;
        
        this.pursuerState = null;
        this.evaderState = null;
        
        this.config = {
            vMax: 10,
            vMin: 0,
            omegaMax: 1.5,
            mppiSamples: 100,
            mppiHorizon: 2.0, // seconds
            mppiLambda: 1.0,
            mppiSigma: 0.5,
            dt: 0.05,
            controlFreq: 30, // Hz
            collisionWeight: 10000.0, // Weight for collision cost
            safeDistance: 20.0 // Distance at which collision cost kicks in
        };
        
        this.lastControlTime = 0;
        this.currentControl = { v: 0, omega: 0 };
        this.currentTrajectories = [];

        // Model state
        this.model = null;
        this.normalizationParams = null;
        this.modelNumRays = 36;
    }

    setModel(model, normalizationParams) {
        this.model = model;
        this.normalizationParams = normalizationParams;
        if (normalizationParams && normalizationParams.numRays) {
            this.modelNumRays = normalizationParams.numRays;
        }
        console.log('SimilarityMPPITrackingService: Model set', { 
            hasModel: !!model, 
            hasParams: !!normalizationParams,
            rays: this.modelNumRays 
        });
    }

    // Fourier feature encoding
    fourierEncode(x, y, numFrequencies = 6) {
        const features = [];
        for (let i = 0; i < numFrequencies; i++) {
            const freq = Math.pow(2, i) * Math.PI;
            features.push(Math.sin(freq * x));
            features.push(Math.cos(freq * x));
            features.push(Math.sin(freq * y));
            features.push(Math.cos(freq * y));
        }
        return features;
    }

    async predictVisibility(observer) {
        if (!this.model || !this.normalizationParams) return null;
        
        const tf = await import('@tensorflow/tfjs');
        
        const { xMin, xMax, yMin, yMax } = this.normalizationParams;
        
        // Normalize
        let xNorm = 2 * (observer.x - xMin) / (xMax - xMin || 1) - 1;
        let yNorm = 2 * (observer.y - yMin) / (yMax - yMin || 1) - 1;
        
        // Clamp
        xNorm = Math.max(-1, Math.min(1, xNorm));
        yNorm = Math.max(-1, Math.min(1, yNorm));
        
        // Fourier encode
        const features = this.fourierEncode(xNorm, yNorm, 6);
        
        // Predict
        const distances = tf.tidy(() => {
            const inputTensor = tf.tensor2d([features]);
            const prediction = this.model.predict(inputTensor);
            return prediction.dataSync();
        });
        
        // Denormalize distances
        const { dMin, dMax } = this.normalizationParams;
        const denormalizedDistances = Array.from(distances).map(d => 
            d * (dMax - dMin) + dMin
        );
        
        return this.reconstructPolygon(observer, denormalizedDistances);
    }

    async predictVisibilityBatch(observers) {
        if (!this.model || !this.normalizationParams || observers.length === 0) return [];
        
        const tf = await import('@tensorflow/tfjs');
        const { xMin, xMax, yMin, yMax, dMin, dMax } = this.normalizationParams;
        
        // Prepare batch input
        const batchFeatures = observers.map(obs => {
            // Normalize
            let xNorm = 2 * (obs.x - xMin) / (xMax - xMin || 1) - 1;
            let yNorm = 2 * (obs.y - yMin) / (yMax - yMin || 1) - 1;
            
            // Clamp
            xNorm = Math.max(-1, Math.min(1, xNorm));
            yNorm = Math.max(-1, Math.min(1, yNorm));
            
            // Fourier encode
            return this.fourierEncode(xNorm, yNorm, 6);
        });
        
        // Predict batch
        const predictionTensor = tf.tidy(() => {
            const inputTensor = tf.tensor2d(batchFeatures);
            return this.model.predict(inputTensor);
        });
        
        const allDistances = await predictionTensor.data();
        predictionTensor.dispose();
        
        // Reconstruct polygons
        const polygons = [];
        const numRays = this.modelNumRays;
        
        for (let i = 0; i < observers.length; i++) {
            const startIdx = i * numRays;
            const distances = allDistances.slice(startIdx, startIdx + numRays);
            
            // Denormalize
            const denormalizedDistances = Array.from(distances).map(d => 
                d * (dMax - dMin) + dMin
            );
            
            polygons.push(this.reconstructPolygon(observers[i], denormalizedDistances));
        }
        
        return polygons;
    }

    reconstructPolygon(observer, distances) {
        const vertices = [];
        const numRays = distances.length;
        
        for (let i = 0; i < numRays; i++) {
            const angle = i * (2 * Math.PI / numRays);
            const dist = distances[i];
            
            vertices.push({
                x: observer.x + dist * Math.cos(angle),
                y: observer.y + dist * Math.sin(angle)
            });
        }
        
        return vertices;
    }

    isPointInPolygon(point, polygon) {
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

    calculateLocalMcSimilarity(poly1, poly2, center2) {
        if (!poly1 || !poly2 || poly2.length < 3) return 0;

        // 1. Calculate total area of poly2 (sum of triangles from center)
        let totalArea = 0;
        const cdf = [];
        
        for (let i = 0; i < poly2.length; i++) {
            const p1 = poly2[i];
            const p2 = poly2[(i + 1) % poly2.length];
            
            const area = 0.5 * Math.abs(
                p1.x * (p2.y - center2.y) + 
                p2.x * (center2.y - p1.y) + 
                center2.x * (p1.y - p2.y)
            );
            
            totalArea += area;
            cdf.push(totalArea);
        }
        
        if (totalArea === 0) return 0;

        // 2. Sample points
        let pointsInA = 0;
        const numSamples = 50; // Reduced samples for performance
        
        for (let k = 0; k < numSamples; k++) {
            const r = Math.random() * totalArea;
            let triIndex = cdf.findIndex(v => v >= r);
            if (triIndex === -1) triIndex = cdf.length - 1;
            
            const p1 = poly2[triIndex];
            const p2 = poly2[(triIndex + 1) % poly2.length];
            
            const r1 = Math.random();
            const r2 = Math.random();
            
            let sqrtR1 = Math.sqrt(r1);
            let u = 1 - sqrtR1;
            let v = sqrtR1 * (1 - r2);
            let w = sqrtR1 * r2;
            
            const px = u * center2.x + v * p1.x + w * p2.x;
            const py = u * center2.y + v * p1.y + w * p2.y;
            
            if (this.isPointInPolygon({x: px, y: py}, poly1)) {
                pointsInA++;
            }
        }
        
        return pointsInA / numSamples;
    }

    start(pursuerState, evaderState) {
        if (this.isTracking) return;
        
        this.pursuerState = JSON.parse(JSON.stringify(pursuerState));
        this.evaderState = JSON.parse(JSON.stringify(evaderState));
        
        this.isTracking = true;
        this.lastUpdateTime = performance.now();
        this.lastControlTime = 0;
        this.currentControl = { v: 0, omega: 0 };
        this.currentTrajectories = [];
        
        console.log('Similarity MPPI Tracking started');
        eventBus.emit('similarityMPPITracking:started');
        
        this.animate();
    }

    stop() {
        if (!this.isTracking) return;
        
        this.isTracking = false;
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        
        console.log('Similarity MPPI Tracking stopped');
        eventBus.emit('similarityMPPITracking:stopped', {});
    }
    
    updateEvaderState(newState) {
        if (newState && newState.position) {
            this.evaderState = {
                position: { x: newState.position.x, y: newState.position.y },
                heading: newState.heading || 0,
                speed: newState.speed || 0,
                angularSpeed: newState.angularSpeed || 0
            };
        }
    }

    async animate() {
        if (!this.isTracking) return;

        const currentTime = performance.now();
        const deltaTime = (currentTime - this.lastUpdateTime) / 1000; // seconds
        this.lastUpdateTime = currentTime;

        // 1. Get latest evader state
        eventBus.emit('realTimeTracking:requestStates', (states) => {
             if (states && states.evaderState) {
                 this.updateEvaderState(states.evaderState);
             }
        });

        // 2. Run MPPI to get control (at specified frequency)
        const controlPeriod = 1000 / this.config.controlFreq;
        if (currentTime - this.lastControlTime >= controlPeriod && !this.isComputing) {
            this.isComputing = true;
            try {
                const result = await this.runMPPI();
                this.currentControl = result.control;
                this.currentTrajectories = result.trajectories;
                this.lastControlTime = currentTime;
            } catch (e) {
                console.error('MPPI Error:', e);
            } finally {
                this.isComputing = false;
            }
        }

        // 3. Apply control to pursuer
        this.updatePursuer(this.currentControl, deltaTime);

        // 4. Emit update for visualization
        eventBus.emit('similarityMPPITracking:update', {
            pursuerState: this.pursuerState,
            evaderState: this.evaderState,
            trajectories: this.currentTrajectories,
            stats: {
                iterations: 0,
                distance: this.computeDistance(this.pursuerState.position, this.evaderState.position)
            }
        });
        
        // Also emit global agent update so other components see the pursuer moving
        eventBus.emit('intruder:positionUpdate', {
            position: this.pursuerState.position,
            heading: this.pursuerState.heading
        });

        this.animationFrameId = requestAnimationFrame(() => this.animate());
    }

    async runMPPI() {
        if (!this.pursuerState || !this.pursuerState.position || !this.evaderState || !this.evaderState.position) {
            return { control: { v: 0, omega: 0 }, trajectories: [] };
        }

        const { mppiSamples, mppiHorizon, mppiLambda, mppiSigma, dt, vMax, omegaMax } = this.config;
        const horizonSteps = Math.floor(mppiHorizon / dt);
        
        const trajectories = []; // Array of control sequences
        const trajectoryPoints = []; // Array of point sequences for visualization
        const costs = [];

        // Pre-calculate evader polygon if model is available
        let evaderPolygon = null;
        if (this.model && this.normalizationParams) {
             evaderPolygon = await this.predictVisibility(this.evaderState.position);
        }

        // Generate random trajectories
        const terminalStates = [];
        const terminalIndices = [];

        for (let k = 0; k < mppiSamples; k++) {
            let simState = {
                x: this.pursuerState.position.x,
                y: this.pursuerState.position.y,
                theta: this.pursuerState.heading
            };
            
            let trajectoryCost = 0;
            const controls = [];
            const points = [{x: simState.x, y: simState.y}];

            for (let t = 0; t < horizonSteps; t++) {
                // Simple base policy: move towards evader
                const dx = this.evaderState.position.x - simState.x;
                const dy = this.evaderState.position.y - simState.y;
                const dist = Math.sqrt(dx*dx + dy*dy);
                const desiredHeading = Math.atan2(dy, dx);
                let headingError = desiredHeading - simState.theta;
                while (headingError > Math.PI) headingError -= 2 * Math.PI;
                while (headingError < -Math.PI) headingError += 2 * Math.PI;

                // SDF-aware Base Policy
                const distToObs = sdfService.getDistance(simState.x, simState.y);
                
                let obstacleSpeedLimit = vMax;
                if (distToObs < 40.0) {
                    const ratio = Math.max(0, distToObs / 40.0);
                    obstacleSpeedLimit = vMax * (0.1 + 0.9 * ratio);
                }
                
                const turnSpeedLimit = vMax * Math.max(0.1, Math.cos(headingError));
                const effectiveVMax = Math.min(vMax, obstacleSpeedLimit, turnSpeedLimit);
                const baseV = Math.min(effectiveVMax, dist); 
                const baseOmega = Math.max(-omegaMax, Math.min(omegaMax, 2.0 * headingError));

                // Add noise
                const noiseV = (Math.random() - 0.5) * 2 * mppiSigma * vMax;
                const noiseOmega = (Math.random() - 0.5) * 2 * mppiSigma * omegaMax;

                let v = baseV + noiseV;
                let omega = baseOmega + noiseOmega;

                v = Math.max(this.config.vMin, Math.min(vMax, v));
                omega = Math.max(-omegaMax, Math.min(omegaMax, omega));

                controls.push({ v, omega });

                // Simulate step
                const dtFrames = dt * 60;
                simState.x += v * Math.cos(simState.theta) * dtFrames;
                simState.y += v * Math.sin(simState.theta) * dtFrames;
                simState.theta += omega * dtFrames;
                
                points.push({x: simState.x, y: simState.y});

                // Cost Calculation
                let stepCost = 0;

                // 1. Similarity Cost (Terminal or Sparse)
                // Only calculate at the end of horizon to save performance
                if (t === horizonSteps - 1 && evaderPolygon) {
                     // Defer calculation to batch processing
                     terminalStates.push({x: simState.x, y: simState.y});
                     terminalIndices.push(k);
                } else if (!evaderPolygon) {
                    // Fallback to distance if model not loaded
                    const dX = simState.x - this.evaderState.position.x;
                    const dY = simState.y - this.evaderState.position.y;
                    stepCost += Math.sqrt(dX*dX + dY*dY);
                }

                // 2. Collision Cost
                if (distToObs < this.config.safeDistance) {
                    const collisionCost = this.config.collisionWeight * (this.config.safeDistance - distToObs);
                    stepCost += collisionCost;
                }
                
                trajectoryCost += stepCost;
            }
            
            trajectories.push(controls);
            trajectoryPoints.push(points);
            costs.push(trajectoryCost);
        }

        // Batch process similarity costs
        if (evaderPolygon && terminalStates.length > 0) {
            const pursuerPolygons = await this.predictVisibilityBatch(terminalStates);
            for (let i = 0; i < terminalStates.length; i++) {
                const k = terminalIndices[i];
                const similarity = this.calculateLocalMcSimilarity(evaderPolygon, pursuerPolygons[i], terminalStates[i]);
                // Maximize similarity -> Minimize negative similarity
                costs[k] += -similarity * 5000;
            }
        }

        // Compute weights
        const minCost = Math.min(...costs);
        let weightSum = 0;
        const weights = costs.map(c => {
            const w = Math.exp(-(c - minCost) / mppiLambda);
            weightSum += w;
            return w;
        });

        // Compute weighted average
        let avgV = 0;
        let avgOmega = 0;

        if (weightSum < 1e-10 || isNaN(weightSum)) {
            const bestIdx = costs.indexOf(minCost);
            if (bestIdx !== -1) {
                avgV = trajectories[bestIdx][0].v;
                avgOmega = trajectories[bestIdx][0].omega;
            }
        } else {
            for (let k = 0; k < mppiSamples; k++) {
                const w = weights[k] / weightSum;
                avgV += w * trajectories[k][0].v;
                avgOmega += w * trajectories[k][0].omega;
            }
        }
        
        return { 
            control: { v: avgV || 0, omega: avgOmega || 0 },
            trajectories: trajectoryPoints
        };
    }

    updatePursuer(control, deltaTime) {
        const state = this.pursuerState;
        const { v, omega } = control;
        
        if (isNaN(v) || isNaN(omega)) return;

        const dt = deltaTime * 60; 

        state.position.x += v * Math.cos(state.heading) * dt;
        state.position.y += v * Math.sin(state.heading) * dt;
        state.heading += omega * dt;
        
        state.heading = this.normalizeAngle(state.heading);
    }

    normalizeAngle(angle) {
        while (angle > Math.PI) angle -= 2 * Math.PI;
        while (angle < -Math.PI) angle += 2 * Math.PI;
        return angle;
    }

    computeDistance(p1, p2) {
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    configure(config) {
        this.config = { ...this.config, ...config };
    }
}

export const similarityMPPITrackingService = new SimilarityMPPITrackingService();