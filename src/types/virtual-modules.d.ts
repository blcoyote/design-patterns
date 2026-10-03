/**
 * `virtual:pattern-usages` is provided at build/dev time by `vite-plugins/patternUsages.ts`
 * (registered in `vite.config.ts`). It never ships full source files — only the `@pattern` tags
 * extracted from them. See `src/lib/selfUsage.ts` for the consumer-facing API.
 */
declare module 'virtual:pattern-usages' {
  import type { PatternUsage } from '../../vite-plugins/types'

  export const patternUsages: PatternUsage[]
}
