/* eslint-disable no-restricted-globals */
// Planner Web Worker (module)
// Performs RRT* planning, visibility computation, and strategy selection off the main thread.

import { RRTStarService } from '../services/RRTStarService.js';
import { ActiveTrackingService } from '../services/ActiveTrackingService.js';
import { SensorModelService } from '../services/SensorModelService.js';

const rrt = new RRTStarService();
const sensors = new SensorModelService();
const active = new ActiveTrackingService();

let initialized = false;

function applyRrtConfig(cfg = {}) {
  // Shallow merge into existing config
  rrt.config = {
    ...rrt.config,
    ...cfg,
    bounds: cfg.bounds ? { ...rrt.config.bounds, ...cfg.bounds } : rrt.config.bounds
  };
}

function flattenTree(root) {
  if (!root) return { nodes: [], edges: [] };

  const nodes = [];
  const edges = [];
  const queue = [{ node: root, parentIndex: -1 }];

  while (queue.length) {
    const { node, parentIndex } = queue.shift();
    const currentIndex = nodes.length;
    nodes.push({ x: node.state.x, y: node.state.y, theta: node.state.theta || 0, cost: node.cost || 0 });
    if (parentIndex >= 0) edges.push([parentIndex, currentIndex]);

    if (node.children && node.children.length) {
      for (const child of node.children) {
        queue.push({ node: child, parentIndex: currentIndex });
      }
    }
  }

  return { nodes, edges };
}

function reconstructPathToIndex(root, targetIndex) {
  // Build a flat array to index nodes deterministically like activeTrackingService.treeToArray
  const arr = [];
  const queue = [root];
  while (queue.length) {
    const n = queue.shift();
    arr.push(n);
    if (n.children && n.children.length) queue.push(...n.children);
  }
  if (targetIndex < 0 || targetIndex >= arr.length) return [];

  const path = [];
  let cur = arr[targetIndex];
  while (cur) {
    path.unshift({ x: cur.state.x, y: cur.state.y, theta: cur.state.theta || 0 });
    cur = cur.parent || null;
  }
  return path;
}

self.onmessage = async (e) => {
  const { type, payload } = e.data || {};

  try {
    if (type === 'init') {
      const { obstacles = [], rrtConfig = {}, pursuerSensorParams = null } = payload || {};
      // Obstacles
      rrt.obstacles = obstacles;
      sensors.setObstacles(obstacles);
      active.setObstacles(obstacles);
      active.setSensorModelService(sensors);
      // Config
      applyRrtConfig(rrtConfig || {});
      // Sensor params override
      if (pursuerSensorParams) {
        Object.assign(sensors.pursuerSensor, pursuerSensorParams);
      }
      initialized = true;
      self.postMessage({ type: 'initialized' });
      return;
    }

    if (type === 'config') {
      const { rrtConfig = {}, pursuerSensorParams = null } = payload || {};
      applyRrtConfig(rrtConfig || {});
      if (pursuerSensorParams) Object.assign(sensors.pursuerSensor, pursuerSensorParams);
      self.postMessage({ type: 'configured' });
      return;
    }

    if (type === 'obstacles') {
      const { obstacles = [] } = payload || {};
      rrt.obstacles = obstacles;
      sensors.setObstacles(obstacles);
      active.setObstacles(obstacles);
      self.postMessage({ type: 'obstaclesUpdated', payload: { count: Array.isArray(obstacles) ? obstacles.length : 0 } });
      return;
    }

    if (type === 'plan') {
      if (!initialized) throw new Error('Worker not initialized');

      const { pursuerState, evaderState, strategy = 'tma' } = payload || {};

      // Convert states to RRT format if needed
      const pState = pursuerState.theta !== undefined
        ? pursuerState
        : { x: pursuerState.position.x, y: pursuerState.position.y, theta: pursuerState.heading || 0 };
      const eState = evaderState.theta !== undefined
        ? evaderState
        : { x: evaderState.position.x, y: evaderState.position.y, theta: evaderState.heading || 0 };

      rrt.setPursuerState(pState);
      rrt.setEvaderState(eState);

      const t0 = performance.now();
      const result = rrt.planBothAgents();
      const planTime = performance.now() - t0;

      const pursuerTree = result.pursuerTree;
      const evaderTree = result.evaderTree;

      // Visibility + strategies in worker
      active.computeVisibilityMatrix(pursuerTree, evaderTree);
      const strategies = active.computeStrategies();
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

      const pathP = reconstructPathToIndex(pursuerTree, pursuerIndex);
      const pathE = reconstructPathToIndex(evaderTree, evaderIndex);

      const flatP = flattenTree(pursuerTree);
      const flatE = flattenTree(evaderTree);

      self.postMessage({
        type: 'planned',
        payload: {
          stats: {
            planningTime: planTime,
            pursuerNodes: flatP.nodes.length,
            evaderNodes: flatE.nodes.length
          },
          pursuer: { nodes: flatP.nodes, edges: flatP.edges, winningIndex: pursuerIndex, path: pathP },
          evader: { nodes: flatE.nodes, edges: flatE.edges, winningIndex: evaderIndex, path: pathE },
          strategy
        }
      });
      return;
    }
  } catch (err) {
    self.postMessage({ type: 'error', payload: { message: err?.message || String(err) } });
  }
};
