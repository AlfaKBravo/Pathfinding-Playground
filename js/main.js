import { App } from './ui/app.js?v=3';
import { drawSwatch } from './ui/renderer.js?v=3';

const root = document.documentElement;
const app = new App();

const drawLegend = () => document.querySelectorAll('canvas[data-swatch]').forEach((c) => drawSwatch(c, c.dataset.swatch));
drawLegend();

/* Blueprint (default) or light drafting-sheet theme */
const themeColor = document.querySelector('meta[name="theme-color"]');
const applyTheme = () => {
  themeColor.content = getComputedStyle(root).getPropertyValue('--paper').trim();
  app.refreshTheme();
  drawLegend();
};
document.querySelector('#themeToggle').addEventListener('click', () => {
  const next = root.dataset.theme === 'light' ? 'dark' : 'light';
  root.dataset.theme = next;
  try { localStorage.setItem('theme', next); } catch (e) { /* storage blocked */ }
  applyTheme();
});
applyTheme();

// canvas text uses the web font; redraw once it has loaded
document.fonts?.ready.then(applyTheme);

document.querySelector('#year').textContent = new Date().getFullYear();
