import bfs from './bfs.js';
import dijkstra from './dijkstra.js';
import astar from './astar.js';

/**
 * Every algorithm the UI can run. To add one, write a module that
 * exports { id, name, short, weighted, search(grid, start, goal) }
 * returning the shape described in result.js, and list it here.
 * The menus, animation and stats pick it up from this list.
 */
export const ALGORITHMS = [bfs, dijkstra, astar];

export function getAlgorithm(id) {
  const algorithm = ALGORITHMS.find((a) => a.id === id);
  if (!algorithm) throw new Error(`Unknown algorithm "${id}".`);
  return algorithm;
}

/** Runs a search and adds timeMs, the wall-clock time the search took. */
export function runSearch(id, grid, start = grid.start, goal = grid.goal) {
  const { search } = getAlgorithm(id);
  const t0 = performance.now();
  const result = search(grid, start, goal);
  result.timeMs = performance.now() - t0;
  return result;
}
