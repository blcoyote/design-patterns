export const NODE_HEIGHT = 64
export const NODE_WIDTH = 150

export interface Point {
  x: number
  y: number
}

export interface Box extends Point {
  width: number
  height: number
}

/** Point where the ray from the box centre towards `toward` leaves the box (with padding). */
export function boxExit(box: Box, toward: Point, pad = 6): Point {
  const dx = toward.x - box.x
  const dy = toward.y - box.y
  if (dx === 0 && dy === 0) return { x: box.x, y: box.y }
  const hw = box.width / 2 + pad
  const hh = box.height / 2 + pad
  const scale = Math.min(dx === 0 ? Infinity : hw / Math.abs(dx), dy === 0 ? Infinity : hh / Math.abs(dy))
  return { x: box.x + dx * scale, y: box.y + dy * scale }
}

/** Bounding box of a participant (centre + size). */
export function boxOf(p: { x: number; y: number; width?: number }): Box {
  return { x: p.x, y: p.y, width: p.width ?? NODE_WIDTH, height: NODE_HEIGHT }
}

export interface EdgeGeometry {
  start: Point
  control: Point
  end: Point
  /** SVG path data (quadratic Bézier). */
  d: string
  /** Point at t = 0.5, for labels. */
  mid: Point
}

/** Quadratic curve between two boxes, bent sideways by `bend` units. */
export function edgeBetween(a: Box, b: Box, bend = 0): EdgeGeometry {
  const mx = (a.x + b.x) / 2
  const my = (a.y + b.y) / 2
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1
  // perpendicular offset for the control point
  const control = { x: mx + (-(b.y - a.y) / len) * bend * 2, y: my + ((b.x - a.x) / len) * bend * 2 }
  const start = boxExit(a, control)
  const end = boxExit(b, control, 10)
  return {
    start,
    control,
    end,
    d: `M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y}`,
    mid: pointOnQuad(start, control, end, 0.5),
  }
}

export function pointOnQuad(p0: Point, p1: Point, p2: Point, t: number): Point {
  const u = 1 - t
  return {
    x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
    y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
  }
}

/** Sampled points along an edge, for keyframe animations. */
export function samplePath(edge: EdgeGeometry, samples = 24, reverse = false): Point[] {
  const pts = Array.from({ length: samples + 1 }, (_, i) => pointOnQuad(edge.start, edge.control, edge.end, i / samples))
  return reverse ? pts.reverse() : pts
}
