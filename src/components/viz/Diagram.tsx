import type { ReactNode } from "react";
import {
  NODE_HEIGHT,
  boxOf,
  edgeBetween,
  type EdgeGeometry,
} from "@/lib/geometry";
import type {
  Packet as PacketDef,
  Participant,
  Relation,
} from "@/types/pattern";
import { DiagramEdge, EdgeMarkers } from "./DiagramEdge";
import { DiagramNode } from "./DiagramNode";
import { PacketLayer } from "./PacketLayer";

export const DEFAULT_VIEWBOX = "0 0 800 460";

export interface DiagramProps {
  participants: Participant[];
  relations: Relation[];
  color: string;
  viewBox?: string;
  /** Ids to highlight. When empty nothing is dimmed. */
  highlight?: string[];
  packets?: PacketDef[];
  notes?: Record<string, string>;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** Changes whenever packets should restart (e.g. the step index). */
  animationKey?: string | number;
  packetSpeed?: number;
  // @pattern template-method: underlay and overlay are hooks in a fixed rendering skeleton, using composition instead of inheritance
  /** Extra SVG drawn beneath the nodes. */
  underlay?: ReactNode;
  /** Extra SVG drawn above everything. */
  overlay?: ReactNode;
  ariaLabel?: string;
}

/** Generic, data-driven UML-ish diagram with animated, clickable nodes and edges. */
export function Diagram({
  participants,
  relations,
  color,
  viewBox = DEFAULT_VIEWBOX,
  highlight = [],
  packets = [],
  notes = {},
  selectedId,
  onSelect,
  animationKey,
  packetSpeed = 1,
  underlay,
  overlay,
  ariaLabel = "Pattern diagram",
}: DiagramProps) {
  const byId = new Map(participants.map((p) => [p.id, p]));
  const geometry = new Map<string, EdgeGeometry>();
  for (const r of relations) {
    const a = byId.get(r.from);
    const b = byId.get(r.to);
    if (a && b) geometry.set(r.id, edgeBetween(boxOf(a), boxOf(b), r.bend));
  }
  const active = new Set(highlight);
  const dimming = active.size > 0;
  const viewHeight = Number(viewBox.split(" ")[3]) || 460;

  return (
    <svg
      viewBox={viewBox}
      className="h-auto w-full select-none"
      role="group"
      aria-label={ariaLabel}
      onClick={() => onSelect(null)}
    >
      <defs>
        <EdgeMarkers color={color} />
        <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="1" fill="#1e293b" />
        </pattern>
      </defs>
      <rect x="-1000" y="-1000" width="3000" height="3000" fill="url(#grid)" />
      {underlay}

      {relations.map((r) => {
        const g = geometry.get(r.id);
        if (!g) return null;
        return (
          <DiagramEdge
            key={r.id}
            relation={r}
            geometry={g}
            color={color}
            active={active.has(r.id)}
            dimmed={dimming && !active.has(r.id) && selectedId !== r.id}
            selected={selectedId === r.id}
            onSelect={onSelect}
          />
        );
      })}

      {participants.map((p) => (
        <DiagramNode
          key={p.id}
          participant={p}
          color={color}
          active={active.has(p.id)}
          dimmed={dimming && !active.has(p.id) && selectedId !== p.id}
          selected={selectedId === p.id}
          note={notes[p.id]}
          noteAbove={p.y + NODE_HEIGHT / 2 + 30 > viewHeight}
          onSelect={onSelect}
        />
      ))}

      <PacketLayer
        animationKey={animationKey}
        packets={packets}
        geometry={geometry}
        color={color}
        speed={packetSpeed}
      />
      {overlay}
    </svg>
  );
}
