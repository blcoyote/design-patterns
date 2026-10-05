import { motion, useReducedMotion } from "motion/react";
import { useMemo, useState } from "react";
import { Diagram } from "@/components/viz/Diagram";
import { boxOf, edgeBetween } from "@/lib/geometry";
import type { Packet, Step, VisualizationProps } from "@/types/pattern";
import { alpha } from "@/theme/alpha";

/**
 * State keeps the generic diagram's ring-ish layout (Document in the middle,
 * the four concrete states arranged around it) but adds a glowing connector
 * that springs from Document to whichever state object is current, exactly
 * tracking the step player. A "Try it" row of the four workflow events lets
 * the visitor fire transitions themselves, independent of the step player —
 * including events that are invalid from the current state, which the state
 * machine simply (and visibly) ignores.
 */

type StateId = "draft" | "review" | "published" | "rejected";
type EventId = "submit" | "approve" | "reject" | "revise";

const STATE_IDS: StateId[] = ["draft", "review", "published", "rejected"];
const EVENT_IDS: EventId[] = ["submit", "approve", "reject", "revise"];

const STATE_NAMES: Record<StateId, string> = {
  draft: "Draft",
  review: "InReview",
  published: "Published",
  rejected: "Rejected",
};

const EVENT_LABELS: Record<EventId, string> = {
  submit: "submit()",
  approve: "approve()",
  reject: "reject()",
  revise: "revise()",
};

/** The only legal hand-offs in the workflow: state -> event -> next state. */
const TRANSITIONS: Record<StateId, Partial<Record<EventId, StateId>>> = {
  draft: { submit: "review" },
  review: { approve: "published", reject: "rejected" },
  published: {},
  rejected: { revise: "draft" },
};

interface SyntheticStep {
  highlight: string[];
  packets: Packet[];
  notes: Record<string, string>;
}

/** Which state a step's highlight set is "about" — the one the connector should point at. */
function stateFromStep(step: Step | SyntheticStep | null): StateId {
  if (step) {
    for (const id of STATE_IDS) {
      if (step.highlight.includes(id)) return id;
    }
  }
  return "draft";
}

/** Builds the highlight/packets/notes for firing `event` while `active` is current. */
function fireEvent(active: StateId, event: EventId): { data: SyntheticStep; nextId: StateId } {
  const target = TRANSITIONS[active][event];
  if (target) {
    const transitionId = `${active}-to-${target}`;
    return {
      nextId: target,
      data: {
        highlight: [`handle-${active}`, transitionId, target],
        packets: [
          { relation: `handle-${active}`, label: EVENT_LABELS[event] },
          {
            relation: transitionId,
            label: `⇒ ${STATE_NAMES[target]}`,
            after: 0,
          },
        ],
        notes: { document: `state: ${STATE_NAMES[target]}` },
      },
    };
  }
  // Invalid from here: Document still forwards the call, but the state object just absorbs it.
  return {
    nextId: active,
    data: {
      highlight: ["client-call", `handle-${active}`, active],
      packets: [
        { relation: "client-call", label: EVENT_LABELS[event] },
        { relation: `handle-${active}`, label: EVENT_LABELS[event], after: 0 },
      ],
      notes: { [active]: "ignored" },
    },
  };
}

export function StateVisualization({
  pattern,
  color,
  step,
  stepIndex,
  selectedId,
  onSelect,
  speed,
}: VisualizationProps) {
  const reduceMotion = !!useReducedMotion();
  // Tag the override with the step it was fired on, so it derives back to "no
  // override" as soon as the step player moves on — no effect/sync needed.
  const [override, setOverride] = useState<{
    forStep: number;
    activeId: StateId;
    data: SyntheticStep;
  } | null>(null);
  const [replayToken, setReplayToken] = useState(0);
  const liveOverride = override?.forStep === stepIndex ? override : null;

  const byId = useMemo(
    () => new Map(pattern.participants.map((p) => [p.id, p])),
    [pattern.participants],
  );
  const relById = useMemo(
    () => new Map(pattern.relations.map((r) => [r.id, r])),
    [pattern.relations],
  );

  const baseActiveId = stateFromStep(step);
  const effectiveStep: Step | SyntheticStep | null = liveOverride ? liveOverride.data : step;
  const activeId = liveOverride ? liveOverride.activeId : baseActiveId;
  const animationKey = liveOverride
    ? `override-${liveOverride.activeId}-${replayToken}`
    : stepIndex;

  const docParticipant = byId.get("document");
  const activeParticipant = byId.get(activeId);
  const connector =
    docParticipant && activeParticipant
      ? edgeBetween(
          boxOf(docParticipant),
          boxOf(activeParticipant),
          relById.get(`handle-${activeId}`)?.bend ?? 0,
        )
      : null;

  const springTransition = reduceMotion
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 220, damping: 24 };

  function fire(event: EventId) {
    const currentId = liveOverride ? liveOverride.activeId : baseActiveId;
    const { data, nextId } = fireEvent(currentId, event);
    setOverride({ forStep: stepIndex, activeId: nextId, data });
    setReplayToken((t) => t + 1);
    onSelect(nextId);
  }

  const overlay = docParticipant && activeParticipant && connector && (
    <motion.g pointerEvents="none">
      <motion.path
        d={connector.d}
        fill="none"
        stroke={color}
        strokeWidth={5}
        strokeLinecap="round"
        opacity={0.85}
        filter="url(#glow)"
        initial={false}
        animate={{ d: connector.d }}
        transition={springTransition}
      />
      <motion.circle
        r={5}
        fill="var(--color-diagram-packet)"
        initial={false}
        animate={{ cx: connector.start.x, cy: connector.start.y }}
        transition={springTransition}
      />
      <motion.circle
        r={5}
        fill={color}
        initial={false}
        animate={{ cx: connector.end.x, cy: connector.end.y }}
        transition={springTransition}
      />
    </motion.g>
  );

  return (
    <div>
      <Diagram
        participants={pattern.participants}
        relations={pattern.relations}
        color={color}
        viewBox={pattern.viewBox}
        highlight={effectiveStep?.highlight}
        packets={effectiveStep?.packets}
        packetSpeed={speed}
        notes={effectiveStep?.notes}
        selectedId={selectedId}
        onSelect={onSelect}
        animationKey={animationKey}
        overlay={overlay}
        ariaLabel={`${pattern.name} diagram`}
      />
      <div className="flex flex-wrap items-center gap-2 border-t border-line p-3">
        <span className="mr-1 text-xs font-mono uppercase tracking-wider text-fg-subtle">
          Try it
        </span>
        {EVENT_IDS.map((event) => {
          const currentId = liveOverride ? liveOverride.activeId : baseActiveId;
          const isValid = !!TRANSITIONS[currentId][event];
          return (
            <button
              key={event}
              type="button"
              aria-label={`Call ${EVENT_LABELS[event]} on the document`}
              title={
                isValid
                  ? `${STATE_NAMES[currentId]} handles this`
                  : `${STATE_NAMES[currentId]} ignores this`
              }
              onClick={(e) => {
                e.stopPropagation();
                fire(event);
              }}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold ring-1 transition focus-visible:outline-2 focus-visible:outline-focus ${
                isValid
                  ? "text-fg-strong ring-line-strong hover:bg-surface-raised"
                  : "text-fg-subtle ring-line ring-dashed hover:bg-surface"
              }`}
              style={isValid ? { boxShadow: `inset 0 0 0 1px ${alpha(color, 33)}` } : undefined}
            >
              {EVENT_LABELS[event]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
