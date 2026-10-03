import { parseCode, type ParsedCode } from './codeRegions'
import type { CodeSource } from '@/components/content/CodeBlock'
import type { CodeLanguage } from '@/hooks/useCodeLanguage'

export interface LanguageCode {
  lang: CodeLanguage
  code: ParsedCode
}

/** Parses the TypeScript/C#/Python/Go examples of an `ExplorableDefinition`-shaped object into one
 * entry per language that is actually present. Shared by `PatternExplorer` and `ComparisonPage`
 * so the "which languages does this subject ship" logic lives in exactly one place. */
export function parseLanguages(def: { code: string; csharp?: string; python?: string; go?: string }): LanguageCode[] {
  const parsed: LanguageCode[] = [{ lang: 'typescript', code: parseCode(def.code) }]
  if (def.csharp) parsed.push({ lang: 'csharp', code: parseCode(def.csharp) })
  if (def.python) parsed.push({ lang: 'python', code: parseCode(def.python) })
  if (def.go) parsed.push({ lang: 'go', code: parseCode(def.go) })
  return parsed
}

/** Turns parsed languages into `CodeBlock` sources, highlighting `region` (if it exists) in each. */
export function buildCodeSources(languages: LanguageCode[], region?: string | null): CodeSource[] {
  return languages.map(({ lang, code }) => ({
    lang,
    text: code.text,
    highlight: region ? code.regions[region] : undefined,
  }))
}
