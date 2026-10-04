import { EMPTY, Grid, MUD, WALL } from '../core/grid.js';
import { ALGORITHMS, getAlgorithm, runSearch } from '../core/algorithms/index.js';
import { pathCost } from '../core/algorithms/result.js';
import { generateMaze } from '../core/maze.js';
import { demoMap } from '../core/presets.js';
import { Chase } from '../core/chase.js';
import { Playback, VISITED } from './playback.js';
import { Renderer } from './renderer.js?v=3';

/** Animation speeds for the speed slider, in search steps per second. */
const SPEEDS = [2, 5, 10, 20, 40, 80, 160, 320, 640, 1500];
const PLAYER_SPEED = 7;     // target cells per second when you steer it
const FLEE_FACTOR = 0.85;   // a fleeing target runs a little slower than the chaser

const DIRS = {
  ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
  up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0],
};
const WASD = { w: 'up', a: 'left', s: 'down', d: 'right' };

const SEARCH_STATS = ['Visited', 'Path cost', 'Steps', 'Time'];
const CHASE_STATS = ['Survived', 'Replans', 'Chaser steps', 'Distance'];

/**
 * Wires the page together: owns the grid, turns input into edits, runs
 * searches, plays them back and asks the renderers to draw.
 */
export class App {
  constructor() {
    const $ = (sel) => document.querySelector(sel);
    this.el = {
      status: $('#status'),
      boards: $('#boards'),
      dpad: $('#dpad'),
      algoA: $('#algoA'),
      algoB: $('#algoB'),
      algoBField: $('#algoBField'),
      compare: $('#compare'),
      run: $('#runBtn'),
      pause: $('#pauseBtn'),
      step: $('#stepBtn'),
      clearPath: $('#clearPathBtn'),
      speed: $('#speed'),
      speedOut: $('#speedOut'),
      chase: $('#chaseBtn'),
      chaseReset: $('#chaseResetBtn'),
      chaserSpeed: $('#chaserSpeed'),
      chaserSpeedOut: $('#chaserSpeedOut'),
      importFile: $('#importFile'),
    };
    this.views = [...document.querySelectorAll('.board')].map((figure, n) => {
      const canvas = figure.querySelector('canvas');
      return {
        figure,
        canvas,
        renderer: new Renderer(canvas),
        algo: n === 0 ? 'bfs' : 'astar',
        name: figure.querySelector('.board-name'),
        stats: [...figure.querySelectorAll('.stats div')].map((div) => ({ dt: div.querySelector('dt'), dd: div.querySelector('dd') })),
        playback: null,
        result: null,
      };
    });

    this.mode = 'search';
    this.tool = 'wall';
    this.compare = false;
    this.state = 'idle'; // idle | playing | paused | done
    this.speed = Number(this.el.speed.value);
    this.stepBudget = 0;
    this.cursor = -1;
    this.showCursor = false;
    this.hover = -1;
    this.drag = null;
    this.chase = null;
    this.chaseRunning = false;
    this.chaseMarks = null;
    this.chaseSearch = null;
    this.targetMode = 'player';
    this.heldDirs = [];
    this.chaserSpeed = Number(this.el.chaserSpeed.value);
    this.frame = 0;
    this.lastTime = 0;
    this.dirty = false;

    this.fillAlgorithmMenus();
    this.bindControls();
    this.views.forEach((view) => this.bindBoard(view));
    this.bindKeys();
    this.setGrid(this.firstGrid());
    this.updateSpeedLabels();
    this.setMode('search');
    // a stroke that wanders off the board should not select page text
    document.addEventListener('selectstart', (e) => {
      if (this.drag) e.preventDefault();
    });
    const resize = new ResizeObserver(() => this.layout());
    this.views.forEach((v) => resize.observe(v.canvas));
  }

  /* ---------- Setup ---------- */

  /** Landscape board on wide screens, portrait on phones. */
  firstGrid() {
    return window.matchMedia('(max-width: 640px)').matches ? demoMap(19, 27) : demoMap(41, 23);
  }

  fillAlgorithmMenus() {
    for (const [select, view] of [[this.el.algoA, this.views[0]], [this.el.algoB, this.views[1]]]) {
      for (const algo of ALGORITHMS) select.add(new Option(algo.name, algo.id));
      select.value = view.algo;
      select.addEventListener('change', () => {
        view.algo = select.value;
        this.updateNames();
        this.clearRun('Algorithm changed. Press Run to search.');
      });
    }
  }

  bindControls() {
    const on = (el, event, fn) => el.addEventListener(event, fn);
    document.querySelectorAll('input[name="mode"]').forEach((r) => on(r, 'change', () => this.setMode(r.value)));
    document.querySelectorAll('input[name="tool"]').forEach((r) => on(r, 'change', () => { this.tool = r.value; }));
    document.querySelectorAll('input[name="targetMode"]').forEach((r) => on(r, 'change', () => this.setTargetMode(r.value)));

    on(this.el.compare, 'change', () => this.setCompare(this.el.compare.checked));
    on(this.el.run, 'click', () => this.run());
    on(this.el.pause, 'click', () => this.togglePause());
    on(this.el.step, 'click', () => this.step());
    on(this.el.clearPath, 'click', () => this.clearRun('Path cleared.'));
    on(this.el.speed, 'input', () => {
      this.speed = Number(this.el.speed.value);
      this.updateSpeedLabels();
    });

    on(this.el.chase, 'click', () => this.toggleChase());
    on(this.el.chaseReset, 'click', () => {
      this.resetChase();
      this.setStatus('Chase reset. Press Start chase, or just start moving.');
    });
    on(this.el.chaserSpeed, 'input', () => {
      this.chaserSpeed = Number(this.el.chaserSpeed.value);
      this.updateSpeedLabels();
      if (this.chase) this.applyChaseSettings();
    });

    on(document.querySelector('#mazeBtn'), 'click', () => this.makeMaze());
    on(document.querySelector('#demoBtn'), 'click', () => {
      this.setGrid(demoMap(this.grid.cols, this.grid.rows));
      this.setStatus('Demo map loaded. BFS walks through the mud; Dijkstra and A* go around.');
    });
    on(document.querySelector('#clearBoardBtn'), 'click', () => {
      this.grid.clear();
      this.afterBoardReset('Board cleared.');
    });
    on(document.querySelector('#exportBtn'), 'click', () => this.exportMap());
    on(document.querySelector('#importBtn'), 'click', () => this.el.importFile.click());
    on(this.el.importFile, 'change', () => this.importMap());

    // on-screen pad: hold to keep moving
    this.el.dpad.querySelectorAll('[data-dir]').forEach((btn) => {
      const dir = btn.dataset.dir;
      on(btn, 'pointerdown', (e) => {
        e.preventDefault();
        this.pressDir(dir);
      });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => on(btn, ev, () => this.releaseDir(dir)));
      on(btn, 'keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.pressDir(dir);
          this.releaseDir(dir);
        }
      });
    });
  }

  /* ---------- Grid ---------- */

  setGrid(grid) {
    this.grid = grid;
    this.state = 'idle';
    for (const view of this.views) {
      view.playback = new Playback(grid.size);
      view.result = null;
    }
    this.cursor = grid.start;
    this.layout();
    this.resetStats();
    if (this.mode === 'chase') this.resetChase();
    this.updateControls();
    this.requestDraw();
  }

  /** After a maze or clear: same grid object, but the old run and chase no longer apply. */
  afterBoardReset(message) {
    this.state = 'idle';
    this.views.forEach((v) => v.playback.clear());
    this.resetStats();
    if (this.mode === 'chase') this.resetChase();
    this.updateControls();
    this.setStatus(message);
    this.requestDraw();
  }

  makeMaze() {
    generateMaze(this.grid);
    this.cursor = this.grid.start;
    this.afterBoardReset(this.mode === 'search' ? 'Maze generated. Press Run to solve it.' : 'Maze generated. Try to escape the chaser.');
  }

  /** Start and goal must stay open; walls drawn over them in Chase mode are removed. */
  openEndpoints() {
    for (const cell of [this.grid.start, this.grid.goal]) if (this.grid.get(cell) === WALL) this.grid.set(cell, EMPTY);
  }

  /** Cells a wall may not cover right now. */
  isProtected(cell) {
    if (this.mode === 'chase' && this.chase) return cell === this.chase.chaser || cell === this.chase.target;
    return cell === this.grid.start || cell === this.grid.goal;
  }

  /** Paints one cell. Returns true if it changed. */
  paint(cell, value) {
    if (this.grid.get(cell) === value) return false;
    if (value === WALL && this.isProtected(cell)) return false;
    this.grid.set(cell, value);
    return true;
  }

  /** The value a click on cell should paint with the current tool; a click on the same type erases it. */
  paintValue(cell) {
    const type = this.grid.get(cell);
    if (this.tool === 'wall') return type === WALL ? EMPTY : WALL;
    if (this.tool === 'mud') return type === MUD ? EMPTY : MUD;
    return EMPTY;
  }

  /** Called after any change to walls, mud, start or goal. */
  gridEdited() {
    if (this.mode === 'chase') {
      if (this.chase) this.chase.replan();
      this.updateChaseStats();
    } else if (this.state === 'done') {
      // the board changed after a finished run: show the new result straight away
      this.searchAll();
      this.views.forEach((v) => v.playback.finish());
      this.finishRun();
    } else if (this.state !== 'idle') {
      this.clearRun('Map changed. Press Run to search again.');
    }
    this.requestDraw();
  }

  /* ---------- Board input ---------- */

  bindBoard(view) {
    const { canvas, renderer } = view;
    canvas.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      const cell = renderer.cellAt(e.clientX, e.clientY);
      if (cell < 0) return;
      e.preventDefault();
      canvas.focus({ preventScroll: true });
      canvas.setPointerCapture(e.pointerId);
      this.showCursor = false;
      this.beginDrag(cell);
    });
    canvas.addEventListener('pointermove', (e) => {
      const cell = renderer.cellAt(e.clientX, e.clientY);
      if (this.drag) {
        if (cell >= 0) this.continueDrag(cell);
      } else if (e.pointerType === 'mouse' && cell !== this.hover) {
        this.hover = cell;
        this.requestDraw();
      }
    });
    const end = () => {
      this.drag = null;
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    canvas.addEventListener('pointerleave', () => {
      if (this.hover >= 0) {
        this.hover = -1;
        this.requestDraw();
      }
    });
    canvas.addEventListener('focus', () => {
      this.showCursor = canvas.matches(':focus-visible');
      this.requestDraw();
    });
    canvas.addEventListener('blur', () => {
      this.showCursor = false;
      this.requestDraw();
    });
    canvas.addEventListener('keydown', (e) => this.boardKey(e));
  }

  beginDrag(cell) {
    const g = this.grid;
    if (this.mode === 'search') {
      if (cell === g.start) this.drag = { kind: 'start' };
      else if (cell === g.goal) this.drag = { kind: 'goal' };
    } else if (this.chase) {
      if (cell === this.chase.target) this.drag = { kind: 'target' };
      else if (cell === this.chase.chaser) this.drag = { kind: 'chaser' };
    }
    if (this.drag) return;
    const value = this.paintValue(cell);
    this.drag = { kind: 'paint', value, last: cell };
    if (this.paint(cell, value)) this.gridEdited();
  }

  continueDrag(cell) {
    const { drag, grid } = this;
    if (drag.kind === 'paint') {
      if (cell === drag.last) return;
      let changed = false;
      for (const c of lineCells(grid, drag.last, cell)) changed = this.paint(c, drag.value) || changed;
      drag.last = cell;
      if (changed) this.gridEdited();
      return;
    }
    this.moveMarker(drag.kind, cell);
  }

  /** Moves the start, goal, chaser or target to cell, if it is open and not taken. */
  moveMarker(kind, cell) {
    const g = this.grid;
    if (!g.isWalkable(cell)) return false;
    if (kind === 'start' || kind === 'goal') {
      const other = kind === 'start' ? g.goal : g.start;
      if (cell === other || cell === g[kind]) return false;
      g[kind] = cell;
      this.gridEdited();
      return true;
    }
    const c = this.chase;
    if (kind === 'target' && cell !== c.target && cell !== c.chaser) c.placeTarget(cell);
    else if (kind === 'chaser' && cell !== c.chaser && cell !== c.target) c.placeChaser(cell);
    else return false;
    this.chaseChanged();
    return true;
  }

  /** Keyboard editing on a focused board (Search mode). */
  boardKey(e) {
    if (this.mode !== 'search' || e.altKey || e.ctrlKey || e.metaKey) return;
    const g = this.grid;
    const dir = DIRS[e.key];
    if (dir) {
      e.preventDefault();
      if (this.cursor < 0) this.cursor = g.start;
      const next = g.step(this.cursor, dir[0], dir[1]);
      if (next >= 0) this.cursor = next;
      this.showCursor = true;
      this.setStatus(`Cursor at column ${g.col(this.cursor) + 1}, row ${g.row(this.cursor) + 1}: ${this.describe(this.cursor)}.`);
      this.requestDraw();
      return;
    }
    if (this.cursor < 0) return;
    const key = e.key.toLowerCase();
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (this.paint(this.cursor, this.paintValue(this.cursor))) {
        this.gridEdited();
        const edit = `Column ${g.col(this.cursor) + 1}, row ${g.row(this.cursor) + 1} is now ${this.describe(this.cursor)}.`;
        // after a finished run the board re-solves at once; keep its result in the message
        if (this.state === 'done') this.setStatus(`${edit} ${this.el.status.textContent}`, this.el.status.dataset.tone);
        else this.setStatus(edit);
      } else {
        this.setStatus('The start and goal cannot be covered by a wall.');
      }
    } else if (key === 's' || key === 'g') {
      e.preventDefault();
      const kind = key === 's' ? 'start' : 'goal';
      if (this.moveMarker(kind, this.cursor)) this.setStatus(`${kind === 'start' ? 'Start' : 'Goal'} moved to column ${g.col(this.cursor) + 1}, row ${g.row(this.cursor) + 1}.`);
      else this.setStatus(`The ${kind} cannot go there.`);
    }
  }

  describe(cell) {
    const g = this.grid;
    if (cell === g.start) return 'the start';
    if (cell === g.goal) return 'the goal';
    return ['empty', 'a wall', 'mud'][g.get(cell)];
  }

  /** Arrow keys and WASD steer the target in Chase mode. */
  bindKeys() {
    // 1, 2, 3 pick the Wall, Mud and Erase tools
    window.addEventListener('keydown', (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey || /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
      const tool = { 1: 'wall', 2: 'mud', 3: 'erase' }[e.key];
      if (!tool) return;
      const radio = document.querySelector(`input[name="tool"][value="${tool}"]`);
      radio.checked = true;
      this.tool = tool;
    });
    window.addEventListener('keydown', (e) => {
      if (this.mode !== 'chase' || e.altKey || e.ctrlKey || e.metaKey) return;
      if (/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
      const name = DIRS[e.key] ? e.key : WASD[e.key.toLowerCase()];
      if (!name) return;
      e.preventDefault();
      if (!e.repeat) this.pressDir(name);
    });
    window.addEventListener('keyup', (e) => {
      const name = DIRS[e.key] ? e.key : WASD[e.key.toLowerCase()];
      if (name) this.releaseDir(name);
    });
    window.addEventListener('blur', () => {
      this.heldDirs = [];
    });
  }

  pressDir(name) {
    if (this.mode !== 'chase' || this.targetMode !== 'player' || !this.chase) return;
    const dir = DIRS[name];
    this.heldDirs = [...this.heldDirs.filter((d) => d !== dir), dir];
    if (this.chase.caught) return;
    if (!this.chaseRunning) this.startChase();
    if (this.chase.moveTarget(dir[0], dir[1])) this.chaseChanged();
  }

  releaseDir(name) {
    const dir = DIRS[name];
    this.heldDirs = this.heldDirs.filter((d) => d !== dir);
  }

  /* ---------- Search mode ---------- */

  activeViews() {
    return this.compare && this.mode === 'search' ? this.views : [this.views[0]];
  }

  searchAll() {
    for (const view of this.activeViews()) {
      view.result = runSearch(view.algo, this.grid);
      view.playback.load(view.result);
    }
  }

  run() {
    this.searchAll();
    this.state = 'playing';
    this.stepBudget = 1;
    this.setStatus(`Searching with ${this.activeViews().map((v) => getAlgorithm(v.algo).short).join(' and ')}…`);
    this.updateLiveStats();
    this.updateControls();
    this.ensureLoop();
  }

  togglePause() {
    if (this.state === 'playing') this.state = 'paused';
    else if (this.state === 'paused') this.state = 'playing';
    else return;
    this.setStatus(this.state === 'paused' ? 'Paused. Press Step to go one cell at a time.' : 'Searching…');
    this.updateControls();
    this.ensureLoop();
  }

  step() {
    if (this.state === 'idle' || this.state === 'done') {
      this.searchAll();
      this.setStatus('Stepping. Press Step again, or Play to continue.');
    }
    this.state = 'paused';
    this.advanceAll(1);
    this.updateControls();
  }

  /** Reveals n more steps on every active board. */
  advanceAll(n) {
    const views = this.activeViews();
    for (let i = 0; i < n; i++) {
      let moved = false;
      for (const v of views) moved = v.playback.advance() || moved;
      if (!moved) break;
    }
    if (views.every((v) => v.playback.done)) this.finishRun();
    else this.updateLiveStats();
    this.requestDraw();
  }

  finishRun() {
    this.state = 'done';
    const views = this.activeViews();
    views.forEach((v) => this.showFinalStats(v));
    const summary = (v) => {
      const r = v.result;
      const name = getAlgorithm(v.algo).short;
      return r.found
        ? `${name}: cost ${r.cost}, ${r.path.length - 1} steps, ${r.visited} cells visited`
        : `${name}: no path after visiting ${r.visited} cells`;
    };
    const anyFound = views.some((v) => v.result.found);
    if (!anyFound) this.setStatus('No path: the goal cannot be reached from the start.', 'bad');
    else this.setStatus(views.map(summary).join(' · ') + '.', 'good');
    this.updateControls();
  }

  clearRun(message) {
    this.state = 'idle';
    this.views.forEach((v) => {
      v.playback.clear();
      v.result = null;
    });
    this.resetStats();
    this.updateControls();
    if (message) this.setStatus(message);
    this.requestDraw();
  }

  setCompare(on) {
    this.compare = on;
    this.el.algoBField.hidden = !on;
    this.views[1].figure.hidden = !on || this.mode !== 'search';
    this.el.boards.classList.toggle('is-compare', on && this.mode === 'search');
    if (on && this.views[0].algo === this.views[1].algo) {
      this.views[1].algo = this.views[0].algo === 'astar' ? 'dijkstra' : 'astar';
      this.el.algoB.value = this.views[1].algo;
    }
    this.updateNames();
    this.layout();
    this.clearRun(on ? 'Compare on. Both algorithms run on the same map. Press Run.' : 'Compare off.');
  }

  /* ---------- Chase mode ---------- */

  setMode(mode) {
    this.mode = mode;
    document.querySelectorAll('[data-mode]').forEach((el) => {
      el.hidden = el.dataset.mode !== mode;
    });
    this.el.dpad.hidden = mode !== 'chase';
    this.heldDirs = [];
    const comparing = this.compare && mode === 'search';
    this.views[1].figure.hidden = !comparing;
    this.el.boards.classList.toggle('is-compare', comparing);
    this.clearRun();
    this.updateNames();
    if (mode === 'chase') {
      this.resetChase();
      this.setStatus('Move the target T with the arrow keys, WASD or the pad. The chaser C starts when you do.');
    } else {
      this.chaseRunning = false;
      this.chase = null;
      this.openEndpoints();
      this.setStatus('Press Run to watch the search. Draw walls and mud on the board first if you like.');
    }
    this.layout();
    this.updateControls();
  }

  resetChase() {
    const g = this.grid;
    this.openEndpoints();
    this.chaseRunning = false;
    this.heldDirs = [];
    this.chase = new Chase(g, g.start, g.goal, { chaserSpeed: this.chaserSpeed });
    this.applyChaseSettings();
    this.chaseChanged();
  }

  applyChaseSettings() {
    const fleeing = this.targetMode === 'flee';
    this.chase.chaserSpeed = this.chaserSpeed;
    this.chase.fleeing = fleeing;
    this.chase.targetSpeed = fleeing ? this.chaserSpeed * FLEE_FACTOR : PLAYER_SPEED;
  }

  setTargetMode(mode) {
    this.targetMode = mode;
    if (this.chase) this.applyChaseSettings();
    this.setStatus(mode === 'flee'
      ? 'Flee AI on: the target runs from the chaser by itself. Press Start chase.'
      : 'You steer the target with the arrow keys, WASD or the pad.');
  }

  toggleChase() {
    if (!this.chase) return;
    if (this.chase.caught) this.resetChase();
    if (this.chaseRunning) {
      this.chaseRunning = false;
      this.setStatus('Chase paused.');
    } else {
      this.startChase();
    }
    this.updateControls();
  }

  startChase() {
    this.chaseRunning = true;
    this.lastChaseReachable = this.chase.reachable;
    this.setStatus(this.targetMode === 'flee' ? 'The chase is on. The target is fleeing.' : 'The chase is on. Keep moving!');
    this.updateControls();
    this.ensureLoop();
  }

  advanceChase(dt) {
    const c = this.chase;
    const held = this.heldDirs[this.heldDirs.length - 1];
    if (held && this.targetMode === 'player') c.moveTarget(held[0], held[1]);
    c.update(dt);
    this.chaseChanged();
    if (c.caught) {
      this.chaseRunning = false;
      this.setStatus(`Caught after ${c.elapsed.toFixed(1)} s. The chaser replanned ${c.replans} times. Press Play again.`, 'bad');
      this.updateControls();
    } else if (c.reachable !== this.lastChaseReachable) {
      this.lastChaseReachable = c.reachable;
      if (!c.reachable) this.setStatus('No path: the chaser cannot reach the target, so it waits.', 'bad');
      else this.setStatus('The chaser found a path again.');
    }
  }

  /** Refreshes chase stats and the visited cells of the latest A* replan. */
  chaseChanged() {
    const c = this.chase;
    if (!c) return;
    if (c.search !== this.chaseSearch) {
      this.chaseSearch = c.search;
      this.chaseMarks = new Uint8Array(this.grid.size);
      for (const { node } of c.search.trace) this.chaseMarks[node] = VISITED;
    }
    this.updateChaseStats();
    this.requestDraw();
  }

  /* ---------- Map files ---------- */

  exportMap() {
    const json = JSON.stringify(this.grid.toJSON(), null, 2);
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'pathfinding-map.json';
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    this.setStatus('Map exported as pathfinding-map.json.', 'good');
  }

  async importMap() {
    const file = this.el.importFile.files[0];
    this.el.importFile.value = '';
    if (!file) return;
    try {
      const grid = Grid.fromJSON(JSON.parse(await file.text()));
      this.setGrid(grid);
      this.setStatus(`Imported ${file.name} (${grid.cols} × ${grid.rows}).`, 'good');
    } catch (err) {
      const reason = err instanceof SyntaxError ? 'the file is not valid JSON.' : err.message;
      this.setStatus(`Could not import ${file.name}: ${reason}`, 'bad');
    }
  }

  /* ---------- Display ---------- */

  setStatus(text, tone = '') {
    if (this.el.status.textContent !== text) this.el.status.textContent = text;
    this.el.status.dataset.tone = tone;
  }

  updateSpeedLabels() {
    this.el.speedOut.textContent = `${SPEEDS[this.speed - 1]} steps/s`;
    this.el.chaserSpeedOut.textContent = `${this.chaserSpeed} cells/s`;
  }

  updateNames() {
    if (this.mode === 'chase') {
      this.views[0].name.textContent = 'A* chaser';
      return;
    }
    this.views.forEach((v) => {
      v.name.textContent = getAlgorithm(v.algo).name;
    });
    const short = (v) => getAlgorithm(v.algo).short;
    this.el.run.querySelector('.label').textContent = this.compare
      ? `Run ${short(this.views[0])} + ${short(this.views[1])}`
      : `Run ${short(this.views[0])}`;
  }

  updateControls() {
    const { pause, chase } = this.el;
    pause.disabled = this.state === 'idle' || this.state === 'done';
    pause.textContent = this.state === 'paused' ? 'Play' : 'Pause';
    const label = chase.querySelector('.label');
    if (this.chase?.caught) label.textContent = 'Play again';
    else label.textContent = this.chaseRunning ? 'Pause chase' : 'Start chase';
  }

  setStats(view, values) {
    const labels = this.mode === 'chase' ? CHASE_STATS : SEARCH_STATS;
    view.stats.forEach((s, i) => {
      s.dt.textContent = labels[i];
      s.dd.textContent = values[i];
    });
  }

  resetStats() {
    this.views.forEach((v) => this.setStats(v, ['–', '–', '–', '–']));
  }

  updateLiveStats() {
    this.activeViews().forEach((v) => this.setStats(v, [v.playback.visited, '…', '…', '…']));
  }

  showFinalStats(view) {
    const r = view.result;
    const time = r.timeMs < 1 ? '< 1 ms' : `${r.timeMs.toFixed(1)} ms`;
    this.setStats(view, [r.visited, r.found ? r.cost : 'No path', r.found ? r.path.length - 1 : '–', time]);
  }

  updateChaseStats() {
    const c = this.chase;
    if (!c) return;
    const distance = c.reachable ? `${c.path.length - 1} (cost ${pathCost(this.grid, c.path)})` : 'No path';
    this.setStats(this.views[0], [`${c.elapsed.toFixed(1)} s`, c.replans, c.steps, distance]);
  }

  /** Sizes the canvases to their boxes and redraws at once (resizing clears a canvas). */
  layout() {
    if (!this.grid) return;
    for (const v of this.views) if (!v.figure.hidden) v.renderer.resize(this.grid.cols, this.grid.rows);
    this.render();
  }

  refreshTheme() {
    this.views.forEach((v) => v.renderer.readTheme());
    this.requestDraw();
  }

  requestDraw() {
    this.dirty = true;
    this.ensureLoop();
  }

  ensureLoop() {
    if (!this.frame) this.frame = requestAnimationFrame((t) => this.tick(t));
  }

  tick(now) {
    this.frame = 0;
    const dt = this.lastTime ? Math.min(0.1, (now - this.lastTime) / 1000) : 0;
    if (this.state === 'playing') {
      this.stepBudget += SPEEDS[this.speed - 1] * dt;
      const steps = Math.floor(this.stepBudget);
      this.stepBudget -= steps;
      if (steps > 0) this.advanceAll(steps);
    }
    if (this.chaseRunning) this.advanceChase(dt);
    if (this.dirty) {
      this.dirty = false;
      this.render();
    }
    const animating = this.state === 'playing' || this.chaseRunning;
    this.lastTime = animating ? now : 0;
    if (animating) this.ensureLoop();
  }

  render() {
    const g = this.grid;
    const cursor = this.showCursor ? this.cursor : -1;
    if (this.mode === 'chase' && this.chase) {
      const c = this.chase;
      this.views[0].renderer.draw({
        grid: g,
        marks: this.chaseMarks,
        plan: c.path,
        agents: [{ cell: c.target, kind: 'target' }, { cell: c.chaser, kind: 'chaser' }],
        hover: this.hover,
      });
      return;
    }
    for (const v of this.views) {
      if (v.figure.hidden) continue;
      v.renderer.draw({
        grid: g,
        marks: v.playback.loaded ? v.playback.marks : null,
        path: v.playback.path,
        start: g.start,
        goal: g.goal,
        cursor,
        hover: this.hover,
      });
    }
  }
}

/** Cells on a straight line from a to b (Bresenham), so fast strokes leave no gaps. */
function lineCells(grid, a, b) {
  let x0 = grid.col(a);
  let y0 = grid.row(a);
  const x1 = grid.col(b);
  const y1 = grid.row(b);
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  const cells = [];
  for (;;) {
    cells.push(grid.index(x0, y0));
    if (x0 === x1 && y0 === y1) return cells;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
}
