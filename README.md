# Pathfinding & Game AI Playground

A browser playground that shows how search algorithms find a path. Draw walls and mud on a grid, then watch **BFS**, **Dijkstra** and **A\*** explore it cell by cell. In **Chase** mode, an A\* chaser hunts a target that you steer, planning a new path every time you move.

Plain JavaScript on an HTML canvas: no framework, no build step, no libraries. The priority queue is a hand-written binary heap.

Project 03 in [Akshaj Kumar Bhardwaj's portfolio](https://github.com/AlfaKBravo).

## Features

| | |
|---|---|
| **Draw the map** | Click or drag to draw walls; click a wall to erase it. Paint mud, which costs 5 to enter instead of 1. Drag the start **S** and goal **G** anywhere. |
| **Three algorithms** | Breadth-first search, Dijkstra's algorithm and A\* (Manhattan heuristic). |
| **Animated search** | Visited cells (hatched), the frontier (outlined) and the final path (solid with a line through it) are told apart by shape, not only by colour. |
| **Playback controls** | Run, pause, single-step, speed (2 to 1,500 steps per second) and clear. |
| **Stats** | Cells visited, path cost, path length and search time after every run. If the goal cannot be reached, the app says so and draws no path. |
| **Chase mode** | An A\* chaser follows you as you move with the arrow keys, WASD or the on-screen pad. It replans whenever you move or the walls change. |
| **Flee AI** | Let the target run by itself: it heads for the cell the chaser would take longest to reach. |
| **Maze generator** | Fills the board with a perfect maze using the recursive backtracker. |
| **Compare** | Run two algorithms side by side on the same map. |
| **Import / export** | Save a map to JSON and load it back. |
| **Phone and keyboard** | Touch drawing and an on-screen pad on phones. Every control works from the keyboard, including drawing on the board. |
| **Day / night edition** | Follows the portfolio's "Instruction Booklet" design. |

## Run it locally

The app uses ES modules, which browsers will not load from a `file://` URL, so serve the folder with any static server:

```bash
python -m http.server 8000
```

Then open <http://localhost:8000>.

## Tests

Unit tests use Node's built-in test runner (Node 20 or newer, nothing to install):

```bash
npm test
```

They cover the binary heap and all three algorithms. The algorithm tests compare results against an independent Bellman-Ford reference on hundreds of random maps, and check that:

- BFS returns a path with the fewest steps.
- Dijkstra and A\* return a lowest-cost path, with mud counted.
- On the same map, A\* visits no more cells than Dijkstra, and both paths cost the same.
- A walled-off goal gives no path.
- Each search finishes in under 100 ms on a default-sized grid.

Further tests cover the grid, the JSON format, the maze generator and the chase logic. GitHub Actions runs them on every push.

## How the algorithms work

All three share one loop: take a cell off the **frontier**, mark it **visited**, and add its unvisited neighbours to the frontier. They differ only in which cell they take next. Moves are up, down, left and right; entering a cell costs 1, or 5 for mud.

### Breadth-first search

The frontier is a first-in, first-out queue, so BFS explores in rings: all cells one step from the start, then two steps, then three. The first time it reaches the goal it has used the fewest steps possible.

BFS counts steps, not cost. Mud is just one more step to it, so on the demo map it walks straight through the mud while the other two go around.

*Time O(V + E) for V cells and E connections.*

### Dijkstra's algorithm

The frontier is a priority queue ordered by **g**, the cost of the cheapest route found so far from the start. Dijkstra always expands the cheapest cell next. Because costs never go negative, a cell's cost is final once it comes off the queue, so when the goal comes off, its path is the cheapest one.

The queue is a binary min-heap ([`js/core/heap.js`](js/core/heap.js)). Instead of a decrease-key operation, a cheaper route pushes a fresh entry, and old entries are skipped when popped ("lazy deletion").

*Time O(E log V).*

### A\* search

A\* orders the frontier by **f = g + h**, where **h** estimates the cost still to go. Here h is the Manhattan distance, |Δcol| + |Δrow|.

The estimate never overshoots: every move costs at least 1 and covers at most one row or column. A heuristic that never overestimates is *admissible*, and with one A\* still returns a lowest-cost path. Manhattan distance is also *consistent* (h drops by at most the cost of each step), so, like Dijkstra, A\* never has to revisit a cell. When two cells tie on f, A\* takes the one closer to the goal.

### Why A\* visits fewer cells than Dijkstra

Let **C** be the cost of the cheapest path. Dijkstra expands every cell it can reach for less than C, in all directions, a "circle" around the start that grows until it touches the goal.

A\* expands a cell only if g + h ≤ C, that is, only if *some* path through that cell could still cost C or less. A cell behind the start, facing away from the goal, has a large h, so its f goes over C and A\* never touches it. Every cell A\* does expand has g ≤ C − h ≤ C, which Dijkstra would expand too. So A\* explores a subset of Dijkstra's cells, stretched toward the goal.

Turn on **Compare**, pick Dijkstra and A\*, and run them on the same map: both paths cost the same, and A\* visits far fewer cells. On the demo map, Dijkstra visits 630 cells and A\* 262. The tests check this property on hundreds of random maps.

The heuristic is what saves the work. With h = 0, A\* becomes Dijkstra. The closer h gets to the true remaining cost, the fewer cells A\* expands.

### Chase mode

The chaser runs A\* from its cell to the target and walks the path, one cell at a time at its set speed (mud takes five times as long). Whenever the target moves, or a wall is drawn or erased, it runs A\* again from where it stands. The dashed line is its current plan, and the hatched cells show what the latest search expanded. If the target is walled off, the chaser waits until a path opens.

The **Flee AI** target checks the cells it could move to. It uses Dijkstra's costs from the chaser to pick the one the chaser would take longest to reach, with a small bonus for cells with more exits so it avoids dead ends. It runs slightly slower than the chaser, so it is caught in the end.

### Maze generator

The recursive backtracker treats odd (col, row) cells as rooms. From the current room, it picks a random unvisited neighbouring room, knocks down the wall between them, and moves on. When it reaches a dead end it backs up. The result is a *perfect* maze: exactly one route between any two rooms. An explicit stack replaces recursion, so big boards cannot overflow the call stack.

## Project structure

```
index.html            page and controls
css/style.css         Instruction Booklet design tokens and layout
js/main.js            entry point: theme toggle, legend
js/core/              no DOM: runs in the browser and in Node tests
  heap.js             binary min-heap
  grid.js             grid model, costs, neighbours, JSON format
  algorithms/
    bfs.js
    dijkstra.js
    astar.js
    result.js         shared result shape and path rebuild
    index.js          registry of algorithms
  maze.js             recursive backtracker
  presets.js          demo map
  chase.js            chaser and fleeing target
js/ui/
  app.js              input, controls, run state
  playback.js         replays a finished search step by step
  renderer.js         draws a scene on the canvas
tests/                node:test unit tests
```

Algorithms are kept apart from rendering. A search returns the same plain result whatever the algorithm: the path, its cost, the number of cells visited, and a **trace** with one entry per expanded cell. The UI animates that trace and never looks inside the algorithm.

### Adding an algorithm

1. Create `js/core/algorithms/your-algorithm.js` that exports `{ id, name, short, weighted, search(grid, start, goal) }`, where `search` returns the shape described in [`result.js`](js/core/algorithms/result.js).
2. Add it to `ALGORITHMS` in [`js/core/algorithms/index.js`](js/core/algorithms/index.js).

The menus, animation, stats and comparison view pick it up automatically. The canvas code does not change.

## Map format

Exported maps are plain JSON, readable by eye: `.` empty, `#` wall, `~` mud. Start and goal are `[column, row]`, counted from 0.

```json
{
  "format": "pathfinding-playground-map",
  "version": 1,
  "cols": 7,
  "rows": 5,
  "start": [1, 2],
  "goal": [5, 2],
  "cells": [
    ".......",
    "...#...",
    "...#~..",
    "...#...",
    "......."
  ]
}
```

## Deployment

The site is static files only. It deploys as-is to Vercel (or any static host). There is no build command, and the output directory is the repository root.

## License

[MIT](LICENSE) © 2026 Akshaj Kumar Bhardwaj
