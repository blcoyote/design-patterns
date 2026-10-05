import { useSyncExternalStore } from "react";
import { createPreferenceStore } from "@/lib/preferenceStore";

export type CodeLanguage = "typescript" | "csharp" | "python" | "go";

const LANGUAGES: readonly CodeLanguage[] = ["typescript", "csharp", "python", "go"];

const store = createPreferenceStore<CodeLanguage>({
  key: "dp:code-lang",
  options: LANGUAGES,
  fallback: "typescript",
});

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
  const lang = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  return [lang, store.set];
}
