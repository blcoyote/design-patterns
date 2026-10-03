import { resolveSubject } from '@/lib/crossRefs'
import type { ComparisonDefinition } from '@/types/comparison'
import { validateComparison } from './validate'

/**
 * Every folder in src/comparisons/<slug> with an index.ts exporting `comparison` is picked up
 * automatically, one level deep (unlike patterns/architectures, there is no category/paradigm
 * grouping). The template at src/comparisons/_template is naturally excluded since it isn't a
 * real comparison, but it's also excluded explicitly for clarity.
 */
const modules = import.meta.glob<{ comparison: ComparisonDefinition }>(['./*/index.ts', '!./_*/**'], {
  eager: true,
})

export const comparisons: ComparisonDefinition[] = Object.values(modules)
  .map((m) => m.comparison)
  .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title))

const bySlug = new Map(comparisons.map((c) => [c.slug, c]))

export function getComparison(slug: string | undefined): ComparisonDefinition | undefined {
  return slug ? bySlug.get(slug) : undefined
}

/** Reverse lookup for the "Often confused with…" box on a pattern/architecture page. */
export function comparisonsFor(subjectSlug: string): ComparisonDefinition[] {
  return comparisons.filter((c) => c.subjects.some((s) => s.slug === subjectSlug))
}

if (import.meta.env.DEV) {
  for (const c of comparisons) {
    const errors = validateComparison(c, resolveSubject)
    if (errors.length) console.warn(`[comparisons] ${c.slug}:\n  ${errors.join('\n  ')}`)
  }
}
