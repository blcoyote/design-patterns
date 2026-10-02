import { describe, expect, it } from 'vitest'
import { parseCode } from '@/lib/codeRegions'
import { patterns } from './registry'
import { validatePattern } from './validate'

const slugs = patterns.map((p) => p.slug)

describe('pattern registry', () => {
  it('has unique slugs', () => {
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('every slug matches its folder-friendly format', () => {
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9-]+$/)
  })

  it.each(patterns.map((p) => [p.slug, p] as const))('%s is internally consistent', (_slug, p) => {
    expect(validatePattern(p, slugs)).toEqual([])
    expect(p.steps.length).toBeGreaterThan(0)
    expect(p.participants.length).toBeGreaterThan(0)
  })

  it.each(patterns.map((p) => [p.slug, p] as const))('%s code has no unclosed or stray markers', (_slug, p) => {
    expect(parseCode(p.code).text).not.toMatch(/\/\/ \[\/?[\w-]+\]/)
  })

  const withCSharp = patterns.filter((p) => p.csharp)
  it.each(withCSharp.map((p) => [p.slug, p] as const))('%s csharp code has no unclosed or stray markers', (_slug, p) => {
    expect(parseCode(p.csharp!).text).not.toMatch(/\/\/ \[\/?[\w-]+\]/)
  })

  it.each(withCSharp.map((p) => [p.slug, p] as const))('%s csharp regions match the typescript regions', (_slug, p) => {
    const tsRegionIds = Object.keys(parseCode(p.code).regions).sort()
    const csRegionIds = Object.keys(parseCode(p.csharp!).regions).sort()
    expect(csRegionIds).toEqual(tsRegionIds)
  })
})

describe('parseCode', () => {
  it('strips markers and records nested regions', () => {
    const { text, regions } = parseCode('// [a]\nline1\n// [b]\nline2\n// [/b]\n// [/a]\nline3')
    expect(text).toBe('line1\nline2\nline3')
    expect(regions).toEqual({ a: [1, 2], b: [2, 2] })
  })
})
