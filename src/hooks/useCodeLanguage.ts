import { useSyncExternalStore } from "react";

export type CodeLanguage = "typescript" | "csharp" | "python" | "go";

const LANGUAGES: readonly CodeLanguage[] = ["typescript", "csharp", "python", "go"];

const STORAGE_KEY = "dp:code-lang";

function readStored(): CodeLanguage {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return LANGUAGES.find((lang) => lang === stored) ?? "typescript";
  } catch {
    return "typescript";
  }
}

let cached = readStored();
const listeners = new Set<() => void>();

// @pattern observer: every CodeBlock subscribes to the shared language preference, so picking C# once switches all of them
function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  // storage events fired while nothing was subscribed were missed — resync on (re)subscribe
  cached = readStored();
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY || e.key === null) {
      cached = readStored();
      listener();
    }
  };
  // @pattern pub-sub: the browser's storage event carries a language change to other tabs, and the tabs don't know about each other
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot() {
  return cached;
}

function getServerSnapshot(): CodeLanguage {
  return "typescript";
}

function setPreferredCodeLanguage(lang: CodeLanguage) {
  if (cached === lang) return;
  cached = lang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // storage unavailable (private mode, etc.) — keep the in-memory value only
  }
  emit();
}

/**
 * The user's preferred code-example language ('typescript' | 'csharp' | 'python' | 'go'),
 * persisted to localStorage and shared across every `CodeBlock` instance so
 * picking C#, Python or Go on one pattern keeps it selected on the next.
 *
 * Callers must fall back to 'typescript' themselves when the preferred
 * language isn't available for the current pattern — do so without calling
 * the setter, so the stored preference isn't overwritten by a one-off
 * fallback.
 */
export function useCodeLanguage(): [CodeLanguage, (lang: CodeLanguage) => void] {
  const lang = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return [lang, setPreferredCodeLanguage];
}
