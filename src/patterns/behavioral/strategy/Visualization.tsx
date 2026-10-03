import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useMemo, useState } from "react";
import { Diagram } from "@/components/viz/Diagram";
import { boxOf } from "@/lib/geometry";
import { edgeBetween } from "@/lib/geometry";
import type { Step, VisualizationProps } from "@/types/pattern";

/**
 * Strategy stays a Navigator/strategies diagram, but the "plug-in" nature is made
 * tangible: a glowing connector reroutes (with a spring) to whichever strategy is
 * currently active, the context pops out a result, and a row of toggle buttons lets
 * the visitor swap strategies themselves, independent of the step player.
 */

type StrategyId = "fastest" | "shortest" | "scenic";
const STRATEGY_IDS: StrategyId[] = ["fastest", "shortest", "scenic"];
const LABELS: Record<StrategyId, string> = {
  fastest: "FastestRoute",
  shortest: "ShortestRoute",
  scenic: "ScenicRoute",
};
const RESULTS: Record<StrategyId, string> = {
  fastest: "12 min",
  shortest: "18 min",
  scenic: "35 min",
};

/** Which strategy a step's highlight set is "about". */
function strategyFromStep(step: Step | null): StrategyId {
  if (step) {
    for (const id of STRATEGY_IDS) {
      if (step.highlight.includes(id) || step.highlight.includes(`calc-${id}`)) return id;
    }
  }
  return "fastest";
}

function syntheticStep(id: StrategyId): Step {
  return {
    title: `Try ${LABELS[id]}`,
    description: `The navigator is handed ${LABELS[id]} directly and delegates route() to it.`,
    highlight: ["client-call", `calc-${id}`, "holds", id],
    packets: [
      { relation: "client-call", label: "route()" },
      { relation: `calc-${id}`, label: "calculate()", after: 0 },
    ],
    notes: { navigator: `strategy: ${id}`, [id]: RESULTS[id] },
  };
}

export function StrategyVisualization({
  pattern,
  color,
  step,
  stepIndex,
  selectedId,
  onSelect,
  speed,
}: VisualizationProps) {
  const reduceMotion = !!useReducedMotion();
  // Tag the override with the step it was picked on, so it derives back to "no
  // override" as soon as the step player moves on — no effect/sync needed.
  const [pickedOverride, setPickedOverride] = useState<{
    forStep: number;
    id: StrategyId;
  } | null>(null);
  const [replayToken, setReplayToken] = useState(0);
  const override = pickedOverride?.forStep === stepIndex ? pickedOverride.id : null;

  const byId = useMemo(
    () => new Map(pattern.participants.map((p) => [p.id, p])),
    [pattern.participants],
  );
  const relById = useMemo(
    () => new Map(pattern.relations.map((r) => [r.id, r])),
    [pattern.relations],
  );

  const effectiveStep = override ? syntheticStep(override) : step;
  const activeId = override ?? strategyFromStep(step);
  const result = effectiveStep?.notes?.[activeId];
  const animationKey = override ? `override-${override}-${replayToken}` : stepIndex;

  const navigator = byId.get("navigator");
  const activeParticipant = byId.get(activeId);
  const connector =
    navigator && activeParticipant
      ? edgeBetween(
          boxOf(navigator),
          boxOf(activeParticipant),
          relById.get(`calc-${activeId}`)?.bend ?? 0,
        )
      : null;

  const springTransition = reduceMotion
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 220, damping: 24 };

  function pick(id: StrategyId) {
    setPickedOverride({ forStep: stepIndex, id });
    setReplayToken((t) => t + 1);
    onSelect(id);
  }

  const overlay = navigator && activeParticipant && connector && (
    <>
      <motion.path
        d={connector.d}
        fill="none"
        stroke={color}
        strokeWidth={5}
        strokeLinecap="round"
        opacity={0.85}
        filter="url(#glow)"
        pointerEvents="none"
        initial={false}
        animate={{ d: connector.d }}
        transition={springTransition}
      />
      <motion.circle
        r={5}
        fill="#ffffff"
        pointerEvents="none"
        initial={false}
        animate={{ cx: connector.start.x, cy: connector.start.y }}
        transition={springTransition}
      />
      <motion.circle
        r={5}
        fill={color}
        pointerEvents="none"
        initial={false}
        animate={{ cx: connector.end.x, cy: connector.end.y }}
        transition={springTransition}
      />

      <g transform={`translate(${boxOf(navigator).x} ${boxOf(navigator).y})`} pointerEvents="none">
        <AnimatePresence>
          {result && (
            <motion.g
              key={`${activeId}-${result}-${replayToken}`}
              initial={reduceMotion ? false : { opacity: 0, y: 8, scale: 0.6 }}
              animate={{ opacity: 1, y: -58, scale: 1 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
              transition={
                reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 320, damping: 22 }
              }
            >
              <rect x={-44} y={-14} width={88} height={28} rx={14} fill={color} />
              <text
                y={5}
                textAnchor="middle"
                className="fill-slate-950 text-[13px] font-bold font-mono select-none"
              >
                {result}
              </text>
            </motion.g>
          )}
        </AnimatePresence>
      </g>
    </>
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
      <div className="flex flex-wrap items-center gap-2 border-t border-slate-800 p-3">
        <span className="mr-1 text-xs font-mono uppercase tracking-wider text-slate-500">
          Try it
        </span>
        {STRATEGY_IDS.map((id) => {
          const isActive = activeId === id;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={isActive}
              aria-label={`Plug in ${LABELS[id]}`}
              onClick={(e) => {
                e.stopPropagation();
                pick(id);
              }}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold ring-1 transition focus-visible:outline-2 focus-visible:outline-white ${
                isActive
                  ? "text-slate-950 ring-transparent"
                  : "text-slate-300 ring-slate-700 hover:bg-slate-800 hover:text-white"
              }`}
              style={isActive ? { backgroundColor: color } : undefined}
            >
              {LABELS[id]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
