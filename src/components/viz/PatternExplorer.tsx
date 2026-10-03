import { useCallback, useState } from "react";
import { CodeBlock } from "@/components/content/CodeBlock";
import { useCodeLanguage } from "@/hooks/useCodeLanguage";
import { useStepPlayer } from "@/hooks/useStepPlayer";
import { resolvePattern } from "@/lib/crossRefs";
import { buildCodeSources, parseLanguages } from "@/lib/codeLanguages";
import { stepDuration } from "@/lib/packetTiming";
import type { ExplorableDefinition } from "@/types/pattern";
import { findSelection } from "@/lib/selection";
import { DetailPanel } from "./DetailPanel";
import { GenericVisualization } from "./GenericVisualization";
import { StepPlayer } from "./StepPlayer";

/**
 * Interactive area: animated visualisation, step player, detail panel and linked code.
 * Shared by design-pattern and architecture pages — `color` is the category or paradigm
 * accent colour. Render with `key={pattern.slug}` so state resets between patterns.
 */
export function PatternExplorer({
  pattern,
  color,
  initialStep,
}: {
  pattern: ExplorableDefinition;
  color: string;
  /** Deep-link into a specific step (e.g. `?step=2`). Starts paused on that step. */
  initialStep?: number;
}) {
  const durationOf = useCallback(
    (index: number, speed: number) => stepDuration(pattern.steps[index], speed),
    [pattern.steps],
  );
  const player = useStepPlayer(pattern.steps.length, durationOf, initialStep);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const step = pattern.steps[player.index] ?? null;
  const selection = findSelection(pattern, selectedId);
  const parsed = parseLanguages(pattern);

  const [preferredLang, setPreferredLang] = useCodeLanguage();
  // fall back to TypeScript without touching the stored preference when the preferred language isn't available here
  const active = parsed.find((p) => p.lang === preferredLang) ?? parsed[0];
  const activeLang = active.lang;
  const activeRegions = active.code.regions;

  const regionOf = (id: string) => {
    const p = pattern.participants.find((x) => x.id === id);
    return p?.code ?? (activeRegions[id] ? id : undefined);
  };
  // arrows without their own region fall back to the class they start from
  const selectedRegion =
    selection?.kind === "participant"
      ? regionOf(selection.item.id)
      : selection && (selection.item.code ?? regionOf(selection.item.from));
  const region = selection ? selectedRegion : step?.code;

  const sources = buildCodeSources(parsed, region);

  // @pattern strategy: every scene implements VisualizationProps, and the explorer never knows which scene it is rendering
  const Visualization = pattern.Visualization ?? GenericVisualization;

  return (
    <section
      aria-label="Interactive visualisation"
      className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]"
    >
      <div className="space-y-5 rounded-2xl bg-slate-900/40 p-4 ring-1 ring-slate-800 sm:p-6">
        <div className="overflow-hidden rounded-xl bg-slate-950 ring-1 ring-slate-800">
          <Visualization
            pattern={pattern}
            color={color}
            step={step}
            stepIndex={player.index}
            speed={player.speed}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </div>
        <StepPlayer steps={pattern.steps} player={player} color={color} />
      </div>

      <div className="space-y-4">
        <DetailPanel
          pattern={pattern}
          selection={selection}
          color={color}
          onSelect={setSelectedId}
          resolvePattern={resolvePattern}
        />
        <CodeBlock
          sources={sources}
          active={activeLang}
          onActiveChange={setPreferredLang}
          color={color}
        />
      </div>
    </section>
  );
}
