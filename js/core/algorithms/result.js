/**
 * Every search returns the same shape, so the UI can animate any of them:
 *
 *   found    true if the goal was reached
 *   path     cell indices from start to goal ([] if not found)
 *   cost     sum of entry costs along the path (0 if not found)
 *   visited  number of cells taken off the frontier and expanded
 *   trace    one entry per expansion: { node, opened }, where opened
 *            lists the cells added to (or improved in) the frontier
 */
export function buildResult(grid, parent, start, goal, found, visited, trace) {
  const path = found ? reconstructPath(parent, start, goal) : [];
  return { found, path, cost: pathCost(grid, path), visited, trace };
}

/** Follows parent links back from goal to start. */
export function reconstructPath(parent, start, goal) {
  const path = [goal];
  let node = goal;
  while (node !== start) {
    node = parent[node];
    path.push(node);
  }
  return path.reverse();
}

/** Cost of walking a path: every cell after the first is entered once. */
export function pathCost(grid, path) {
  let cost = 0;
  for (let i = 1; i < path.length; i++) cost += grid.cost(path[i]);
  return cost;
}
