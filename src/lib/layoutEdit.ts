import {
  DEFAULT_VIEWBOX,
  NODE_WIDTH,
  boxOf,
  edgeBetween,
  perpendicularOffset,
  type Box,
  type Point,
} from "@/lib/geometry";
import type { ExplorableDefinition, Participant, Relation } from "@/types/pattern";

/** Layout values an editor may change, keyed by participant / relation id. */
export interface LayoutOverrides {
  participants: Record<string, { x?: number; y?: number; width?: number }>;
  relations: Record<string, { bend?: number }>;
}

export function emptyLayout(): LayoutOverrides {
  return { participants: {}, relations: {} };
}

/**
 * Returns a new definition with the overrides applied to participants and
 * relations. Entries without an override keep their identity; `def` is never
 * mutated.
 */
export function applyLayout<T extends ExplorableDefinition>(def: T, o: LayoutOverrides): T {
  const participants = def.participants.map((p) => {
    const patch = o.participants[p.id];
    if (!patch) return p;
    return {
      ...p,
      ...(patch.x !== undefined && { x: patch.x }),
      ...(patch.y !== undefined && { y: patch.y }),
      ...(patch.width !== undefined && { width: patch.width }),
    };
  });
  const relations = def.relations.map((r) => {
    const patch = o.relations[r.id];
    if (!patch || patch.bend === undefined) return r;
    return { ...r, bend: patch.bend };
  });
  return { ...def, participants, relations };
}

const BEND_LIMIT = 600;
const BEND_TOLERANCE = 1e-6;

/**
 * Inverse of `edgeBetween(a, b, bend).mid`: the integer bend whose curve
 * midpoint sits at the same perpendicular offset from the chord as `p`.
 *
 * The midpoint is not linear in `bend` (start and end are box exits towards
 * the control point), so this bisects the signed offset of `mid`, which grows
 * with `bend`. Targets outside ±600 saturate. Coincident boxes have no chord
 * and return 0.
 */
export function bendForPoint(a: Box, b: Box, p: Point): number {
  if (a.x === b.x && a.y === b.y) return 0;
  const target = perpendicularOffset(a, b, p);
  const offsetAt = (bend: number) => perpendicularOffset(a, b, edgeBetween(a, b, bend).mid);
  let lo = -BEND_LIMIT;
  let hi = BEND_LIMIT;
  while (hi - lo > BEND_TOLERANCE) {
    const mid = (lo + hi) / 2;
    if (offsetAt(mid) < target) lo = mid;
    else hi = mid;
  }
  // `+ 0` normalises -0
  return Math.round((lo + hi) / 2) + 0;
}

/** Round `v` to the nearest multiple of `step`; a non-positive step returns `v` unchanged. */
export function snap(v: number, step: number): number {
  if (!(step > 0)) return v;
  return Math.round(v / step) * step + 0;
}

function parseViewBox(viewBox: string): { x: number; y: number; width: number; height: number } {
  const [x, y, width, height] = viewBox
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  if ([x, y, width, height].every(Number.isFinite) && width > 0 && height > 0) {
    return { x, y, width, height };
  }
  return parseViewBox(DEFAULT_VIEWBOX);
}

/**
 * Clamp a box centre so at least `minVisible` units of the box (per axis, or
 * half its size if smaller) stay inside the viewBox: it can be dragged mostly
 * off-canvas, but never lost.
 */
export function clampToViewBox(
  point: Point,
  box: Pick<Box, "width" | "height">,
  viewBox: string = DEFAULT_VIEWBOX,
  minVisible = 24,
): Point {
  const vb = parseViewBox(viewBox);
  const keepX = Math.min(minVisible, box.width / 2);
  const keepY = Math.min(minVisible, box.height / 2);
  const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
  return {
    x: clamp(point.x, vb.x - box.width / 2 + keepX, vb.x + vb.width + box.width / 2 - keepX),
    y: clamp(point.y, vb.y - box.height / 2 + keepY, vb.y + vb.height + box.height / 2 - keepY),
  };
}

/**
 * Overrides that turn `original` into `edited`, containing only values that
 * differ. Matching is by id against `original`. An absent `bend` equals 0 and
 * an absent `width` equals the default node width.
 */
export function diffLayout(
  original: ExplorableDefinition,
  edited: ExplorableDefinition,
): LayoutOverrides {
  const out = emptyLayout();
  const editedParticipants = new Map<string, Participant>(
    edited.participants.map((p) => [p.id, p]),
  );
  for (const before of original.participants) {
    const after = editedParticipants.get(before.id);
    if (!after) continue;
    const patch: LayoutOverrides["participants"][string] = {};
    if (after.x !== before.x) patch.x = after.x;
    if (after.y !== before.y) patch.y = after.y;
    if (boxOf(after).width !== boxOf(before).width) patch.width = after.width ?? NODE_WIDTH;
    if (Object.keys(patch).length > 0) out.participants[before.id] = patch;
  }
  const editedRelations = new Map<string, Relation>(edited.relations.map((r) => [r.id, r]));
  for (const before of original.relations) {
    const after = editedRelations.get(before.id);
    if (!after) continue;
    const bend = after.bend ?? 0;
    if (bend !== (before.bend ?? 0)) out.relations[before.id] = { bend };
  }
  return out;
}

/** True when the overrides change nothing. */
export function isEmpty(o: LayoutOverrides): boolean {
  const hasValues = (patch: object) => Object.values(patch).some((v) => v !== undefined);
  return (
    !Object.values(o.participants).some(hasValues) && !Object.values(o.relations).some(hasValues)
  );
}
