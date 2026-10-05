import { useSyncExternalStore } from "react";
import { createPreferenceStore } from "@/lib/preferenceStore";
import { applyTheme } from "@/theme/applyTheme";
import { defaultTheme, THEME_STORAGE_KEY, themes, type ThemeId } from "@/theme/themes";

const store = createPreferenceStore<ThemeId>({
  key: THEME_STORAGE_KEY,
  options: themes.map((theme) => theme.id),
  fallback: defaultTheme,
  onChange: applyTheme,
});

/** Applies the stored theme to the page. Call once at startup, after the stylesheet is loaded. */
export function initTheme() {
  applyTheme(store.getSnapshot());
}

/**
 * The active theme id, persisted to localStorage and shared across every consumer.
 * Setting it re-points the design tokens by switching `data-theme` on `<html>`.
 */
export function useTheme(): [ThemeId, (theme: ThemeId) => void] {
  const theme = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  return [theme, store.set];
}
