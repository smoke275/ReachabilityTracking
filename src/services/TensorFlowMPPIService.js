/**
 * TensorFlowMPPIService
 * Implements MPPI-based tracking using TensorFlow.js for GPU acceleration.
 */

import * as tf from '@tensorflow/tfjs';
import { eventBus } from '../utils/EventBus.js';
import { sdfService } from './SDFService.js';

export class TensorFlowMPPIService {
    constructor() {
        this.isTracking = false;
        this.isComputing = false; // Flag to prevent overlapping computations
        this.animationFrameId = null;
        this.lastUpdateTime = 0;
        
        this.pursuerState = null;
        this.evaderState = null;
        
        this.config = {
            vMax: 10,
            vMin: 0,
            omegaMax: 1.5,
            mppiSamples: 2000, // Increased samples for GPU
            mppiHorizon: 2.0, // seconds
            mppiLambda: 1.0,
            mppiSigma: 0.25, // Reduced from 0.5 to reduce jitter
            dt: 0.05,
            controlFreq: 30, // Hz
            collisionWeight: 10000.0,
            safeDistance: 20.0
        };
        
        this.lastControlTime = 0;
        this.currentControl = { v: 0, omega: 0 };
        this.currentTrajectories = []; // For visualization (CPU side)

        // TF Tensors
        this.sdfTensor = null;
        this.sdfConfig = null; // { width, height, resolution, minX, minY }

        this.setupListeners();
    }

    setupListeners() {
        eventBus.on('sdf:updated', () => {
            this.updateSDFTensor();
        });
    }

    updateSDFTensor() {
        if (!sdfService.isReady || !sdfService.grid) return;

        // Dispose old tensor
        if (this.sdfTensor) {
            this.sdfTensor.dispose();
        }

        // Create new tensor from SDF grid
        // SDF grid is Float32Array, perfect for tensor
        this.sdfTensor = tf.tensor1d(sdfService.grid);
        
        this.sdfConfig = {
            width: sdfService.cols,
            height: sdfService.rows,
            resolution: sdfService.resolution,
            minX: sdfService.bounds.minX,
            minY: sdfService.bounds.minY
        };

        console.log('TF MPPI: SDF Tensor updated', this.sdfTensor.shape);
    }

    configure(config) {
        this.config = { ...this.config, ...config };
    }

    start(pursuerState, evaderState) {
        if (this.isTracking) return;
        
        this.pursuerState = JSON.parse(JSON.stringify(pursuerState));
        this.evaderState = JSON.parse(JSON.stringify(evaderState));
        
        // Ensure SDF is loaded
        if (!this.sdfTensor && sdfService.isReady) {
            this.updateSDFTensor();
        }

        this.isTracking = true;
        this.lastUpdateTime = performance.now();
        this.lastControlTime = 0;
        this.currentControl = { v: 0, omega: 0 };
        
        console.log('TensorFlow MPPI Tracking started');
        eventBus.emit('similarityMPPITracking:started');
        
        this.animate();
    }

    stop() {
        this.isTracking = false;
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        console.log('TensorFlow MPPI Tracking stopped');
        eventBus.emit('similarityMPPITracking:stopped');
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

    animate() {
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
            this.runMPPIAsync().then(result => {
                if (!result) {
                    this.isComputing = false;
                    return;
                }
                
                // Apply Low-Pass Filter (Exponential Moving Average) to smooth control inputs
                // alpha = 0.6 means 60% new control, 40% old control
                const alpha = 0.6; 
                this.currentControl.v = this.currentControl.v * (1 - alpha) + result.control.v * alpha;
                this.currentControl.omega = this.currentControl.omega * (1 - alpha) + result.control.omega * alpha;
                
                this.currentTrajectories = result.trajectories; // Optional: downsample for viz
                this.lastControlTime = performance.now();
                this.isComputing = false;
            }).catch(err => {
                console.error("MPPI Error:", err);
                this.isComputing = false;
            });
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
        
        // Also emit global agent update
        eventBus.emit('intruder:positionUpdate', {
            position: this.pursuerState.position,
            heading: this.pursuerState.heading
        });

        this.animationFrameId = requestAnimationFrame(() => this.animate());
    }

    async runMPPIAsync() {
        if (!this.pursuerState || !this.evaderState || !this.sdfTensor) {
            return null;
        }

        const { mppiSamples, mppiHorizon, mppiLambda, mppiSigma, dt, vMax, omegaMax, collisionWeight, safeDistance } = this.config;
        const horizonSteps = Math.floor(mppiHorizon / dt);
        const dtFrames = dt * 60;

        // Run TF operations
        // We use tf.tidy but we need to extract data async
        // So we return the tensors we want to download, then dispose everything else
        
        const tensorsToDownload = tf.tidy(() => {
            // 1. Initialize States [K, 3] (x, y, theta)
            const startX = this.pursuerState.position.x;
            const startY = this.pursuerState.position.y;
            const startTheta = this.pursuerState.heading;
            
            let states = tf.tensor2d(
                Array(mppiSamples).fill([startX, startY, startTheta]), 
                [mppiSamples, 3]
            );

            // 2. Generate Noise/Controls [K, T, 2]
            const noiseV = tf.randomUniform([mppiSamples, horizonSteps], -1.0, 1.0); 
            const noiseOmega = tf.randomNormal([mppiSamples, horizonSteps], 0, 1.0);
            
            // We will accumulate costs
            let costs = tf.zeros([mppiSamples]);
            
            // Loop over time
            let currentX = states.slice([0, 0], [-1, 1]).flatten();
            let currentY = states.slice([0, 1], [-1, 1]).flatten();
            let currentTheta = states.slice([0, 2], [-1, 1]).flatten();

            const evaderX = tf.scalar(this.evaderState.position.x);
            const evaderY = tf.scalar(this.evaderState.position.y);
            const safeDist = tf.scalar(safeDistance);
            const colWeight = tf.scalar(collisionWeight);
            const dtScalar = tf.scalar(dtFrames);

            const vizPointsX = [];
            const vizPointsY = [];
            
            // Capture initial controls for final weighted sum
            let v0 = null;
            let omega0 = null;

            for (let t = 0; t < horizonSteps; t++) {
                // --- Dynamics & Control ---
                
                // 1. Guidance
                const dx = evaderX.sub(currentX);
                const dy = evaderY.sub(currentY);
                const distToGoal = dx.square().add(dy.square()).sqrt();
                
                const desiredTheta = tf.atan2(dy, dx);
                let headingError = desiredTheta.sub(currentTheta);
                
                // Normalize angle error to [-PI, PI] correctly handling negative modulo
                // ((x + PI) % 2PI + 2PI) % 2PI - PI
                const PI = Math.PI;
                const TWO_PI = 2 * PI;
                headingError = headingError.add(PI).mod(TWO_PI).add(TWO_PI).mod(TWO_PI).sub(PI);
                
                // Kinematic Constraint: Slow down if turning sharply
                // turnSpeedLimit = vMax * max(0.1, cos(error))
                const turnSpeedFactor = headingError.cos().maximum(0.1);
                const turnSpeedLimit = turnSpeedFactor.mul(vMax);
                
                // Base controls
                // baseV = min(dist, turnSpeedLimit)
                const baseV = distToGoal.minimum(turnSpeedLimit).clipByValue(0, vMax);
                const baseOmega = headingError.mul(2.0).clipByValue(-omegaMax, omegaMax);
                
                // Add noise
                const stepNoiseV = noiseV.slice([0, t], [-1, 1]).flatten().mul(mppiSigma).mul(vMax); 
                const stepNoiseOmega = noiseOmega.slice([0, t], [-1, 1]).flatten().mul(mppiSigma).mul(omegaMax);
                
                // Combine
                let v = baseV.add(stepNoiseV).clipByValue(this.config.vMin, vMax);
                let omega = baseOmega.add(stepNoiseOmega).clipByValue(-omegaMax, omegaMax);
                
                if (t === 0) {
                    v0 = v;
                    omega0 = omega;
                }
                
                // --- SDF Collision Check (Before moving) ---
                const gridX = currentX.sub(this.sdfConfig.minX).div(this.sdfConfig.resolution);
                const gridY = currentY.sub(this.sdfConfig.minY).div(this.sdfConfig.resolution);
                
                // Indices
                const x0 = gridX.floor().toInt();
                const x1 = x0.add(1);
                const y0 = gridY.floor().toInt();
                const y1 = y0.add(1);
                
                // Clip indices
                const W = this.sdfConfig.width;
                const H = this.sdfConfig.height;
                const x0c = x0.clipByValue(0, W - 1);
                const x1c = x1.clipByValue(0, W - 1);
                const y0c = y0.clipByValue(0, H - 1);
                const y1c = y1.clipByValue(0, H - 1);
                
                // Gather indices (1D)
                const idx00 = y0c.mul(W).add(x0c).toInt();
                const idx10 = y0c.mul(W).add(x1c).toInt();
                const idx01 = y1c.mul(W).add(x0c).toInt();
                const idx11 = y1c.mul(W).add(x1c).toInt();
                
                const v00 = this.sdfTensor.gather(idx00);
                const v10 = this.sdfTensor.gather(idx10);
                const v01 = this.sdfTensor.gather(idx01);
                const v11 = this.sdfTensor.gather(idx11);
                
                // Weights
                const wx = gridX.sub(x0.toFloat());
                const wy = gridY.sub(y0.toFloat());
                
                // Interpolate
                const top = v00.mul(tf.scalar(1).sub(wx)).add(v10.mul(wx));
                const bottom = v01.mul(tf.scalar(1).sub(wx)).add(v11.mul(wx));
                const distToObs = top.mul(tf.scalar(1).sub(wy)).add(bottom.mul(wy));
                
                // --- Cost Calculation ---
                costs = costs.add(distToGoal);
                
                // 2. Collision Cost
                const collisionTerm = safeDist.sub(distToObs).relu().mul(colWeight);
                costs = costs.add(collisionTerm);
                
                // --- Apply Speed Limit based on SDF ---
                const distRatio = distToObs.div(40.0).clipByValue(0, 1);
                const speedFactor = distRatio.mul(0.9).add(0.1);
                v = v.mul(speedFactor);
                
                // --- Update State ---
                const dxMove = v.mul(currentTheta.cos()).mul(dtScalar);
                const dyMove = v.mul(currentTheta.sin()).mul(dtScalar);
                const dTheta = omega.mul(dtScalar);
                
                currentX = currentX.add(dxMove);
                currentY = currentY.add(dyMove);
                currentTheta = currentTheta.add(dTheta);
                
                // Store for viz (only every 5th step to save memory?)
                vizPointsX.push(currentX);
                vizPointsY.push(currentY);
            }
            
            // --- Weight Computation ---
            const minCost = costs.min();
            const costDiff = costs.sub(minCost);
            const weights = tf.exp(costDiff.div(-mppiLambda));
            const weightSum = weights.sum();
            
            // Compute both strategies on GPU to avoid multiple downloads
            
            // 1. Weighted Average Strategy
            const normalizedWeights = weights.div(weightSum);
            const weightedV = v0.mul(normalizedWeights).sum();
            const weightedOmega = omega0.mul(normalizedWeights).sum();
            
            // 2. Best Sample Strategy (Fallback)
            const bestIdx = costs.argMin();
            const bestV = v0.gather([bestIdx]).squeeze();
            const bestOmega = omega0.gather([bestIdx]).squeeze();
            
            // Return tensors needed for async download
            return {
                weightSum,
                weightedV,
                weightedOmega,
                bestV,
                bestOmega,
                // For viz, let's just take the first 20 trajectories
                // vizPointsX is array of [K] tensors.
                // We want [20, T]
                vizX: tf.stack(vizPointsX).transpose().slice([0, 0], [20, -1]),
                vizY: tf.stack(vizPointsY).transpose().slice([0, 0], [20, -1])
            };
        });

        // Now we are outside tidy, but we hold references to tensors in `tensorsToDownload`
        // We need to download data async
        
        try {
            // Parallel download of all scalar values
            const [weightSumVal, weightedVVal, weightedOmegaVal, bestVVal, bestOmegaVal, vizXData, vizYData] = await Promise.all([
                tensorsToDownload.weightSum.data(),
                tensorsToDownload.weightedV.data(),
                tensorsToDownload.weightedOmega.data(),
                tensorsToDownload.bestV.data(),
                tensorsToDownload.bestOmega.data(),
                tensorsToDownload.vizX.array(),
                tensorsToDownload.vizY.array()
            ]);
            
            let finalV, finalOmega;
            const sum = weightSumVal[0];

            if (sum < 1e-10 || isNaN(sum)) {
                // Fallback to best sample
                finalV = bestVVal[0];
                finalOmega = bestOmegaVal[0];
            } else {
                // Use weighted average
                finalV = weightedVVal[0];
                finalOmega = weightedOmegaVal[0];
            }
            
            const trajectories = vizXData.map((xs, i) => {
                return xs.map((x, t) => ({ x: x, y: vizYData[i][t] }));
            });

            return {
                control: { v: finalV, omega: finalOmega },
                trajectories: trajectories
            };

        } finally {
            // Cleanup all tensors returned by tidy
            tf.dispose(tensorsToDownload);
        }
    }

    runMPPI() {
        // Legacy synchronous method - kept for reference or fallback
        // But we replaced usage with runMPPIAsync
        return { control: { v: 0, omega: 0 }, trajectories: [] };
    }

    updatePursuer(control, deltaTime) {
        const state = this.pursuerState;
        const { v, omega } = control;
        
        if (isNaN(v) || isNaN(omega)) return;

        // Apply unicycle model
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
}

export const tensorFlowMPPIService = new TensorFlowMPPIService();
