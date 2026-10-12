import { boxOf, type Box } from "@/lib/geometry";
import type { Participant } from "@/types/pattern";

export interface BoundedContextRegion {
  /** Text drawn at the region's top-left; also the key `seams` refers to. */
  label: string;
  /** Participant ids the region wraps. */
  members: string[];
  /** Nested inside a top-level region (e.g. a pure core): lighter dash, tighter padding, never stretched. */
  inner?: boolean;
}

export interface BoundedContextUnderlayProps {
  participants: Participant[];
  regions: BoundedContextRegion[];
  /** Pairs of region labels; a dotted vertical line is drawn between the two regions. */
  seams?: [string, string][];
  color: string;
}

const PADDING = 24;
const INNER_PADDING = 12;
/** Extra room above the members for the region label. */
const LABEL_ROOM = 14;
const SEAM_OVERHANG = 10;

interface Rect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

function wrap(boxes: Box[], pad: number): Rect {
  return {
    left: Math.min(...boxes.map((b) => b.x - b.width / 2)) - pad,
    right: Math.max(...boxes.map((b) => b.x + b.width / 2)) + pad,
    top: Math.min(...boxes.map((b) => b.y - b.height / 2)) - pad - LABEL_ROOM,
    bottom: Math.max(...boxes.map((b) => b.y + b.height / 2)) + pad,
  };
}

/** Stretches top-level regions whose vertical ranges overlap to a shared top/bottom. */
function alignSideBySide(rects: Rect[]): void {
  const groups: Rect[][] = [];
  for (const rect of rects) {
    const touching = groups.filter((g) =>
      g.some((o) => rect.top < o.bottom && o.top < rect.bottom),
    );
    const merged = [rect, ...touching.flat()];
    for (const g of touching) groups.splice(groups.indexOf(g), 1);
    groups.push(merged);
  }
  for (const group of groups) {
    const top = Math.min(...group.map((r) => r.top));
    const bottom = Math.max(...group.map((r) => r.bottom));
    for (const r of group) {
      r.top = top;
      r.bottom = bottom;
    }
  }
}

/**
 * Diagram underlay that draws dashed bounded-context regions around groups of
 * participants, so the regions follow the boxes (including when they are moved
 * in the dev layout editor) instead of being hard-coded rectangles.
 */
export function BoundedContextUnderlay({
  participants,
  regions,
  seams = [],
  color,
}: BoundedContextUnderlayProps) {
  const byId = new Map(participants.map((p) => [p.id, p]));
  const placed = regions.flatMap((region) => {
    const boxes = region.members.flatMap((id) => {
      const p = byId.get(id);
      return p ? [boxOf(p)] : [];
    });
    if (boxes.length === 0) return [];
    return [{ region, rect: wrap(boxes, region.inner ? INNER_PADDING : PADDING) }];
  });

  alignSideBySide(placed.filter((r) => !r.region.inner).map((r) => r.rect));

  const rectOf = new Map(placed.map((r) => [r.region.label, r.rect]));

  return (
    <g pointerEvents="none">
      {placed.map(({ region, rect }) => (
        <g key={region.label}>
          <rect
            x={rect.left}
            y={rect.top}
            width={rect.right - rect.left}
            height={rect.bottom - rect.top}
            rx={region.inner ? 16 : 24}
            fill="var(--color-diagram-node)"
            fillOpacity={region.inner ? 0.25 : 0.35}
            stroke="var(--color-line-bold)"
            strokeOpacity={region.inner ? 0.7 : 1}
            strokeWidth={1.5}
            strokeDasharray={region.inner ? "3 5" : "8 6"}
          />
          <text
            x={rect.left + (region.inner ? 14 : 20)}
            y={rect.top + (region.inner ? 22 : 28)}
            className="fill-fg-subtle text-[12px] font-mono font-semibold tracking-wider uppercase select-none"
          >
            {region.label}
          </text>
        </g>
      ))}

      {seams.map(([a, b]) => {
        const ra = rectOf.get(a);
        const rb = rectOf.get(b);
        if (!ra || !rb) return null;
        const [left, right] = ra.left <= rb.left ? [ra, rb] : [rb, ra];
        const x = (left.right + right.left) / 2;
        return (
          <line
            key={`${a}|${b}`}
            x1={x}
            y1={Math.min(ra.top, rb.top) - SEAM_OVERHANG}
            x2={x}
            y2={Math.max(ra.bottom, rb.bottom) + SEAM_OVERHANG}
            stroke={color}
            strokeOpacity={0.3}
            strokeWidth={1}
            strokeDasharray="2 6"
          />
        );
      })}
    </g>
  );
}
