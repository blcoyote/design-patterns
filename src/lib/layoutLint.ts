import {
  DEFAULT_VIEWBOX,
  NODE_HEIGHT,
  boxOf,
  edgeBetween,
  samplePath,
  type Box,
  type EdgeGeometry,
  type Point,
} from "@/lib/geometry";
import type { ExplorableDefinition, Participant, Relation } from "@/types/pattern";

/**
 * Pure layout checks that mirror what the pattern-diagram-reviewer agent looks for: cramped or
 * overlapping boxes, things leaving the viewBox, labels sitting on top of each other or on boxes,
 * and connector lines that cross each other or run through an unrelated box.
 */
export type LintRule =
  | "box-overlap"
  | "box-gap"
  | "box-outside"
  | "note-outside"
  | "label-overlap"
  | "label-box"
  | "edge-crossing"
  | "edge-through-box";

export const LINT_RULES: readonly LintRule[] = [
  "box-overlap",
  "box-gap",
  "box-outside",
  "note-outside",
  "label-overlap",
  "label-box",
  "edge-crossing",
  "edge-through-box",
];

export type LintSeverity = "error" | "warning";

export interface LayoutWarning {
  rule: LintRule;
  /** Overlaps and boxes leaving the canvas are "error"; spacing and line-routing findings are "warning". */
  severity?: LintSeverity;
  message: string;
  /** Participants to select / outline for this warning (possibly none, e.g. two crossing edges). */
  participantIds: string[];
  /** Relations (edges or their labels) involved. */
  relationIds: string[];
}

/** The part of a definition the lint reads. Any `ExplorableDefinition` satisfies it. */
export interface LintInput {
  participants: Participant[];
  relations: Relation[];
  /** Step notes are drawn as badges under (or above) their participant, so they are checked too. */
  steps?: Pick<ExplorableDefinition["steps"][number], "notes">[];
  viewBox?: string;
}

/** Smallest empty space (viewBox units) boxes should keep between each other. */
export const MIN_BOX_GAP = 20;

/** The edge sampling density used for crossing tests. */
const EDGE_SAMPLES = 32;

/** How far a crossing may sit from a shared endpoint box and still count as "at the endpoint". */
const ENDPOINT_SLACK = 12;

/** Parsed `viewBox`: `[minX, minY, width, height]`; falls back to the default for malformed input. */
function parseViewBox(viewBox: string): [number, number, number, number] {
  const nums = viewBox
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  if (nums.length === 4 && nums.every(Number.isFinite)) return [nums[0], nums[1], nums[2], nums[3]];
  return parseViewBox(DEFAULT_VIEWBOX);
}

/** The text `DiagramEdge` shows on a relation (an unlabelled `creates` shows `«create»`), if any. */
export function relationLabel(r: Pick<Relation, "label" | "type">): string | undefined {
  return r.label ?? (r.type === "creates" ? "«create»" : undefined);
}

/** The rect `DiagramEdge` draws behind a label, centred on the curve midpoint. */
export function labelRect(label: string, mid: Point): Box {
  return { x: mid.x, y: mid.y, width: label.length * 6.8 + 14, height: 18 };
}

/** The pill `DiagramNode` draws for a note: centred 18 units beyond the box edge, below unless near the bottom. */
export function noteRect(note: string, p: Participant, viewHeight: number): Box {
  const above = p.y + NODE_HEIGHT / 2 + 30 > viewHeight;
  const offset = NODE_HEIGHT / 2 + 18;
  return {
    x: p.x,
    y: above ? p.y - offset : p.y + offset,
    width: note.length * 7.2 + 24,
    height: 20,
  };
}

const left = (b: Box) => b.x - b.width / 2;
const right = (b: Box) => b.x + b.width / 2;
const top = (b: Box) => b.y - b.height / 2;
const bottom = (b: Box) => b.y + b.height / 2;

/** Empty space between two boxes: negative or zero when they overlap on both axes, else the distance. */
function boxGap(a: Box, b: Box): { overlap: boolean; gap: number } {
  const gx = Math.abs(a.x - b.x) - (a.width + b.width) / 2;
  const gy = Math.abs(a.y - b.y) - (a.height + b.height) / 2;
  if (gx < 0 && gy < 0) return { overlap: true, gap: Math.max(gx, gy) };
  return { overlap: false, gap: Math.hypot(Math.max(gx, 0), Math.max(gy, 0)) };
}

function rectsOverlap(a: Box, b: Box): boolean {
  return boxGap(a, b).overlap;
}

function inflate(b: Box, by: number): Box {
  return { x: b.x, y: b.y, width: b.width + 2 * by, height: b.height + 2 * by };
}

function containsPoint(b: Box, p: Point): boolean {
  return p.x >= left(b) && p.x <= right(b) && p.y >= top(b) && p.y <= bottom(b);
}

/** Intersection point of two segments when they properly cross (not merely touch or run collinear). */
export function segmentIntersection(a1: Point, a2: Point, b1: Point, b2: Point): Point | null {
  const rx = a2.x - a1.x;
  const ry = a2.y - a1.y;
  const sx = b2.x - b1.x;
  const sy = b2.y - b1.y;
  const denom = rx * sy - ry * sx;
  if (denom === 0) return null;
  const qx = b1.x - a1.x;
  const qy = b1.y - a1.y;
  const t = (qx * sy - qy * sx) / denom;
  const u = (qx * ry - qy * rx) / denom;
  if (t <= 0 || t >= 1 || u <= 0 || u >= 1) return null;
  return { x: a1.x + t * rx, y: a1.y + t * ry };
}

/** Whether the segment p→q touches the rectangle `b` (an endpoint inside it, or a crossing of one of its sides). */
function segmentHitsRect(p: Point, q: Point, b: Box): boolean {
  if (containsPoint(b, p) || containsPoint(b, q)) return true;
  const tl = { x: left(b), y: top(b) };
  const tr = { x: right(b), y: top(b) };
  const br = { x: right(b), y: bottom(b) };
  const bl = { x: left(b), y: bottom(b) };
  return (
    segmentIntersection(p, q, tl, tr) !== null ||
    segmentIntersection(p, q, tr, br) !== null ||
    segmentIntersection(p, q, br, bl) !== null ||
    segmentIntersection(p, q, bl, tl) !== null
  );
}

function pathHitsRect(path: Point[], b: Box): boolean {
  for (let i = 0; i + 1 < path.length; i++)
    if (segmentHitsRect(path[i], path[i + 1], b)) return true;
  return false;
}

/** First crossing between two sampled paths that satisfies `accept`, or null. */
function firstCrossing(a: Point[], b: Point[], accept: (at: Point) => boolean): Point | null {
  for (let i = 0; i + 1 < a.length; i++) {
    for (let j = 0; j + 1 < b.length; j++) {
      const at = segmentIntersection(a[i], a[i + 1], b[j], b[j + 1]);
      if (at && accept(at)) return at;
    }
  }
  return null;
}

/** All layout warnings for a definition, in a stable order (box rules, notes, labels, edges). */
export function lintLayout(input: LintInput): LayoutWarning[] {
  const warnings: LayoutWarning[] = [];
  const { participants, relations } = input;
  const [minX, minY, viewWidth, viewHeight] = parseViewBox(input.viewBox ?? DEFAULT_VIEWBOX);
  const canvas: Box = {
    x: minX + viewWidth / 2,
    y: minY + viewHeight / 2,
    width: viewWidth,
    height: viewHeight,
  };
  const outside = (b: Box) =>
    left(b) < left(canvas) ||
    right(b) > right(canvas) ||
    top(b) < top(canvas) ||
    bottom(b) > bottom(canvas);

  const boxes = new Map(participants.map((p) => [p.id, boxOf(p)]));
  const labelOf = (id: string) => participants.find((p) => p.id === id)?.label ?? id;

  // 1. Boxes: overlapping, cramped, or leaving the viewBox.
  for (let i = 0; i < participants.length; i++) {
    const a = participants[i];
    const boxA = boxes.get(a.id);
    if (!boxA) continue;
    if (outside(boxA)) {
      warnings.push({
        rule: "box-outside",
        severity: "error",
        message: `${a.label} is partly outside the viewBox`,
        participantIds: [a.id],
        relationIds: [],
      });
    }
    for (let j = i + 1; j < participants.length; j++) {
      const b = participants[j];
      const boxB = boxes.get(b.id);
      if (!boxB) continue;
      const { overlap, gap } = boxGap(boxA, boxB);
      if (overlap) {
        warnings.push({
          rule: "box-overlap",
          severity: "error",
          message: `${a.label} and ${b.label} overlap`,
          participantIds: [a.id, b.id],
          relationIds: [],
        });
      } else if (gap < MIN_BOX_GAP) {
        warnings.push({
          rule: "box-gap",
          severity: "warning",
          message: `${a.label} and ${b.label} are ${Math.round(gap)} apart (aim for at least ${MIN_BOX_GAP})`,
          participantIds: [a.id, b.id],
          relationIds: [],
        });
      }
    }
  }

  // 2. Note badges: only the widest note of each participant across the steps matters.
  const widest = new Map<string, string>();
  for (const step of input.steps ?? []) {
    for (const [id, note] of Object.entries(step.notes ?? {})) {
      if (note.length > (widest.get(id)?.length ?? -1)) widest.set(id, note);
    }
  }
  for (const p of participants) {
    const note = widest.get(p.id);
    if (note === undefined) continue;
    if (outside(noteRect(note, p, viewHeight))) {
      warnings.push({
        rule: "note-outside",
        severity: "warning",
        message: `The note "${note}" on ${p.label} would extend outside the viewBox`,
        participantIds: [p.id],
        relationIds: [],
      });
    }
  }

  // 3. Edges: geometry exactly as Diagram computes it. Self-relations have no drawable curve.
  interface DrawnEdge {
    relation: Relation;
    geometry: EdgeGeometry;
    path: Point[];
  }
  const edges: DrawnEdge[] = [];
  for (const r of relations) {
    const a = boxes.get(r.from);
    const b = boxes.get(r.to);
    if (!a || !b || r.from === r.to) continue;
    const geometry = edgeBetween(a, b, r.bend);
    edges.push({ relation: r, geometry, path: samplePath(geometry, EDGE_SAMPLES) });
  }

  // 3a. Label rects against each other and against every box.
  const labelled = edges.flatMap((e) => {
    const label = relationLabel(e.relation);
    return label === undefined ? [] : [{ edge: e, label, rect: labelRect(label, e.geometry.mid) }];
  });
  for (let i = 0; i < labelled.length; i++) {
    const a = labelled[i];
    for (let j = i + 1; j < labelled.length; j++) {
      const b = labelled[j];
      if (!rectsOverlap(a.rect, b.rect)) continue;
      warnings.push({
        rule: "label-overlap",
        severity: "warning",
        message: `The labels "${a.label}" and "${b.label}" overlap`,
        participantIds: [],
        relationIds: [a.edge.relation.id, b.edge.relation.id],
      });
    }
    for (const p of participants) {
      const box = boxes.get(p.id);
      if (!box || !rectsOverlap(a.rect, box)) continue;
      warnings.push({
        rule: "label-box",
        severity: "warning",
        message: `The label "${a.label}" covers ${p.label}`,
        participantIds: [p.id],
        relationIds: [a.edge.relation.id],
      });
    }
  }

  // 3b. Edge crossings. Edges sharing a participant legitimately meet at it, so a crossing next to a shared box is ignored.
  for (let i = 0; i < edges.length; i++) {
    const a = edges[i];
    for (let j = i + 1; j < edges.length; j++) {
      const b = edges[j];
      const shared = [a.relation.from, a.relation.to].filter(
        (id) => id === b.relation.from || id === b.relation.to,
      );
      const slackBoxes = shared.flatMap((id) => {
        const box = boxes.get(id);
        return box ? [inflate(box, ENDPOINT_SLACK)] : [];
      });
      const at = firstCrossing(a.path, b.path, (point) =>
        slackBoxes.every((box) => !containsPoint(box, point)),
      );
      if (!at) continue;
      warnings.push({
        rule: "edge-crossing",
        severity: "warning",
        message: `${describeEdge(a.relation, labelOf)} crosses ${describeEdge(b.relation, labelOf)}`,
        participantIds: [],
        relationIds: [a.relation.id, b.relation.id],
      });
    }
  }

  // 3c. Edges running through a box that is not one of their endpoints.
  for (const e of edges) {
    for (const p of participants) {
      if (p.id === e.relation.from || p.id === e.relation.to) continue;
      const box = boxes.get(p.id);
      if (!box || !pathHitsRect(e.path, box)) continue;
      warnings.push({
        rule: "edge-through-box",
        severity: "warning",
        message: `${describeEdge(e.relation, labelOf)} passes through ${p.label}`,
        participantIds: [p.id],
        relationIds: [e.relation.id],
      });
    }
  }

  return warnings;
}

function describeEdge(r: Relation, labelOf: (id: string) => string): string {
  return `${labelOf(r.from)} → ${labelOf(r.to)}`;
}

/** Which ids each part of the diagram should outline: boxes, relation labels, relation curves. */
export interface WarningTargets {
  participants: ReadonlySet<string>;
  labels: ReadonlySet<string>;
  edges: ReadonlySet<string>;
}

export function emptyWarningTargets(): WarningTargets {
  return { participants: new Set(), labels: new Set(), edges: new Set() };
}

/** Splits warnings into the ids to outline; label rules mark relation labels, edge rules mark curves. */
export function warningTargets(warnings: readonly LayoutWarning[]): WarningTargets {
  const participants = new Set<string>();
  const labels = new Set<string>();
  const edges = new Set<string>();
  for (const w of warnings) {
    for (const id of w.participantIds) participants.add(id);
    const bucket = w.rule === "label-overlap" || w.rule === "label-box" ? labels : edges;
    for (const id of w.relationIds) bucket.add(id);
  }
  return { participants, labels, edges };
}
