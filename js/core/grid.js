/**
 * The board the algorithms search: a rectangle of square cells, each
 * empty, a wall or mud. Cells are addressed by a single index,
 * row * cols + col, so per-cell data fits in flat typed arrays.
 *
 * Movement is 4-directional (no diagonals). Entering a cell costs 1,
 * or MUD_COST for mud. Walls cannot be entered.
 */

export const EMPTY = 0;
export const WALL = 1;
export const MUD = 2;
export const MUD_COST = 5;

/** Neighbour order: up, right, down, left. */
export const DIRECTIONS = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

export const MIN_SIZE = 5;
export const MAX_SIZE = 150;

const MAP_FORMAT = 'pathfinding-playground-map';
const CELL_CHARS = { [EMPTY]: '.', [WALL]: '#', [MUD]: '~' };
const CHAR_CELLS = { '.': EMPTY, '#': WALL, '~': MUD };

export class Grid {
  constructor(cols, rows) {
    if (!Number.isInteger(cols) || !Number.isInteger(rows) || cols < MIN_SIZE || rows < MIN_SIZE || cols > MAX_SIZE || rows > MAX_SIZE) {
      throw new RangeError(`Grid size must be whole numbers from ${MIN_SIZE} to ${MAX_SIZE}, got ${cols} x ${rows}.`);
    }
    this.cols = cols;
    this.rows = rows;
    this.cells = new Uint8Array(cols * rows);
    const mid = Math.floor(rows / 2);
    this.start = this.index(1, mid);
    this.goal = this.index(cols - 2, mid);
  }

  get size() {
    return this.cells.length;
  }

  index(col, row) {
    return row * this.cols + col;
  }

  col(i) {
    return i % this.cols;
  }

  row(i) {
    return Math.floor(i / this.cols);
  }

  inBounds(col, row) {
    return col >= 0 && row >= 0 && col < this.cols && row < this.rows;
  }

  get(i) {
    return this.cells[i];
  }

  set(i, type) {
    this.cells[i] = type;
  }

  isWalkable(i) {
    return this.cells[i] !== WALL;
  }

  /** Cost of moving into cell i. */
  cost(i) {
    return this.cells[i] === MUD ? MUD_COST : 1;
  }

  /** The cell one step from i in direction (dx, dy), or -1 if off the board. */
  step(i, dx, dy) {
    const col = this.col(i) + dx;
    const row = this.row(i) + dy;
    return this.inBounds(col, row) ? this.index(col, row) : -1;
  }

  /** Walkable cells next to i, in DIRECTIONS order. */
  neighbors(i) {
    const out = [];
    const col = this.col(i);
    const row = this.row(i);
    for (const [dx, dy] of DIRECTIONS) {
      const c = col + dx;
      const r = row + dy;
      if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) continue;
      const n = r * this.cols + c;
      if (this.cells[n] !== WALL) out.push(n);
    }
    return out;
  }

  /** Grid distance between two cells, ignoring walls. */
  manhattan(a, b) {
    return Math.abs(this.col(a) - this.col(b)) + Math.abs(this.row(a) - this.row(b));
  }

  /** Removes every wall and mud cell. */
  clear() {
    this.cells.fill(EMPTY);
  }

  clone() {
    const copy = new Grid(this.cols, this.rows);
    copy.cells.set(this.cells);
    copy.start = this.start;
    copy.goal = this.goal;
    return copy;
  }

  /**
   * A readable map: one string per row, '.' empty, '#' wall, '~' mud.
   * Start and goal are [col, row] pairs.
   */
  toJSON() {
    const cells = [];
    for (let r = 0; r < this.rows; r++) {
      let line = '';
      for (let c = 0; c < this.cols; c++) line += CELL_CHARS[this.cells[this.index(c, r)]];
      cells.push(line);
    }
    return {
      format: MAP_FORMAT,
      version: 1,
      cols: this.cols,
      rows: this.rows,
      start: [this.col(this.start), this.row(this.start)],
      goal: [this.col(this.goal), this.row(this.goal)],
      cells,
    };
  }

  /** Builds a grid from toJSON() output. Throws an Error that explains what is wrong. */
  static fromJSON(data) {
    if (!data || typeof data !== 'object') throw new Error('The file is not a map.');
    if (data.format !== MAP_FORMAT) throw new Error('The file is not a Pathfinding Playground map.');
    const { cols, rows, cells, start, goal } = data;
    const grid = new Grid(cols, rows);
    if (!Array.isArray(cells) || cells.length !== rows) throw new Error(`The map should have ${rows} rows of cells.`);
    cells.forEach((line, r) => {
      if (typeof line !== 'string' || line.length !== cols) throw new Error(`Row ${r + 1} should have ${cols} cells.`);
      for (let c = 0; c < cols; c++) {
        const type = CHAR_CELLS[line[c]];
        if (type === undefined) throw new Error(`Row ${r + 1} has an unknown cell "${line[c]}".`);
        grid.cells[grid.index(c, r)] = type;
      }
    });
    grid.start = grid.readPoint(start, 'start');
    grid.goal = grid.readPoint(goal, 'goal');
    if (grid.start === grid.goal) throw new Error('Start and goal must be different cells.');
    return grid;
  }

  readPoint(point, name) {
    if (!Array.isArray(point) || point.length !== 2 || !point.every(Number.isInteger) || !this.inBounds(point[0], point[1])) {
      throw new Error(`The ${name} must be a [column, row] inside the map.`);
    }
    const i = this.index(point[0], point[1]);
    if (!this.isWalkable(i)) throw new Error(`The ${name} is on a wall.`);
    return i;
  }
}
