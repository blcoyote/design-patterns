import { useState } from 'react'
import { CodeBlock, type CodeSource } from '@/components/content/CodeBlock'
import { useCodeLanguage, type CodeLanguage } from '@/hooks/useCodeLanguage'
import { useStepPlayer } from '@/hooks/useStepPlayer'
import { resolvePattern } from '@/lib/crossRefs'
import { parseCode, type ParsedCode } from '@/lib/codeRegions'
import type { ExplorableDefinition } from '@/types/pattern'
import { findSelection } from '@/lib/selection'
import { DetailPanel } from './DetailPanel'
import { GenericVisualization } from './GenericVisualization'
import { StepPlayer } from './StepPlayer'

/**
 * Interactive area: animated visualisation, step player, detail panel and linked code.
 * Shared by design-pattern and architecture pages — `color` is the category or paradigm
 * accent colour. Render with `key={pattern.slug}` so state resets between patterns.
 */
export function PatternExplorer({ pattern, color }: { pattern: ExplorableDefinition; color: string }) {
  const player = useStepPlayer(pattern.steps.length)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const step = pattern.steps[player.index] ?? null
  const selection = findSelection(pattern, selectedId)
  const parsed: { lang: CodeLanguage; code: ParsedCode }[] = [{ lang: 'typescript', code: parseCode(pattern.code) }]
  if (pattern.csharp) parsed.push({ lang: 'csharp', code: parseCode(pattern.csharp) })
  if (pattern.python) parsed.push({ lang: 'python', code: parseCode(pattern.python) })

  const [preferredLang, setPreferredLang] = useCodeLanguage()
  // fall back to TypeScript without touching the stored preference when the preferred language isn't available here
  const active = parsed.find((p) => p.lang === preferredLang) ?? parsed[0]
  const activeLang = active.lang
  const activeRegions = active.code.regions

  const regionOf = (id: string) => {
    const p = pattern.participants.find((x) => x.id === id)
    return p?.code ?? (activeRegions[id] ? id : undefined)
  }
  // arrows without their own region fall back to the class they start from
  const selectedRegion =
    selection?.kind === 'participant'
      ? regionOf(selection.item.id)
      : selection && (selection.item.code ?? regionOf(selection.item.from))
  const region = selection ? selectedRegion : step?.code

  const sources: CodeSource[] = parsed.map(({ lang, code }) => ({
    lang,
    text: code.text,
    highlight: region ? code.regions[region] : undefined,
  }))

  const Visualization = pattern.Visualization ?? GenericVisualization

  return (
    <section aria-label="Interactive visualisation" className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="space-y-5 rounded-2xl bg-slate-900/40 p-4 ring-1 ring-slate-800 sm:p-6">
        <div className="overflow-hidden rounded-xl bg-slate-950 ring-1 ring-slate-800">
          <Visualization
            pattern={pattern}
            color={color}
            step={step}
            stepIndex={player.index}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </div>
        <StepPlayer steps={pattern.steps} player={player} color={color} />
      </div>

      <div className="space-y-4">
        <DetailPanel pattern={pattern} selection={selection} color={color} onSelect={setSelectedId} resolvePattern={resolvePattern} />
        <CodeBlock sources={sources} active={activeLang} onActiveChange={setPreferredLang} color={color} />
      </div>
    </section>
  )
}
