import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import type { Plugin } from 'vite'
import type { PatternUsage } from './types.ts'

const VIRTUAL_ID = 'virtual:pattern-usages'
const RESOLVED_ID = '\0' + VIRTUAL_ID

// `// @pattern <slug>: <explanation>`, on its own line
const TAG = /^\s*\/\/ @pattern ([\w-]+): (.+?)\s*$/

const MAX_SNIPPET_LINES = 15

/** Directories scanned recursively for `.ts`/`.tsx` files (test files excluded). */
const SCAN_DIRS = ['src/components', 'src/hooks', 'src/lib']

/** Individual files scanned in addition to `SCAN_DIRS`. */
const SCAN_FILES = ['src/patterns/registry.ts', 'src/architectures/registry.ts']

/**
 * Pure parser: extracts every `@pattern` tag from one file's already-read source. No filesystem
 * access, so this is unit-tested directly on fixture strings (see `patternUsages.test.ts`).
 *
 * A tag covers the declaration or statement that follows it: the snippet is the tag's following
 * lines, up to the first blank line, capped at `MAX_SNIPPET_LINES`, dedented. The tag line itself
 * is never part of the snippet.
 */
export function extractUsages(file: string, source: string): PatternUsage[] {
  const lines = source.split('\n')
  const usages: PatternUsage[] = []

  for (let i = 0; i < lines.length; i++) {
    const match = TAG.exec(lines[i])
    if (!match) continue
    const [, slug, explanation] = match

    const snippetLines: string[] = []
    for (let j = i + 1; j < lines.length && snippetLines.length < MAX_SNIPPET_LINES; j++) {
      if (lines[j].trim() === '') break
      snippetLines.push(lines[j])
    }
    if (snippetLines.length === 0) continue

    const indent = Math.min(...snippetLines.map((l) => l.length - l.trimStart().length))
    const snippet = snippetLines.map((l) => l.slice(indent)).join('\n')

    // the snippet starts on the line right after the tag, so that's the line GitHub should jump to
    usages.push({ slug, file, line: i + 2, explanation, snippet })
  }

  return usages
}

function isScannable(name: string): boolean {
  return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)
}

function walk(dir: string, out: string[]): void {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else if (isScannable(entry.name)) out.push(full)
  }
}

function collectFiles(root: string): string[] {
  const files: string[] = []
  for (const dir of SCAN_DIRS) walk(join(root, dir), files)
  for (const file of SCAN_FILES) files.push(join(root, file))
  return files
}

function toRepoRelative(root: string, absolute: string): string {
  return relative(root, absolute).split(sep).join('/')
}

function scan(root: string): PatternUsage[] {
  const usages: PatternUsage[] = []
  for (const absolute of collectFiles(root)) {
    let source: string
    try {
      source = readFileSync(absolute, 'utf8')
    } catch {
      continue
    }
    usages.push(...extractUsages(toRepoRelative(root, absolute), source))
  }
  return usages
}

function isScanned(root: string, absolute: string): boolean {
  const rel = toRepoRelative(root, absolute)
  return SCAN_DIRS.some((dir) => rel === dir || rel.startsWith(`${dir}/`)) || SCAN_FILES.includes(rel)
}

/**
 * Vite plugin providing the virtual module `virtual:pattern-usages`: `{ slug, file, line,
 * explanation, snippet }[]`, collected at build/dev-start by scanning `SCAN_DIRS`/`SCAN_FILES`
 * for `@pattern` tags. Only the extracted data is emitted — never the full file contents — so
 * the bundle doesn't ship source that was never meant to be read in the browser.
 *
 * This plugin is itself the Plugin pattern: the host (Vite) only knows the `resolveId`/`load`
 * contract, and this module registers against it without Vite changing.
 */
export function patternUsagesPlugin(root: string = process.cwd()): Plugin {
  return {
    name: 'pattern-usages',
    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_ID
    },
    load(id) {
      if (id !== RESOLVED_ID) return
      return `export const patternUsages = ${JSON.stringify(scan(root))}\n`
    },
    configureServer(server) {
      // scanned files aren't imported by any module graph, so they wouldn't otherwise be watched
      for (const absolute of collectFiles(root)) server.watcher.add(absolute)
    },
    handleHotUpdate({ file, server }) {
      if (!isScanned(root, file)) return
      const mod = server.moduleGraph.getModuleById(RESOLVED_ID)
      if (!mod) return
      server.moduleGraph.invalidateModule(mod)
      return [mod]
    },
  }
}
