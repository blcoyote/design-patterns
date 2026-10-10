import { describe, expect, it } from "vitest";
import { emptyLayout, type LayoutOverrides } from "@/lib/layoutEdit";
import {
  historyShortcut,
  initialHistory,
  layoutHistoryReducer as reduce,
  layoutsEqual,
  type LayoutHistoryAction,
  type LayoutHistoryState,
} from "./useLayoutHistory";

const move = (id: string, x: number, y: number): LayoutHistoryAction => ({
  type: "update",
  update: (o) => ({
    ...o,
    participants: { ...o.participants, [id]: { ...o.participants[id], x, y } },
  }),
});
const bend = (id: string, value: number): LayoutHistoryAction => ({
  type: "update",
  update: (o) => ({ ...o, relations: { ...o.relations, [id]: { bend: value } } }),
});
const run = (state: LayoutHistoryState, ...actions: LayoutHistoryAction[]) =>
  actions.reduce(reduce, state);

describe("layoutHistoryReducer", () => {
  it("records a stand-alone update as one undo entry and clears redo", () => {
    let s = run(initialHistory(), move("a", 10, 20));
    expect(s.past).toHaveLength(1);
    s = run(s, { type: "undo" }, move("a", 30, 40));
    expect(s.future).toEqual([]);
    expect(s.past).toHaveLength(1);
  });

  it("coalesces a whole gesture into a single entry", () => {
    const s = run(
      initialHistory(),
      { type: "gestureStart" },
      move("a", 10, 10),
      move("a", 20, 20),
      move("a", 30, 30),
      { type: "gestureEnd" },
    );
    expect(s.past).toEqual([emptyLayout()]);
    expect(s.present.participants.a).toEqual({ x: 30, y: 30 });
    expect(s.gestureBase).toBeNull();
    const undone = run(s, { type: "undo" });
    expect(undone.present).toEqual(emptyLayout());
    expect(undone.past).toEqual([]);
  });

  it("keeps live updates out of history while the gesture is open", () => {
    const s = run(initialHistory(), { type: "gestureStart" }, move("a", 10, 10));
    expect(s.past).toEqual([]);
    expect(s.present.participants.a).toEqual({ x: 10, y: 10 });
  });

  it("two gestures need two undos", () => {
    let s = run(
      initialHistory(),
      { type: "gestureStart" },
      move("a", 10, 10),
      { type: "gestureEnd" },
      { type: "gestureStart" },
      move("a", 50, 50),
      { type: "gestureEnd" },
    );
    expect(s.past).toHaveLength(2);
    s = run(s, { type: "undo" });
    expect(s.present.participants.a).toEqual({ x: 10, y: 10 });
    s = run(s, { type: "undo" });
    expect(s.present).toEqual(emptyLayout());
  });

  it("adds no entry for a gesture that ends where it began", () => {
    const start = run(initialHistory(), move("a", 10, 10));
    const s = run(start, { type: "gestureStart" }, move("a", 99, 99), move("a", 10, 10), {
      type: "gestureEnd",
    });
    expect(s.past).toHaveLength(1);
  });

  it("ignores a second gestureStart, a stray gestureEnd, and undo/redo during a gesture", () => {
    const start = run(initialHistory(), move("a", 10, 10));
    expect(run(start, { type: "gestureEnd" })).toBe(start);
    const open = run(start, { type: "gestureStart" });
    expect(run(open, { type: "gestureStart" })).toBe(open);
    expect(run(open, { type: "undo" })).toBe(open);
    expect(run(open, { type: "redo" })).toBe(open);
    expect(run(open, { type: "reset" })).toBe(open);
  });

  it("redoes what was undone, and a new edit drops the redo stack", () => {
    let s = run(initialHistory(), move("a", 10, 10), move("a", 20, 20));
    s = run(s, { type: "undo" });
    expect(s.present.participants.a).toEqual({ x: 10, y: 10 });
    s = run(s, { type: "redo" });
    expect(s.present.participants.a).toEqual({ x: 20, y: 20 });
    s = run(s, { type: "undo" }, bend("r", 5));
    expect(s.future).toEqual([]);
    expect(run(s, { type: "redo" })).toBe(s);
  });

  it("undo and redo on empty stacks are no-ops", () => {
    const s = initialHistory();
    expect(run(s, { type: "undo" })).toBe(s);
    expect(run(s, { type: "redo" })).toBe(s);
  });

  it("reset clears everything as one undoable entry, and is a no-op when already empty", () => {
    const empty = initialHistory();
    expect(run(empty, { type: "reset" })).toBe(empty);
    let s = run(empty, move("a", 10, 10), bend("r", 30), { type: "reset" });
    expect(s.present).toEqual(emptyLayout());
    s = run(s, { type: "undo" });
    expect(s.present.participants.a).toEqual({ x: 10, y: 10 });
    expect(s.present.relations.r).toEqual({ bend: 30 });
  });

  it("reverts one participant or relation without touching the others", () => {
    const s = run(initialHistory(), move("a", 10, 10), move("b", 20, 20), bend("r", 30));
    const noA = run(s, { type: "revert", target: { kind: "participant", id: "a" } });
    expect(Object.keys(noA.present.participants)).toEqual(["b"]);
    expect(noA.present.relations.r).toEqual({ bend: 30 });
    const noR = run(noA, { type: "revert", target: { kind: "relation", id: "r" } });
    expect(noR.present.relations).toEqual({});
    expect(noR.present.participants.b).toEqual({ x: 20, y: 20 });
    // each revert is undoable
    expect(run(noR, { type: "undo" }).present.relations.r).toEqual({ bend: 30 });
  });

  it("reverting something that is not overridden adds no entry", () => {
    const s = run(initialHistory(), move("a", 10, 10));
    expect(run(s, { type: "revert", target: { kind: "relation", id: "zzz" } })).toBe(s);
  });

  it("starts over once the saved overrides are in the source file", () => {
    const s = run(initialHistory(), move("a", 10, 10), bend("r", 30));
    const after = run(s, { type: "saved", saved: s.present });
    expect(after).toEqual(initialHistory());
  });

  it("keeps edits made while the save was in flight", () => {
    const s = run(initialHistory(), move("a", 10, 10));
    const saving = s.present;
    const edited = run(s, move("a", 20, 20));
    expect(run(edited, { type: "saved", saved: saving })).toBe(edited);
  });

  it("ignores a save confirmation while a gesture is open", () => {
    const s = run(initialHistory(), { type: "gestureStart" }, move("a", 10, 10));
    expect(run(s, { type: "saved", saved: s.present })).toBe(s);
  });

  it("seeds from a restored draft with empty history", () => {
    const draft: LayoutOverrides = { participants: { a: { x: 1 } }, relations: {} };
    const s = initialHistory(draft);
    expect(s.present).toBe(draft);
    expect(s.past).toEqual([]);
  });
});

describe("layoutsEqual", () => {
  it("ignores key order and undefined values", () => {
    expect(
      layoutsEqual(
        { participants: { a: { x: 1, y: 2 } }, relations: {} },
        { participants: { a: { y: 2, x: 1, width: undefined } }, relations: { r: {} } },
      ),
    ).toBe(true);
  });
  it("detects differing values", () => {
    expect(
      layoutsEqual(
        { participants: { a: { x: 1 } }, relations: {} },
        { participants: { a: { x: 2 } }, relations: {} },
      ),
    ).toBe(false);
  });
});

describe("historyShortcut", () => {
  const key = (
    k: string,
    mods: Partial<Record<"ctrlKey" | "metaKey" | "shiftKey" | "altKey", boolean>>,
  ) =>
    historyShortcut({
      key: k,
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      altKey: false,
      ...mods,
    });
  it("maps the documented chords", () => {
    expect(key("z", { ctrlKey: true })).toBe("undo");
    expect(key("z", { metaKey: true })).toBe("undo");
    expect(key("Z", { ctrlKey: true, shiftKey: true })).toBe("redo");
    expect(key("Z", { metaKey: true, shiftKey: true })).toBe("redo");
    expect(key("y", { ctrlKey: true })).toBe("redo");
  });
  it("ignores everything else", () => {
    expect(key("z", {})).toBeNull();
    expect(key("y", { metaKey: true })).toBeNull();
    expect(key("a", { ctrlKey: true })).toBeNull();
    expect(key("z", { ctrlKey: true, altKey: true })).toBeNull();
  });
});
