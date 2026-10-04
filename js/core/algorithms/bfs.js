import { buildResult } from './result.js';

/**
 * Breadth-first search. Explores the grid in rings of equal step count
 * using a FIFO queue, so the first time it reaches the goal it has a
 * path with the fewest steps. It ignores mud: every step counts as one.
 */
export function bfs(grid, start, goal) {
  const parent = new Int32Array(grid.size).fill(-1);
  const discovered = new Uint8Array(grid.size);
  const queue = [start];
  const trace = [];
  let head = 0;
  let visited = 0;
  discovered[start] = 1;

  while (head < queue.length) {
    const node = queue[head++];
    visited++;
    const opened = [];
    trace.push({ node, opened });
    if (node === goal) return buildResult(grid, parent, start, goal, true, visited, trace);

    for (const next of grid.neighbors(node)) {
      if (discovered[next]) continue;
      discovered[next] = 1;
      parent[next] = node;
      queue.push(next);
      opened.push(next);
    }
  }
  return buildResult(grid, parent, start, goal, false, visited, trace);
}

export default {
  id: 'bfs',
  name: 'Breadth-first search',
  short: 'BFS',
  weighted: false,
  search: bfs,
};
