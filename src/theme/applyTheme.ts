import type { ThemeId } from "./themes";

/** Resolves any CSS colour to `rgb()` through a canvas, or null if the browser can't parse it. */
function toRgb(color: string): string | null {
  const ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  const sentinel = "#010203";
  ctx.fillStyle = sentinel;
  ctx.fillStyle = color;
  if (ctx.fillStyle === sentinel) return null; // unparseable colour: assignment was ignored
  ctx.clearRect(0, 0, 1, 1);
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return `rgb(${r} ${g} ${b})`;
}

/** Points the browser chrome (mobile address bar) at the active theme's canvas colour. */
function syncThemeColorMeta() {
  const canvas = getComputedStyle(document.documentElement).getPropertyValue("--color-canvas");
  const rgb = canvas.trim() ? toRgb(canvas.trim()) : null;
  if (!rgb) return;
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.appendChild(meta);
  }
  meta.content = rgb;
}

/** Switches the page to `id`: the `data-theme` attribute re-points every token. */
export function applyTheme(id: ThemeId) {
  document.documentElement.dataset.theme = id;
  syncThemeColorMeta();
}
