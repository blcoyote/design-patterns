import { expect, it } from "vitest";
import { boxOf, edgeBetween, samplePath } from "@/lib/geometry";
import type { Point } from "@/lib/geometry";
import { pattern } from "./index";

const routes = pattern.relations.map((relation) => {
  const from = pattern.participants.find((participant) => participant.id === relation.from)!;
  const to = pattern.participants.find((participant) => participant.id === relation.to)!;
  const edge = edgeBetween(boxOf(from), boxOf(to), relation.bend);
  return { relation, edge, points: samplePath(edge, 80) };
});

function orientation(start: Point, end: Point, point: Point) {
  return (end.x - start.x) * (point.y - start.y) - (end.y - start.y) * (point.x - start.x);
}

it("keeps every route inside the viewBox and clear of unrelated nodes and routes", () => {
  for (const [index, route] of routes.entries()) {
    for (const point of route.points) {
      expect(point.x).toBeGreaterThanOrEqual(0);
      expect(point.x).toBeLessThanOrEqual(800);
      expect(point.y).toBeGreaterThanOrEqual(0);
      expect(point.y).toBeLessThanOrEqual(460);
      for (const participant of pattern.participants) {
        if ([route.relation.from, route.relation.to].includes(participant.id)) continue;
        const box = boxOf(participant);
        expect(
          Math.abs(point.x - box.x) < box.width / 2 && Math.abs(point.y - box.y) < box.height / 2,
          `${route.relation.id} crosses ${participant.id}`,
        ).toBe(false);
      }
    }
    for (const other of routes.slice(index + 1)) {
      for (let segment = 1; segment < route.points.length; segment++) {
        for (let otherSegment = 1; otherSegment < other.points.length; otherSegment++) {
          const start = route.points[segment - 1];
          const end = route.points[segment];
          const otherStart = other.points[otherSegment - 1];
          const otherEnd = other.points[otherSegment];
          expect(
            orientation(start, end, otherStart) * orientation(start, end, otherEnd) < 0 &&
              orientation(otherStart, otherEnd, start) * orientation(otherStart, otherEnd, end) < 0,
            `${route.relation.id} crosses ${other.relation.id}`,
          ).toBe(false);
        }
      }
    }
  }
});

it("keeps creation and client labels separate, clear of nodes, and inside the viewBox", () => {
  const labels = routes.flatMap(({ relation, edge }) =>
    relation.label
      ? [{ id: relation.id, ...edge.mid, halfWidth: relation.label.length * 3.4 + 7 }]
      : [],
  );
  for (const [index, label] of labels.entries()) {
    expect(label.x - label.halfWidth).toBeGreaterThanOrEqual(0);
    expect(label.x + label.halfWidth).toBeLessThanOrEqual(800);
    expect(label.y - 9).toBeGreaterThanOrEqual(0);
    expect(label.y + 9).toBeLessThanOrEqual(460);
    for (const participant of pattern.participants) {
      const box = boxOf(participant);
      expect(
        Math.abs(label.x - box.x) < label.halfWidth + box.width / 2 &&
          Math.abs(label.y - box.y) < 9 + box.height / 2,
        `${label.id} label overlaps ${participant.id}`,
      ).toBe(false);
    }
    for (const other of labels.slice(index + 1)) {
      expect(
        Math.abs(label.x - other.x) < label.halfWidth + other.halfWidth &&
          Math.abs(label.y - other.y) < 18,
        `${label.id} label overlaps ${other.id}`,
      ).toBe(false);
    }
  }
});
