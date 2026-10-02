import { useSyncExternalStore } from 'react'

export type CodeLanguage = 'typescript' | 'csharp'

const STORAGE_KEY = 'dp:code-lang'

function readStored(): CodeLanguage {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'csharp' ? 'csharp' : 'typescript'
  } catch {
    return 'typescript'
  }
}

let cached = readStored()
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY || e.key === null) {
      cached = readStored()
      listener()
    }
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

function getSnapshot() {
  return cached
}

function getServerSnapshot(): CodeLanguage {
  return 'typescript'
}

function setPreferredCodeLanguage(lang: CodeLanguage) {
  if (cached === lang) return
  cached = lang
  try {
    localStorage.setItem(STORAGE_KEY, lang)
  } catch {
    // storage unavailable (private mode, etc.) — keep the in-memory value only
  }
  emit()
}

/**
 * The user's preferred code-example language ('typescript' | 'csharp'),
 * persisted to localStorage and shared across every `CodeBlock` instance so
 * picking C# on one pattern keeps C# selected on the next.
 *
 * Callers must fall back to 'typescript' themselves when the preferred
 * language isn't available for the current pattern — do so without calling
 * the setter, so the stored preference isn't overwritten by a one-off
 * fallback.
 */
export function useCodeLanguage(): [CodeLanguage, (lang: CodeLanguage) => void] {
  const lang = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  return [lang, setPreferredCodeLanguage]
}
