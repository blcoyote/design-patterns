import { describe, expect, it } from 'vitest'
import { findMarkerErrors, parseCode } from '@/lib/codeRegions'
import type { PatternDefinition } from '@/types/pattern'
import { patterns } from './registry'
import { validatePattern } from './validate'

const slugs = patterns.map((p) => p.slug)

const modules = import.meta.glob<{ pattern: PatternDefinition }>(['./*/*/index.ts', '!./_*/**'], {
  eager: true,
})

describe('pattern registry', () => {
  it('has unique slugs', () => {
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('every pattern lives at ./<category>/<slug>/index.ts', () => {
    for (const [path, mod] of Object.entries(modules)) {
      const { pattern } = mod
      expect(path).toBe(`./${pattern.category}/${pattern.slug}/index.ts`)
    }
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
    expect(findMarkerErrors(p.code)).toEqual([])
  })

  const withCSharp = patterns.filter((p) => p.csharp)
  it.each(withCSharp.map((p) => [p.slug, p] as const))('%s csharp code has no unclosed or stray markers', (_slug, p) => {
    expect(findMarkerErrors(p.csharp!)).toEqual([])
  })

  it.each(withCSharp.map((p) => [p.slug, p] as const))('%s csharp has no JavaScript template strings', (_slug, p) => {
    // backticks outside comments are invalid C#; they usually mean a TS line was copied over unconverted
    expect(p.csharp!.split('\n').filter((line) => line.split('//')[0].includes('`'))).toEqual([])
  })

  it.each(withCSharp.map((p) => [p.slug, p] as const))('%s csharp regions match the typescript regions', (_slug, p) => {
    const tsRegionIds = Object.keys(parseCode(p.code).regions).sort()
    const csRegionIds = Object.keys(parseCode(p.csharp!).regions).sort()
    expect(csRegionIds).toEqual(tsRegionIds)
  })

  const withPython = patterns.filter((p) => p.python)
  it.each(withPython.map((p) => [p.slug, p] as const))('%s python code has no unclosed or stray markers', (_slug, p) => {
    expect(findMarkerErrors(p.python!)).toEqual([])
  })

  it.each(withPython.map((p) => [p.slug, p] as const))('%s python uses # markers, not //', (_slug, p) => {
    // a `// [id]` line in Python is a syntax error; it usually means a marker was copied over unconverted
    expect(p.python!.split('\n').filter((line) => /^\s*\/\/ \[/.test(line))).toEqual([])
  })

  it.each(withPython.map((p) => [p.slug, p] as const))('%s python regions match the typescript regions', (_slug, p) => {
    const tsRegionIds = Object.keys(parseCode(p.code).regions).sort()
    const pyRegionIds = Object.keys(parseCode(p.python!).regions).sort()
    expect(pyRegionIds).toEqual(tsRegionIds)
  })
})

describe('findMarkerErrors', () => {
  it('reports unmatched, unclosed, duplicate and inline markers', () => {
    expect(findMarkerErrors('// [a]\nx\n// [/a]')).toEqual([])
    expect(findMarkerErrors('// [/a]')).toEqual(['line 1: "[/a]" has no matching opening marker'])
    expect(findMarkerErrors('// [a]\nx')).toEqual(['region "a" is never closed'])
    expect(findMarkerErrors('// [a]\n// [/a]\n// [a]\n// [/a]')).toEqual(['line 3: region "a" opened twice'])
    expect(findMarkerErrors('foo() // [a]')).toEqual(['line 1: marker must be on its own line'])
    expect(findMarkerErrors('# [a]\nx\n# [/a]')).toEqual([])
    expect(findMarkerErrors('foo()  # [a]')).toEqual(['line 1: marker must be on its own line'])
  })
})

describe('parseCode', () => {
  it('strips markers and records nested regions', () => {
    const { text, regions } = parseCode('// [a]\nline1\n// [b]\nline2\n// [/b]\n// [/a]\nline3')
    expect(text).toBe('line1\nline2\nline3')
    expect(regions).toEqual({ a: [1, 2], b: [2, 2] })
  })

  it('accepts Python # markers', () => {
    const { text, regions } = parseCode('# [a]\nx = 1\n    # [b]\n    y = 2\n    # [/b]\n# [/a]')
    expect(text).toBe('x = 1\n    y = 2')
    expect(regions).toEqual({ a: [1, 2], b: [2, 2] })
  })
})
