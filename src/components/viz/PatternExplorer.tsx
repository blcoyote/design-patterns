import { useState } from 'react'
import { CodeBlock, type CodeSource } from '@/components/content/CodeBlock'
import { useCodeLanguage, type CodeLanguage } from '@/hooks/useCodeLanguage'
import { useStepPlayer } from '@/hooks/useStepPlayer'
import { parseCode } from '@/lib/codeRegions'
import { categories } from '@/patterns/categories'
import type { PatternDefinition } from '@/types/pattern'
import { findSelection } from '@/lib/selection'
import { DetailPanel } from './DetailPanel'
import { GenericVisualization } from './GenericVisualization'
import { StepPlayer } from './StepPlayer'

/**
 * Interactive area: animated visualisation, step player, detail panel and linked code.
 * Render with `key={pattern.slug}` so state resets between patterns.
 */
export function PatternExplorer({ pattern }: { pattern: PatternDefinition }) {
  const color = categories[pattern.category].color
  const player = useStepPlayer(pattern.steps.length)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const step = pattern.steps[player.index] ?? null
  const selection = findSelection(pattern, selectedId)
  const ts = parseCode(pattern.code)
  const cs = pattern.csharp ? parseCode(pattern.csharp) : null

  const [preferredLang, setPreferredLang] = useCodeLanguage()
  const availableLangs: CodeLanguage[] = cs ? ['typescript', 'csharp'] : ['typescript']
  // fall back to TypeScript without touching the stored preference when C# isn't available here
  const activeLang = availableLangs.includes(preferredLang) ? preferredLang : 'typescript'
  const activeRegions = activeLang === 'csharp' && cs ? cs.regions : ts.regions

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

  const sources: CodeSource[] = [{ lang: 'typescript', text: ts.text, highlight: region ? ts.regions[region] : undefined }]
  if (cs) sources.push({ lang: 'csharp', text: cs.text, highlight: region ? cs.regions[region] : undefined })

  const Visualization = pattern.Visualization ?? GenericVisualization

  return (
    <section aria-label="Interactive visualisation" className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="space-y-5 rounded-2xl bg-slate-900/40 p-4 ring-1 ring-slate-800 sm:p-6">
        <div className="overflow-hidden rounded-xl bg-slate-950 ring-1 ring-slate-800">
          <Visualization
            pattern={pattern}
            step={step}
            stepIndex={player.index}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </div>
        <StepPlayer steps={pattern.steps} player={player} color={color} />
      </div>

      <div className="space-y-4">
        <DetailPanel pattern={pattern} selection={selection} color={color} onSelect={setSelectedId} />
        <CodeBlock sources={sources} active={activeLang} onActiveChange={setPreferredLang} color={color} />
      </div>
    </section>
  )
}
