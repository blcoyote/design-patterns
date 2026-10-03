import { patternUsages } from 'virtual:pattern-usages'
import { describe, expect, it } from 'vitest'
import { architectures } from '@/architectures/registry'
import { patterns } from '@/patterns/registry'
import { usagesOf, usedSlugs } from './selfUsage'

const patternSlugs = new Set(patterns.map((p) => p.slug))
const architectureSlugs = new Set(architectures.map((a) => a.slug))

// a folder two levels under patterns/ or architectures/ is a pattern/architecture's own example —
// @pattern tags must never live there, or every teaching example would tag itself
const INSIDE_A_PATTERN_OR_ARCHITECTURE_FOLDER = /^src\/(patterns|architectures)\/[^/]+\/[^/]+\//

describe('pattern usages collected from @pattern tags', () => {
  it('found at least one usage', () => {
    expect(patternUsages.length).toBeGreaterThan(0)
  })

  it.each(patternUsages.map((u) => [`${u.slug} (${u.file}:${u.line})`, u] as const))('%s tags a slug that exists in a registry', (_label, u) => {
    expect(patternSlugs.has(u.slug) || architectureSlugs.has(u.slug)).toBe(true)
  })

  it.each(patternUsages.map((u) => [`${u.slug} (${u.file}:${u.line})`, u] as const))('%s is not inside a pattern or architecture folder', (_label, u) => {
    expect(u.file).not.toMatch(INSIDE_A_PATTERN_OR_ARCHITECTURE_FOLDER)
  })

  it.each(patternUsages.map((u) => [`${u.slug} (${u.file}:${u.line})`, u] as const))('%s has a non-empty explanation and snippet', (_label, u) => {
    expect(u.explanation.trim().length).toBeGreaterThan(0)
    expect(u.snippet.trim().length).toBeGreaterThan(0)
  })

  it('design-pattern and architecture slugs never collide', () => {
    const overlap = [...patternSlugs].filter((slug) => architectureSlugs.has(slug))
    expect(overlap).toEqual([])
  })
})

describe('usagesOf / usedSlugs', () => {
  it('usagesOf returns every usage tagged with a slug', () => {
    const [usage] = patternUsages
    expect(usagesOf(usage.slug)).toEqual(expect.arrayContaining([expect.objectContaining({ slug: usage.slug, file: usage.file })]))
  })

  it('usagesOf returns an empty array for an unused slug', () => {
    expect(usagesOf('does-not-exist')).toEqual([])
  })

  it('usagesOf resolves a GitHub link on main at the tagged line', () => {
    const [usage] = usagesOf(patternUsages[0].slug)
    expect(usage.githubUrl).toBe(`https://github.com/blcoyote/design-patterns/blob/main/${usage.file}#L${usage.line}`)
  })

  it('usedSlugs contains exactly the tagged slugs', () => {
    expect(usedSlugs()).toEqual(new Set(patternUsages.map((u) => u.slug)))
  })
})
