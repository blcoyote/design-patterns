import type { Category, PatternDefinition } from '@/types/pattern'
import { categoryOrder } from './categories'
import { validatePattern } from './validate'

/**
 * Every folder in src/patterns/<category>/<slug> with an index.ts exporting `pattern` is
 * picked up automatically. The template at src/patterns/_template is naturally excluded
 * since it isn't nested one level deeper, but it's also excluded explicitly for clarity.
 */
const modules = import.meta.glob<{ pattern: PatternDefinition }>(['./*/*/index.ts', '!./_*/**'], {
  eager: true,
})

export const patterns: PatternDefinition[] = Object.values(modules)
  .map((m) => m.pattern)
  .sort(
    (a, b) =>
      categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category) ||
      a.order - b.order ||
      a.name.localeCompare(b.name),
  )

const bySlug = new Map(patterns.map((p) => [p.slug, p]))

export function getPattern(slug: string | undefined): PatternDefinition | undefined {
  return slug ? bySlug.get(slug) : undefined
}

export function byCategory(): { category: Category; patterns: PatternDefinition[] }[] {
  return categoryOrder.map((category) => ({
    category,
    patterns: patterns.filter((p) => p.category === category),
  }))
}

export function neighbours(slug: string) {
  const i = patterns.findIndex((p) => p.slug === slug)
  return { prev: patterns[i - 1], next: patterns[i + 1] }
}

if (import.meta.env.DEV) {
  const slugs = patterns.map((p) => p.slug)
  for (const p of patterns) {
    const errors = validatePattern(p, slugs)
    if (errors.length) console.warn(`[patterns] ${p.slug}:\n  ${errors.join('\n  ')}`)
  }
}
