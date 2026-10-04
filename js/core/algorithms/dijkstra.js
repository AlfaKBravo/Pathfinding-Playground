import { MinHeap } from '../heap.js';
import { buildResult } from './result.js';

const byCost = (a, b) => a.g - b.g || a.seq - b.seq;

/**
 * Dijkstra's algorithm. Always expands the frontier cell with the lowest
 * cost from the start, so when the goal comes off the heap its cost is
 * the lowest possible. The heap uses lazy deletion: a cheaper route
 * pushes a new entry, and stale entries are skipped when popped.
 */
export function dijkstra(grid, start, goal) {
  const parent = new Int32Array(grid.size).fill(-1);
  const dist = new Float64Array(grid.size).fill(Infinity);
  const closed = new Uint8Array(grid.size);
  const heap = new MinHeap(byCost);
  const trace = [];
  let visited = 0;
  let seq = 0;
  dist[start] = 0;
  heap.push({ node: start, g: 0, seq: seq++ });

  while (!heap.isEmpty()) {
    const { node, g } = heap.pop();
    if (closed[node]) continue;
    closed[node] = 1;
    visited++;
    const opened = [];
    trace.push({ node, opened });
    if (node === goal) return buildResult(grid, parent, start, goal, true, visited, trace);

    for (const next of grid.neighbors(node)) {
      if (closed[next]) continue;
      const cost = g + grid.cost(next);
      if (cost < dist[next]) {
        dist[next] = cost;
        parent[next] = node;
        heap.push({ node: next, g: cost, seq: seq++ });
        opened.push(next);
      }
    }
  }
  return buildResult(grid, parent, start, goal, false, visited, trace);
}

/**
 * Lowest cost from source to every cell (Infinity where unreachable).
 * Used by the fleeing agent to judge how soon the chaser can reach a cell.
 */
export function costMap(grid, source) {
  const dist = new Float64Array(grid.size).fill(Infinity);
  const heap = new MinHeap(byCost);
  let seq = 0;
  dist[source] = 0;
  heap.push({ node: source, g: 0, seq: seq++ });
  while (!heap.isEmpty()) {
    const { node, g } = heap.pop();
    if (g > dist[node]) continue;
    for (const next of grid.neighbors(node)) {
      const cost = g + grid.cost(next);
      if (cost < dist[next]) {
        dist[next] = cost;
        heap.push({ node: next, g: cost, seq: seq++ });
      }
    }
  }
  return dist;
}

export default {
  id: 'dijkstra',
  name: "Dijkstra's algorithm",
  short: 'Dijkstra',
  weighted: true,
  search: dijkstra,
};
