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
    }

    configure(config) {
        this.config = { ...this.config, ...config };
    }

    start(pursuerState, evaderState) {
        if (this.isTracking) return;
        
        this.pursuerState = JSON.parse(JSON.stringify(pursuerState));
        this.evaderState = JSON.parse(JSON.stringify(evaderState));
        
        this.isTracking = true;
        this.lastUpdateTime = performance.now();
        this.lastControlTime = 0;
        this.currentControl = { v: 0, omega: 0 };
        
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
        if (currentTime - this.lastControlTime >= controlPeriod) {
            const result = this.runMPPI();
            this.currentControl = result.control;
            this.currentTrajectories = result.trajectories;
            this.lastControlTime = currentTime;
        }

        // 3. Apply control to pursuer
        this.updatePursuer(this.currentControl, deltaTime);

        // 4. Emit update for visualization
        // console.log(`Emitting update with ${this.currentTrajectories.length} trajectories`);
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

    runMPPI() {
        if (!this.pursuerState || !this.pursuerState.position || !this.evaderState || !this.evaderState.position) {
            return { control: { v: 0, omega: 0 }, trajectories: [] };
        }

        const { mppiSamples, mppiHorizon, mppiLambda, mppiSigma, dt, vMax, omegaMax } = this.config;
        const horizonSteps = Math.floor(mppiHorizon / dt);
        
        const trajectories = []; // Array of control sequences
        const trajectoryPoints = []; // Array of point sequences for visualization
        const costs = [];

        // Generate random trajectories
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

                // SDF-aware Base Policy: Slow down near obstacles
                const distToObs = sdfService.getDistance(simState.x, simState.y);
                
                // If near obstacle (e.g. < 40px), reduce speed limit
                // But keep a minimum speed (e.g. 10% of vMax) to allow escaping if stuck
                let obstacleSpeedLimit = vMax;
                if (distToObs < 40.0) {
                    const ratio = Math.max(0, distToObs / 40.0);
                    obstacleSpeedLimit = vMax * (0.1 + 0.9 * ratio);
                }
                
                // Also slow down if we need to turn sharply (Kinematic constraint)
                const turnSpeedLimit = vMax * Math.max(0.1, Math.cos(headingError));

                const effectiveVMax = Math.min(vMax, obstacleSpeedLimit, turnSpeedLimit);
                const baseV = Math.min(effectiveVMax, dist); 
                const baseOmega = Math.max(-omegaMax, Math.min(omegaMax, 2.0 * headingError));

                // Add noise
                const noiseV = (Math.random() - 0.5) * 2 * mppiSigma * vMax;
                const noiseOmega = (Math.random() - 0.5) * 2 * mppiSigma * omegaMax;

                let v = baseV + noiseV;
                let omega = baseOmega + noiseOmega;

                // Clamp
                v = Math.max(this.config.vMin, Math.min(vMax, v));
                omega = Math.max(-omegaMax, Math.min(omegaMax, omega));

                controls.push({ v, omega });

                // Simulate step
                // Convert dt (seconds) to frames (assuming 60fps) for the model
                const dtFrames = dt * 60;
                simState.x += v * Math.cos(simState.theta) * dtFrames;
                simState.y += v * Math.sin(simState.theta) * dtFrames;
                simState.theta += omega * dtFrames;
                
                points.push({x: simState.x, y: simState.y});

                // Cost: Distance to evader (assume static for now)
                const dX = simState.x - this.evaderState.position.x;
                const dY = simState.y - this.evaderState.position.y;
                const stepCost = Math.sqrt(dX*dX + dY*dY);
                
                trajectoryCost += stepCost;

                // Cost: Collision avoidance using SDF
                // distToObs is already computed above for the base policy
                if (distToObs < this.config.safeDistance) {
                    // Exponential barrier or linear penalty
                    // Using linear penalty for simplicity: cost increases as distance decreases
                    // If inside (dist < 0), cost continues to increase linearly
                    const collisionCost = this.config.collisionWeight * (this.config.safeDistance - distToObs);
                    trajectoryCost += collisionCost;
                } else {
                    // Small bonus for being far from obstacles (optional, helps center in corridors)
                    // trajectoryCost -= Math.min(100, distToObs); 
                }
            }
            
            trajectories.push(controls);
            trajectoryPoints.push(points);
            costs.push(trajectoryCost);
        }

        // Compute weights
        const minCost = Math.min(...costs);
        let weightSum = 0;
        const weights = costs.map(c => {
            const w = Math.exp(-(c - minCost) / mppiLambda);
            weightSum += w;
            return w;
        });

        // console.log(`MPPI: Generated ${trajectories.length} trajectories, minCost=${minCost.toFixed(2)}`);

        // Compute weighted average of first control
        let avgV = 0;
        let avgOmega = 0;

        if (weightSum < 1e-10 || isNaN(weightSum)) {
            // Fallback: use the best trajectory (min cost)
            const bestIdx = costs.indexOf(minCost);
            if (bestIdx !== -1) {
                avgV = trajectories[bestIdx][0].v;
                avgOmega = trajectories[bestIdx][0].omega;
            } else {
                avgV = 0;
                avgOmega = 0;
            }
        } else {
            for (let k = 0; k < mppiSamples; k++) {
                const w = weights[k] / weightSum;
                avgV += w * trajectories[k][0].v;
                avgOmega += w * trajectories[k][0].omega;
            }
        }
        
        if (isNaN(avgV) || isNaN(avgOmega)) {
            console.warn('MPPI produced NaN control', { avgV, avgOmega, weightSum, minCost });
            return { control: { v: 0, omega: 0 }, trajectories: trajectoryPoints };
        }

        return { 
            control: { v: avgV, omega: avgOmega },
            trajectories: trajectoryPoints
        };
    }

    updatePursuer(control, deltaTime) {
        const state = this.pursuerState;
        const { v, omega } = control;
        
        if (isNaN(v) || isNaN(omega)) return;

        // Apply unicycle model
        // Use 60fps normalization to match other services
        const dt = deltaTime * 60; 

        state.position.x += v * Math.cos(state.heading) * dt;
        state.position.y += v * Math.sin(state.heading) * dt;
        state.heading += omega * dt;
        
        // Normalize heading
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

export const similarityMPPITrackingService = new SimilarityMPPITrackingService();
