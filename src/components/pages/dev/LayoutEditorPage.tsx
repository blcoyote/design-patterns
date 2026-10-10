import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { paradigms } from "@/architectures/paradigms";
import { getArchitecture } from "@/architectures/registry";
import {
  DiagramEditContext,
  type DiagramEditContextValue,
} from "@/components/viz/DiagramEditContext";
import { GenericVisualization } from "@/components/viz/GenericVisualization";
import { useHistoryShortcuts, useLayoutHistory } from "@/hooks/useLayoutHistory";
import { describeChanges } from "@/lib/layoutChanges";
import { loadLayoutDraft, saveLayoutDraft } from "@/lib/layoutDraft";
import { applyLayout, diffLayout, emptyLayout, isEmpty } from "@/lib/layoutEdit";
import { lintLayout, warningTargets, type LayoutWarning } from "@/lib/layoutLint";
import { saveLayoutToSource } from "@/lib/layoutSave";
import { categories } from "@/patterns/categories";
import { getPattern } from "@/patterns/registry";
import type { ExplorableDefinition } from "@/types/pattern";
import { NotFound } from "../NotFound";
import { LayoutChangeList } from "./LayoutChangeList";
import { LayoutLintPanel } from "./LayoutLintPanel";
import { LayoutToolbar } from "./LayoutToolbar";

const buttonClass =
  "rounded-control px-3 py-2 text-sm text-fg-soft ring-1 ring-control-outline transition hover:bg-surface-raised hover:text-fg disabled:opacity-40 disabled:hover:bg-transparent";

function resolveSubject(area: string | undefined, slug: string | undefined) {
  if (area === "patterns") {
    const pattern = getPattern(slug);
    return pattern && { definition: pattern, color: categories[pattern.category].color };
  }
  if (area === "architecture") {
    const architecture = getArchitecture(slug);
    return (
      architecture && { definition: architecture, color: paradigms[architecture.paradigm].color }
    );
  }
  return undefined;
}

/** Dev-only: shows one pattern or architecture in its real scene with a manual step selector. */
export function LayoutEditorPage() {
  const { area, slug } = useParams();
  const subject = resolveSubject(area, slug);
  if (!subject || !area || !slug) return <NotFound />;
  return (
    <LayoutScene
      key={`${area}:${slug}`}
      area={area}
      slug={slug}
      definition={subject.definition}
      color={subject.color}
    />
  );
}

/** Grid step boxes start out snapping to; the toolbar can change it. */
const DEFAULT_SNAP = 10;

function LayoutScene({
  area,
  slug,
  definition: original,
  color,
}: {
  area: string;
  slug: string;
  definition: ExplorableDefinition;
  color: string;
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editedId, setEditedId] = useState<string | null>(null);
  const [snapStep, setSnapStep] = useState<number | null>(DEFAULT_SNAP);
  const [showPackets, setShowPackets] = useState(true);
  const history = useLayoutHistory(() => loadLayoutDraft(area, slug, original));
  const { overrides, update } = history;
  const [diagrams, setDiagrams] = useState(0);
  const [settled, setSettled] = useState(false);
  // After a save the file on disk holds `saved.definition` before Vite hot-updates the registry;
  // until `original` is a new object that is the baseline, so the page never flashes the old layout.
  const [saved, setSaved] = useState<{
    for: ExplorableDefinition;
    definition: ExplorableDefinition;
  } | null>(null);
  const baseline = saved?.for === original ? saved.definition : original;
  const definition = useMemo(() => applyLayout(baseline, overrides), [baseline, overrides]);
  const diff = useMemo(() => diffLayout(baseline, definition), [baseline, definition]);
  const changes = useMemo(() => describeChanges(baseline, diff), [baseline, diff]);
  const hasChanges = !isEmpty(diff);
  const warnings = useMemo(() => lintLayout(definition), [definition]);
  const warningIds = useMemo(() => warningTargets(warnings), [warnings]);
  const liveStep = definition.steps[stepIndex] ?? null;
  const step = useMemo(
    () => (showPackets || !liveStep ? liveStep : { ...liveStep, packets: [] }),
    [showPackets, liveStep],
  );
  const last = definition.steps.length - 1;

  const Visualization = definition.Visualization ?? GenericVisualization;

  useHistoryShortcuts(history.undo, history.redo);

  const saveToSource = async () => {
    const result = await saveLayoutToSource(area, slug, diff);
    if (result.ok) {
      // drop the stored draft now: a reload racing the effect below must not re-apply it
      saveLayoutDraft(area, slug, emptyLayout());
      setSaved({ for: original, definition });
      history.markSaved(overrides);
    }
    return result;
  };

  // Keep the draft in localStorage (removed again when nothing differs from the source).
  useEffect(() => saveLayoutDraft(area, slug, diff), [area, slug, diff]);

  // Give the mounted <Diagram>s a tick to register before concluding the scene has none.
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(true), 0);
    return () => window.clearTimeout(timer);
  }, []);

  /** A box is selected for editing; a warning about edges only selects the first relation instead. */
  const selectWarning = (w: LayoutWarning) => {
    if (w.participantIds.length > 0) setEditedId(w.participantIds[0]);
    else if (w.relationIds.length > 0) setSelectedId(w.relationIds[0]);
  };

  const register = useCallback(() => {
    setDiagrams((n) => n + 1);
    return () => setDiagrams((n) => n - 1);
  }, []);
  const edit = useMemo<DiagramEditContextValue>(
    () => ({
      snap: snapStep,
      selectedId: editedId,
      onMoveParticipant: (id, x, y) =>
        update((o) => ({
          ...o,
          participants: { ...o.participants, [id]: { ...o.participants[id], x, y } },
        })),
      onResizeParticipant: (id, width) =>
        update((o) => ({
          ...o,
          participants: { ...o.participants, [id]: { ...o.participants[id], width } },
        })),
      onBendRelation: (id, bend) =>
        update((o) => ({
          ...o,
          relations: { ...o.relations, [id]: { ...o.relations[id], bend } },
        })),
      onGestureStart: history.gestureStart,
      onGestureEnd: history.gestureEnd,
      onSelect: setEditedId,
      warnings: warningIds,
      register,
    }),
    [snapStep, editedId, warningIds, update, history.gestureStart, history.gestureEnd, register],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline gap-3">
        <Link to="/dev/layout" className="text-sm text-fg-muted hover:text-fg">
          ← All diagrams
        </Link>
        <h1 className="text-2xl font-bold text-fg">{definition.name}</h1>
        <span className="font-mono text-xs text-fg-subtle">
          drag to edit (hold Alt to bypass snapping), Ctrl/Cmd+Z to undo
        </span>
      </div>

      {settled && diagrams === 0 && (
        <p
          role="status"
          className="rounded-control bg-surface px-3 py-2 text-sm text-warn-fg ring-1 ring-control-outline"
        >
          This scene does not render a shared Diagram, so its boxes cannot be dragged here.
        </p>
      )}

      <div className="space-y-4 rounded-panel bg-card p-3 shadow-card ring-1 ring-card-outline sm:p-6">
        <LayoutToolbar
          snap={snapStep}
          onSnapChange={setSnapStep}
          canUndo={history.canUndo}
          canRedo={history.canRedo}
          onUndo={history.undo}
          onRedo={history.redo}
          hasChanges={hasChanges}
          onReset={history.reset}
          showPackets={showPackets}
          onShowPacketsChange={setShowPackets}
          json={JSON.stringify(diff, null, 2)}
          onSave={saveToSource}
        />

        <div className="overflow-x-auto overflow-y-hidden rounded-card bg-diagram-canvas ring-1 ring-diagram-canvas-outline">
          <div className="min-w-160">
            <DiagramEditContext value={edit}>
              <Visualization
                pattern={definition}
                color={color}
                step={step}
                stepIndex={stepIndex}
                speed={1}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            </DiagramEditContext>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={buttonClass}
            disabled={stepIndex <= 0}
            onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
          >
            Previous
          </button>
          <select
            aria-label="Step"
            value={stepIndex}
            onChange={(e) => setStepIndex(Number(e.target.value))}
            className="min-w-0 flex-1 rounded-control bg-surface px-3 py-2 text-sm text-fg ring-1 ring-control-outline"
          >
            {definition.steps.map((s, i) => (
              <option key={s.title} value={i}>
                {i + 1}. {s.title}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={buttonClass}
            disabled={stepIndex >= last}
            onClick={() => setStepIndex((i) => Math.min(last, i + 1))}
          >
            Next
          </button>
        </div>

        <LayoutLintPanel warnings={warnings} onSelect={selectWarning} />

        <LayoutChangeList
          changes={changes}
          onRevert={({ kind, id }) => history.revert({ kind, id })}
        />
      </div>
    </div>
  );
}
