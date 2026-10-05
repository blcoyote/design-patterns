import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useMemo, useState } from "react";
import { Diagram } from "@/components/viz/Diagram";
import { onActivate } from "@/lib/a11y";
import { boxOf, edgeBetween } from "@/lib/geometry";
import type { Step, VisualizationProps } from "@/types/pattern";
import { alpha } from "@/theme/alpha";

/**
 * Null Object keeps the generic Logger/ReportGenerator/NullLogger/ConsoleLogger
 * diagram up top — with a glowing connector that springs to whichever logger is
 * currently wired in, exactly like Strategy/State — and adds a custom "call path"
 * panel below it: one generate() call traced from Client to its logger. In
 * "before" mode two calls pass through a null-check diamond safely, but a third
 * call has no guard at all and detonates into a TypeError the moment the logger
 * really is null. In "after" mode the same three calls run straight through —
 * no diamonds anywhere, because the logger is always a real object. A
 * Before/After toggle lets the visitor flip between the two independently of
 * the step player, resetting back to the narrative's own mode whenever the
 * step changes.
 */

type Mode = "before" | "after";
type LoggerId = "nullLogger" | "consoleLogger";

/** Which half of the narrative a given step belongs to. */
function modeFromStep(stepIndex: number): Mode {
  return stepIndex < 4 ? "before" : "after";
}

/** Which concrete logger is wired up by a given (after-mode) step. */
function loggerFromStep(stepIndex: number): LoggerId {
  return stepIndex >= 7 ? "consoleLogger" : "nullLogger";
}

const BEFORE_STEP: Step = {
  title: "Before (try it)",
  description:
    "logger is null. The two guarded calls safely no-op, but the forgotten guard on warn() throws the moment the report has warnings.",
  highlight: ["client", "client-create", "reportGenerator"],
  packets: [{ relation: "client-create", label: "new ReportGenerator(null)" }],
  notes: { reportGenerator: "💥 TypeError" },
};

function afterStep(loggerId: LoggerId): Step {
  const callRelation = loggerId === "nullLogger" ? "call-null" : "call-console";
  const label = loggerId === "nullLogger" ? "NullLogger" : "ConsoleLogger";
  return {
    title: "After (try it)",
    description: `${label} stands in for null. Every call in generate() runs unconditionally — the logger quietly handles whatever it gets.`,
    highlight: ["client", "client-call", "reportGenerator", callRelation, loggerId, "holds"],
    packets: [
      { relation: "client-call", label: "generate()" },
      { relation: callRelation, label: "logger.warn()", after: 0 },
    ],
    notes:
      loggerId === "nullLogger"
        ? { reportGenerator: "logger: NullLogger", nullLogger: "no-op" }
        : {
            reportGenerator: "logger: ConsoleLogger",
            consoleLogger: "printed",
          },
  };
}

interface PathNode {
  id: string;
  kind: "client" | "box" | "diamond" | "crash" | "end";
  label: string;
  sub?: string;
  tone: "neutral" | "warn" | "danger" | "success";
  selectId: string;
}

function beforeNodes(): PathNode[] {
  return [
    {
      id: "n0",
      kind: "client",
      label: "Client",
      sub: "logger: null",
      tone: "neutral",
      selectId: "client",
    },
    {
      id: "n1",
      kind: "diamond",
      label: "logger?",
      sub: "info()",
      tone: "neutral",
      selectId: "reportGenerator",
    },
    {
      id: "n2",
      kind: "diamond",
      label: "logger?",
      sub: "info()",
      tone: "neutral",
      selectId: "reportGenerator",
    },
    {
      id: "n3",
      kind: "box",
      label: "warn()",
      sub: "no guard!",
      tone: "warn",
      selectId: "reportGenerator",
    },
    {
      id: "n4",
      kind: "crash",
      label: "TypeError",
      sub: "reading 'warn'",
      tone: "danger",
      selectId: "reportGenerator",
    },
  ];
}

function afterNodes(loggerId: LoggerId): PathNode[] {
  const label = loggerId === "nullLogger" ? "NullLogger" : "ConsoleLogger";
  const sub = loggerId === "nullLogger" ? "no-op" : "printed";
  return [
    {
      id: "n0",
      kind: "client",
      label: "Client",
      sub: `logger: ${label}`,
      tone: "neutral",
      selectId: "client",
    },
    {
      id: "n1",
      kind: "box",
      label: "info()",
      tone: "neutral",
      selectId: "reportGenerator",
    },
    {
      id: "n2",
      kind: "box",
      label: "info()",
      tone: "neutral",
      selectId: "reportGenerator",
    },
    {
      id: "n3",
      kind: "box",
      label: "warn()",
      tone: "neutral",
      selectId: "reportGenerator",
    },
    { id: "n4", kind: "end", label, sub, tone: "success", selectId: loggerId },
  ];
}

const WIDTH_BY_KIND: Record<PathNode["kind"], number> = {
  client: 128,
  box: 104,
  diamond: 112,
  crash: 120,
  end: 132,
};
const CENTER_Y = 86;
const XS = [76, 234, 380, 526, 682];

const TONE_STROKE: Record<PathNode["tone"], string> = {
  neutral: "var(--color-diagram-node-stroke)",
  warn: "var(--color-warn-strong)",
  danger: "var(--color-danger)",
  success: "var(--color-ok)",
};

function PathShape({
  node,
  color,
  selected,
  dim,
}: {
  node: PathNode;
  color: string;
  selected: boolean;
  dim: boolean;
}) {
  const stroke = selected
    ? "var(--color-selected)"
    : node.tone === "neutral"
      ? color
      : TONE_STROKE[node.tone];
  const w = WIDTH_BY_KIND[node.kind];

  if (node.kind === "diamond") {
    const h = 62;
    const points = `0,${-h / 2} ${w / 2},0 0,${h / 2} ${-w / 2},0`;
    return (
      <>
        <polygon
          points={points}
          fill="var(--color-diagram-node)"
          stroke={stroke}
          strokeWidth={selected ? 2.5 : 1.5}
          opacity={dim ? 0.4 : 1}
        />
        <text
          y={-4}
          textAnchor="middle"
          className="fill-fg-strong text-[11px] font-mono font-semibold select-none"
        >
          {node.label}
        </text>
        <text
          y={11}
          textAnchor="middle"
          className="fill-fg-muted text-[10px] font-mono select-none"
        >
          {node.sub}
        </text>
      </>
    );
  }

  if (node.kind === "crash") {
    const spikes = 10;
    const outer = 58;
    const inner = 34;
    const pts = Array.from({ length: spikes * 2 }, (_, i) => {
      const r = i % 2 === 0 ? outer : inner;
      const a = (Math.PI * i) / spikes - Math.PI / 2;
      return `${(r * Math.cos(a)).toFixed(1)},${(r * Math.sin(a)).toFixed(1)}`;
    }).join(" ");
    return (
      <>
        <polygon
          points={pts}
          fill="var(--color-danger-surface)"
          stroke={selected ? "var(--color-selected)" : "var(--color-danger)"}
          strokeWidth={selected ? 2.5 : 1.5}
          opacity={dim ? 0.4 : 1}
        />
        <text
          y={-4}
          textAnchor="middle"
          className="fill-danger-fg-soft text-[11px] font-bold font-mono select-none"
        >
          {node.label}
        </text>
        <text
          y={11}
          textAnchor="middle"
          className="fill-danger-fg/80 text-[9px] font-mono select-none"
        >
          {node.sub}
        </text>
      </>
    );
  }

  const h = 56;
  return (
    <>
      <rect
        x={-w / 2}
        y={-h / 2}
        width={w}
        height={h}
        rx={10}
        fill={node.kind === "end" ? alpha(color, 10) : "var(--color-diagram-node)"}
        stroke={stroke}
        strokeWidth={selected ? 2.5 : node.kind === "end" ? 2 : 1.5}
        opacity={dim ? 0.4 : 1}
      />
      <text
        y={node.sub ? -3 : 4}
        textAnchor="middle"
        className="fill-fg-strong text-[12px] font-semibold font-mono select-none"
      >
        {node.label}
      </text>
      {node.sub && (
        <text
          y={13}
          textAnchor="middle"
          className="fill-fg-muted text-[10px] font-mono select-none"
        >
          {node.sub}
        </text>
      )}
    </>
  );
}

export function NullObjectVisualization({
  pattern,
  color,
  step,
  stepIndex,
  selectedId,
  onSelect,
  speed,
}: VisualizationProps) {
  const reduceMotion = !!useReducedMotion();
  // Tag the override with the step it was picked on, so it falls back to the
  // narrative's own mode as soon as the step player moves on — no effect/sync needed.
  const [pickedOverride, setPickedOverride] = useState<{
    forStep: number;
    mode: Mode;
  } | null>(null);
  const [replayToken, setReplayToken] = useState(0);
  const override = pickedOverride?.forStep === stepIndex ? pickedOverride.mode : null;

  const byId = useMemo(
    () => new Map(pattern.participants.map((p) => [p.id, p])),
    [pattern.participants],
  );
  const relById = useMemo(
    () => new Map(pattern.relations.map((r) => [r.id, r])),
    [pattern.relations],
  );

  const narrativeMode = modeFromStep(stepIndex);
  const narrativeLogger = loggerFromStep(stepIndex);
  const mode = override ?? narrativeMode;
  const loggerId: LoggerId = override === "before" ? "nullLogger" : narrativeLogger;

  const effectiveStep: Step | null = override
    ? override === "before"
      ? BEFORE_STEP
      : afterStep(loggerId)
    : step;
  const animationKey = override ? `override-${override}-${replayToken}` : stepIndex;

  // The connector only has somewhere to point once a real logger is wired in —
  // in "before" mode the field is null, so nothing lights up.
  const showConnector = mode === "after" && (override !== null || stepIndex >= 5);
  const reportGenerator = byId.get("reportGenerator");
  const activeLogger = byId.get(loggerId);
  const connector =
    showConnector && reportGenerator && activeLogger
      ? edgeBetween(
          boxOf(reportGenerator),
          boxOf(activeLogger),
          relById.get(`call-${loggerId === "nullLogger" ? "null" : "console"}`)?.bend ?? 0,
        )
      : null;

  const springTransition = reduceMotion
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 220, damping: 24 };

  function pick(next: Mode) {
    setPickedOverride({ forStep: stepIndex, mode: next });
    setReplayToken((t) => t + 1);
    onSelect(next === "before" ? "reportGenerator" : loggerFromStep(stepIndex));
  }

  const overlay = reportGenerator && activeLogger && connector && (
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

  const nodes = mode === "before" ? beforeNodes() : afterNodes(loggerId);

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

      <div className="border-t border-line p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-xs font-mono uppercase tracking-wider text-fg-subtle">
            Call path —{" "}
            {mode === "before"
              ? "logger: null"
              : `logger: ${loggerId === "nullLogger" ? "NullLogger" : "ConsoleLogger"}`}
          </span>
        </div>
        <svg
          viewBox="0 0 760 170"
          className="h-auto w-full select-none rounded-lg bg-canvas/40 ring-1 ring-line"
        >
          <defs>
            <marker
              id="nullobj-arrow"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-fg-subtle)" />
            </marker>
          </defs>
          {XS.slice(0, -1).map((x, i) => {
            const nextX = XS[i + 1];
            const startX = x + WIDTH_BY_KIND[nodes[i].kind] / 2 + 6;
            const endX = nextX - WIDTH_BY_KIND[nodes[i + 1].kind] / 2 - 10;
            return (
              <line
                key={`edge-${i}`}
                x1={startX}
                y1={CENTER_Y}
                x2={endX}
                y2={CENTER_Y}
                stroke="var(--color-fg-subtle)"
                strokeWidth={1.5}
                markerEnd="url(#nullobj-arrow)"
              />
            );
          })}

          {mode === "before" &&
            [1, 2].map((i) => (
              <g key={`skip-${i}`}>
                <path
                  d={`M ${XS[i]} ${CENTER_Y + 30} L ${XS[i]} ${CENTER_Y + 50}`}
                  stroke="var(--color-diagram-edge)"
                  strokeWidth={1.5}
                  strokeDasharray="3 3"
                  markerEnd="url(#nullobj-arrow)"
                />
                <text
                  x={XS[i]}
                  y={CENTER_Y + 64}
                  textAnchor="middle"
                  className="fill-fg-subtle text-[9px] font-mono select-none"
                >
                  null → skip
                </text>
              </g>
            ))}

          <AnimatePresence mode="popLayout">
            {nodes.map((node, i) => {
              const dim = selectedId !== null && selectedId !== node.selectId;
              return (
                <motion.g
                  key={`${mode}-${node.id}-${replayToken}`}
                  role="button"
                  tabIndex={0}
                  aria-label={`${node.label}${node.sub ? ` — ${node.sub}` : ""}`}
                  aria-pressed={selectedId === node.selectId}
                  className="cursor-pointer outline-none"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(node.selectId);
                  }}
                  onKeyDown={onActivate(() => onSelect(node.selectId))}
                  initial={reduceMotion ? false : { opacity: 0, scale: 0.7, x: XS[i], y: CENTER_Y }}
                  animate={{ opacity: 1, scale: 1, x: XS[i], y: CENTER_Y }}
                  exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.7 }}
                  transition={
                    reduceMotion
                      ? { duration: 0.15 }
                      : {
                          type: "spring",
                          stiffness: 300,
                          damping: 24,
                          delay: i * 0.04,
                        }
                  }
                >
                  <PathShape
                    node={node}
                    color={color}
                    selected={selectedId === node.selectId}
                    dim={dim}
                  />
                </motion.g>
              );
            })}
          </AnimatePresence>
        </svg>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="mr-1 text-xs font-mono uppercase tracking-wider text-fg-subtle">
            Try it
          </span>
          {(["before", "after"] as const).map((m) => {
            const isActive = mode === m;
            return (
              <button
                key={m}
                type="button"
                aria-pressed={isActive}
                aria-label={
                  m === "before" ? "Show the null-check version" : "Show the Null Object version"
                }
                onClick={(e) => {
                  e.stopPropagation();
                  pick(m);
                }}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold capitalize ring-1 transition focus-visible:outline-2 focus-visible:outline-focus ${
                  isActive
                    ? "text-fg-on-accent ring-transparent"
                    : "text-fg-soft ring-line-strong hover:bg-surface-raised hover:text-fg"
                }`}
                style={
                  isActive
                    ? { backgroundColor: m === "before" ? "var(--color-danger)" : color }
                    : undefined
                }
              >
                {m}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
