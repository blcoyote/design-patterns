import { describe, expect, it } from 'vitest'
import { resolveSubject } from '@/lib/crossRefs'
import type { ComparisonDefinition } from '@/types/comparison'
import { comparisons, comparisonsFor, getComparison } from './registry'
import { validateComparison } from './validate'

const slugs = comparisons.map((c) => c.slug)

const modules = import.meta.glob<{ comparison: ComparisonDefinition }>(['./*/index.ts', '!./_*/**'], {
  eager: true,
})

describe('comparison registry', () => {
  it('has unique slugs', () => {
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('every comparison lives at ./<slug>/index.ts (one level deep)', () => {
    // the glob is deliberately broad, so a misplaced index.ts (wrong depth) fails here instead of going unseen
    expect(Object.keys(modules).length).toBe(comparisons.length)
    for (const [path, mod] of Object.entries(modules)) {
      expect(path).toBe(`./${mod.comparison.slug}/index.ts`)
    }
  })

  it('every slug matches its folder-friendly format', () => {
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9-]+$/)
  })

  it.each(comparisons.map((c) => [c.slug, c] as const))('%s is internally consistent', (_slug, c) => {
    expect(validateComparison(c, resolveSubject)).toEqual([])
  })

  it('getComparison resolves a known slug and returns undefined otherwise', () => {
    const first = comparisons[0]
    expect(getComparison(first?.slug)).toBe(first)
    expect(getComparison('does-not-exist')).toBeUndefined()
    expect(getComparison(undefined)).toBeUndefined()
  })

  it('comparisonsFor finds every comparison that names a subject, and nothing otherwise', () => {
    const first = comparisons[0]
    for (const subject of first.subjects) {
      expect(comparisonsFor(subject.slug)).toContainEqual(first)
    }
    expect(comparisonsFor('does-not-exist')).toEqual([])
  })
})

describe('validateComparison', () => {
  const base = comparisons.find((c) => c.slug === 'strategy-vs-state')
  if (!base) throw new Error('fixture comparison "strategy-vs-state" not found')

  it('passes for the real comparison', () => {
    expect(validateComparison(base, resolveSubject)).toEqual([])
  })

  it('flags a subject slug that does not resolve', () => {
    const bad: ComparisonDefinition = { ...base, subjects: [...base.subjects, { kind: 'pattern', slug: 'does-not-exist' }] }
    const errors = validateComparison(bad, resolveSubject)
    expect(errors.some((e) => e.includes('does-not-exist'))).toBe(true)
  })

  it('flags a code ref with an unknown region', () => {
    const bad: ComparisonDefinition = {
      ...base,
      options: base.options.map((o, i) => (i === 0 ? { ...o, code: [{ kind: 'pattern' as const, slug: 'strategy', region: 'no-such-region' }] } : o)),
    }
    const errors = validateComparison(bad, resolveSubject)
    expect(errors.some((e) => e.includes('no-such-region'))).toBe(true)
  })

  it('flags an out-of-range step', () => {
    const bad: ComparisonDefinition = {
      ...base,
      options: base.options.map((o, i) => (i === 0 ? { ...o, steps: [{ kind: 'pattern' as const, slug: 'strategy', step: 999 }] } : o)),
    }
    const errors = validateComparison(bad, resolveSubject)
    expect(errors.some((e) => e.includes('999'))).toBe(true)
  })

  it('flags two "best" choices', () => {
    const bad: ComparisonDefinition = {
      ...base,
      scenario: {
        ...base.scenario,
        choices: base.scenario.choices.map((choice, i) => (i === 1 ? { ...choice, verdict: 'best' as const } : choice)),
      },
    }
    const errors = validateComparison(bad, resolveSubject)
    expect(errors.some((e) => e.toLowerCase().includes('best'))).toBe(true)
  })

  it('flags a choice naming an unknown option', () => {
    const bad: ComparisonDefinition = {
      ...base,
      scenario: { ...base.scenario, choices: base.scenario.choices.map((choice, i) => (i === 0 ? { ...choice, option: 'nope' } : choice)) },
    }
    const errors = validateComparison(bad, resolveSubject)
    expect(errors.some((e) => e.includes('"nope"'))).toBe(true)
  })
})
