// The viewport the layout is designed at (a maximized browser on a 24" 1080p monitor); every size is a ratio of it, so no monitor is special-cased.
export const DESIGN_VIEWPORT = { width: 1920, height: 950 } as const;
const MIN_SCALE = 0.6;
const MAX_SCALE = 1.6;
const STEP = 0.05;

export function screenScaleFor(width: number, height: number): number {
  const raw = Math.min(width / DESIGN_VIEWPORT.width, height / DESIGN_VIEWPORT.height);
  const stepped = Math.round(raw / STEP) * STEP;
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, Number(stepped.toFixed(2))));
}

// Moving the window to another monitor changes its size or its pixel density; a density change fires no resize, so it is watched too.
function watchPixelDensity(win: Window, onChange: () => void): () => void {
  if (!win.matchMedia) return () => undefined;
  let query = win.matchMedia(`(resolution: ${win.devicePixelRatio}dppx)`);
  const handler = () => {
    onChange();
    query.removeEventListener('change', handler);
    query = win.matchMedia(`(resolution: ${win.devicePixelRatio}dppx)`);
    query.addEventListener('change', handler);
  };
  query.addEventListener('change', handler);
  return () => query.removeEventListener('change', handler);
}

// Publishes --ui-scale on the root and keeps it current for the monitor the window is on.
export function installScreenScale(win: Window = window): () => void {
  const apply = () => win.document.documentElement.style.setProperty('--ui-scale', String(screenScaleFor(win.innerWidth, win.innerHeight)));
  apply();
  win.addEventListener('resize', apply);
  const stopDensity = watchPixelDensity(win, apply);
  return () => {
    win.removeEventListener('resize', apply);
    stopDensity();
  };
}
