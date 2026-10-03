import { describe, expect, it } from 'vitest'
import { extractUsages } from './patternUsages.ts'

describe('extractUsages', () => {
  it('parses the tag grammar and keeps the snippet up to the next blank line', () => {
    const source = ['// @pattern observer: notifies every subscriber', 'function emit() {', '  for (const l of listeners) l()', '}', '', 'const unrelated = 1'].join(
      '\n',
    )
    expect(extractUsages('src/lib/example.ts', source)).toEqual([
      {
        slug: 'observer',
        file: 'src/lib/example.ts',
        line: 2,
        explanation: 'notifies every subscriber',
        snippet: 'function emit() {\n  for (const l of listeners) l()\n}',
      },
    ])
  })

  it('strips the tag line itself from the snippet', () => {
    const source = '// @pattern singleton: one instance\nconst x = 1'
    const [usage] = extractUsages('f.ts', source)
    expect(usage.snippet).not.toContain('@pattern')
    expect(usage.snippet).toBe('const x = 1')
  })

  it('caps the snippet at 15 lines', () => {
    const body = Array.from({ length: 20 }, (_, i) => `line${i}`).join('\n')
    const source = `// @pattern iterator: a cursor\n${body}`
    const [usage] = extractUsages('f.ts', source)
    expect(usage.snippet.split('\n')).toHaveLength(15)
    expect(usage.snippet.split('\n')[0]).toBe('line0')
    expect(usage.snippet.split('\n')[14]).toBe('line14')
  })

  it('dedents the snippet to the shallowest line', () => {
    const source = ['// @pattern strategy: swaps behaviour', '  if (true) {', '    doThing()', '  }'].join('\n')
    const [usage] = extractUsages('f.ts', source)
    expect(usage.snippet).toBe('if (true) {\n  doThing()\n}')
  })

  it('reports the line number of the line right after the tag, for the GitHub link', () => {
    const source = '\n\n// @pattern facade: one entry point\nexport function f() {}'
    const [usage] = extractUsages('f.ts', source)
    expect(usage.line).toBe(4)
  })

  it('skips a tag with nothing but a blank line after it', () => {
    const source = '// @pattern observer: dangling tag\n\ncode()'
    expect(extractUsages('f.ts', source)).toEqual([])
  })

  it('skips a tag on the last line of the file', () => {
    const source = '// @pattern observer: dangling tag'
    expect(extractUsages('f.ts', source)).toEqual([])
  })

  it('finds multiple tags in the same file', () => {
    const source = ['// @pattern observer: first', 'a()', '', '// @pattern strategy: second', 'b()'].join('\n')
    const usages = extractUsages('f.ts', source)
    expect(usages.map((u) => u.slug)).toEqual(['observer', 'strategy'])
  })

  it('ignores a comment that only resembles the tag', () => {
    expect(extractUsages('f.ts', '// not a @pattern tag: nope\ncode()')).toEqual([])
  })
})
