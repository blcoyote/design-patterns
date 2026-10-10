export interface ThemeDefinition {
  /** Matches the `[data-theme="<id>"]` block in tokens.css. */
  id: string;
  label: string;
}

/**
 * Every theme the site ships. Adding one is a `[data-theme="<id>"]` block in
 * tokens.css that re-points tokens (and sets its own `color-scheme`), plus an entry
 * here. The first entry is the default and is the one `:root` defines.
 */
export const themes = [
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
] as const satisfies readonly ThemeDefinition[];

export type ThemeId = (typeof themes)[number]["id"];

export const defaultTheme: ThemeId = themes[0].id;

/** localStorage key for the chosen theme, shared by the pre-paint script and `useTheme`. */
export const THEME_STORAGE_KEY = "dp:theme";
