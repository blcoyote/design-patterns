import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useMemo, useState } from "react";
import { DEFAULT_VIEWBOX } from "@/components/viz/Diagram";
import { DiagramEdge, EdgeMarkers } from "@/components/viz/DiagramEdge";
import { PacketLayer } from "@/components/viz/PacketLayer";
import { onActivate } from "@/lib/a11y";
import { boxOf, edgeBetween, NODE_HEIGHT, NODE_WIDTH } from "@/lib/geometry";
import type { EdgeGeometry } from "@/lib/geometry";
import type { Packet, Participant, Step, VisualizationProps } from "@/types/pattern";
import { alpha } from "@/theme/alpha";

/**
 * Interpreter drawn as a literal AST: Add at the root, branching into a
 * Variable leaf and a Multiply subtree, which itself branches into two
 * Number leaves, with Context sitting apart — consulted only by Variable.
 * The step data ripples interpret(context) calls down the holds-edges and
 * bubbles the computed values back up as reversed packets, exactly like
 * Composite's getSize() — plus a "Try it" row that swaps the value bound
 * to `x` in the context and re-evaluates the whole tree instantly.
 */

/** Operator glyph shown at the top of non-terminal (Add/Multiply) nodes. */
const OPERATOR: Record<string, string> = {
  add: "+",
  multiply: "×",
};

/** Terminal expressions — leaves with no children of their own. */
const TERMINAL_IDS = new Set(["variableX", "numberTwo", "numberThree"]);

const TRY_VALUES = [1, 5, 10];

/** A synthetic, step-shaped snapshot used to render a "Try it" re-evaluation. */
interface SyntheticStep {
  highlight: string[];
  packets: Packet[];
  notes: Record<string, string>;
}

/** Recomputes the whole tree for a given value of `x`, as an instant snapshot (no travel animation). */
function evaluate(x: number): SyntheticStep {
  const product = 2 * 3;
  const total = x + product;
  return {
    highlight: [
      "client",
      "context",
      "varLookup",
      "variableX",
      "add",
      "addLeft",
      "addRight",
      "multiply",
      "mulLeft",
      "numberTwo",
      "mulRight",
      "numberThree",
    ],
    packets: [],
    notes: {
      context: `x = ${x}`,
      variableX: `${x}`,
      numberTwo: "2",
      numberThree: "3",
      multiply: `${product}`,
      add: `${total}`,
      client: `result: ${total}`,
    },
  };
}

interface ExprNodeProps {
  participant: Participant;
  color: string;
  active: boolean;
  dimmed: boolean;
  selected: boolean;
  note?: string;
  reduceMotion: boolean;
  onSelect: (id: string) => void;
}

/** One clickable node in the AST: a UML-ish box tagged as an operator or a terminal leaf. */
function ExprNode({
  participant: p,
  color,
  active,
  dimmed,
  selected,
  note,
  reduceMotion,
  onSelect,
}: ExprNodeProps) {
  const w = p.width ?? NODE_WIDTH;
  const h = NODE_HEIGHT;
  const operator = OPERATOR[p.id];
  const isTerminal = TERMINAL_IDS.has(p.id);
  const isContext = p.id === "context";
  const hasTag = Boolean(operator) || isTerminal;
  const select = () => onSelect(p.id);

  return (
    <motion.g
      role="button"
      tabIndex={0}
      aria-label={`${p.label} — ${p.role}`}
      aria-pressed={selected}
      className="cursor-pointer outline-none [&:focus-visible>rect.frame]:stroke-focus"
      onClick={(e) => {
        e.stopPropagation();
        select();
      }}
      onKeyDown={onActivate(select)}
      initial={reduceMotion ? false : { opacity: 0, scale: 0.6, x: p.x, y: p.y }}
      animate={{ opacity: dimmed ? 0.35 : 1, scale: 1, x: p.x, y: p.y }}
      transition={
        reduceMotion ? { duration: 0.3 } : { type: "spring", stiffness: 260, damping: 22 }
      }
      whileHover={{ scale: 1.04 }}
    >
      {active && (
        <motion.rect
          x={-w / 2 - 6}
          y={-h / 2 - 6}
          width={w + 12}
          height={h + 12}
          rx={16}
          fill="none"
          stroke={color}
          strokeWidth={2}
          initial={false}
          animate={
            reduceMotion ? { opacity: 0.7 } : { opacity: [0.7, 0, 0.7], scale: [1, 1.05, 1] }
          }
          transition={
            reduceMotion ? { duration: 0 } : { duration: 1.8, repeat: Infinity, ease: "easeInOut" }
          }
          filter="url(#glow)"
        />
      )}
      <rect
        className="frame transition-colors duration-300"
        x={-w / 2}
        y={-h / 2}
        width={w}
        height={h}
        rx={12}
        fill={active ? alpha(color, 13) : "var(--color-diagram-node)"}
        stroke={
          selected ? "var(--color-selected)" : active ? color : "var(--color-diagram-node-stroke)"
        }
        strokeWidth={selected ? 2.5 : 1.5}
        strokeDasharray={isContext ? "6 4" : undefined}
      />
      {operator && (
        <text
          y={-h / 2 + 15}
          textAnchor="middle"
          className="fill-fg-muted text-[12px] font-mono select-none"
        >
          {operator}
        </text>
      )}
      {isTerminal && !operator && (
        <text
          y={-h / 2 + 14}
          textAnchor="middle"
          className="fill-fg-subtle text-[9px] uppercase tracking-wider select-none"
        >
          terminal
        </text>
      )}
      <text
        y={hasTag ? 6 : -2}
        textAnchor="middle"
        className="text-[13px] font-semibold select-none"
        fill={active || selected ? "var(--color-diagram-text-active)" : "var(--color-diagram-text)"}
      >
        {p.label}
      </text>
      <text
        y={hasTag ? 22 : 16}
        textAnchor="middle"
        className="fill-fg-muted text-[10px] select-none"
      >
        {p.role}
      </text>

      <AnimatePresence>
        {note && (
          <motion.g
            key={note}
            initial={{ opacity: 0, y: h / 2 + 8, scale: 0.6 }}
            animate={{ opacity: 1, y: h / 2 + 18, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ type: "spring", stiffness: 400, damping: 22 }}
          >
            <rect
              x={-(note.length * 3.6 + 12)}
              y={-10}
              width={note.length * 7.2 + 24}
              height={20}
              rx={10}
              fill={color}
            />
            <text
              y={4}
              textAnchor="middle"
              className="fill-fg-on-accent text-[11px] font-semibold font-mono select-none"
            >
              {note}
            </text>
          </motion.g>
        )}
      </AnimatePresence>
    </motion.g>
  );
}

export function InterpreterVisualization({
  pattern,
  color,
  step,
  stepIndex,
  speed,
  selectedId,
  onSelect,
}: VisualizationProps) {
  const reduceMotion = !!useReducedMotion();
  // Tag the override with the step it was fired on, so it derives back to "no
  // override" as soon as the step player moves on — no effect/sync needed.
  const [override, setOverride] = useState<{
    forStep: number;
    x: number;
  } | null>(null);

  const byId = useMemo(
    () => new Map(pattern.participants.map((p) => [p.id, p])),
    [pattern.participants],
  );

  const geometry = useMemo(() => {
    const g: Record<string, EdgeGeometry> = {};
    for (const r of pattern.relations) {
      const a = byId.get(r.from);
      const b = byId.get(r.to);
      if (a && b) g[r.id] = edgeBetween(boxOf(a), boxOf(b), r.bend);
    }
    return g;
  }, [pattern.relations, byId]);

  const liveOverride = override?.forStep === stepIndex ? override : null;
  const effectiveStep: Step | SyntheticStep | null = liveOverride ? evaluate(liveOverride.x) : step;
  const animationKey = liveOverride ? `try-${liveOverride.x}` : stepIndex;

  const highlight = effectiveStep?.highlight ?? [];
  const active = new Set(highlight);
  const dimming = active.size > 0;
  const notes = effectiveStep?.notes ?? {};
  const packets = effectiveStep?.packets ?? [];

  const stateFor = (id: string) => ({
    active: active.has(id),
    dimmed: dimming && !active.has(id) && selectedId !== id,
    selected: selectedId === id,
  });

  function tryValue(x: number) {
    setOverride({ forStep: stepIndex, x });
    onSelect("context");
  }

  return (
    <div>
      <svg
        viewBox={pattern.viewBox ?? DEFAULT_VIEWBOX}
        className="h-auto w-full select-none"
        role="group"
        aria-label={`${pattern.name} diagram`}
        onClick={() => onSelect(null)}
      >
        <defs>
          <EdgeMarkers color={color} />
          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" fill="var(--color-diagram-grid)" />
          </pattern>
        </defs>
        <rect x="-1000" y="-1000" width="3000" height="3000" fill="url(#grid)" />

        {pattern.relations.map((r) => {
          const g = geometry[r.id];
          if (!g) return null;
          return (
            <DiagramEdge
              key={r.id}
              relation={r}
              geometry={g}
              color={color}
              {...stateFor(r.id)}
              onSelect={onSelect}
            />
          );
        })}

        {pattern.participants.map((p) => (
          <ExprNode
            key={p.id}
            participant={p}
            color={color}
            {...stateFor(p.id)}
            note={notes[p.id]}
            reduceMotion={reduceMotion}
            onSelect={onSelect}
          />
        ))}

        <PacketLayer
          packets={packets}
          geometry={geometry}
          color={color}
          speed={speed}
          animationKey={animationKey}
        />
      </svg>

      <div className="flex flex-wrap items-center gap-2 border-t border-line p-3">
        <span className="mr-1 text-xs font-mono uppercase tracking-wider text-fg-subtle">
          Try it — x =
        </span>
        {TRY_VALUES.map((x) => (
          <button
            key={x}
            type="button"
            aria-label={`Re-evaluate the tree with x = ${x}`}
            title={`Set x = ${x} and re-interpret the whole tree`}
            onClick={(e) => {
              e.stopPropagation();
              tryValue(x);
            }}
            className="rounded-lg px-3 py-1.5 text-sm font-semibold text-fg-strong ring-1 ring-line-strong transition hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-focus"
            style={
              liveOverride?.x === x
                ? { boxShadow: `inset 0 0 0 1px ${alpha(color, 33)}` }
                : undefined
            }
          >
            {x}
          </button>
        ))}
      </div>
    </div>
  );
}
