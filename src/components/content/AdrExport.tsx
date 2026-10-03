import { useEffect, useMemo, useRef, useState } from 'react'
import { adrFilename, buildAdr, NO_PATTERN, type AdrSubject } from '@/lib/adr'
import type { ComparisonDefinition } from '@/types/comparison'

function today(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/**
 * Exports the comparison, plus a chosen option, as a MADR-style architecture decision record —
 * so a team that worked through the comparison can drop the outcome straight into their own
 * project's `docs/decisions/`. Preselects the subject the scenario quiz picked, when that pick
 * maps onto one of the subjects (a "no pattern" or purely illustrative quiz choice does not).
 */
export function AdrExport({
  comparison,
  subjects,
  preselected,
}: {
  comparison: ComparisonDefinition
  subjects: AdrSubject[]
  /** A subject slug to preselect, typically the scenario quiz's pick when it names a subject. */
  preselected?: string
}) {
  const [chosen, setChosen] = useState(preselected ?? subjects[0]?.slug ?? NO_PATTERN)
  const [copied, setCopied] = useState(false)
  const [open, setOpen] = useState(false)

  // The quiz pick (if any) only arrives after this component has already mounted with a default
  // selection — apply it the first time it shows up, but never fight a choice the reader then
  // makes by hand.
  const appliedPreselect = useRef(false)
  useEffect(() => {
    if (preselected && !appliedPreselect.current) {
      appliedPreselect.current = true
      setChosen(preselected)
    }
  }, [preselected])

  const adr = useMemo(() => {
    const sourceUrl = `${location.origin}${location.pathname}#/compare/${comparison.slug}`
    return buildAdr({ comparison, chosen, subjects, date: today(), sourceUrl })
  }, [comparison, chosen, subjects])

  const filename = adrFilename(chosen, subjects)

  const copy = async () => {
    await navigator.clipboard.writeText(adr)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  const download = () => {
    const blob = new Blob([adr], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="rounded-2xl bg-slate-900/40 p-6 ring-1 ring-slate-800">
      <h2 className="text-xs font-semibold tracking-wider text-slate-400 uppercase">Export as an ADR</h2>
      <p className="mt-3 leading-relaxed text-slate-300">
        Turn this comparison into an architecture decision record (MADR format, with YAML frontmatter) for your own
        project's <code className="text-slate-400">docs/decisions/</code>.
      </p>

      <fieldset className="mt-4">
        <legend className="text-xs font-medium tracking-wider text-slate-500 uppercase">Chosen option</legend>
        <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Chosen option">
          {subjects.map((s) => (
            <label
              key={s.slug}
              className={`flex cursor-pointer items-center gap-2 rounded-lg px-3 py-1.5 text-sm ring-1 transition ${
                chosen === s.slug ? 'bg-slate-800 text-white ring-slate-600' : 'text-slate-400 ring-slate-800 hover:text-white'
              }`}
            >
              <input
                type="radio"
                name="adr-chosen"
                value={s.slug}
                checked={chosen === s.slug}
                onChange={() => setChosen(s.slug)}
                className="sr-only"
              />
              {s.name}
            </label>
          ))}
          <label
            className={`flex cursor-pointer items-center gap-2 rounded-lg px-3 py-1.5 text-sm ring-1 transition ${
              chosen === NO_PATTERN ? 'bg-slate-800 text-white ring-slate-600' : 'text-slate-400 ring-slate-800 hover:text-white'
            }`}
          >
            <input
              type="radio"
              name="adr-chosen"
              value={NO_PATTERN}
              checked={chosen === NO_PATTERN}
              onChange={() => setChosen(NO_PATTERN)}
              className="sr-only"
            />
            No pattern
          </label>
        </div>
      </fieldset>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-200 ring-1 ring-slate-700 hover:bg-slate-900"
        >
          {open ? 'Hide preview' : 'Show preview'}
        </button>
        <button
          type="button"
          onClick={copy}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-200 ring-1 ring-slate-700 hover:bg-slate-900"
        >
          {copied ? 'Copied ✓' : 'Copy'}
        </button>
        <button
          type="button"
          onClick={download}
          className="rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-950 hover:bg-slate-200"
        >
          Download {filename}
        </button>
      </div>

      {open && (
        <pre className="mt-4 max-h-[32rem] overflow-auto rounded-xl bg-[#011627] p-4 text-xs leading-relaxed whitespace-pre-wrap text-slate-300 ring-1 ring-slate-800">
          {adr}
        </pre>
      )}
    </section>
  )
}
