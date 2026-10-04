import { Grid, MUD, WALL } from './grid.js';

/**
 * The map shown on first load: two walls with a doorway in the middle,
 * and a field of mud between the doorways. BFS walks straight through
 * the mud (fewest steps); Dijkstra and A* take the dry lanes around it
 * (lowest cost), so the difference shows on the very first run.
 *
 * Built along the board's long side, so it suits landscape screens and
 * portrait phones alike.
 */
export function demoMap(cols, rows) {
  const grid = new Grid(cols, rows);
  const portrait = rows > cols;
  const long = portrait ? rows : cols;
  const across = portrait ? cols : rows;
  const at = (u, v) => (portrait ? grid.index(v, u) : grid.index(u, v));

  const mid = Math.floor(across / 2);
  const wallA = Math.floor(long / 4);
  const wallB = long - 1 - wallA;

  for (let v = 0; v < across; v++) {
    if (Math.abs(v - mid) <= 1) continue; // doorway
    grid.set(at(wallA, v), WALL);
    grid.set(at(wallB, v), WALL);
  }
  for (let u = wallA + 2; u <= wallB - 2; u++) {
    for (let v = 2; v < across - 2; v++) grid.set(at(u, v), MUD);
  }

  grid.start = at(Math.max(1, Math.floor(wallA / 2)), mid);
  grid.goal = at(long - 1 - Math.max(1, Math.floor(wallA / 2)), mid);
  return grid;
}
