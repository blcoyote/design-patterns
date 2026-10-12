import { motion, useReducedMotion } from "motion/react";
import { useMemo } from "react";
import { DEFAULT_VIEWBOX } from "@/components/viz/Diagram";
import { DiagramEdge, EdgeMarkers } from "@/components/viz/DiagramEdge";
import { useDiagramEdit } from "@/components/viz/DiagramEditContext";
import { DiagramEditLayer } from "@/components/viz/DiagramEditLayer";
import { DiagramNode } from "@/components/viz/DiagramNode";
import { onActivate } from "@/lib/a11y";
import { PacketLayer } from "@/components/viz/PacketLayer";
import { boxExit, boxOf, edgeBetween } from "@/lib/geometry";
import type { Box, EdgeGeometry, Point } from "@/lib/geometry";
import type { Participant, Relation, VisualizationProps } from "@/types/pattern";
import { alpha } from "@/theme/alpha";

/**
 * The decorator stack drawn as literal, concentric rounded rectangles:
 * SugarDecorator ⊃ MilkDecorator ⊃ SimpleCoffee. A small UML strip on the
 * right shows the Coffee interface and the abstract CoffeeDecorator base.
 */

// --- Layout ----------------------------------------------------------------
// Every box sits at its participant's x/y from index.ts. The three layers share one
// centre and have fixed sizes; the layout editor moves them as one stack.

/** How far right of a layer's centre the vertical "delegation" line threads through its top. */
const LINK_OFFSET = 50;

const LAYER_SIZE = {
  sugarDecorator: { width: 344, height: 258 },
  milkDecorator: { width: 236, height: 172 },
  simpleCoffee: { width: 130, height: 84 },
} satisfies Record<string, Pick<Box, "width" | "height">>;

/** The layers, outer to inner; the layout editor moves them together. */
const STACK_GROUPS = [Object.keys(LAYER_SIZE)];

const layerBox = (p: Participant, size: Pick<Box, "width" | "height">): Box => ({
  x: p.x,
  y: p.y,
  ...size,
});

/** Where the delegation line meets the top edge of a layer. */
const linkTop = (b: Box): Point => ({ x: b.x + LINK_OFFSET, y: b.y - b.height / 2 });

/**
 * `control` stays the true midpoint so the path renders as a straight line; `mid`
 * (used only for label placement, by `DiagramEdge` and `Packet`'s reduced-motion
 * fallback) can be nudged sideways so short labels don't sit on top of the
 * layer's own title text.
 */
function straightLink(p0: Point, p1: Point, labelOffsetX = 0): EdgeGeometry {
  const control = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
  const mid = { x: control.x + labelOffsetX, y: control.y };
  return {
    start: p0,
    control,
    end: p1,
    d: `M ${p0.x} ${p0.y} Q ${control.x} ${control.y} ${p1.x} ${p1.y}`,
    mid,
  };
}

interface SceneBoxes {
  client: Box;
  coffee: Box;
  coffeeDecorator: Box;
  sugar: Box;
  milk: Box;
  core: Box;
}

function buildGeometry(b: SceneBoxes, relations: Relation[]): Record<string, EdgeGeometry> {
  const bendOf = (id: string) => relations.find((r) => r.id === id)?.bend ?? 0;
  const sugarTop = linkTop(b.sugar);
  const milkTop = linkTop(b.milk);
  const coreTop = linkTop(b.core);
  const callEntry: Point = { x: sugarTop.x, y: sugarTop.y - 6 };
  return {
    call: straightLink(boxExit(b.client, callEntry), callEntry),
    wrapsMilk: straightLink(sugarTop, milkTop, 48),
    wrapsCoffee: straightLink(milkTop, coreTop, 48),
    sugarExtends: edgeBetween(b.sugar, b.coffeeDecorator, bendOf("sugarExtends")),
    milkExtends: edgeBetween(b.milk, b.coffeeDecorator, bendOf("milkExtends")),
    decoratorImpl: edgeBetween(b.coffeeDecorator, b.coffee, bendOf("decoratorImpl")),
    simpleImpl: edgeBetween(b.core, b.coffee, bendOf("simpleImpl")),
    wrappee: edgeBetween(b.coffeeDecorator, b.coffee, bendOf("wrappee")),
  };
}

const LEGEND_RELATIONS = [
  "sugarExtends",
  "milkExtends",
  "decoratorImpl",
  "simpleImpl",
  "wrappee",
] as const;
const LIVE_RELATIONS = ["wrapsMilk", "wrapsCoffee", "call"] as const;

interface LayerProps {
  participant: Participant;
  box: Box;
  color: string;
  active: boolean;
  dimmed: boolean;
  selected: boolean;
  note?: string;
  delay: number;
  reduceMotion: boolean;
  /** In the layout editor: no entrance, and the layer follows a drag without easing. */
  instant: boolean;
  onSelect: (id: string) => void;
}

/** One concentric, clickable rounded-rect layer of the wrapping stack. */
function Layer({
  participant: p,
  box,
  color,
  active,
  dimmed,
  selected,
  note,
  delay,
  reduceMotion,
  instant,
  onSelect,
}: LayerProps) {
  const w = box.width;
  const h = box.height;
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
      initial={reduceMotion || instant ? false : { opacity: 0, scale: 0.7, x: box.x, y: box.y }}
      animate={{ opacity: dimmed ? 0.35 : 1, scale: 1, x: box.x, y: box.y }}
      transition={
        instant
          ? { duration: 0 }
          : reduceMotion
            ? { duration: 0.3 }
            : { type: "spring", stiffness: 260, damping: 22, delay }
      }
    >
      {active && (
        <motion.rect
          x={-w / 2 - 6}
          y={-h / 2 - 6}
          width={w + 12}
          height={h + 12}
          rx={22}
          fill="none"
          stroke={color}
          strokeWidth={2}
          initial={false}
          animate={
            reduceMotion ? { opacity: 0.7 } : { opacity: [0.7, 0, 0.7], scale: [1, 1.02, 1] }
          }
          transition={
            reduceMotion ? { duration: 0 } : { duration: 1.8, repeat: Infinity, ease: "easeInOut" }
          }
          style={{ filter: "var(--diagram-glow)" }}
        />
      )}
      <rect
        className="frame transition-colors duration-300"
        x={-w / 2}
        y={-h / 2}
        width={w}
        height={h}
        rx={22}
        fill={active ? alpha(color, 12) : "var(--color-diagram-node)"}
        stroke={
          selected ? "var(--color-selected)" : active ? color : "var(--color-diagram-node-stroke)"
        }
        strokeWidth={selected ? 2.5 : 1.5}
      />
      <text
        y={-h / 2 + 22}
        textAnchor="middle"
        className="text-[13px] font-semibold select-none"
        fill={active || selected ? "var(--color-diagram-text-active)" : "var(--color-diagram-text)"}
      >
        {p.label}
      </text>
      <text y={-h / 2 + 38} textAnchor="middle" className="fill-fg-muted text-[11px] select-none">
        {p.role}
      </text>
      {note && (
        <g transform={`translate(0 ${h / 2 - 16})`}>
          <rect
            x={-(note.length * 3.6 + 10)}
            y={-10}
            width={note.length * 7.2 + 20}
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
        </g>
      )}
    </motion.g>
  );
}

export function DecoratorVisualization({
  pattern,
  color,
  step,
  stepIndex,
  speed,
  selectedId,
  onSelect,
}: VisualizationProps) {
  const reduceMotion = !!useReducedMotion();
  const edit = useDiagramEdit();
  const byId = useMemo(
    () => new Map(pattern.participants.map((p) => [p.id, p])),
    [pattern.participants],
  );
  const relById = useMemo(
    () => new Map(pattern.relations.map((r) => [r.id, r])),
    [pattern.relations],
  );

  const highlight = step?.highlight ?? [];
  const active = new Set(highlight);
  const dimming = active.size > 0;
  const notes = step?.notes ?? {};
  const packets = step?.packets ?? [];

  const client = byId.get("client");
  const coffee = byId.get("coffee");
  const coffeeDecorator = byId.get("coffeeDecorator");
  const simpleCoffee = byId.get("simpleCoffee");
  const milkDecorator = byId.get("milkDecorator");
  const sugarDecorator = byId.get("sugarDecorator");

  const boxes = useMemo<SceneBoxes | null>(
    () =>
      client && coffee && coffeeDecorator && sugarDecorator && milkDecorator && simpleCoffee
        ? {
            client: boxOf(client),
            coffee: boxOf(coffee),
            coffeeDecorator: boxOf(coffeeDecorator),
            sugar: layerBox(sugarDecorator, LAYER_SIZE.sugarDecorator),
            milk: layerBox(milkDecorator, LAYER_SIZE.milkDecorator),
            core: layerBox(simpleCoffee, LAYER_SIZE.simpleCoffee),
          }
        : null,
    [client, coffee, coffeeDecorator, sugarDecorator, milkDecorator, simpleCoffee],
  );
  const geometry = useMemo(
    () => boxes && buildGeometry(boxes, pattern.relations),
    [boxes, pattern.relations],
  );

  if (
    !boxes ||
    !geometry ||
    !client ||
    !coffee ||
    !coffeeDecorator ||
    !simpleCoffee ||
    !milkDecorator ||
    !sugarDecorator
  )
    return null;

  // Painted outer-to-inner (sugar at the back, core on top) so the nesting reads correctly;
  // delayed inner-to-outer (core appears first) so the "build" narrative still makes sense.
  const layers: { participant: Participant; box: Box; delay: number }[] = [
    { participant: sugarDecorator, box: boxes.sugar, delay: 0.24 },
    { participant: milkDecorator, box: boxes.milk, delay: 0.12 },
    { participant: simpleCoffee, box: boxes.core, delay: 0 },
  ];

  const stateFor = (id: string) => ({
    active: active.has(id),
    dimmed: dimming && !active.has(id) && selectedId !== id,
    selected: selectedId === id,
  });

  return (
    <svg
      viewBox={pattern.viewBox ?? DEFAULT_VIEWBOX}
      className="h-auto w-full select-none"
      role="group"
      aria-label={`${pattern.name} diagram`}
      onClick={() => (edit ? edit.onSelect(null) : onSelect(null))}
    >
      <defs>
        <EdgeMarkers color={color} />
        <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="1" fill="var(--color-diagram-grid)" />
        </pattern>
      </defs>
      <rect x="-1000" y="-1000" width="3000" height="3000" fill="url(#grid)" />

      {/* Reference UML strip — dimmed unless explicitly selected. */}
      {LEGEND_RELATIONS.map((id) => {
        const r = relById.get(id);
        if (!r) return null;
        const s = stateFor(id);
        return (
          <DiagramEdge
            key={id}
            relation={r}
            geometry={geometry[id]}
            color={color}
            {...s}
            onSelect={onSelect}
          />
        );
      })}

      <g key={`layers-${stepIndex}`}>
        {layers.map(({ participant, box, delay }) => {
          const s = stateFor(participant.id);
          return (
            <Layer
              key={participant.id}
              participant={participant}
              box={box}
              color={color}
              {...s}
              note={notes[participant.id]}
              delay={delay}
              reduceMotion={reduceMotion}
              instant={edit !== null}
              onSelect={onSelect}
            />
          );
        })}
      </g>

      {/* The live cost() delegation path, drawn above the layers so it's always visible. */}
      {LIVE_RELATIONS.map((id) => {
        const r = relById.get(id);
        if (!r) return null;
        const s = stateFor(id);
        return (
          <DiagramEdge
            key={id}
            relation={r}
            geometry={geometry[id]}
            color={color}
            {...s}
            onSelect={onSelect}
          />
        );
      })}

      {[client, coffee, coffeeDecorator].map((p) => (
        <DiagramNode
          key={p.id}
          participant={p}
          color={color}
          {...stateFor(p.id)}
          instant={edit !== null}
          onSelect={onSelect}
        />
      ))}

      <PacketLayer
        packets={packets}
        geometry={geometry}
        color={color}
        speed={speed}
        animationKey={stepIndex}
      />
      <DiagramEditLayer
        participants={[
          client,
          coffee,
          coffeeDecorator,
          sugarDecorator,
          milkDecorator,
          simpleCoffee,
        ]}
        relations={LEGEND_RELATIONS.flatMap((id) => relById.get(id) ?? [])}
        geometry={geometry}
        viewBox={pattern.viewBox}
        fixedSizes={LAYER_SIZE}
        moveTogether={STACK_GROUPS}
      />
    </svg>
  );
}
