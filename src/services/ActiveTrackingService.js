/**
 * ActiveTrackingService
 * Implements active tracking algorithm using RRT* trees and sensor model.
 * 
 * Based on surveillance and collision-free tracking paper:
 * - Computes visibility relationships between pursuer and evader nodes
 * - Ne(n_i^p): Set of evader nodes NOT visible from pursuer node i
 * - Np(n_j^e): Set of pursuer nodes that CAN see evader node j
 * 
 * This enables the pursuer to track the evader while maintaining visibility
 * and avoiding obstacles.
 */

import { eventBus } from '../utils/EventBus.js';

export class ActiveTrackingService {
    constructor() {
        // Visibility matrix: visible_p_e[i][j] = can pursuer node i see evader node j
        this.visibilityMatrix = null;
        
        // Node arrays for quick indexing
        this.pursuerNodes = [];
        this.evaderNodes = [];
        
        // Visibility sets
        this.Ne = []; // Ne[i] = indices of evader nodes not visible from pursuer node i
        this.Np = []; // Np[j] = indices of pursuer nodes that can see evader node j
        
        // Obstacles for visibility checking
        this.obstacles = [];
        
        // Sensor model service reference (will be set by app)
        this.sensorModelService = null;
        
        // Sensor parameters (will use from sensor model service)
        this.pursuerSensorParams = null;
        
        // Statistics
        this.stats = {
            totalPursuerNodes: 0,
            totalEvaderNodes: 0,
            visibilityComputeTime: 0,
            visiblePairs: 0,
            averageVisibleEvaderNodes: 0,
            averageTrackingPursuerNodes: 0
        };
        
        console.log('ActiveTrackingService initialized');
    }

    /**
     * Initialize with obstacles and sensor parameters
     * @param {Object} params - {obstacles, pursuerSensorParams, sensorModelService}
     */
    initialize(params) {
        if (params.obstacles) {
            this.obstacles = params.obstacles;
        }
        
        if (params.sensorModelService) {
            this.sensorModelService = params.sensorModelService;
        }
        
        if (params.pursuerSensorParams) {
            this.pursuerSensorParams = params.pursuerSensorParams;
        } else if (this.sensorModelService) {
            // Get from sensor model service
            this.pursuerSensorParams = this.sensorModelService.getPursuerSensorParams();
        }
        
        console.log('ActiveTrackingService initialized:', {
            obstacles: this.obstacles.length,
            sensorParams: this.pursuerSensorParams
        });
    }

    /**
     * Set sensor model service reference
     * @param {SensorModelService} service - Sensor model service instance
     */
    setSensorModelService(service) {
        this.sensorModelService = service;
        if (service && !this.pursuerSensorParams) {
            this.pursuerSensorParams = service.getPursuerSensorParams();
        }
    }

    /**
     * Set obstacles for visibility checking
     * @param {Array} obstacles - Array of polygon obstacles
     */
    setObstacles(obstacles) {
        this.obstacles = obstacles || [];
    }

    /**
     * Convert RRT tree to flat array of nodes
     * @param {RRTNode} root - Root of RRT tree
     * @returns {Array} Flat array of nodes
     */
    treeToArray(root) {
        if (!root) return [];
        
        const nodes = [];
        const queue = [root];
        
        while (queue.length > 0) {
            const node = queue.shift();
            nodes.push(node);
            
            if (node.children) {
                queue.push(...node.children);
            }
        }
        
        return nodes;
    }

    /**
     * Check if pursuer node can see evader node
     * @param {Object} pursuerNode - Pursuer RRT node with state {x, y, theta}
     * @param {Object} evaderNode - Evader RRT node with state {x, y, theta}
     * @returns {boolean} True if visible
     */
    canSeeNode(pursuerNode, evaderNode) {
        if (!this.sensorModelService) {
            console.warn('Sensor model service not set');
            return false;
        }
        
        // Convert RRT node states to sensor model format
        const pursuerState = {
            position: { x: pursuerNode.state.x, y: pursuerNode.state.y },
            heading: pursuerNode.state.theta
        };
        
        const evaderState = {
            position: { x: evaderNode.state.x, y: evaderNode.state.y },
            heading: evaderNode.state.theta
        };
        
        // Use sensor model service to check visibility
        return this.sensorModelService.canSee(
            pursuerState,
            evaderState,
            this.pursuerSensorParams,
            this.obstacles
        );
    }

    /**
     * Compute visibility matrix between all pursuer and evader nodes
     * @param {RRTNode} pursuerTree - Root of pursuer RRT* tree
     * @param {RRTNode} evaderTree - Root of evader RRT* tree
     * @returns {Object} {visibilityMatrix, Ne, Np, stats}
     */
    computeVisibilityMatrix(pursuerTree, evaderTree) {
        const startTime = performance.now();
        
        // Convert trees to arrays
        this.pursuerNodes = this.treeToArray(pursuerTree);
        this.evaderNodes = this.treeToArray(evaderTree);
        
        const numPursuer = this.pursuerNodes.length;
        const numEvader = this.evaderNodes.length;
        
        console.log(`Computing visibility matrix: ${numPursuer} pursuer nodes × ${numEvader} evader nodes`);
        
        // Initialize visibility matrix
        this.visibilityMatrix = Array(numPursuer).fill(null).map(() => 
            Array(numEvader).fill(false)
        );
        
        // Initialize Ne and Np
        this.Ne = Array(numPursuer).fill(null).map(() => []);
        this.Np = Array(numEvader).fill(null).map(() => []);
        
        let visiblePairs = 0;
        
        // Compute visibility for each pair
        for (let i = 0; i < numPursuer; i++) {
            for (let j = 0; j < numEvader; j++) {
                const isVisible = this.canSeeNode(this.pursuerNodes[i], this.evaderNodes[j]);
                this.visibilityMatrix[i][j] = isVisible;
                
                if (isVisible) {
                    visiblePairs++;
                    // Pursuer node i can see evader node j
                    // So j is in the tracking set Np[j]
                    this.Np[j].push(i);
                } else {
                    // Pursuer node i cannot see evader node j
                    // So j is in the non-visible set Ne[i]
                    this.Ne[i].push(j);
                }
            }
            
            // Progress logging
            if ((i + 1) % 100 === 0 || i === numPursuer - 1) {
                console.log(`Visibility computation: ${i + 1}/${numPursuer} pursuer nodes processed`);
            }
        }
        
        const computeTime = performance.now() - startTime;
        
        // Calculate statistics
        const avgVisibleEvaderNodes = this.Ne.reduce((sum, arr) => sum + arr.length, 0) / numPursuer;
        const avgTrackingPursuerNodes = this.Np.reduce((sum, arr) => sum + arr.length, 0) / numEvader;
        
        this.stats = {
            totalPursuerNodes: numPursuer,
            totalEvaderNodes: numEvader,
            visibilityComputeTime: computeTime,
            visiblePairs: visiblePairs,
            totalPairs: numPursuer * numEvader,
            visibilityRatio: visiblePairs / (numPursuer * numEvader),
            averageNonVisibleEvaderNodes: avgVisibleEvaderNodes,
            averageTrackingPursuerNodes: avgTrackingPursuerNodes
        };
        
        console.log('Visibility computation complete:', this.stats);
        
        // Emit event for visualization/analysis
        eventBus.emit('activeTracking:visibilityComputed', {
            visibilityMatrix: this.visibilityMatrix,
            Ne: this.Ne,
            Np: this.Np,
            pursuerNodes: this.pursuerNodes,
            evaderNodes: this.evaderNodes,
            stats: this.stats
        });
        
        return {
            visibilityMatrix: this.visibilityMatrix,
            Ne: this.Ne,
            Np: this.Np,
            stats: this.stats
        };
    }

    /**
     * Get evader nodes not visible from a specific pursuer node
     * @param {number} pursuerNodeIndex - Index of pursuer node
     * @returns {Array} Array of evader node indices
     */
    getNonVisibleEvaderNodes(pursuerNodeIndex) {
        if (pursuerNodeIndex < 0 || pursuerNodeIndex >= this.Ne.length) {
            console.warn('Invalid pursuer node index:', pursuerNodeIndex);
            return [];
        }
        return this.Ne[pursuerNodeIndex];
    }

    /**
     * Get pursuer nodes that can see a specific evader node
     * @param {number} evaderNodeIndex - Index of evader node
     * @returns {Array} Array of pursuer node indices
     */
    getTrackingPursuerNodes(evaderNodeIndex) {
        if (evaderNodeIndex < 0 || evaderNodeIndex >= this.Np.length) {
            console.warn('Invalid evader node index:', evaderNodeIndex);
            return [];
        }
        return this.Np[evaderNodeIndex];
    }

    /**
     * Check if a pursuer node can track a specific evader node
     * @param {number} pursuerNodeIndex - Index of pursuer node
     * @param {number} evaderNodeIndex - Index of evader node
     * @returns {boolean} True if pursuer can see evader
     */
    canTrack(pursuerNodeIndex, evaderNodeIndex) {
        if (!this.visibilityMatrix || 
            pursuerNodeIndex < 0 || pursuerNodeIndex >= this.visibilityMatrix.length ||
            evaderNodeIndex < 0 || evaderNodeIndex >= this.visibilityMatrix[0].length) {
            return false;
        }
        return this.visibilityMatrix[pursuerNodeIndex][evaderNodeIndex];
    }

    /**
     * Find nearest pursuer node that can track the evader's current position
     * @param {Object} evaderState - Current evader state {x, y, theta}
     * @returns {Object|null} {node, index, distance} or null if none found
     */
    findNearestTrackingNode(evaderState) {
        if (!this.pursuerNodes || this.pursuerNodes.length === 0) {
            return null;
        }
        
        if (!this.sensorModelService) {
            console.warn('Sensor model service not set');
            return null;
        }
        
        let minDist = Infinity;
        let bestNode = null;
        let bestIndex = -1;
        
        for (let i = 0; i < this.pursuerNodes.length; i++) {
            const node = this.pursuerNodes[i];
            
            // Check if this pursuer node can see the evader position
            const pursuerState = {
                position: { x: node.state.x, y: node.state.y },
                heading: node.state.theta
            };
            
            const evaderStateFormatted = {
                position: { x: evaderState.x, y: evaderState.y },
                heading: evaderState.theta || 0
            };
            
            const canSee = this.sensorModelService.canSee(
                pursuerState,
                evaderStateFormatted,
                this.pursuerSensorParams,
                this.obstacles
            );
            
            if (!canSee) continue;
            
            // Calculate distance
            const dx = node.state.x - evaderState.x;
            const dy = node.state.y - evaderState.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < minDist) {
                minDist = dist;
                bestNode = node;
                bestIndex = i;
            }
        }
        
        return bestNode ? { node: bestNode, index: bestIndex, distance: minDist } : null;
    }

    /**
     * Get statistics about visibility computation
     * @returns {Object} Statistics object
     */
    getStats() {
        return { ...this.stats };
    }

    /**
     * Compute all active tracking strategies
     * @returns {Object} Solutions for each strategy
     */
    computeStrategies() {
        if (!this.pursuerNodes.length || !this.evaderNodes.length) {
            console.warn('Nodes not available for computing strategies.');
            return null;
        }

        const solutions = {
            pl: this._computePL(),
            el: this._computeEL(),
            elst: this._computeELST(),
            tma: this._computeTMA()
        };

        console.log('Strategy solutions:', solutions);
        eventBus.emit('activeTracking:strategiesComputed', solutions);

        return solutions;
    }

    /**
     * PL – Pursuer as Leader (Eq. 2)
     * Pursuer chooses a node to maximize its minimum margin against any escape.
     */
    _computePL() {
        let bestValue = -Infinity;
        let winningNodeIndex = -1;

        const tau_p = this.pursuerNodes.map(n => n.cost);
        const tau_e = this.evaderNodes.map(n => n.cost);

        for (let i = 0; i < this.pursuerNodes.length; i++) {
            const nonVisibleEvaderIndices = this.Ne[i];

            if (nonVisibleEvaderIndices.length === 0) {
                // This pursuer node sees all evader nodes, perfect surveillance from here.
                // This is a very strong candidate, but let's see if there's a guaranteed capture.
                // For now, we treat this as a high value, but not infinity.
                continue; 
            }

            const minEvaderTime = Math.min(...nonVisibleEvaderIndices.map(j => tau_e[j]));
            const value = minEvaderTime - tau_p[i];

            if (value > bestValue) {
                bestValue = value;
                winningNodeIndex = i;
            }
        }

        return {
            bestValue,
            winningNode: winningNodeIndex !== -1 ? this.pursuerNodes[winningNodeIndex] : null,
            winningNodeIndex,
            type: 'pursuer'
        };
    }

    /**
     * EL – Evader as Leader (Eq. 4)
     * Evader finds an escape node that minimizes the pursuer's interception margin.
     */
    _computeEL() {
        let bestValue = Infinity;
        let winningNodeIndex = -1;

        const tau_p = this.pursuerNodes.map(n => n.cost);
        const tau_e = this.evaderNodes.map(n => n.cost);

        // Per paper, evader searches from nodes not visible from the pursuer's root
        const rootPursuerNodeIndex = 0; 
        const evaderCandidates = this.Ne[rootPursuerNodeIndex];

        for (const j of evaderCandidates) {
            const trackingPursuerIndices = this.Np[j];

            if (trackingPursuerIndices.length === 0) {
                // No pursuer node can see this evader node. It's a winning escape.
                // The margin is effectively -infinity for the pursuer.
                bestValue = -Infinity;
                winningNodeIndex = j;
                break; 
            }

            const minPursuerTime = Math.min(...trackingPursuerIndices.map(i => tau_p[i]));
            const value = tau_e[j] - minPursuerTime;

            if (value < bestValue) {
                bestValue = value;
                winningNodeIndex = j;
            }
        }

        return {
            bestValue,
            winningNode: winningNodeIndex !== -1 ? this.evaderNodes[winningNodeIndex] : null,
            winningNodeIndex,
            type: 'evader'
        };
    }

    /**
     * ELST – Evader with Shortest-Time Escape (Eq. 5–6)
     * Evader finds the fastest winning escape route.
     */
    _computeELST() {
        const tau_p = this.pursuerNodes.map(n => n.cost);
        const tau_e = this.evaderNodes.map(n => n.cost);
        
        const rootPursuerNodeIndex = 0;
        const evaderCandidates = this.Ne[rootPursuerNodeIndex];
        
        const escapeNodes = []; // M_e in the paper

        for (const j of evaderCandidates) {
            const trackingPursuerIndices = this.Np[j];
            if (trackingPursuerIndices.length === 0) {
                escapeNodes.push({ index: j, time: tau_e[j], margin: -Infinity });
                continue;
            }

            const minPursuerTime = Math.min(...trackingPursuerIndices.map(i => tau_p[i]));
            const margin = tau_e[j] - minPursuerTime;

            if (margin < 0) {
                escapeNodes.push({ index: j, time: tau_e[j], margin });
            }
        }

        if (escapeNodes.length > 0) {
            // Find the escape node with the minimum time
            escapeNodes.sort((a, b) => a.time - b.time);
            const winningNodeIndex = escapeNodes[0].index;
            return {
                bestValue: escapeNodes[0].margin,
                winningNode: this.evaderNodes[winningNodeIndex],
                winningNodeIndex,
                type: 'evader'
            };
        } else {
            // If no escape node, fall back to EL
            return this._computeEL();
        }
    }

    /**
     * TMA – Two Moves Ahead (Eq. 7)
     * Pursuer anticipates evader's ELST move and counters it.
     */
    _computeTMA() {
        // 1. Find evader's likely target via ELST
        const elstSolution = this._computeELST();
        if (!elstSolution || elstSolution.winningNodeIndex === -1) {
            // If evader has no move, pursuer can just wait. Or do PL.
            return this._computePL(); 
        }
        const evaderTargetIndex = elstSolution.winningNodeIndex;

        // 2. Pursuer reacts by choosing a node from those that can see the evader's target
        const pursuerCandidates = this.Np[evaderTargetIndex];
        if (pursuerCandidates.length === 0) {
            // This shouldn't happen if ELST fallback to EL works correctly,
            // unless the evader found a completely invisible node.
            // In this case, the pursuer has no counter-move. Fallback to PL.
            return this._computePL();
        }

        let bestValue = -Infinity;
        let winningNodeIndex = -1;

        const tau_p = this.pursuerNodes.map(n => n.cost);
        const tau_e = this.evaderNodes.map(n => n.cost);

        for (const i of pursuerCandidates) {
            const nonVisibleEvaderIndices = this.Ne[i];
            if (nonVisibleEvaderIndices.length === 0) {
                continue;
            }

            const minEvaderTime = Math.min(...nonVisibleEvaderIndices.map(j => tau_e[j]));
            const value = minEvaderTime - tau_p[i];

            if (value > bestValue) {
                bestValue = value;
                winningNodeIndex = i;
            }
        }

        return {
            bestValue,
            winningNode: winningNodeIndex !== -1 ? this.pursuerNodes[winningNodeIndex] : null,
            winningNodeIndex,
            type: 'pursuer'
        };
    }

    /**
     * Export visibility data for analysis
     * @returns {Object} Complete visibility data
     */
    exportVisibilityData() {
        return {
            visibilityMatrix: this.visibilityMatrix,
            Ne: this.Ne,
            Np: this.Np,
            pursuerNodes: this.pursuerNodes.map(n => n.state),
            evaderNodes: this.evaderNodes.map(n => n.state),
            stats: this.stats
        };
    }

    /**
     * Reset the service
     */
    reset() {
        this.visibilityMatrix = null;
        this.pursuerNodes = [];
        this.evaderNodes = [];
        this.Ne = [];
        this.Np = [];
        this.stats = {
            totalPursuerNodes: 0,
            totalEvaderNodes: 0,
            visibilityComputeTime: 0,
            visiblePairs: 0,
            averageVisibleEvaderNodes: 0,
            averageTrackingPursuerNodes: 0
        };
        
        console.log('ActiveTrackingService reset');
    }
}

// Export as singleton
export const activeTrackingService = new ActiveTrackingService();
