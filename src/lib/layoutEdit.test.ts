import { describe, expect, it } from "vitest";
import { NODE_HEIGHT, NODE_WIDTH, boxOf, edgeBetween, type Box } from "./geometry";
import {
  applyLayout,
  MIN_BOX_WIDTH,
  bendForPoint,
  clampToViewBox,
  clampWidth,
  diffLayout,
  emptyLayout,
  isEmpty,
  snap,
} from "./layoutEdit";
import type { ExplorableDefinition } from "@/types/pattern";

function makeDef(): ExplorableDefinition {
  return {
    slug: "demo",
    name: "Demo",
    participants: [
      { id: "a", label: "A", role: "A", description: "", x: 100, y: 100 },
      { id: "b", label: "B", role: "B", description: "", x: 400, y: 100, width: 180 },
      { id: "c", label: "C", role: "C", description: "", x: 400, y: 300 },
    ],
    relations: [
      { id: "ab", from: "a", to: "b", type: "calls", description: "" },
      { id: "bc", from: "b", to: "c", type: "calls", description: "", bend: 30 },
    ],
    steps: [],
    code: "",
    csharp: "",
    python: "",
    go: "",
  };
}

describe("applyLayout", () => {
  it("applies participant and relation overrides to a new definition", () => {
    const def = makeDef();
    const next = applyLayout(def, {
      participants: { a: { x: 120, width: 200 } },
      relations: { ab: { bend: -40 } },
    });
    expect(next.participants[0]).toMatchObject({ id: "a", x: 120, y: 100, width: 200 });
    expect(next.relations[0].bend).toBe(-40);
  });

  it("never mutates the input and keeps identity of untouched entries", () => {
    const def = makeDef();
    const snapshot = structuredClone(def);
    const next = applyLayout(def, {
      participants: { a: { x: 1 } },
      relations: { ab: { bend: 5 } },
    });
    expect(def).toEqual(snapshot);
    expect(next).not.toBe(def);
    expect(next.participants).not.toBe(def.participants);
    expect(next.participants[0]).not.toBe(def.participants[0]);
    expect(next.participants[1]).toBe(def.participants[1]);
    expect(next.participants[2]).toBe(def.participants[2]);
    expect(next.relations[0]).not.toBe(def.relations[0]);
    expect(next.relations[1]).toBe(def.relations[1]);
    expect(next.steps).toBe(def.steps);
  });

  it("ignores undefined values and unknown ids", () => {
    const def = makeDef();
    const next = applyLayout(def, {
      participants: { a: { x: undefined }, nope: { x: 1 } },
      relations: { ab: {}, nope: { bend: 1 } },
    });
    expect(next.participants).toEqual(def.participants);
    expect(next.relations[0]).toBe(def.relations[0]);
  });
});

describe("bendForPoint", () => {
  const boxes: Array<[string, Box, Box]> = [
    ["horizontal", boxOf({ x: 100, y: 200 }), boxOf({ x: 500, y: 200 })],
    ["vertical", boxOf({ x: 300, y: 60 }), boxOf({ x: 300, y: 400 })],
    ["diagonal", boxOf({ x: 120, y: 80 }), boxOf({ x: 600, y: 380, width: 200 })],
    ["reverse diagonal", boxOf({ x: 650, y: 400 }), boxOf({ x: 140, y: 90 })],
    ["close", boxOf({ x: 300, y: 200 }), boxOf({ x: 300, y: 290 })],
  ];

  for (const [name, a, b] of boxes) {
    it(`round-trips edgeBetween(...).mid for ${name} boxes`, () => {
      for (let bend = -80; bend <= 80; bend += 1) {
        expect(bendForPoint(a, b, edgeBetween(a, b, bend).mid)).toBe(bend);
      }
    });
  }

  it("returns 0 for a point on the chord and for coincident boxes", () => {
    const a = boxOf({ x: 100, y: 100 });
    const b = boxOf({ x: 500, y: 100 });
    expect(bendForPoint(a, b, { x: 300, y: 100 })).toBe(0);
    expect(bendForPoint(a, a, { x: 10, y: 10 })).toBe(0);
  });

  it("is signed: points on opposite sides of the chord give opposite bends", () => {
    const a = boxOf({ x: 100, y: 200 });
    const b = boxOf({ x: 500, y: 200 });
    // perpendicular of (+x) is (0, +1): positive bend bends towards larger y
    expect(bendForPoint(a, b, { x: 300, y: 250 })).toBeGreaterThan(0);
    expect(bendForPoint(a, b, { x: 300, y: 150 })).toBeLessThan(0);
  });
});

describe("snap", () => {
  it("rounds to the nearest step", () => {
    expect(snap(14, 10)).toBe(10);
    expect(snap(15, 10)).toBe(20);
    expect(snap(-14, 10)).toBe(-10);
    expect(Object.is(snap(-2, 10), 0)).toBe(true);
  });
  it("returns the value unchanged for a non-positive step", () => {
    expect(snap(13.7, 0)).toBe(13.7);
    expect(snap(13.7, -5)).toBe(13.7);
  });
});

describe("clampToViewBox", () => {
  const size = { width: NODE_WIDTH, height: NODE_HEIGHT };

  it("leaves a point inside the viewBox alone", () => {
    expect(clampToViewBox({ x: 400, y: 230 }, size)).toEqual({ x: 400, y: 230 });
  });

  it("keeps at least part of the box inside the default viewBox", () => {
    const far = clampToViewBox({ x: 5000, y: -5000 }, size);
    // box left edge / bottom edge must still be inside 0 0 800 460
    expect(far.x - size.width / 2).toBeLessThan(800);
    expect(far.y + size.height / 2).toBeGreaterThan(0);
    const near = clampToViewBox({ x: -5000, y: 5000 }, size);
    expect(near.x + size.width / 2).toBeGreaterThan(0);
    expect(near.y - size.height / 2).toBeLessThan(460);
  });

  it("respects a custom viewBox with an offset origin", () => {
    const p = clampToViewBox({ x: 0, y: 0 }, size, "100 100 400 300", 20);
    expect(p).toEqual({ x: 100 - 75 + 20, y: 100 - 32 + 20 });
  });

  it("falls back to the default viewBox for malformed input", () => {
    expect(clampToViewBox({ x: 5000, y: 100 }, size, "nonsense")).toEqual(
      clampToViewBox({ x: 5000, y: 100 }, size),
    );
  });
});

describe("clampWidth", () => {
  it("leaves a sensible width alone", () => {
    expect(clampWidth(150)).toBe(150);
  });

  it("enforces the minimum and the viewBox width", () => {
    expect(clampWidth(10)).toBe(MIN_BOX_WIDTH);
    expect(clampWidth(-300)).toBe(80);
    expect(clampWidth(5000)).toBe(800);
    expect(clampWidth(5000, "0 0 400 300")).toBe(400);
  });
});

describe("diffLayout", () => {
  it("is empty for identical definitions", () => {
    expect(diffLayout(makeDef(), makeDef())).toEqual(emptyLayout());
  });

  it("contains only the values that differ", () => {
    const original = makeDef();
    const edited = applyLayout(original, {
      participants: { a: { x: 130 }, b: { width: 200 } },
      relations: { ab: { bend: 25 } },
    });
    expect(diffLayout(original, edited)).toEqual({
      participants: { a: { x: 130 }, b: { width: 200 } },
      relations: { ab: { bend: 25 } },
    });
  });

  it("treats bend 0 and undefined as equal", () => {
    const original = makeDef();
    const edited = applyLayout(original, { participants: {}, relations: { ab: { bend: 0 } } });
    expect(diffLayout(original, edited)).toEqual(emptyLayout());
    const reverse = applyLayout(original, { participants: {}, relations: { bc: { bend: 0 } } });
    expect(diffLayout(original, reverse).relations).toEqual({ bc: { bend: 0 } });
  });

  it("treats an absent width and the default width as equal", () => {
    const original = makeDef();
    const edited = applyLayout(original, {
      participants: { a: { width: NODE_WIDTH } },
      relations: {},
    });
    expect(diffLayout(original, edited)).toEqual(emptyLayout());
  });

  it("round-trips through applyLayout", () => {
    const original = makeDef();
    const overrides = {
      participants: { c: { x: 410, y: 320, width: 160 } },
      relations: { bc: { bend: -12 } },
    };
    const edited = applyLayout(original, overrides);
    expect(diffLayout(original, edited)).toEqual(overrides);
  });
});

describe("isEmpty", () => {
  it("is true for empty overrides and entries without values", () => {
    expect(isEmpty(emptyLayout())).toBe(true);
    expect(isEmpty({ participants: { a: {} }, relations: { r: { bend: undefined } } })).toBe(true);
  });
  it("is false when any value is set", () => {
    expect(isEmpty({ participants: { a: { x: 0 } }, relations: {} })).toBe(false);
    expect(isEmpty({ participants: {}, relations: { r: { bend: 0 } } })).toBe(false);
  });
});
