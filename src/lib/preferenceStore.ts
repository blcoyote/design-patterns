export interface PreferenceStore<T extends string> {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => T;
  getServerSnapshot: () => T;
  set: (value: T) => void;
}

interface PreferenceStoreConfig<T extends string> {
  /** localStorage key. */
  key: string;
  /** Values a stored string may take; anything else falls back. */
  options: readonly T[];
  fallback: T;
  /** Runs whenever the value changes, from `set` or from another tab, even with no subscribers. */
  onChange?: (value: T) => void;
}

/**
 * A localStorage-backed preference that React reads through `useSyncExternalStore`: one
 * shared value, persisted, kept in sync across tabs while something is subscribed.
 */
export function createPreferenceStore<T extends string>({
  key,
  options,
  fallback,
  onChange,
}: PreferenceStoreConfig<T>): PreferenceStore<T> {
  function readStored(): T {
    try {
      const stored = localStorage.getItem(key);
      return options.find((option) => option === stored) ?? fallback;
    } catch {
      return fallback;
    }
  }

  let cached = readStored();
  const listeners = new Set<() => void>();

  // @pattern observer: every consumer of a preference store subscribes to its shared value, so changing it once updates all of them
  function emit() {
    for (const listener of listeners) listener();
  }

  function refresh() {
    const next = readStored();
    if (next === cached) return;
    cached = next;
    onChange?.(next);
  }

  function subscribe(listener: () => void) {
    // storage events fired while nothing was subscribed were missed — resync on (re)subscribe
    refresh();
    listeners.add(listener);
    const onStorage = (e: StorageEvent) => {
      if (e.key === key || e.key === null) {
        refresh();
        listener();
      }
    };
    // @pattern pub-sub: the browser's storage event carries a change to other tabs, and the tabs don't know about each other
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  }

  function set(value: T) {
    if (cached === value) return;
    cached = value;
    try {
      localStorage.setItem(key, value);
    } catch {
      // storage unavailable (private mode, etc.) — keep the in-memory value only
    }
    onChange?.(value);
    emit();
  }

  return { subscribe, getSnapshot: () => cached, getServerSnapshot: () => fallback, set };
}
