/**
 * Shape of one `@pattern` tag collected from the source. Kept in its own file, with no Node
 * imports, so `src/types/virtual-modules.d.ts` (type-checked as part of the app) and
 * `patternUsages.ts` (type-checked as part of the Node/Vite config) can both reference the
 * same type without crossing their tsconfig boundaries.
 */
export interface PatternUsage {
  /** Design-pattern or architecture slug named in the tag. */
  slug: string
  /** Repo-relative path, forward slashes, e.g. `src/lib/crossRefs.ts`. */
  file: string
  /** 1-based line number of the tagged declaration (the line after the tag comment). */
  line: number
  explanation: string
  snippet: string
}
