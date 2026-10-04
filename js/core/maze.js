import { EMPTY, WALL } from './grid.js';

/**
 * Fills the grid with a maze using the recursive backtracker.
 *
 * Rooms sit on odd (col, row) positions, with walls between them. From
 * the current room, pick a random unvisited room two cells away, knock
 * out the wall between, and move there. When a room has no unvisited
 * neighbours, back up to the previous one. An explicit stack replaces
 * recursion so large grids cannot overflow the call stack.
 *
 * The result is a perfect maze: exactly one route between any two rooms.
 * Start goes to the top-left room and goal to the bottom-right one.
 *
 * rng returns a number in [0, 1); pass a seeded one for repeatable mazes.
 */
export function generateMaze(grid, rng = Math.random) {
  grid.cells.fill(WALL);
  const lastCol = lastOdd(grid.cols);
  const lastRow = lastOdd(grid.rows);
  const first = grid.index(1, 1);
  grid.set(first, EMPTY);
  const stack = [first];

  while (stack.length > 0) {
    const room = stack[stack.length - 1];
    const col = grid.col(room);
    const row = grid.row(room);
    const options = [];
    for (const [dx, dy] of [[0, -2], [2, 0], [0, 2], [-2, 0]]) {
      const c = col + dx;
      const r = row + dy;
      if (c < 1 || r < 1 || c > lastCol || r > lastRow) continue;
      if (grid.get(grid.index(c, r)) === WALL) options.push([c, r]);
    }
    if (options.length === 0) {
      stack.pop();
      continue;
    }
    const [c, r] = options[Math.floor(rng() * options.length)];
    grid.set(grid.index((col + c) / 2, (row + r) / 2), EMPTY);
    const next = grid.index(c, r);
    grid.set(next, EMPTY);
    stack.push(next);
  }

  grid.start = first;
  grid.goal = grid.index(lastCol, lastRow);
  return grid;
}

/** Largest odd index that leaves a border wall: size - 2, or size - 3 if that is even. */
function lastOdd(size) {
  return (size - 2) % 2 === 1 ? size - 2 : size - 3;
}
