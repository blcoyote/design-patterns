import { motion, useReducedMotion } from "motion/react";
import { useMemo, useState, type ReactElement } from "react";
import { DEFAULT_VIEWBOX } from "@/components/viz/Diagram";
import { DiagramEdge, EdgeMarkers } from "@/components/viz/DiagramEdge";
import { PacketLayer } from "@/components/viz/PacketLayer";
import { onActivate } from "@/lib/a11y";
import { boxOf, edgeBetween, NODE_HEIGHT, NODE_WIDTH, type EdgeGeometry } from "@/lib/geometry";
import type { Packet as PacketDef, Participant, Step, VisualizationProps } from "@/types/pattern";
import { alpha } from "@/theme/alpha";

/**
 * Visitor is drawn as the Shape/ShapeVisitor diagram, but every element gets a
 * literal shape glyph (a circle for Circle, a little rectangle for Rectangle, a
 * dashed cluster for the composite Group) so the "elements" read as shapes, not
 * just UML boxes. The two hops of double dispatch — accept(visitor) into the
 * element, then visitX(this) back out to the visitor — are two separate
 * packets travelling two separate edges, so the bounce is visible rather than
 * implied. A "Try it" row lets the visitor swap AreaCalculator for
 * JsonExporter, replays the whole tour, and appends the result to a small
 * output log — demonstrating a new operation arriving without a single edit
 * to Circle, Rectangle or Group.
 */

type VisitorId = "area" | "json";

const CONCRETE_VISITOR: Record<VisitorId, string> = {
  area: "areaCalculator",
  json: "jsonExporter",
};
const VISITOR_BEND: Record<VisitorId, number> = { area: 0, json: -60 };
const AREA_RESULT = "40.27";
const JSON_RESULT =
  '{"type":"group","children":[{"type":"circle","r":3},{"type":"rectangle","w":4,"h":3}]}';

interface SyntheticStep {
  highlight: string[];
  packets: PacketDef[];
  notes: Record<string, string>;
}

/** The full double-dispatch tour: Group visits Circle, then Rectangle, then itself — under whichever visitor is active. */
function tourStep(which: VisitorId): SyntheticStep {
  const concreteId = CONCRETE_VISITOR[which];
  return {
    highlight: [
      "group",
      "enterCircle",
      "circle",
      "dispatchCircle",
      "enterRectangle",
      "rectangle",
      "dispatchRectangle",
      "groupDispatch",
      "visitor",
      concreteId,
    ],
    packets: [
      { relation: "enterCircle", label: "accept(v)" },
      { relation: "dispatchCircle", label: "visitCircle(this)", after: 0 },
      { relation: "enterRectangle", label: "accept(v)", after: 1 },
      {
        relation: "dispatchRectangle",
        label: "visitRectangle(this)",
        after: 2,
      },
      { relation: "groupDispatch", label: "visitGroup(this)", after: 3 },
    ],
    notes: {
      circle: "visited",
      rectangle: "visited",
      [concreteId]: which === "area" ? `total ${AREA_RESULT}` : "exported",
    },
  };
}

function CircleGlyph({ color }: { color: string }) {
  return <circle r={9} fill="none" stroke={color} strokeWidth={2} />;
}

function RectGlyph({ color }: { color: string }) {
  return (
    <rect x={-9} y={-6} width={18} height={12} rx={2} fill="none" stroke={color} strokeWidth={2} />
  );
}

function GroupGlyph({ color }: { color: string }) {
  return (
    <>
      <rect
        x={-12}
        y={-8}
        width={24}
        height={16}
        rx={3}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeDasharray="3 2"
      />
      <circle cx={-5} cy={0} r={3} fill={color} />
      <rect x={1} y={-3} width={6} height={6} fill={color} />
    </>
  );
}

function SigmaGlyph({ color }: { color: string }) {
  return (
    <text y={5} textAnchor="middle" fontSize={16} fontWeight="bold" fill={color}>
      Σ
    </text>
  );
}

function JsonGlyph({ color }: { color: string }) {
  return (
    <text
      y={4}
      textAnchor="middle"
      fontSize={13}
      fontWeight="bold"
      fontFamily="monospace"
      fill={color}
    >
      {"{ }"}
    </text>
  );
}

const ICON: Record<string, (props: { color: string }) => ReactElement> = {
  circle: CircleGlyph,
  rectangle: RectGlyph,
  group: GroupGlyph,
  areaCalculator: SigmaGlyph,
  jsonExporter: JsonGlyph,
};

interface ShapeNodeProps {
  participant: Participant;
  color: string;
  active: boolean;
  dimmed: boolean;
  selected: boolean;
  note?: string;
  reduceMotion: boolean;
  onSelect: (id: string) => void;
}

/** A clickable UML-ish box with an optional shape glyph tucked in the bottom-left corner. */
function ShapeNode({
  participant: p,
  color,
  active,
  dimmed,
  selected,
  note,
  reduceMotion,
  onSelect,
}: ShapeNodeProps) {
  const w = p.width ?? NODE_WIDTH;
  const h = NODE_HEIGHT;
  const isInterface = p.kind === "interface";
  const Icon = ICON[p.id];
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
      initial={false}
      animate={{ opacity: dimmed ? 0.35 : 1, x: p.x, y: p.y }}
      transition={reduceMotion ? { duration: 0 } : { duration: 0.4 }}
      whileHover={reduceMotion ? undefined : { scale: 1.04 }}
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
        strokeDasharray={isInterface ? "6 4" : undefined}
      />
      {isInterface && (
        <text
          y={-h / 2 + 15}
          textAnchor="middle"
          className="fill-fg-muted text-[10px] font-mono select-none"
        >
          «interface»
        </text>
      )}
      {Icon && (
        <g transform={`translate(${-w / 2 + 20} ${h / 2 - 17})`}>
          <Icon color={active || selected ? color : "var(--color-fg-subtle)"} />
        </g>
      )}
      <text
        y={isInterface ? 6 : -2}
        textAnchor="middle"
        className={`text-[13px] font-semibold select-none ${isInterface ? "italic" : ""}`}
        fill={active || selected ? "var(--color-diagram-text-active)" : "var(--color-diagram-text)"}
      >
        {p.label}
      </text>
      <text
        y={isInterface ? 22 : 16}
        textAnchor="middle"
        className="fill-fg-muted text-[10px] select-none"
      >
        {p.role}
      </text>

      {note && (
        <motion.g
          key={note}
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: h / 2 + 8, scale: 0.6 }}
          animate={{ opacity: 1, y: h / 2 + 18, scale: 1 }}
          transition={
            reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 400, damping: 22 }
          }
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
    </motion.g>
  );
}

export function VisitorVisualization({
  pattern,
  color,
  step,
  stepIndex,
  speed,
  selectedId,
  onSelect,
}: VisualizationProps) {
  const reduceMotion = !!useReducedMotion();

  const [activeVisitor, setActiveVisitor] = useState<VisitorId>("area");
  const [log, setLog] = useState<{ visitor: VisitorId; result: string }[]>([]);
  // Tag the override with the step it was fired on, so it derives back to "no
  // override" as soon as the step player moves on — no effect/sync needed.
  const [override, setOverride] = useState<{
    forStep: number;
    data: SyntheticStep;
  } | null>(null);
  const [replayToken, setReplayToken] = useState(0);
  const liveOverride = override?.forStep === stepIndex ? override.data : null;

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

  const effectiveStep: Step | SyntheticStep | null = liveOverride ?? step;
  const animationKey = liveOverride ? `override-${activeVisitor}-${replayToken}` : stepIndex;

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

  function run(which: VisitorId) {
    setActiveVisitor(which);
    setOverride({ forStep: stepIndex, data: tourStep(which) });
    setReplayToken((t) => t + 1);
    const result = which === "area" ? AREA_RESULT : JSON_RESULT;
    setLog((l) => [...l, { visitor: which, result }]);
    onSelect(CONCRETE_VISITOR[which]);
  }

  // A permanent connector showing which concrete visitor the ShapeVisitor
  // interface currently resolves to — independent of the step player.
  const visitorNode = byId.get("visitor");
  const concreteNode = byId.get(CONCRETE_VISITOR[activeVisitor]);
  const connector =
    visitorNode && concreteNode
      ? edgeBetween(boxOf(visitorNode), boxOf(concreteNode), VISITOR_BEND[activeVisitor])
      : null;
  const springTransition = reduceMotion
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 220, damping: 24 };

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
          <ShapeNode
            key={p.id}
            participant={p}
            color={color}
            {...stateFor(p.id)}
            note={notes[p.id]}
            reduceMotion={reduceMotion}
            onSelect={onSelect}
          />
        ))}

        {connector && (
          <motion.g pointerEvents="none">
            <motion.path
              d={connector.d}
              fill="none"
              stroke={color}
              strokeWidth={4}
              strokeLinecap="round"
              strokeDasharray="1 7"
              opacity={0.8}
              filter="url(#glow)"
              initial={false}
              animate={{ d: connector.d }}
              transition={springTransition}
            />
            <motion.circle
              r={4}
              fill={color}
              initial={false}
              animate={{ cx: connector.end.x, cy: connector.end.y }}
              transition={springTransition}
            />
          </motion.g>
        )}

        <PacketLayer
          packets={packets}
          geometry={geometry}
          color={color}
          speed={speed}
          animationKey={animationKey}
          stagger={0.25}
        />
      </svg>

      <div className="flex flex-wrap items-center gap-2 border-t border-line p-3">
        <span className="mr-1 text-xs font-mono uppercase tracking-wider text-fg-subtle">
          Try it
        </span>
        <button
          type="button"
          aria-pressed={activeVisitor === "area"}
          onClick={(e) => {
            e.stopPropagation();
            run("area");
          }}
          className={`rounded-lg px-3 py-1.5 text-sm font-semibold ring-1 transition focus-visible:outline-2 focus-visible:outline-focus ${
            activeVisitor === "area"
              ? "text-fg-on-accent ring-transparent"
              : "text-fg-soft ring-line-strong hover:bg-surface-raised hover:text-fg"
          }`}
          style={activeVisitor === "area" ? { backgroundColor: color } : undefined}
        >
          Run AreaCalculator
        </button>
        <button
          type="button"
          aria-pressed={activeVisitor === "json"}
          onClick={(e) => {
            e.stopPropagation();
            run("json");
          }}
          className={`rounded-lg px-3 py-1.5 text-sm font-semibold ring-1 transition focus-visible:outline-2 focus-visible:outline-focus ${
            activeVisitor === "json"
              ? "text-fg-on-accent ring-transparent"
              : "text-fg-soft ring-line-strong hover:bg-surface-raised hover:text-fg"
          }`}
          style={activeVisitor === "json" ? { backgroundColor: color } : undefined}
        >
          Run JsonExporter
        </button>
        {log.length > 0 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setLog([]);
            }}
            className="ml-auto rounded-lg px-2.5 py-1.5 text-xs font-semibold text-fg-subtle ring-1 ring-line transition hover:bg-surface hover:text-fg-soft"
          >
            Clear log
          </button>
        )}
      </div>

      <div className="border-t border-line p-3">
        <div className="mb-1.5 text-[11px] font-mono uppercase tracking-wider text-fg-subtle">
          Output (accumulates across runs)
        </div>
        <div className="max-h-28 space-y-1 overflow-y-auto rounded-lg bg-surface/60 p-2 font-mono text-xs text-fg-soft">
          {log.length === 0 ? (
            <div className="text-fg-faint">
              Run a visitor above to see the same Circle + Rectangle produce a different result.
            </div>
          ) : (
            log.map((entry, i) => (
              <div key={i} className="break-all">
                <span style={{ color }}>
                  {entry.visitor === "area" ? "AreaCalculator" : "JsonExporter"}
                </span>
                <span className="text-fg-subtle"> → </span>
                {entry.result}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
