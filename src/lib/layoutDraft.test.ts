import { afterEach, describe, expect, it, vi } from "vitest";
import { layoutDraftKey, loadLayoutDraft, parseLayoutDraft, saveLayoutDraft } from "./layoutDraft";

const def = {
  participants: [
    { id: "a", label: "A", role: "A", description: "", x: 0, y: 0 },
    { id: "b", label: "B", role: "B", description: "", x: 0, y: 0 },
  ],
  relations: [{ id: "ab", from: "a", to: "b", type: "calls" as const, description: "" }],
};

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("parseLayoutDraft", () => {
  it("keeps valid numeric values for known ids", () => {
    const raw = JSON.stringify({
      participants: { a: { x: 10, y: 20, width: 160 } },
      relations: { ab: { bend: -30 } },
    });
    expect(parseLayoutDraft(raw, def)).toEqual({
      participants: { a: { x: 10, y: 20, width: 160 } },
      relations: { ab: { bend: -30 } },
    });
  });

  it("drops ids that no longer exist in the definition", () => {
    const raw = JSON.stringify({
      participants: { a: { x: 1 }, gone: { x: 2 } },
      relations: { ab: { bend: 5 }, gone: { bend: 9 } },
    });
    const out = parseLayoutDraft(raw, def);
    expect(Object.keys(out.participants)).toEqual(["a"]);
    expect(Object.keys(out.relations)).toEqual(["ab"]);
  });

  it("drops non-numeric values, unknown fields and empty entries", () => {
    const raw = JSON.stringify({
      participants: { a: { x: "10", y: null, z: 4 }, b: { x: 3, y: Infinity } },
      relations: { ab: { bend: "30" } },
    });
    expect(parseLayoutDraft(raw, def)).toEqual({
      participants: { b: { x: 3 } },
      relations: {},
    });
  });

  it.each([null, "", "not json", "null", "[]", '"s"', "42", '{"participants":[],"relations":5}'])(
    "falls back to empty for %j",
    (raw) => {
      expect(parseLayoutDraft(raw, def)).toEqual({ participants: {}, relations: {} });
    },
  );
});

describe("draft storage", () => {
  it("round-trips through localStorage under dev-layout:<area>/<slug>", () => {
    const store = fakeStorage();
    vi.stubGlobal("localStorage", store);
    saveLayoutDraft("patterns", "observer", { participants: { a: { x: 7 } }, relations: {} });
    expect([...store.data.keys()]).toEqual(["dev-layout:patterns/observer"]);
    expect(layoutDraftKey("patterns", "observer")).toBe("dev-layout:patterns/observer");
    expect(loadLayoutDraft("patterns", "observer", def).participants.a).toEqual({ x: 7 });
  });

  it("removes the entry when saving an empty draft", () => {
    const store = fakeStorage({ "dev-layout:patterns/observer": "{}" });
    vi.stubGlobal("localStorage", store);
    saveLayoutDraft("patterns", "observer", { participants: {}, relations: {} });
    expect(store.data.size).toBe(0);
  });

  it("never throws when storage is missing or throws", () => {
    // no localStorage global in the node test environment
    expect(loadLayoutDraft("patterns", "x", def)).toEqual({ participants: {}, relations: {} });
    expect(() =>
      saveLayoutDraft("patterns", "x", { participants: { a: { x: 1 } }, relations: {} }),
    ).not.toThrow();
    const throwing = () => {
      throw new Error("blocked");
    };
    vi.stubGlobal("localStorage", { getItem: throwing, setItem: throwing, removeItem: throwing });
    expect(loadLayoutDraft("patterns", "x", def)).toEqual({ participants: {}, relations: {} });
    expect(() =>
      saveLayoutDraft("patterns", "x", { participants: { a: { x: 1 } }, relations: {} }),
    ).not.toThrow();
  });
});
