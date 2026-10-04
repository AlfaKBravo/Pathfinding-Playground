import { MUD, WALL } from '../core/grid.js';
import { FRONTIER, PATH, VISITED } from './playback.js';

/**
 * Draws a grid and everything on it onto a canvas. It knows nothing about
 * algorithms: it is handed a scene (the grid, which cells are visited,
 * frontier or path, and where the markers are) and paints it.
 *
 * Cell states differ by shape as well as colour, so they read without
 * colour vision: visited cells are hatched, frontier cells are outlined,
 * and the path is a solid fill with a line running through it.
 */
export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.cols = 1;
    this.rows = 1;
    this.readTheme();
  }

  /** Reads the colour tokens from CSS, so the board follows the blueprint or light theme. */
  readTheme() {
    const css = getComputedStyle(this.canvas);
    const token = (name) => css.getPropertyValue(name).trim();
    this.theme = {
      paper: token('--paper'),
      paper2: token('--paper-2'),
      ink: token('--ink'),
      ink2: token('--ink-2'),
      spot: token('--spot'),
      spotInk: token('--spot-ink'),
      mono: token('--f-mono') || 'monospace',
    };
  }

  /** Matches the canvas to the grid's shape and the element's size on screen. */
  resize(cols, rows) {
    this.cols = cols;
    this.rows = rows;
    this.canvas.style.aspectRatio = `${cols} / ${rows}`;
    this.canvas.style.setProperty('--ar', cols / rows);
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const width = Math.max(1, Math.round(this.canvas.clientWidth * dpr));
    const height = Math.max(1, Math.round((width * rows) / cols));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    this.cell = width / cols;
  }

  /** The cell under a pointer event, or -1 if it is outside the board. */
  cellAt(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const col = Math.floor(((clientX - rect.left) / rect.width) * this.cols);
    const row = Math.floor(((clientY - rect.top) / rect.height) * this.rows);
    if (col < 0 || row < 0 || col >= this.cols || row >= this.rows) return -1;
    return row * this.cols + col;
  }

  draw(scene) {
    const { grid, marks, path = [], plan = [], start = -1, goal = -1, agents = [], cursor = -1, hover = -1 } = scene;
    const { ctx, theme: t } = this;
    const s = this.cell;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = t.paper;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    for (let i = 0; i < grid.size; i++) {
      const [x, y, w, h] = this.rect(grid, i);
      const type = grid.get(i);
      const mark = marks ? marks[i] : 0;
      if (type === WALL) {
        ctx.fillStyle = t.ink;
        ctx.fillRect(x, y, w, h);
        continue;
      }
      if (mark === PATH) {
        ctx.fillStyle = t.spot;
        ctx.fillRect(x, y, w, h);
        if (type === MUD) drawMud(ctx, x, y, s, t.spotInk);
        continue;
      }
      if (type === MUD) {
        ctx.fillStyle = t.paper2;
        ctx.fillRect(x, y, w, h);
        drawMud(ctx, x, y, s, t.ink2);
      }
      if (mark === VISITED) drawVisited(ctx, x, y, w, h, s, t.ink);
      else if (mark === FRONTIER) drawFrontier(ctx, x, y, s, t.spot);
    }

    this.drawGridLines(t.ink);
    if (plan.length > 1) this.drawLine(grid, plan, t.spot, 0.14, [s * 0.3, s * 0.25]);
    if (path.length > 1) this.drawLine(grid, path, t.spotInk, 0.16);
    if (start >= 0) this.drawMarker(grid, start, 'S', t.ink, t.paper, 'square');
    if (goal >= 0) this.drawMarker(grid, goal, 'G', t.spot, t.spotInk, 'square');
    for (const { cell, kind } of agents) {
      if (kind === 'chaser') this.drawMarker(grid, cell, 'C', t.spot, t.spotInk, 'circle');
      else this.drawMarker(grid, cell, 'T', t.ink, t.paper, 'diamond');
    }
    if (hover >= 0) this.outline(grid, hover, t.ink, [], 0.06);
    if (cursor >= 0) this.outline(grid, cursor, t.spot, [s * 0.18, s * 0.12], 0.1);
  }

  /** Cell rectangle in device pixels, snapped so neighbours share edges with no seams. */
  rect(grid, i) {
    const s = this.cell;
    const c = grid.col(i);
    const r = grid.row(i);
    const x = Math.round(c * s);
    const y = Math.round(r * s);
    return [x, y, Math.round((c + 1) * s) - x, Math.round((r + 1) * s) - y];
  }

  center(grid, i) {
    return [(grid.col(i) + 0.5) * this.cell, (grid.row(i) + 0.5) * this.cell];
  }

  drawGridLines(color) {
    const { ctx, cell: s, canvas } = this;
    if (s < 6) return;
    ctx.save();
    ctx.globalAlpha = 0.1;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let c = 1; c < this.cols; c++) {
      const x = Math.round(c * s) + 0.5;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
    }
    for (let r = 1; r < this.rows; r++) {
      const y = Math.round(r * s) + 0.5;
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  drawLine(grid, cells, color, weight, dash = []) {
    const { ctx } = this;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2, this.cell * weight);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.setLineDash(dash);
    ctx.beginPath();
    cells.forEach((cell, n) => {
      const [x, y] = this.center(grid, cell);
      if (n === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.restore();
  }

  drawMarker(grid, cell, letter, fill, text, shape) {
    const { ctx, cell: s, theme: t } = this;
    const [cx, cy] = this.center(grid, cell);
    const r = s * 0.44;
    ctx.save();
    ctx.fillStyle = fill;
    ctx.strokeStyle = t.ink;
    ctx.lineWidth = Math.max(1.5, s * 0.08);
    ctx.beginPath();
    if (shape === 'circle') ctx.arc(cx, cy, r, 0, Math.PI * 2);
    else if (shape === 'diamond') {
      ctx.moveTo(cx, cy - r * 1.12);
      ctx.lineTo(cx + r * 1.12, cy);
      ctx.lineTo(cx, cy + r * 1.12);
      ctx.lineTo(cx - r * 1.12, cy);
      ctx.closePath();
    } else ctx.rect(cx - r, cy - r, r * 2, r * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = text;
    ctx.font = `600 ${Math.round(s * 0.58)}px ${t.mono}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(letter, cx, cy + s * 0.03);
    ctx.restore();
  }

  outline(grid, cell, color, dash, weight) {
    const { ctx, cell: s } = this;
    const [x, y, w, h] = this.rect(grid, cell);
    const lw = Math.max(2, s * weight);
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.setLineDash(dash);
    ctx.strokeRect(x + lw / 2, y + lw / 2, w - lw, h - lw);
    ctx.restore();
  }
}

/** Mud: two short waves. */
function drawMud(ctx, x, y, s, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, s * 0.08);
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (const k of [0.38, 0.66]) {
    const yy = y + s * k;
    ctx.moveTo(x + s * 0.2, yy);
    ctx.quadraticCurveTo(x + s * 0.35, yy - s * 0.12, x + s * 0.5, yy);
    ctx.quadraticCurveTo(x + s * 0.65, yy + s * 0.12, x + s * 0.8, yy);
  }
  ctx.stroke();
  ctx.restore();
}

/** Visited: a light tint and a diagonal hatch line, which joins into hatching across a region. */
function drawVisited(ctx, x, y, w, h, s, ink) {
  ctx.save();
  ctx.globalAlpha = 0.1;
  ctx.fillStyle = ink;
  ctx.fillRect(x, y, w, h);
  ctx.globalAlpha = 0.45;
  ctx.strokeStyle = ink;
  ctx.lineWidth = Math.max(1, s * 0.07);
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x + w, y);
  ctx.stroke();
  ctx.restore();
}

/** Frontier: an outlined square inside the cell. */
function drawFrontier(ctx, x, y, s, spot) {
  ctx.save();
  ctx.strokeStyle = spot;
  ctx.lineWidth = Math.max(1.5, s * 0.11);
  const inset = s * 0.24;
  ctx.strokeRect(x + inset, y + inset, s - inset * 2, s - inset * 2);
  ctx.restore();
}

const ONE_CELL = { col: () => 0, row: () => 0 };

/** Paints one legend sample (a cell state or a marker) on a small canvas, the same way the board does. */
export function drawSwatch(canvas, kind) {
  const renderer = new Renderer(canvas);
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const size = Math.round(canvas.clientWidth * dpr) || 24;
  canvas.width = canvas.height = size;
  renderer.cell = size;
  const { ctx, theme: t } = renderer;
  ctx.fillStyle = kind === 'wall' ? t.ink : kind === 'path' ? t.spot : kind === 'mud' ? t.paper2 : t.paper;
  ctx.fillRect(0, 0, size, size);
  const markers = {
    start: ['S', t.ink, t.paper, 'square'],
    goal: ['G', t.spot, t.spotInk, 'square'],
    chaser: ['C', t.spot, t.spotInk, 'circle'],
    target: ['T', t.ink, t.paper, 'diamond'],
  };
  if (markers[kind]) renderer.drawMarker(ONE_CELL, 0, ...markers[kind]);
  if (kind === 'mud') drawMud(ctx, 0, 0, size, t.ink2);
  if (kind === 'visited') drawVisited(ctx, 0, 0, size, size, size, t.ink);
  if (kind === 'frontier') drawFrontier(ctx, 0, 0, size, t.spot);
  if (kind === 'path') {
    ctx.strokeStyle = t.spotInk;
    ctx.lineWidth = Math.max(2, size * 0.16);
    ctx.beginPath();
    ctx.moveTo(0, size / 2);
    ctx.lineTo(size, size / 2);
    ctx.stroke();
  }
}
