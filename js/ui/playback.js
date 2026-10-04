/** What the animation has revealed about each cell so far. */
export const NONE = 0;
export const FRONTIER = 1;
export const VISITED = 2;
export const PATH = 3;

/**
 * Replays a search result one step at a time. The search itself has
 * already finished; this only decides how much of its trace to show.
 * First the trace (each step visits a cell and opens its neighbours),
 * then the path, one cell per step.
 */
export class Playback {
  constructor(size) {
    this.marks = new Uint8Array(size);
    this.result = null;
    this.step = 0;
    this.pathShown = 0;
  }

  load(result) {
    this.result = result;
    this.marks.fill(NONE);
    this.step = 0;
    this.pathShown = 0;
  }

  clear() {
    this.result = null;
    this.marks.fill(NONE);
    this.step = 0;
    this.pathShown = 0;
  }

  get loaded() {
    return this.result !== null;
  }

  get done() {
    const r = this.result;
    return !r || (this.step >= r.trace.length && this.pathShown >= r.path.length);
  }

  /** Cells visited so far. */
  get visited() {
    return this.step;
  }

  /** The part of the path revealed so far, in order from the start. */
  get path() {
    return this.result ? this.result.path.slice(0, this.pathShown) : [];
  }

  /** Reveals one more step. Returns false when there is nothing left. */
  advance() {
    const r = this.result;
    if (!r) return false;
    if (this.step < r.trace.length) {
      const { node, opened } = r.trace[this.step++];
      this.marks[node] = VISITED;
      for (const cell of opened) if (this.marks[cell] !== VISITED) this.marks[cell] = FRONTIER;
      return true;
    }
    if (this.pathShown < r.path.length) {
      this.marks[r.path[this.pathShown++]] = PATH;
      return true;
    }
    return false;
  }

  finish() {
    while (this.advance());
  }
}
