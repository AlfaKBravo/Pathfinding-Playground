import { Grid, MUD, WALL } from '../js/core/grid.js';

/** Small seeded random number generator (mulberry32), for repeatable tests. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A grid with random walls and mud; start and goal are always open. */
export function randomGrid(cols, rows, random, { walls = 0.25, mud = 0.15 } = {}) {
  const grid = new Grid(cols, rows);
  for (let i = 0; i < grid.size; i++) {
    const roll = random();
    if (roll < walls) grid.set(i, WALL);
    else if (roll < walls + mud) grid.set(i, MUD);
  }
  grid.start = Math.floor(random() * grid.size);
  do grid.goal = Math.floor(random() * grid.size);
  while (grid.goal === grid.start);
  grid.set(grid.start, 0);
  grid.set(grid.goal, 0);
  return grid;
}

/**
 * Lowest cost from start to goal by repeated relaxation (Bellman-Ford).
 * Slow but independent of the heap, so it checks the algorithms fairly.
 * stepCost overrides grid.cost, e.g. () => 1 to count steps.
 */
export function referenceCost(grid, start, goal, stepCost = (i) => grid.cost(i)) {
  const dist = new Array(grid.size).fill(Infinity);
  dist[start] = 0;
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < grid.size; i++) {
      if (dist[i] === Infinity) continue;
      for (const n of grid.neighbors(i)) {
        const d = dist[i] + stepCost(n);
        if (d < dist[n]) {
          dist[n] = d;
          changed = true;
        }
      }
    }
  }
  return dist[goal];
}

/** Checks that a path is a connected walk over open cells from start to goal. */
export function isValidPath(grid, path, start, goal) {
  if (path[0] !== start || path[path.length - 1] !== goal) return false;
  for (let i = 0; i < path.length; i++) {
    if (!grid.isWalkable(path[i])) return false;
    if (i > 0 && grid.manhattan(path[i - 1], path[i]) !== 1) return false;
  }
  return true;
}
