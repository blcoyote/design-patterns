import { motion } from "motion/react";
import type { EdgeGeometry } from "@/lib/geometry";
import type { Relation, RelationType } from "@/types/pattern";
import { onActivate } from "@/lib/a11y";

const DASH: Record<RelationType, string | undefined> = {
  calls: undefined,
  wraps: undefined,
  holds: undefined,
  creates: "5 4",
  implements: "7 5",
  notifies: "2 5",
};

export type EdgeState = "idle" | "active" | "selected";

export interface DiagramEdgeProps {
  relation: Relation;
  geometry: EdgeGeometry;
  color: string;
  active: boolean;
  dimmed: boolean;
  selected: boolean;
  onSelect: (id: string) => void;
}

export function DiagramEdge({
  relation: r,
  geometry: g,
  color,
  active,
  dimmed,
  selected,
  onSelect,
}: DiagramEdgeProps) {
  const state: EdgeState = selected ? "selected" : active ? "active" : "idle";
  const stroke = selected ? "var(--color-selected)" : active ? color : "var(--color-diagram-edge)";
  const marker = r.type === "implements" ? "triangle" : "arrow";
  const label = r.label ?? (r.type === "creates" ? "«create»" : undefined);
  const select = () => onSelect(r.id);

  return (
    <motion.g
      role="button"
      tabIndex={0}
      aria-label={`${r.label ?? r.type} arrow`}
      aria-pressed={selected}
      className="cursor-pointer outline-none group"
      onClick={(e) => {
        e.stopPropagation();
        select();
      }}
      onKeyDown={onActivate(select)}
      initial={false}
      animate={{ opacity: dimmed ? 0.25 : 1 }}
      transition={{ duration: 0.4 }}
    >
      {/* wide invisible hit area */}
      <path d={g.d} fill="none" stroke="transparent" strokeWidth={16} />
      <path
        d={g.d}
        fill="none"
        stroke={stroke}
        strokeWidth={selected ? 2.5 : active ? 2.2 : 1.5}
        strokeDasharray={DASH[r.type]}
        markerEnd={`url(#${marker}-${state})`}
        markerStart={r.type === "holds" ? `url(#diamond-${state})` : undefined}
        className="transition-[stroke] duration-300 group-hover:stroke-fg-body group-focus-visible:stroke-focus"
      />
      {active && (
        <path
          d={g.d}
          fill="none"
          stroke={color}
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray="4 14"
          className="flow-dash"
          filter="url(#glow)"
          pointerEvents="none"
        />
      )}
      {label && (
        <g transform={`translate(${g.mid.x} ${g.mid.y})`}>
          <rect
            x={-(label.length * 3.4 + 7)}
            y={-9}
            width={label.length * 6.8 + 14}
            height={18}
            rx={5}
            fill="var(--color-diagram-label-bg)"
            stroke={active || selected ? stroke : "var(--color-diagram-label-stroke)"}
          />
          <text
            y={4}
            textAnchor="middle"
            className="text-[11px] font-mono select-none"
            fill={
              active || selected
                ? "var(--color-diagram-label-text-active)"
                : "var(--color-diagram-label-text)"
            }
          >
            {label}
          </text>
        </g>
      )}
    </motion.g>
  );
}

/** Marker definitions shared by all edges, one per visual state. */
export function EdgeMarkers({ color }: { color: string }) {
  const colors: Record<EdgeState, string> = {
    idle: "var(--color-diagram-edge)",
    active: color,
    selected: "var(--color-selected)",
  };
  return (
    <>
      {(Object.keys(colors) as EdgeState[]).map((s) => (
        <g key={s}>
          <marker
            id={`arrow-${s}`}
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill={colors[s]} />
          </marker>
          <marker
            id={`triangle-${s}`}
            viewBox="0 0 12 12"
            refX="10"
            refY="6"
            markerWidth="10"
            markerHeight="10"
            orient="auto"
          >
            <path
              d="M 1 1 L 11 6 L 1 11 z"
              fill="var(--color-canvas)"
              stroke={colors[s]}
              strokeWidth="1.5"
            />
          </marker>
          <marker
            id={`diamond-${s}`}
            viewBox="0 0 14 10"
            refX="1"
            refY="5"
            markerWidth="12"
            markerHeight="9"
            orient="auto"
          >
            <path d="M 1 5 L 7 1 L 13 5 L 7 9 z" fill={colors[s]} />
          </marker>
        </g>
      ))}
      <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="3" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </>
  );
}
