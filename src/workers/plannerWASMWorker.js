/* eslint-disable no-restricted-globals */
// Planner WASM Web Worker
// Uses Rust/WASM implementation for high-performance planning

let wasmModule = null;
let rrtService = null;
let sensorService = null;
let activeService = null;
let initialized = false;
let globalBounds = null; // Store bounds for config updates

// Load WASM module
async function initWASM() {
  try {
    // Import the WASM module (uses actual generated name from wasm-pack)
    wasmModule = await import('../../pkg/reachability_wasm.js');
    await wasmModule.default(); // Initialize WASM
    
    // Create service instances
    rrtService = new wasmModule.RRTStarService();
    sensorService = new wasmModule.SensorModelService();
    activeService = new wasmModule.ActiveTrackingService();
    
    return true;
  } catch (err) {
    console.error('Failed to load WASM module:', err);
    throw err;
  }
}

function reconstructPathFromFlat(nodes, edges, targetIndex) {
  if (!nodes || targetIndex < 0 || targetIndex >= nodes.length) return [];
  
  // Build parent map from edges
  const parentMap = new Map();
  for (const [parentIdx, childIdx] of edges) {
    parentMap.set(childIdx, parentIdx);
  }
  
  // Reconstruct path by following parents backward
  const path = [];
  let current = targetIndex;
  
  while (current !== undefined && current >= 0) {
    const node = nodes[current];
    path.unshift({ x: node.x, y: node.y, theta: node.theta });
    current = parentMap.get(current);
  }
  
  return path;
}

self.onmessage = async (e) => {
  const { type, payload } = e.data || {};

  try {
    if (type === 'init') {
      const { obstacles = [], rrtConfig = {}, pursuerSensorParams = null } = payload || {};
      
      // Initialize WASM if not already done
      if (!wasmModule) {
        await initWASM();
      }
      
      // Store bounds globally for config updates
      if (rrtConfig && rrtConfig.bounds) {
        globalBounds = rrtConfig.bounds;
      }
      
      // Initialize RRT service
      const obstaclesJS = obstacles;
      const configJS = rrtConfig || {};
      rrtService.initialize(obstaclesJS, configJS);
      
      // Initialize sensor service - WASM uses constructor + setters, not initialize()
      if (obstaclesJS && obstaclesJS.length > 0) {
        sensorService.set_obstacles(obstaclesJS);
      }
      if (pursuerSensorParams) {
        sensorService.update_pursuer_sensor(pursuerSensorParams);
      }
      
      // Initialize active tracking service - WASM uses constructor + setters, not initialize()
      if (obstaclesJS && obstaclesJS.length > 0) {
        activeService.set_obstacles(obstaclesJS);
      }
      if (pursuerSensorParams) {
        activeService.update_sensor_params(pursuerSensorParams);
      }
      
      initialized = true;
      self.postMessage({ type: 'initialized' });
      return;
    }
    if (type === 'config') {
      if (!initialized || !rrtService || !sensorService || !activeService) {
        throw new Error('Worker not initialized - call init first');
      }
      
      const { rrtConfig = {}, pursuerSensorParams = null } = payload || {};
      
      if (rrtConfig && Object.keys(rrtConfig).length > 0) {
        // WASM requires bounds to be present in config updates
        // If bounds not included, keep the existing bounds from initialization
        if (!rrtConfig.bounds && globalBounds) {
          rrtConfig.bounds = globalBounds;
        }
        rrtService.update_config(rrtConfig);
      }
      
      if (pursuerSensorParams) {
        sensorService.update_pursuer_sensor(pursuerSensorParams);
        activeService.update_sensor_params(pursuerSensorParams);
      }
      
      self.postMessage({ type: 'configured' });
      return;
    }

    if (type === 'obstacles') {
      if (!initialized || !rrtService || !sensorService || !activeService) {
        throw new Error('Worker not initialized - call init first');
      }
      
      const { obstacles = [] } = payload || {};
      
      rrtService.update_obstacles(obstacles);
      sensorService.set_obstacles(obstacles);
      activeService.set_obstacles(obstacles);
      
      self.postMessage({ 
        type: 'obstaclesUpdated', 
        payload: { count: Array.isArray(obstacles) ? obstacles.length : 0 } 
      });
      return;
    }

    if (type === 'plan') {
      if (!initialized) {
        throw new Error('Worker not initialized');
      }

      const { pursuerState, evaderState, strategy = 'tma' } = payload || {};

      // Normalize states
      const pState = pursuerState.theta !== undefined
        ? pursuerState
        : { x: pursuerState.position.x, y: pursuerState.position.y, theta: pursuerState.heading || 0 };
      const eState = evaderState.theta !== undefined
        ? evaderState
        : { x: evaderState.position.x, y: evaderState.position.y, theta: evaderState.heading || 0 };

      // Set states
      rrtService.set_pursuer_state(pState.x, pState.y, pState.theta);
      rrtService.set_evader_state(eState.x, eState.y, eState.theta);

      // Plan both agents
      const t0 = performance.now();
      const planResult = rrtService.plan_both_agents();
      const planTime = performance.now() - t0;

      // Extract trees
      const pursuerTree = planResult.pursuer_tree;
      const evaderTree = planResult.evader_tree;

      // Transform flat tree to RRTNode format for WASM visibility computation
      // WASM expects: {state: {x, y, theta}, parent_idx: Option<usize>, children_idx: Vec<usize>, cost}
      // Flat tree has: {nodes: [{x, y, theta, cost}], edges: [[parent, child]]}
      const transformFlatTree = (flatTree) => {
        const nodes = flatTree.nodes.map((node, idx) => ({
          state: { x: node.x, y: node.y, theta: node.theta },
          parent_idx: null, // Will be filled from edges
          children_idx: [],  // Will be filled from edges
          cost: node.cost
        }));
        
        // Build parent-child relationships from edges
        for (const [parentIdx, childIdx] of flatTree.edges) {
          nodes[childIdx].parent_idx = parentIdx;
          nodes[parentIdx].children_idx.push(childIdx);
        }
        
        return nodes;
      };
      
      const pursuerNodes = transformFlatTree(pursuerTree);
      const evaderNodes = transformFlatTree(evaderTree);

      // Compute visibility matrix - WASM expects complete RRTNode format
      const t1 = performance.now();
      activeService.compute_visibility_matrix(pursuerNodes, evaderNodes);
      
      // Compute strategies
      const strategies = activeService.compute_strategies();
      const visibilityTime = performance.now() - t1;

      // Select strategy
      const selected = strategies && strategies[strategy] ? strategies[strategy] : null;

      let pursuerIndex = 0;
      let evaderIndex = 0;
      
      if (selected) {
        if (selected.type === 'pursuer') {
          pursuerIndex = selected.winningNodeIndex ?? 0;
          evaderIndex = 0;
        } else {
          pursuerIndex = 0;
          evaderIndex = selected.winningNodeIndex ?? 0;
        }
      }

      // Reconstruct paths
      const pathP = reconstructPathFromFlat(pursuerTree.nodes, pursuerTree.edges, pursuerIndex);
      const pathE = reconstructPathFromFlat(evaderTree.nodes, evaderTree.edges, evaderIndex);

      self.postMessage({
        type: 'planned',
        payload: {
          stats: {
            planningTime: planTime,
            visibilityTime: visibilityTime,
            totalTime: planTime + visibilityTime,
            pursuerNodes: pursuerTree.nodes.length,
            evaderNodes: evaderTree.nodes.length
          },
          pursuer: { 
            nodes: pursuerTree.nodes, 
            edges: pursuerTree.edges, 
            winningIndex: pursuerIndex, 
            path: pathP 
          },
          evader: { 
            nodes: evaderTree.nodes, 
            edges: evaderTree.edges, 
            winningIndex: evaderIndex, 
            path: pathE 
          },
          strategy,
          usingWASM: true
        }
      });
      return;
    }
  } catch (err) {
    console.error('WASM Worker error:', err);
    self.postMessage({ 
      type: 'error', 
      payload: { 
        message: err?.message || String(err),
        wasmError: true
      } 
    });
  }
};

// Signal ready
self.postMessage({ type: 'ready' });
