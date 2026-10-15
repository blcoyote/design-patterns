/**
 * The page's localStorage, or `null` outside a browser or where access throws (private mode,
 * blocked). Node 25+ also defines a global `localStorage` that warns when touched (even by
 * `typeof`) unless `--localstorage-file` is set, so the check goes through `window`, which
 * Node does not define.
 */
export function browserStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}
