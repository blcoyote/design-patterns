import { describe, expect, it } from "vitest";
import { architectures } from "@/architectures/registry";
import { patterns } from "@/patterns/registry";
import type { Participant, Relation } from "@/types/pattern";
import {
  LINT_RULES,
  lintLayout,
  noteRect,
  segmentIntersection,
  warningTargets,
  type LayoutWarning,
  type LintRule,
} from "./layoutLint";

function box(id: string, x: number, y: number, width?: number): Participant {
  return { id, label: id.toUpperCase(), role: "Role", description: "", x, y, width };
}

function rel(id: string, from: string, to: string, extra: Partial<Relation> = {}): Relation {
  return { id, from, to, type: "calls", description: "", ...extra };
}

const rules = (ws: LayoutWarning[]) => ws.map((w) => w.rule);
const only = (ws: LayoutWarning[], rule: LintRule) => ws.filter((w) => w.rule === rule);

describe("lintLayout: boxes", () => {
  it("is quiet for a well spaced layout", () => {
    const ws = lintLayout({
      participants: [box("a", 100, 100), box("b", 400, 100), box("c", 700, 100)],
      relations: [rel("ab", "a", "b"), rel("bc", "b", "c")],
    });
    expect(ws).toEqual([]);
  });

  it("flags overlapping boxes as an error", () => {
    const ws = lintLayout({
      participants: [box("a", 200, 200), box("b", 260, 220)],
      relations: [],
    });
    expect(rules(ws)).toEqual(["box-overlap"]);
    expect(ws[0]).toMatchObject({ severity: "error", participantIds: ["a", "b"] });
  });

  it("flags boxes closer than 20 units, measured edge to edge", () => {
    // a spans x 25..175, b starts at 190: a 15 unit gap
    const near = lintLayout({
      participants: [box("a", 100, 100), box("b", 265, 100)],
      relations: [],
    });
    expect(rules(near)).toEqual(["box-gap"]);
    expect(near[0].message).toContain("15");
    // exactly 20 is fine
    const ok = lintLayout({
      participants: [box("a", 100, 100), box("b", 270, 100)],
      relations: [],
    });
    expect(ok).toEqual([]);
  });

  it("measures the gap vertically too, and honours custom widths", () => {
    // heights are 64: a spans y 68..132, b starts at 142: a 10 unit gap
    expect(
      rules(lintLayout({ participants: [box("a", 400, 100), box("b", 400, 174)], relations: [] })),
    ).toEqual(["box-gap"]);
    // a is 300 wide (x -50..250 is outside, so keep it inside): spans 100..400; b starts at 410
    const wide = lintLayout({
      participants: [box("a", 250, 100, 300), box("b", 485, 100)],
      relations: [],
    });
    expect(rules(wide)).toEqual(["box-gap"]);
  });

  it("flags a box partly outside the viewBox", () => {
    const ws = lintLayout({ participants: [box("a", 50, 100)], relations: [] });
    expect(rules(ws)).toEqual(["box-outside"]);
    expect(ws[0].participantIds).toEqual(["a"]);
    expect(rules(lintLayout({ participants: [box("a", 400, 440)], relations: [] }))).toEqual([
      "box-outside",
    ]);
  });

  it("respects a custom viewBox", () => {
    const participants = [box("a", 1000, 100)];
    expect(rules(lintLayout({ participants, relations: [] }))).toEqual(["box-outside"]);
    expect(lintLayout({ participants, relations: [], viewBox: "0 0 1200 460" })).toEqual([]);
  });
});

describe("lintLayout: note badges", () => {
  const steps = (note: string) => [{ notes: { a: note } }];

  it("flags a note that sticks out sideways", () => {
    const ws = lintLayout({
      participants: [box("a", 76, 100)],
      relations: [],
      steps: steps("a rather long note"),
    });
    expect(rules(ws)).toEqual(["note-outside"]);
    expect(ws[0].participantIds).toEqual(["a"]);
  });

  it("puts the badge above a box near the bottom, as Diagram does", () => {
    const p = box("a", 400, 420);
    expect(noteRect("x", p, 460).y).toBe(370);
    expect(noteRect("x", box("a", 400, 100), 460).y).toBe(150);
    // below the bottom would be outside, but the mirrored rule moves it above
    expect(lintLayout({ participants: [p], relations: [], steps: steps("ok") })).toEqual([]);
  });

  it("flags an above-badge that leaves the top of a short viewBox", () => {
    const ws = lintLayout({
      participants: [box("a", 400, 50)],
      relations: [],
      steps: steps("ok"),
      viewBox: "0 0 800 100",
    });
    expect(rules(ws)).toEqual(["note-outside"]);
  });

  it("uses the widest note over all steps and ignores participants without notes", () => {
    const ws = lintLayout({
      participants: [box("a", 400, 100), box("b", 80, 300)],
      relations: [],
      steps: [{ notes: { a: "short" } }, {}, { notes: { a: "x".repeat(200) } }],
    });
    expect(only(ws, "note-outside")).toHaveLength(1);
    expect(ws[0].participantIds).toEqual(["a"]);
  });
});

describe("lintLayout: edge labels", () => {
  it("flags two labels at the same spot", () => {
    const ws = lintLayout({
      participants: [box("a", 100, 230), box("b", 700, 230)],
      relations: [rel("r1", "a", "b", { label: "foo" }), rel("r2", "a", "b", { label: "bar" })],
    });
    expect(rules(ws)).toEqual(["label-overlap"]);
    expect(ws[0].relationIds).toEqual(["r1", "r2"]);
  });

  it("accepts well separated labels", () => {
    const ws = lintLayout({
      participants: [box("a", 100, 230), box("b", 700, 230)],
      relations: [
        rel("r1", "a", "b", { label: "foo", bend: 40 }),
        rel("r2", "a", "b", { label: "bar", bend: -40 }),
      ],
    });
    expect(only(ws, "label-overlap")).toEqual([]);
  });

  it("flags a label covering a box", () => {
    const ws = lintLayout({
      participants: [box("a", 100, 230), box("b", 300, 230)],
      relations: [rel("r", "a", "b", { label: "a long label" })],
    });
    const hits = only(ws, "label-box");
    expect(hits.map((w) => w.participantIds)).toEqual([["a"], ["b"]]);
    expect(hits[0].relationIds).toEqual(["r"]);
  });

  it("counts an unlabelled creates relation as «create»", () => {
    const boxes = [box("a", 100, 230), box("b", 300, 230)];
    const plain = lintLayout({ participants: boxes, relations: [rel("r", "a", "b")] });
    expect(only(plain, "label-box")).toEqual([]);
    const creates = lintLayout({
      participants: boxes,
      relations: [rel("r", "a", "b", { type: "creates" })],
    });
    expect(only(creates, "label-box").length).toBeGreaterThan(0);
  });
});

describe("lintLayout: edges", () => {
  it("flags two unrelated edges crossing", () => {
    const ws = lintLayout({
      participants: [
        box("a", 100, 100),
        box("b", 300, 300),
        box("c", 300, 100),
        box("d", 100, 300),
      ],
      relations: [rel("ab", "a", "b"), rel("cd", "c", "d")],
    });
    expect(rules(ws)).toEqual(["edge-crossing"]);
    expect(ws[0].relationIds).toEqual(["ab", "cd"]);
  });

  it("does not flag edges that share an endpoint participant", () => {
    const ws = lintLayout({
      participants: [box("a", 100, 230), box("b", 450, 100), box("c", 450, 360)],
      relations: [rel("ab", "a", "b"), rel("ac", "a", "c"), rel("ab2", "a", "b", { bend: 30 })],
    });
    expect(only(ws, "edge-crossing")).toEqual([]);
  });

  it("flags a curve bent into another edge", () => {
    const ws = lintLayout({
      participants: [box("a", 100, 100), box("b", 500, 100), box("c", 300, 300), box("d", 300, 20)],
      relations: [rel("ab", "a", "b", { bend: 0 }), rel("cd", "c", "d")],
    });
    expect(only(ws, "edge-crossing")).toHaveLength(1);
  });

  it("flags an edge running through an unrelated box, but not its own endpoints", () => {
    const ws = lintLayout({
      participants: [box("a", 100, 230), box("m", 400, 230), box("b", 700, 230)],
      relations: [rel("ab", "a", "b")],
    });
    const hits = only(ws, "edge-through-box");
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({ participantIds: ["m"], relationIds: ["ab"] });
  });

  it("is quiet when the same edge is bent clear of the box", () => {
    const ws = lintLayout({
      participants: [box("a", 100, 230), box("m", 400, 230), box("b", 700, 230)],
      relations: [rel("ab", "a", "b", { bend: 120 })],
    });
    expect(only(ws, "edge-through-box")).toEqual([]);
  });

  it("ignores relations with missing endpoints and self relations", () => {
    const ws = lintLayout({
      participants: [box("a", 400, 230)],
      relations: [rel("x", "a", "gone"), rel("self", "a", "a", { label: "loop" })],
    });
    expect(ws).toEqual([]);
  });
});

describe("segmentIntersection", () => {
  it("returns the crossing point of properly crossing segments", () => {
    expect(
      segmentIntersection({ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 10, y: 0 }),
    ).toEqual({ x: 5, y: 5 });
  });

  it("returns null for parallel, collinear and non-reaching segments", () => {
    const o = { x: 0, y: 0 };
    expect(segmentIntersection(o, { x: 10, y: 0 }, { x: 0, y: 1 }, { x: 10, y: 1 })).toBeNull();
    expect(segmentIntersection(o, { x: 10, y: 0 }, { x: 5, y: 0 }, { x: 15, y: 0 })).toBeNull();
    expect(segmentIntersection(o, { x: 4, y: 4 }, { x: 6, y: 0 }, { x: 6, y: 10 })).toBeNull();
  });
});

describe("warningTargets", () => {
  it("routes label rules to labels and edge rules to curves", () => {
    const targets = warningTargets([
      { rule: "label-box", message: "", participantIds: ["a"], relationIds: ["r1"] },
      { rule: "edge-crossing", message: "", participantIds: [], relationIds: ["r2", "r3"] },
      { rule: "box-gap", message: "", participantIds: ["b", "c"], relationIds: [] },
    ]);
    expect([...targets.participants]).toEqual(["a", "b", "c"]);
    expect([...targets.labels]).toEqual(["r1"]);
    expect([...targets.edges]).toEqual(["r2", "r3"]);
  });
});

describe("lintLayout over every current definition", () => {
  const subjects = [
    ...patterns.map((d) => ({ area: "patterns", d })),
    ...architectures.map((d) => ({ area: "architecture", d })),
  ];

  it("never throws, only refers to real ids, and reports counts", () => {
    const counts = new Map<LintRule, number>(LINT_RULES.map((r) => [r, 0]));
    const affected = new Map<LintRule, Set<string>>(LINT_RULES.map((r) => [r, new Set()]));
    for (const { area, d } of subjects) {
      const participantIds = new Set(d.participants.map((p) => p.id));
      const relationIds = new Set(d.relations.map((r) => r.id));
      const warnings = lintLayout(d);
      for (const w of warnings) {
        expect(w.message).not.toBe("");
        expect(LINT_RULES).toContain(w.rule);
        for (const id of w.participantIds) expect(participantIds.has(id)).toBe(true);
        for (const id of w.relationIds) expect(relationIds.has(id)).toBe(true);
        counts.set(w.rule, (counts.get(w.rule) ?? 0) + 1);
        affected.get(w.rule)?.add(`${area}/${d.slug}`);
      }
    }
    console.info(
      `layout lint over ${subjects.length} definitions:\n` +
        LINT_RULES.map(
          (r) =>
            `  ${r.padEnd(18)} ${String(counts.get(r)).padStart(4)} warnings in ${affected.get(r)?.size} definitions`,
        ).join("\n"),
    );
    expect(subjects.length).toBeGreaterThan(0);
  });
});
