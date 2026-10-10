import { readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { patchLayout } from "./layoutPatch.ts";
import type { LayoutPatch } from "./types.ts";

const ROOT = join(import.meta.dirname, "..");

/** A realistic, prettier-shaped definition file around the given array bodies. */
function file(participants: string, relations: string): string {
  return [
    'import type { PatternDefinition } from "@/types/pattern";',
    'import tsExample from "./example.ts?raw";',
    "",
    "export const pattern: PatternDefinition = {",
    '  slug: "demo",',
    '  summary: "Uses participants: [ and relations: [ in prose",',
    "  participants: [",
    participants,
    "  ],",
    "  relations: [",
    relations,
    "  ],",
    "  steps: [],",
    "  code: tsExample,",
    "};",
    "",
  ].join("\n");
}

const box = (id: string, extra = "") =>
  [
    "    {",
    `      id: "${id}",`,
    `      label: "${id}",`,
    '      kind: "class",',
    "      x: 100,",
    "      y: 200,",
    extra,
    '      description: "A box.",',
    "    },",
  ]
    .filter((line) => line !== "")
    .join("\n");

const edge = (id: string, extra = "") =>
  [
    "    {",
    `      id: "${id}",`,
    '      from: "a",',
    '      to: "b",',
    '      type: "calls",',
    extra,
    '      description: "An edge.",',
    "    },",
  ]
    .filter((line) => line !== "")
    .join("\n");

const none: LayoutPatch = { participants: {}, relations: {} };
const moveBox = (id: string, to: { x?: number; y?: number; width?: number }): LayoutPatch => ({
  participants: { [id]: to },
  relations: {},
});
const bendEdge = (id: string, bend: number): LayoutPatch => ({
  participants: {},
  relations: { [id]: { bend } },
});

describe("patchLayout: replace", () => {
  const source = file(
    `${box("a", "      width: 170,")}\n${box("b")}`,
    edge("e", "      bend: 30,"),
  );

  it("replaces x, y, width and bend literals in place and nothing else", () => {
    const out = patchLayout(source, {
      participants: { a: { x: 410, y: 220, width: 180 } },
      relations: { e: { bend: -40 } },
    });
    expect(out).toBe(
      source
        .replace("x: 100,", "x: 410,")
        .replace("y: 200,", "y: 220,")
        .replace("width: 170,", "width: 180,")
        .replace("bend: 30,", "bend: -40,"),
    );
  });

  it("only touches the object with the matching id", () => {
    const out = patchLayout(source, moveBox("b", { x: 1 }));
    const [a, b] = [out.indexOf('id: "a"'), out.indexOf('id: "b"')];
    expect(out.slice(a, b)).toContain("x: 100,");
    expect(out.slice(b)).toContain("x: 1,");
  });

  it("is the identity when the values already match", () => {
    const patch: LayoutPatch = {
      participants: { a: { x: 100, y: 200, width: 170 }, b: { x: 100, y: 200 } },
      relations: { e: { bend: 30 } },
    };
    expect(patchLayout(source, patch)).toBe(source);
    expect(patchLayout(source, none)).toBe(source);
  });

  it("leaves a literal that already equals the value untouched, whatever its spelling", () => {
    const src = file(box("a").replace("x: 100,", "x: 100.0, // centre"), edge("e"));
    expect(patchLayout(src, moveBox("a", { x: 100 }))).toBe(src);
  });

  it("handles negative, decimal and exponent values on both sides", () => {
    const src = file(box("a").replace("x: 100,", "x: -12.5,").replace("y: 200,", "y: .5,"), "");
    const out = patchLayout(src, moveBox("a", { x: -0.25, y: 1e-7 }));
    expect(out).toContain("x: -0.25,");
    expect(out).toContain("y: 1e-7,");
    expect(patchLayout(out, moveBox("a", { x: 7.75, y: -3 }))).toContain("x: 7.75,\n      y: -3,");
  });

  it("writes -0 as 0", () => {
    expect(patchLayout(file(box("a"), ""), moveBox("a", { x: -0 }))).toContain("x: 0,");
  });

  it("keeps trailing comments on replaced properties", () => {
    const src = file(box("a").replace("x: 100,", "x: 100, // centre, not [edge]"), "");
    expect(patchLayout(src, moveBox("a", { x: 5 }))).toContain("x: 5, // centre, not [edge]");
  });

  it("replaces a literal that has no trailing comma", () => {
    const src = file("    { id: 'a', x: 1, y: 2 }", "");
    expect(patchLayout(src, moveBox("a", { y: 9 }))).toBe(file("    { id: 'a', x: 1, y: 9 }", ""));
  });
});

describe("patchLayout: insert", () => {
  it("inserts a missing width after y with the indentation of y", () => {
    const src = file(box("a"), "");
    const out = patchLayout(src, moveBox("a", { width: 170 }));
    expect(out).toBe(src.replace("      y: 200,\n", "      y: 200,\n      width: 170,\n"));
  });

  it("inserts after the later of x/y even when width is present elsewhere", () => {
    const src = file(box("a").replace('      kind: "class",\n', ""), "");
    const out = patchLayout(src, moveBox("a", { width: 99 }));
    expect(out).toContain("      y: 200,\n      width: 99,\n      description");
  });

  it("keeps a trailing comment on the anchor line with the anchor", () => {
    const src = file(box("a").replace("y: 200,", "y: 200, // lowest row"), "");
    const out = patchLayout(src, moveBox("a", { width: 150 }));
    expect(out).toContain("      y: 200, // lowest row\n      width: 150,\n");
  });

  it("inserts a missing x and y after the later of kind and label when the object has neither", () => {
    const src = file('    {\n      id: "a",\n      kind: "client",\n      label: "A",\n    },', "");
    const out = patchLayout(src, moveBox("a", { x: 5, y: 6 }));
    expect(out).toContain('      label: "A",\n      x: 5,\n      y: 6,\n    },');
  });

  it("inserts a missing bend after type", () => {
    const src = file(box("a"), edge("e"));
    const out = patchLayout(src, bendEdge("e", 30));
    expect(out).toBe(
      src.replace('      type: "calls",\n', '      type: "calls",\n      bend: 30,\n'),
    );
  });

  it("inserts a missing bend after the later of type and label", () => {
    const src = file(box("a"), edge("e", '      label: "request",'));
    const out = patchLayout(src, bendEdge("e", -20));
    expect(out).toContain('      label: "request",\n      bend: -20,\n      description');
  });

  it("adds a comma when the anchor is the last property", () => {
    const src = file('    {\n      id: "a",\n      x: 1,\n      y: 2\n    },', "");
    const out = patchLayout(src, moveBox("a", { width: 7 }));
    expect(out).toContain("      y: 2,\n      width: 7\n    },");
  });

  it("inserts inline into a single-line object", () => {
    const src = file('    { id: "a", x: 1, y: 2, kind: "class" },', "");
    expect(patchLayout(src, moveBox("a", { width: 7 }))).toBe(
      file('    { id: "a", x: 1, y: 2, width: 7, kind: "class" },', ""),
    );
  });

  it("inserts several missing properties in x, y, width order", () => {
    const src = file('    {\n      id: "a",\n      label: "A",\n    },', "");
    const out = patchLayout(src, moveBox("a", { width: 3, y: 2, x: 1 }));
    expect(out).toContain('      label: "A",\n      x: 1,\n      y: 2,\n      width: 3,\n    },');
  });

  it("uses the file's CRLF line endings", () => {
    const src = file(box("a"), "").replace(/\n/g, "\r\n");
    const out = patchLayout(src, moveBox("a", { width: 8 }));
    expect(out).toContain("      y: 200,\r\n      width: 8,\r\n");
    expect(out).not.toMatch(/[^\r]\n/);
  });

  it("is stable: patching the result again with the same values changes nothing", () => {
    const src = file(box("a"), edge("e"));
    const patch: LayoutPatch = {
      participants: { a: { x: 1, y: 2, width: 3 } },
      relations: { e: { bend: 4 } },
    };
    const once = patchLayout(src, patch);
    expect(patchLayout(once, patch)).toBe(once);
  });
});

describe("patchLayout: remove", () => {
  it("removes the whole bend line when bend becomes 0", () => {
    const src = file(box("a"), edge("e", "      bend: 30,"));
    expect(patchLayout(src, bendEdge("e", 0))).toBe(src.replace("      bend: 30,\n", ""));
  });

  it("takes a trailing comment on the removed line with it", () => {
    const src = file(box("a"), edge("e", "      bend: 30, // clear of the cache"));
    expect(patchLayout(src, bendEdge("e", 0))).toBe(
      src.replace("      bend: 30, // clear of the cache\n", ""),
    );
  });

  it("removes an inline bend together with the comma that precedes it", () => {
    const src = file("", '    { id: "e", from: "a", to: "b", type: "calls", bend: 30 },');
    expect(patchLayout(src, bendEdge("e", 0))).toBe(
      file("", '    { id: "e", from: "a", to: "b", type: "calls" },'),
    );
  });

  it("removes an inline bend in the middle of a line", () => {
    const src = file("", '    { id: "e", bend: 30, from: "a", to: "b", type: "calls" },');
    expect(patchLayout(src, bendEdge("e", 0))).toBe(
      file("", '    { id: "e", from: "a", to: "b", type: "calls" },'),
    );
  });

  it("does nothing when asked for bend 0 and there is no bend", () => {
    const src = file(box("a"), edge("e"));
    expect(patchLayout(src, bendEdge("e", 0))).toBe(src);
  });

  it("leaves an explicit bend: 0 alone when 0 is requested", () => {
    const src = file(box("a"), edge("e", "      bend: 0,"));
    expect(patchLayout(src, bendEdge("e", 0))).toBe(src);
  });

  it("never removes width, even when it equals the default", () => {
    const src = file(box("a", "      width: 170,"), "");
    const out = patchLayout(src, moveBox("a", { width: 150 }));
    expect(out).toContain("width: 150,");
  });
});

describe("patchLayout: ids and text that merely look like code", () => {
  it("a participant and a relation may share an id; each array is patched independently", () => {
    const src = file(box("shared"), edge("shared", "      bend: 10,"));
    const out = patchLayout(src, {
      participants: { shared: { x: 111 } },
      relations: { shared: { bend: 22 } },
    });
    expect(out).toBe(src.replace("x: 100,", "x: 111,").replace("bend: 10,", "bend: 22,"));
  });

  it("ignores ids and numbers that appear in descriptions, labels and code strings", () => {
    const decoy = [
      "    {",
      '      id: "decoy",',
      '      label: "x: 1, y: 2",',
      "      x: 50,",
      "      y: 60,",
      '      description: "{ id: \\"a\\", x: 999 } and id: \'a\', x: 5, bend: 7 ] ] }",',
      "    },",
    ].join("\n");
    const src = file(`${decoy}\n${box("a")}`, "");
    const out = patchLayout(src, moveBox("a", { x: 7 }));
    expect(out).toBe(src.replace("      x: 100,", "      x: 7,"));
  });

  it("is not fooled by brackets, braces and quotes inside strings", () => {
    const src = file(
      [
        "    {",
        '      id: "tricky",',
        "      x: 1,",
        "      y: 2,",
        "      description: 'calls [handler] } { ) ( \\' and \"quotes\" // not a comment',",
        "    },",
        box("a"),
      ].join("\n"),
      "",
    );
    const out = patchLayout(src, {
      participants: { tricky: { x: 9 }, a: { y: 8 } },
      relations: {},
    });
    expect(out).toBe(src.replace("x: 1,", "x: 9,").replace("y: 200,", "y: 8,"));
  });

  it("is not fooled by template literals with nested ${} expressions", () => {
    const src = file(
      [
        "    {",
        '      id: "tpl",',
        "      x: 1,",
        "      y: 2,",
        "      description: `a [ ${ { id: \"a\", x: 5 }.id + `nested ] ${1 + 1} }` } ] ${'}'} x: 3`,",
        "    },",
        box("a"),
      ].join("\n"),
      "",
    );
    const out = patchLayout(src, { participants: { tpl: { y: 4 }, a: { x: 3 } }, relations: {} });
    expect(out).toBe(src.replace("y: 2,", "y: 4,").replace("x: 100,", "x: 3,"));
  });

  it("is not fooled by comments containing brackets, ids and quotes", () => {
    const src = file(
      [
        '    // { id: "a", x: 1 }, [ it\'s a trap',
        "    /* id: 'a',",
        "       x: 2, ] } */",
        box("a"),
      ].join("\n"),
      "",
    );
    expect(patchLayout(src, moveBox("a", { y: 1 }))).toBe(src.replace("y: 200,", "y: 1,"));
  });

  it("matches ids written with single quotes or backticks", () => {
    const src = file("    { id: 'q', x: 1, y: 2 },\n    { id: `t`, x: 3, y: 4 },", "");
    const out = patchLayout(src, {
      participants: { q: { x: 10 }, t: { y: 40 } },
      relations: {},
    });
    expect(out).toBe(file("    { id: 'q', x: 10, y: 2 },\n    { id: `t`, x: 3, y: 40 },", ""));
  });

  it("only looks at the exported definition's top-level arrays", () => {
    const src = [
      "const helper = { participants: [{ id: 'a', x: 1, y: 1 }] };",
      "export const pattern = {",
      "  steps: [{ participants: [{ id: 'a', x: 2, y: 2 }] }],",
      "  participants: [{ id: 'a', x: 3, y: 3 }],",
      "  relations: [],",
      "};",
    ].join("\n");
    const out = patchLayout(src, moveBox("a", { x: 99 }));
    expect(out).toBe(src.replace("{ id: 'a', x: 3, y: 3 }", "{ id: 'a', x: 99, y: 3 }"));
  });

  it("skips spread elements and non-object entries in the array", () => {
    const src = file(`    ...shared,\n    makeBox(),\n${box("a")}`, "");
    expect(patchLayout(src, moveBox("a", { x: 5 }))).toBe(src.replace("x: 100,", "x: 5,"));
  });

  it("does not need the arrays of an area the patch does not touch", () => {
    const src = "export const architecture = {\n  participants: [{ id: 'a', x: 1, y: 2 }],\n};\n";
    expect(patchLayout(src, moveBox("a", { x: 3 }))).toContain("x: 3");
  });
});

describe("patchLayout: errors", () => {
  const src = file(box("a"), edge("e"));

  it("throws when a participant id is not found", () => {
    expect(() => patchLayout(src, moveBox("nope", { x: 1 }))).toThrow(
      /no participant with id "nope" in "participants"/,
    );
  });

  it("throws when a relation id is not found (and a participant id does not count)", () => {
    expect(() => patchLayout(src, bendEdge("a", 5))).toThrow(
      /no relation with id "a" in "relations"/,
    );
  });

  it("throws when an id appears twice in one array", () => {
    const dup = file(`${box("a")}\n${box("a")}`, "");
    expect(() => patchLayout(dup, moveBox("a", { x: 1 }))).toThrow(/appears more than once/);
  });

  it("throws when the value is not a numeric literal", () => {
    const computed = file(box("a").replace("x: 100,", "x: COL * 2,"), "");
    expect(() => patchLayout(computed, moveBox("a", { x: 1 }))).toThrow(
      /participant "a" x is not a numeric literal \(found `COL \* 2`\)/,
    );
    const hex = file(box("a").replace("x: 100,", "x: 0x10,"), "");
    expect(() => patchLayout(hex, moveBox("a", { x: 1 }))).toThrow(/not a numeric literal/);
    const str = file("", edge("e", '      bend: "30",'));
    expect(() => patchLayout(str, bendEdge("e", 0))).toThrow(/not a numeric literal/);
  });

  it("rejects non-finite values", () => {
    expect(() => patchLayout(src, moveBox("a", { x: Number.NaN }))).toThrow(/finite number/);
    expect(() => patchLayout(src, bendEdge("e", Number.POSITIVE_INFINITY))).toThrow(
      /finite number/,
    );
  });

  it("throws when there is no exported definition", () => {
    expect(() => patchLayout("const x = { participants: [] };", moveBox("a", { x: 1 }))).toThrow(
      /no `export const/,
    );
  });

  it("throws when the array is missing or not a literal", () => {
    expect(() => patchLayout("export const p = { steps: [] };", moveBox("a", { x: 1 }))).toThrow(
      /no top-level "participants"/,
    );
    expect(() =>
      patchLayout("export const p = { participants: boxes };", moveBox("a", { x: 1 })),
    ).toThrow(/"participants" is not an array literal/);
    expect(() => patchLayout("export const p = { participants: [] };", bendEdge("e", 1))).toThrow(
      /no top-level "relations"/,
    );
  });

  it("throws on unterminated strings, comments and brackets", () => {
    expect(() => patchLayout('export const p = { a: "oops\n};', moveBox("a", { x: 1 }))).toThrow(
      /unterminated string/,
    );
    expect(() => patchLayout("export const p = { /* oops };", moveBox("a", { x: 1 }))).toThrow(
      /unterminated block comment/,
    );
    expect(() => patchLayout("export const p = { participants: [", moveBox("a", { x: 1 }))).toThrow(
      /unbalanced/,
    );
  });

  it("never returns a partially patched result when a later id fails", () => {
    expect(() =>
      patchLayout(src, { participants: { a: { x: 1 }, nope: { x: 2 } }, relations: {} }),
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------------------
// Every real definition file
// ---------------------------------------------------------------------------------------

function indexFiles(area: "patterns" | "architectures"): string[] {
  const base = join(ROOT, "src", area);
  const files: string[] = [];
  for (const group of readdirSync(base, { withFileTypes: true })) {
    if (!group.isDirectory() || group.name.startsWith("_")) continue;
    for (const entry of readdirSync(join(base, group.name), { withFileTypes: true })) {
      if (entry.isDirectory() && !entry.name.startsWith("_")) {
        files.push(join(base, group.name, entry.name, "index.ts"));
      }
    }
  }
  return files;
}

const rel = (path: string) => relative(ROOT, path).split(sep).join("/");
const realFiles = [...indexFiles("patterns"), ...indexFiles("architectures")];

interface Layout {
  patch: LayoutPatch;
  /** Participants lacking a width / relations lacking a bend, i.e. where an insert happens. */
  widthless: string[];
  bendless: string[];
}

/** The definition's layout as evaluated by the real module, independent of the patcher's scanner. */
async function currentLayout(file: string): Promise<Layout> {
  const loaded: Record<string, unknown> = await import(file);
  const definition = loaded.pattern ?? loaded.architecture;
  if (typeof definition !== "object" || definition === null) {
    throw new Error(`${rel(file)} exports neither "pattern" nor "architecture"`);
  }
  const participants: LayoutPatch["participants"] = {};
  const relations: LayoutPatch["relations"] = {};
  const widthless: string[] = [];
  const bendless: string[] = [];
  const list = (key: string): unknown[] => {
    const value: unknown = Reflect.get(definition, key);
    return Array.isArray(value) ? value : [];
  };
  const num = (item: unknown, key: string): number | undefined => {
    const value: unknown = typeof item === "object" && item !== null ? Reflect.get(item, key) : 0;
    return typeof value === "number" ? value : undefined;
  };
  const idOf = (item: unknown): string => {
    const id: unknown = typeof item === "object" && item !== null ? Reflect.get(item, "id") : "";
    if (typeof id !== "string") throw new Error(`${rel(file)}: an entry has no string id`);
    return id;
  };
  for (const item of list("participants")) {
    const id = idOf(item);
    participants[id] = { x: num(item, "x"), y: num(item, "y"), width: num(item, "width") };
    if (num(item, "width") === undefined) widthless.push(id);
  }
  for (const item of list("relations")) {
    const id = idOf(item);
    relations[id] = { bend: num(item, "bend") };
    if (num(item, "bend") === undefined) bendless.push(id);
  }
  return { patch: { participants, relations }, widthless, bendless };
}

describe("patchLayout on the real definition files", () => {
  it("finds the pattern and architecture folders", () => {
    expect(realFiles.length).toBeGreaterThanOrEqual(50);
  });

  it.each(realFiles.map((file) => [rel(file), file]))(
    "%s: applying its own current values returns the source unchanged",
    async (_name, file) => {
      const source = await readFile(file, "utf8");
      const { patch } = await currentLayout(file);
      expect(Object.keys(patch.participants).length).toBeGreaterThan(0);
      expect(patchLayout(source, patch)).toBe(source);
    },
  );

  it.each(realFiles.map((file) => [rel(file), file]))(
    "%s: moving every box and bend changes only literals, and reverting restores the source",
    async (_name, file) => {
      const source = await readFile(file, "utf8");
      const { patch, widthless, bendless } = await currentLayout(file);

      const shifted: LayoutPatch = { participants: {}, relations: {} };
      const reverted: LayoutPatch = { participants: {}, relations: {} };
      for (const [id, box] of Object.entries(patch.participants)) {
        shifted.participants[id] = { x: (box.x ?? 0) + 13, y: (box.y ?? 0) - 7 };
        reverted.participants[id] = { x: box.x, y: box.y };
      }
      for (const [id, edge] of Object.entries(patch.relations)) {
        // 0 is "no bend": an explicit `bend: 0` cannot be restored once removed, so keep it as is.
        if (edge.bend === 0) continue;
        shifted.relations[id] = { bend: (edge.bend ?? 0) + 17 };
        reverted.relations[id] = { bend: edge.bend ?? 0 };
      }
      const out = patchLayout(source, shifted);
      expect(out).not.toBe(source);
      // Real files are prettier-formatted, one property per line: a new bend adds one line, and a
      // bend of -17 shifted to 0 is removed, so the line count is predictable.
      const cancelled = Object.values(patch.relations).filter((edge) => edge.bend === -17).length;
      expect(out.split("\n").length).toBe(source.split("\n").length + bendless.length - cancelled);
      // Reverting restores the source exactly: inserted bends go back to 0 (removed again).
      expect(patchLayout(out, reverted)).toBe(source);

      // Inserts: write a width on every box lacking one, then confirm each landed on its own box.
      if (widthless.length > 0) {
        const widths: LayoutPatch = { participants: {}, relations: {} };
        for (const id of widthless) widths.participants[id] = { width: 170 };
        const withWidths = patchLayout(source, widths);
        expect(withWidths.split("\n").length).toBe(source.split("\n").length + widthless.length);
        const again: LayoutPatch = { participants: {}, relations: {} };
        for (const [id, box] of Object.entries(patch.participants)) {
          again.participants[id] = { ...box, width: box.width ?? 170 };
        }
        // Applying the full layout, widths included, is now the identity.
        expect(patchLayout(withWidths, again)).toBe(withWidths);
      }
    },
  );
});
