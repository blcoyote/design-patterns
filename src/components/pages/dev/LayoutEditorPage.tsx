import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { paradigms } from "@/architectures/paradigms";
import { getArchitecture } from "@/architectures/registry";
import {
  DiagramEditContext,
  type DiagramEditContextValue,
} from "@/components/viz/DiagramEditContext";
import { GenericVisualization } from "@/components/viz/GenericVisualization";
import { applyLayout, emptyLayout, type LayoutOverrides } from "@/lib/layoutEdit";
import { categories } from "@/patterns/categories";
import { getPattern } from "@/patterns/registry";
import type { ExplorableDefinition } from "@/types/pattern";
import { NotFound } from "../NotFound";

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
  if (!subject) return <NotFound />;
  return (
    <LayoutScene key={`${area}:${slug}`} definition={subject.definition} color={subject.color} />
  );
}

/** Grid step boxes snap to while dragging; holding Alt turns it off. */
const SNAP = 10;

function LayoutScene({
  definition: original,
  color,
}: {
  definition: ExplorableDefinition;
  color: string;
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editedId, setEditedId] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<LayoutOverrides>(emptyLayout);
  const [diagrams, setDiagrams] = useState(0);
  const [settled, setSettled] = useState(false);
  const definition = useMemo(() => applyLayout(original, overrides), [original, overrides]);
  const step = definition.steps[stepIndex] ?? null;
  const last = definition.steps.length - 1;

  const Visualization = definition.Visualization ?? GenericVisualization;

  // Give the mounted <Diagram>s a tick to register before concluding the scene has none.
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(true), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const register = useCallback(() => {
    setDiagrams((n) => n + 1);
    return () => setDiagrams((n) => n - 1);
  }, []);
  const edit = useMemo<DiagramEditContextValue>(
    () => ({
      snap: SNAP,
      selectedId: editedId,
      onMoveParticipant: (id, x, y) =>
        setOverrides((o) => ({
          ...o,
          participants: { ...o.participants, [id]: { ...o.participants[id], x, y } },
        })),
      onSelect: setEditedId,
      register,
    }),
    [editedId, register],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline gap-3">
        <Link to="/dev/layout" className="text-sm text-fg-muted hover:text-fg">
          ← All diagrams
        </Link>
        <h1 className="text-2xl font-bold text-fg">{definition.name}</h1>
        <span className="font-mono text-xs text-fg-subtle">
          drag a box to move it (snaps to {SNAP}, hold Alt for free)
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
      </div>
    </div>
  );
}
