import type { HtmlTagDescriptor, Plugin } from "vite";
import { defaultTheme, THEME_STORAGE_KEY, themes } from "../src/theme/themes.ts";

/**
 * Inline script that sets `data-theme` before first paint, so a stored non-default theme
 * never flashes the default one. Generated from `themes.ts` so the id list can't drift.
 * It only reads localStorage; the app (`useTheme`) owns writing it.
 */
export function themeBootstrapScript(): string {
  const ids = JSON.stringify(themes.map((theme) => theme.id));
  return (
    `(function(){var t=${JSON.stringify(defaultTheme)};` +
    `try{var s=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});` +
    `if(${ids}.indexOf(s)>=0)t=s}catch(e){}` +
    `document.documentElement.dataset.theme=t})();`
  );
}

/** The `<script>` tag Vite splices into index.html, ahead of everything else in <head>. */
export function themeBootstrapTags(): HtmlTagDescriptor[] {
  return [{ tag: "script", children: themeBootstrapScript(), injectTo: "head-prepend" }];
}

export function themeBootstrapPlugin(): Plugin {
  return { name: "theme-bootstrap", transformIndexHtml: themeBootstrapTags };
}
