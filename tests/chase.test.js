import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Grid, MUD, WALL } from '../js/core/grid.js';
import { Chase } from '../js/core/chase.js';

const run = (chase, seconds, dt = 1 / 60) => {
  for (let t = 0; t < seconds && !chase.caught; t += dt) chase.update(dt);
};

test('the chaser follows its A* path and catches a target that stays still', () => {
  const grid = new Grid(10, 5);
  const chase = new Chase(grid, grid.index(0, 2), grid.index(9, 2), { chaserSpeed: 10 });
  assert.equal(chase.path.length, 10);
  run(chase, 0.5);
  assert.equal(chase.caught, false);
  assert.equal(chase.steps, 5);
  run(chase, 2);
  assert.equal(chase.caught, true);
  assert.equal(chase.chaser, chase.target);
});

test('mud slows the chaser to a fifth of its speed', () => {
  const grid = new Grid(6, 5);
  grid.set(grid.index(1, 0), MUD);
  for (let r = 1; r < 5; r++) grid.set(grid.index(1, r), WALL);
  const chase = new Chase(grid, grid.index(0, 0), grid.index(5, 0), { chaserSpeed: 10 });
  run(chase, 0.45);
  assert.equal(chase.steps, 0, 'still wading into the mud');
  run(chase, 0.1);
  assert.equal(chase.steps, 1);
});

test('the chaser replans when the target moves', () => {
  const grid = new Grid(9, 9);
  const chase = new Chase(grid, grid.index(0, 4), grid.index(8, 4));
  const before = chase.replans;
  assert.equal(chase.moveTarget(0, -1), true);
  assert.equal(chase.replans, before + 1);
  assert.equal(chase.path[chase.path.length - 1], grid.index(8, 3));
});

test('the target cannot walk into walls or off the board, or move again too soon', () => {
  const grid = new Grid(5, 5);
  grid.set(grid.index(3, 4), WALL);
  const chase = new Chase(grid, grid.index(0, 0), grid.index(4, 4), { targetSpeed: 5 });
  assert.equal(chase.moveTarget(1, 0), false, 'off the board');
  assert.equal(chase.moveTarget(-1, 0), false, 'into a wall');
  assert.equal(chase.moveTarget(0, -1), true);
  assert.equal(chase.moveTarget(0, -1), false, 'cooling down');
  chase.update(0.25);
  assert.equal(chase.moveTarget(0, -1), true);
});

test('the chaser waits when the target is walled off, and goes once a path opens', () => {
  const grid = new Grid(7, 5);
  for (let r = 0; r < 5; r++) grid.set(grid.index(3, r), WALL);
  const chase = new Chase(grid, grid.index(0, 2), grid.index(6, 2), { chaserSpeed: 10 });
  assert.equal(chase.reachable, false);
  run(chase, 1);
  assert.equal(chase.steps, 0);
  grid.set(grid.index(3, 2), 0);
  chase.replan();
  assert.equal(chase.reachable, true);
  run(chase, 2);
  assert.equal(chase.caught, true);
});

test('a fleeing target moves away from the chaser', () => {
  const grid = new Grid(15, 5);
  const chase = new Chase(grid, grid.index(2, 2), grid.index(5, 2), { chaserSpeed: 1, targetSpeed: 4, fleeing: true });
  const start = grid.manhattan(chase.chaser, chase.target);
  run(chase, 1);
  assert.ok(grid.manhattan(chase.chaser, chase.target) > start);
});

test('a slower fleeing target is caught in the end', () => {
  const grid = new Grid(15, 9);
  const chase = new Chase(grid, grid.index(0, 0), grid.index(7, 4), { chaserSpeed: 5, targetSpeed: 4, fleeing: true });
  run(chase, 60);
  assert.equal(chase.caught, true);
});
