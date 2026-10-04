import { App } from './ui/app.js';
import { drawSwatch } from './ui/renderer.js';

const root = document.documentElement;
const app = new App();

const drawLegend = () => document.querySelectorAll('canvas[data-swatch]').forEach((c) => drawSwatch(c, c.dataset.swatch));
drawLegend();

/* Day / night edition, shared with the portfolio */
const themeColor = document.querySelector('meta[name="theme-color"]');
const applyTheme = () => {
  themeColor.content = getComputedStyle(root).getPropertyValue('--paper').trim();
  app.refreshTheme();
  drawLegend();
};
document.querySelector('#themeToggle').addEventListener('click', () => {
  const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
  root.dataset.theme = next;
  try { localStorage.setItem('theme', next); } catch (e) { /* storage blocked */ }
  applyTheme();
});
applyTheme();

// canvas text uses the web font; redraw once it has loaded
document.fonts?.ready.then(applyTheme);

document.querySelector('#year').textContent = new Date().getFullYear();
