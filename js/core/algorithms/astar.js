import { MinHeap } from '../heap.js';
import { buildResult } from './result.js';

/**
 * Lowest f = g + h first. On a tie, prefer the cell closer to the goal
 * (smaller h): it pushes the search forward instead of widening it.
 */
const byEstimate = (a, b) => a.f - b.f || a.h - b.h || a.seq - b.seq;

/**
 * A* search. Like Dijkstra, but ranks frontier cells by
 * g (cost so far) + h (estimated cost to the goal). The estimate is the
 * Manhattan distance, which never overestimates because every step
 * costs at least 1 and moves are 4-directional. With such a heuristic
 * A* still returns a lowest-cost path, while skipping cells that lead
 * away from the goal.
 */
export function astar(grid, start, goal) {
  const parent = new Int32Array(grid.size).fill(-1);
  const dist = new Float64Array(grid.size).fill(Infinity);
  const closed = new Uint8Array(grid.size);
  const heap = new MinHeap(byEstimate);
  const trace = [];
  let visited = 0;
  let seq = 0;
  const h0 = grid.manhattan(start, goal);
  dist[start] = 0;
  heap.push({ node: start, g: 0, h: h0, f: h0, seq: seq++ });

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
        const h = grid.manhattan(next, goal);
        heap.push({ node: next, g: cost, h, f: cost + h, seq: seq++ });
        opened.push(next);
      }
    }
  }
  return buildResult(grid, parent, start, goal, false, visited, trace);
}

export default {
  id: 'astar',
  name: 'A* search',
  short: 'A*',
  weighted: true,
  search: astar,
};
