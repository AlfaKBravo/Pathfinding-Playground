import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Grid, EMPTY, MUD, MUD_COST, WALL } from '../js/core/grid.js';
import { generateMaze } from '../js/core/maze.js';
import { bfs } from '../js/core/algorithms/bfs.js';
import { rng } from './helpers.js';

test('converts between index and column / row', () => {
  const grid = new Grid(10, 6);
  const i = grid.index(7, 4);
  assert.equal(i, 47);
  assert.equal(grid.col(i), 7);
  assert.equal(grid.row(i), 4);
});

test('rejects sizes outside the allowed range', () => {
  assert.throws(() => new Grid(2, 10), RangeError);
  assert.throws(() => new Grid(10, 500), RangeError);
  assert.throws(() => new Grid(10.5, 10), RangeError);
});

test('neighbours are 4-directional, stay on the board and skip walls', () => {
  const grid = new Grid(5, 5);
  assert.deepEqual(grid.neighbors(grid.index(0, 0)), [grid.index(1, 0), grid.index(0, 1)]);
  grid.set(grid.index(2, 1), WALL);
  assert.deepEqual(grid.neighbors(grid.index(2, 2)), [grid.index(3, 2), grid.index(2, 3), grid.index(1, 2)]);
});

test('mud costs 5 to enter, other cells 1', () => {
  const grid = new Grid(5, 5);
  grid.set(3, MUD);
  assert.equal(grid.cost(3), MUD_COST);
  assert.equal(grid.cost(4), 1);
});

test('maps survive a JSON round trip', () => {
  const grid = new Grid(8, 6);
  grid.set(grid.index(3, 2), WALL);
  grid.set(grid.index(4, 2), MUD);
  grid.start = grid.index(0, 0);
  grid.goal = grid.index(7, 5);
  const copy = Grid.fromJSON(JSON.parse(JSON.stringify(grid)));
  assert.equal(copy.cols, 8);
  assert.equal(copy.rows, 6);
  assert.deepEqual([...copy.cells], [...grid.cells]);
  assert.equal(copy.start, grid.start);
  assert.equal(copy.goal, grid.goal);
});

test('importing a broken map explains the problem', () => {
  const good = new Grid(6, 5).toJSON();
  assert.throws(() => Grid.fromJSON({ ...good, format: 'other' }), /not a Pathfinding Playground map/);
  assert.throws(() => Grid.fromJSON({ ...good, cells: good.cells.slice(1) }), /5 rows/);
  assert.throws(() => Grid.fromJSON({ ...good, cells: good.cells.map((r, i) => (i === 2 ? r + '.' : r)) }), /Row 3/);
  assert.throws(() => Grid.fromJSON({ ...good, cells: good.cells.map((r, i) => (i === 0 ? 'x' + r.slice(1) : r)) }), /unknown cell/);
  assert.throws(() => Grid.fromJSON({ ...good, start: [99, 0] }), /start/);
  assert.throws(() => Grid.fromJSON({ ...good, goal: good.start }), /different/);
  const walled = { ...good, cells: good.cells.map((r, i) => (i === good.start[1] ? '#'.repeat(6) : r)) };
  assert.throws(() => Grid.fromJSON(walled), /on a wall/);
});

test('the maze generator makes a perfect maze that links start and goal', () => {
  for (const [cols, rows, seed] of [[41, 23, 1], [19, 25, 2], [20, 14, 3]]) {
    const grid = generateMaze(new Grid(cols, rows), rng(seed));
    assert.equal(grid.get(grid.start), EMPTY);
    assert.equal(grid.get(grid.goal), EMPTY);

    // every open cell is reachable from the start
    const open = [...grid.cells].filter((c) => c !== WALL).length;
    const seen = new Set([grid.start]);
    const queue = [grid.start];
    while (queue.length) for (const n of grid.neighbors(queue.shift())) if (!seen.has(n)) seen.add(n), queue.push(n);
    assert.equal(seen.size, open);

    // a perfect maze is a tree: edges = cells - 1
    let edges = 0;
    for (let i = 0; i < grid.size; i++) if (grid.isWalkable(i)) edges += grid.neighbors(i).length;
    assert.equal(edges / 2, open - 1);

    assert.equal(bfs(grid, grid.start, grid.goal).found, true);
  }
});

test('the same seed makes the same maze', () => {
  const a = generateMaze(new Grid(21, 15), rng(9));
  const b = generateMaze(new Grid(21, 15), rng(9));
  assert.deepEqual([...a.cells], [...b.cells]);
});
