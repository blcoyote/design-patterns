export interface ParsedCode {
  /** Code with region markers removed. */
  text: string
  /** Region id → inclusive 1-based [start, end] line range in `text`. */
  regions: Record<string, [number, number]>
}

const OPEN = /^\s*\/\/ \[([\w-]+)\]\s*$/
const CLOSE = /^\s*\/\/ \[\/([\w-]+)\]\s*$/

const cache = new Map<string, ParsedCode>()

/**
 * Strips `// [id]` / `// [/id]` marker lines from a code sample and
 * records the line range each region covers. Regions may nest.
 */
export function parseCode(source: string): ParsedCode {
  const cached = cache.get(source)
  if (cached) return cached

  const out: string[] = []
  const open = new Map<string, number>()
  const regions: Record<string, [number, number]> = {}

  for (const line of source.replace(/^\n+|\s+$/g, '').split('\n')) {
    const start = OPEN.exec(line)
    if (start) {
      open.set(start[1], out.length + 1)
      continue
    }
    const end = CLOSE.exec(line)
    if (end) {
      const from = open.get(end[1])
      if (from !== undefined) {
        regions[end[1]] = [from, out.length]
        open.delete(end[1])
      }
      continue
    }
    out.push(line)
  }

  const parsed = { text: out.join('\n'), regions }
  cache.set(source, parsed)
  return parsed
}
