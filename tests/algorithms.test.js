import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { Grid, MUD, WALL } from '../js/core/grid.js';
import { bfs } from '../js/core/algorithms/bfs.js';
import { dijkstra } from '../js/core/algorithms/dijkstra.js';
import { astar } from '../js/core/algorithms/astar.js';
import { ALGORITHMS, runSearch } from '../js/core/algorithms/index.js';
import { generateMaze } from '../js/core/maze.js';
import { demoMap } from '../js/core/presets.js';
import { isValidPath, randomGrid, referenceCost, rng } from './helpers.js';

const SEARCHES = { bfs, dijkstra, astar };
const RANDOM_MAPS = 300;

/** Draws a map from strings: S start, G goal, # wall, ~ mud, . empty. */
function mapOf(lines) {
  const grid = new Grid(lines[0].length, lines.length);
  lines.forEach((line, r) => {
    [...line].forEach((ch, c) => {
      const i = grid.index(c, r);
      if (ch === '#') grid.set(i, WALL);
      if (ch === '~') grid.set(i, MUD);
      if (ch === 'S') grid.start = i;
      if (ch === 'G') grid.goal = i;
    });
  });
  return grid;
}

for (const [name, search] of Object.entries(SEARCHES)) {
  describe(name, () => {
    test('finds a straight path on an open grid', () => {
      const grid = mapOf([
        '.......',
        '.S...G.',
        '.......',
        '.......',
        '.......',
      ]);
      const result = search(grid, grid.start, grid.goal);
      assert.equal(result.found, true);
      assert.equal(result.path.length, 5);
      assert.equal(result.cost, 4);
      assert.ok(isValidPath(grid, result.path, grid.start, grid.goal));
    });

    test('reports no path when the goal is walled off', () => {
      const grid = mapOf([
        '.......',
        '.S..#G#',
        '....###',
        '.......',
        '.......',
      ]);
      grid.set(grid.index(5, 0), WALL);
      const result = search(grid, grid.start, grid.goal);
      assert.equal(result.found, false);
      assert.deepEqual(result.path, []);
      assert.equal(result.cost, 0);
      assert.ok(result.visited > 0);
    });

    test('returns a one-cell path when start is the goal', () => {
      const grid = new Grid(5, 5);
      const result = search(grid, 7, 7);
      assert.equal(result.found, true);
      assert.deepEqual(result.path, [7]);
      assert.equal(result.cost, 0);
      assert.equal(result.visited, 1);
    });

    test('the trace has one entry per visited cell, and no cell is visited twice', () => {
      const grid = randomGrid(20, 15, rng(7));
      const result = search(grid, grid.start, grid.goal);
      assert.equal(result.trace.length, result.visited);
      assert.equal(new Set(result.trace.map((s) => s.node)).size, result.visited);
    });
  });
}

test('BFS returns a path with the fewest steps on maps with no mud', () => {
  const random = rng(1);
  for (let n = 0; n < RANDOM_MAPS; n++) {
    const grid = randomGrid(12 + (n % 9), 8 + (n % 7), random, { mud: 0 });
    const result = bfs(grid, grid.start, grid.goal);
    const steps = referenceCost(grid, grid.start, grid.goal, () => 1);
    if (steps === Infinity) {
      assert.equal(result.found, false);
      continue;
    }
    assert.equal(result.found, true);
    assert.equal(result.path.length - 1, steps);
    assert.ok(isValidPath(grid, result.path, grid.start, grid.goal));
  }
});

test('BFS still returns the fewest steps when there is mud', () => {
  const random = rng(2);
  for (let n = 0; n < RANDOM_MAPS; n++) {
    const grid = randomGrid(15, 10, random);
    const result = bfs(grid, grid.start, grid.goal);
    const steps = referenceCost(grid, grid.start, grid.goal, () => 1);
    assert.equal(result.found ? result.path.length - 1 : Infinity, steps);
  }
});

test('Dijkstra and A* return a lowest-cost path on random maps with mud', () => {
  const random = rng(3);
  for (let n = 0; n < RANDOM_MAPS; n++) {
    const grid = randomGrid(10 + (n % 11), 8 + (n % 9), random);
    const best = referenceCost(grid, grid.start, grid.goal);
    for (const search of [dijkstra, astar]) {
      const result = search(grid, grid.start, grid.goal);
      if (best === Infinity) {
        assert.equal(result.found, false);
        continue;
      }
      assert.equal(result.found, true);
      assert.equal(result.cost, best);
      assert.ok(isValidPath(grid, result.path, grid.start, grid.goal));
    }
  }
});

test('on the same map, A* visits no more cells than Dijkstra and both paths cost the same', () => {
  const random = rng(4);
  for (let n = 0; n < RANDOM_MAPS; n++) {
    const grid = randomGrid(25, 15, random, { walls: 0.2, mud: 0.2 });
    const d = dijkstra(grid, grid.start, grid.goal);
    const a = astar(grid, grid.start, grid.goal);
    assert.ok(a.visited <= d.visited, `A* visited ${a.visited}, Dijkstra ${d.visited}`);
    assert.equal(a.found, d.found);
    assert.equal(a.cost, d.cost);
  }
});

test('Dijkstra avoids mud when going around is cheaper, while BFS walks through it', () => {
  const grid = mapOf([
    '#########',
    '.........',
    '.S.~~~.G.',
    '.........',
    '#########',
  ]);
  assert.equal(bfs(grid, grid.start, grid.goal).path.length - 1, 6);
  assert.equal(bfs(grid, grid.start, grid.goal).cost, 18);
  assert.equal(dijkstra(grid, grid.start, grid.goal).cost, 8);
  assert.equal(astar(grid, grid.start, grid.goal).cost, 8);
});

test('the demo map shows all three behaviours', () => {
  for (const [cols, rows] of [[41, 23], [19, 25]]) {
    const grid = demoMap(cols, rows);
    const b = bfs(grid, grid.start, grid.goal);
    const d = dijkstra(grid, grid.start, grid.goal);
    const a = astar(grid, grid.start, grid.goal);
    assert.ok(b.found && d.found && a.found);
    assert.ok(b.path.some((i) => grid.get(i) === MUD), 'BFS crosses the mud');
    assert.ok(!d.path.some((i) => grid.get(i) === MUD), 'Dijkstra goes around it');
    assert.ok(d.cost < b.cost);
    assert.equal(a.cost, d.cost);
    assert.ok(a.visited < d.visited);
  }
});

test('each search finishes in under 100 ms on a default-sized grid', () => {
  const grids = [new Grid(41, 23), randomGrid(41, 23, rng(5)), generateMaze(new Grid(41, 23), rng(6))];
  for (const grid of grids) {
    for (const { id } of ALGORITHMS) {
      const result = runSearch(id, grid);
      assert.ok(result.timeMs < 100, `${id} took ${result.timeMs.toFixed(1)} ms`);
    }
  }
});

test('runSearch rejects an unknown algorithm', () => {
  assert.throws(() => runSearch('greedy', new Grid(5, 5)), /Unknown algorithm/);
});
