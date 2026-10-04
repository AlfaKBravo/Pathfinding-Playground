import { astar } from './algorithms/astar.js';
import { costMap } from './algorithms/dijkstra.js';

/**
 * The chase game: a chaser follows an A* path to a target, and plans a
 * new path whenever the target moves or the map changes.
 *
 * Time is continuous. Each agent earns movement at its speed (cells per
 * second) and spends it to enter cells: 1 for dry ground, 5 for mud, so
 * mud slows both agents down. The target either moves on the player's
 * input or, when fleeing, picks its own moves.
 */
export class Chase {
  constructor(grid, chaser, target, { chaserSpeed = 4, targetSpeed = 6, fleeing = false } = {}) {
    this.grid = grid;
    this.chaser = chaser;
    this.target = target;
    this.chaserSpeed = chaserSpeed;
    this.targetSpeed = targetSpeed;
    this.fleeing = fleeing;
    this.progress = 0;        // movement the chaser has earned toward its next cell
    this.targetCooldown = 0;  // seconds until the target may move again
    this.elapsed = 0;
    this.steps = 0;
    this.replans = 0;
    this.caught = chaser === target;
    this.path = [];
    this.search = null;
    this.replan();
  }

  /** True when the chaser has a route to the target. */
  get reachable() {
    return this.path.length > 0;
  }

  /** Runs A* from the chaser to the target and follows the new path. */
  replan() {
    this.search = astar(this.grid, this.chaser, this.target);
    this.path = this.search.found ? this.search.path : [];
    this.replans++;
  }

  /** Advances the game by dt seconds. */
  update(dt) {
    if (this.caught) return;
    this.elapsed += dt;
    this.targetCooldown = Math.max(0, this.targetCooldown - dt);
    if (this.fleeing && this.targetCooldown === 0) this.flee();
    if (this.caught) return;

    if (this.path.length < 2) {
      this.progress = 0;
      return;
    }
    this.progress += dt * this.chaserSpeed;
    while (this.path.length >= 2) {
      const next = this.path[1];
      const need = this.grid.cost(next);
      if (this.progress < need) break;
      this.progress -= need;
      this.chaser = next;
      this.path.shift();
      this.steps++;
      if (this.chaser === this.target) {
        this.caught = true;
        return;
      }
    }
  }

  /**
   * Moves the target one cell in direction (dx, dy). Returns false if it
   * is still recovering from its last move, or the way is blocked.
   */
  moveTarget(dx, dy) {
    if (this.caught || this.targetCooldown > 0) return false;
    const next = this.grid.step(this.target, dx, dy);
    if (next < 0 || !this.grid.isWalkable(next)) return false;
    this.stepTarget(next);
    return true;
  }

  /** Puts the target on any cell (used when it is dragged). */
  placeTarget(cell) {
    this.target = cell;
    this.afterTargetMove();
  }

  /** Puts the chaser on any cell (used when it is dragged). */
  placeChaser(cell) {
    this.chaser = cell;
    this.progress = 0;
    this.caught = this.chaser === this.target;
    this.replan();
  }

  stepTarget(cell) {
    this.target = cell;
    this.targetCooldown = this.grid.cost(cell) / this.targetSpeed;
    this.afterTargetMove();
  }

  afterTargetMove() {
    this.caught = this.target === this.chaser;
    this.replan();
  }

  /**
   * Fleeing target: of staying put or stepping to a neighbour, pick the
   * cell the chaser would take longest to reach, with a small bonus for
   * cells with more exits so it is less eager to run into dead ends.
   */
  flee() {
    const dist = costMap(this.grid, this.chaser);
    const score = (cell) => {
      const d = dist[cell] === Infinity ? 1e6 : dist[cell];
      return d + 0.5 * this.grid.neighbors(cell).length;
    };
    let best = this.target;
    let bestScore = score(this.target) - 0.25; // slight preference for moving
    for (const cell of this.grid.neighbors(this.target)) {
      if (cell === this.chaser) continue;
      const s = score(cell);
      if (s > bestScore) {
        best = cell;
        bestScore = s;
      }
    }
    if (best === this.target) this.targetCooldown = 1 / this.targetSpeed;
    else this.stepTarget(best);
  }
}
