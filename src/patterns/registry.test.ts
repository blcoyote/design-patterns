import { describe, expect, it } from "vitest";
import { findMarkerErrors, parseCode } from "@/lib/codeRegions";
import { packetAnimationDuration, packetTimeline, stepDuration } from "@/lib/packetTiming";
import type { PatternDefinition } from "@/types/pattern";
import { patterns } from "./registry";
import { validatePattern } from "./validate";

const slugs = patterns.map((p) => p.slug);

const modules = import.meta.glob<{ pattern: PatternDefinition }>(["./**/index.ts", "!./_*/**"], {
  eager: true,
});

describe("pattern registry", () => {
  it("has unique slugs", () => {
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("every pattern lives at ./<category>/<slug>/index.ts", () => {
    // the glob is deliberately broad, so a misplaced index.ts (wrong depth) fails here instead of going unseen
    expect(Object.keys(modules).length).toBe(patterns.length);
    for (const [path, mod] of Object.entries(modules)) {
      const { pattern } = mod;
      expect(path).toBe(`./${pattern.category}/${pattern.slug}/index.ts`);
    }
  });

  it("every slug matches its folder-friendly format", () => {
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9-]+$/);
  });

  it.each(patterns.map((p) => [p.slug, p] as const))("%s is internally consistent", (_slug, p) => {
    expect(validatePattern(p, slugs)).toEqual([]);
    expect(p.steps.length).toBeGreaterThan(0);
    expect(p.participants.length).toBeGreaterThan(0);
  });

  it.each(patterns.map((p) => [p.slug, p] as const))(
    "%s code has no unclosed or stray markers",
    (_slug, p) => {
      expect(findMarkerErrors(p.code)).toEqual([]);
    },
  );

  const withCSharp = patterns.filter((p) => p.csharp);
  it.each(withCSharp.map((p) => [p.slug, p] as const))(
    "%s csharp code has no unclosed or stray markers",
    (_slug, p) => {
      expect(findMarkerErrors(p.csharp!)).toEqual([]);
    },
  );

  it.each(withCSharp.map((p) => [p.slug, p] as const))(
    "%s csharp has no JavaScript template strings",
    (_slug, p) => {
      // backticks outside comments are invalid C#; they usually mean a TS line was copied over unconverted
      expect(p.csharp!.split("\n").filter((line) => line.split("//")[0].includes("`"))).toEqual([]);
    },
  );

  it.each(withCSharp.map((p) => [p.slug, p] as const))(
    "%s csharp regions match the typescript regions",
    (_slug, p) => {
      const tsRegionIds = Object.keys(parseCode(p.code).regions).sort();
      const csRegionIds = Object.keys(parseCode(p.csharp!).regions).sort();
      expect(csRegionIds).toEqual(tsRegionIds);
    },
  );

  const withPython = patterns.filter((p) => p.python);
  it.each(withPython.map((p) => [p.slug, p] as const))(
    "%s python code has no unclosed or stray markers",
    (_slug, p) => {
      expect(findMarkerErrors(p.python!)).toEqual([]);
    },
  );

  it.each(withPython.map((p) => [p.slug, p] as const))(
    "%s python uses # markers, not //",
    (_slug, p) => {
      // a `// [id]` line in Python is a syntax error; it usually means a marker was copied over unconverted
      expect(p.python!.split("\n").filter((line) => /^\s*\/\/ \[/.test(line))).toEqual([]);
    },
  );

  it.each(withPython.map((p) => [p.slug, p] as const))(
    "%s python regions match the typescript regions",
    (_slug, p) => {
      const tsRegionIds = Object.keys(parseCode(p.code).regions).sort();
      const pyRegionIds = Object.keys(parseCode(p.python!).regions).sort();
      expect(pyRegionIds).toEqual(tsRegionIds);
    },
  );
});

describe("pattern go examples", () => {
  it("every pattern ships a go example", () => {
    expect(patterns.every((p) => p.go?.trim())).toBe(true);
  });

  it.each(patterns.map((p) => [p.slug, p] as const))(
    "%s go code has no unclosed or stray markers",
    (_slug, p) => {
      expect(findMarkerErrors(p.go!)).toEqual([]);
    },
  );

  it.each(patterns.map((p) => [p.slug, p] as const))(
    "%s go is a runnable package main file",
    (_slug, p) => {
      expect(p.go).toMatch(/^package main$/m);
      expect(p.go).toMatch(/^func main\(\) \{$/m);
    },
  );

  it.each(patterns.map((p) => [p.slug, p] as const))(
    "%s go regions match the typescript regions",
    (_slug, p) => {
      const tsRegionIds = Object.keys(parseCode(p.code).regions).sort();
      const goRegionIds = Object.keys(parseCode(p.go!).regions).sort();
      expect(goRegionIds).toEqual(tsRegionIds);
    },
  );
});

describe("packet dependencies", () => {
  const singleton = patterns.find((pattern) => pattern.slug === "singleton")!;

  it.each([
    ["command", 3, [undefined, 0]],
    ["template-method", 8, [undefined, 0]],
    ["abstract-factory", 3, [undefined, 0]],
    ["prototype", 5, [undefined, 0]],
    ["bridge", 2, [undefined, 0]],
    ["plugin", 5, [undefined, 0]],
    ["proxy", 3, [undefined, 0]],
    ["iterator", 2, [undefined, 0]],
    ["memento", 3, [undefined, 0]],
    ["state", 8, [undefined, 0, 1]],
    ["strategy", 2, [undefined, 0]],
    ["interpreter", 5, [undefined, 0, 1]],
    ["decorator", 3, [undefined, 0]],
    ["cache-aside", 1, [undefined, 0, 1, 2, 3]],
    ["circuit-breaker", 4, [undefined, 0, 1]],
    ["null-object", 7, [undefined, 0]],
    ["object-pool", 2, [undefined, 0, 1]],
    ["pub-sub", 7, [undefined, 0, 0]],
    ["builder", 2, [undefined, 0]],
    ["flyweight", 5, [undefined, 0]],
  ] as const)("%s step %s preserves its causal dependencies", (slug, number, expected) => {
    const pattern = patterns.find((item) => item.slug === slug)!;
    expect(pattern.steps[number - 1].packets?.map((packet) => packet.after)).toEqual(expected);
  });

  it("Singleton returns wait for their requests", () => {
    for (const step of singleton.steps.slice(1, 3)) {
      expect(step.packets).toEqual([
        { relation: step.packets![0].relation, label: "getInstance()" },
        {
          relation: step.packets![0].relation,
          label: "instance",
          reverse: true,
          after: 0,
        },
      ]);
    }
    expect(validatePattern(singleton, slugs)).toEqual([]);
  });

  it.each([-1, 1, 2, 0.5, NaN])("rejects invalid dependency %s", (after) => {
    const invalid = {
      ...singleton,
      steps: [
        {
          ...singleton.steps[1],
          packets: [{ relation: "user-get" }, { relation: "user-get", after }],
        },
      ],
    };
    expect(validatePattern(invalid)).toContain("step 1: packet 1 must depend on an earlier packet");
  });

  it("rejects an unsequenced chain", () => {
    const invalid = {
      ...singleton,
      steps: [
        {
          ...singleton.steps[1],
          packets: [{ relation: "user-get" }, { relation: "user-get", reverse: true }],
        },
      ],
    };
    expect(validatePattern(invalid)).toContain(
      'step 1: packet 1 continues packet 0; sequence it with "after"',
    );
  });

  it("rejects a dependency on the packet itself", () => {
    const invalid = {
      ...singleton,
      steps: [
        {
          ...singleton.steps[1],
          packets: [{ relation: "user-get", after: 0 }],
        },
      ],
    };
    expect(validatePattern(invalid)).toContain("step 1: packet 0 must depend on an earlier packet");
  });
});

describe("packet sequence timing", () => {
  it("keeps the existing request/response duration", () => {
    expect(packetAnimationDuration([{ relation: "call" }, { relation: "call", after: 0 }])).toBe(
      1.4,
    );
  });

  it("does not count parallel branches as sequential hops", () => {
    expect(
      packetAnimationDuration([
        { relation: "publish" },
        { relation: "email", after: 0 },
        { relation: "analytics", after: 0 },
        { relation: "inventory", after: 0 },
      ]),
    ).toBe(1.4);
  });

  const baseStep = { title: "", description: "", highlight: [] };
  const chain = [
    { relation: "request" },
    { relation: "cache", after: 0 },
    { relation: "database", after: 1 },
    { relation: "result", after: 2 },
    { relation: "populate", after: 3 },
  ];

  it("keeps every hop of a long chain at a readable speed", () => {
    expect(packetAnimationDuration(chain)).toBe(1.4);
  });

  it.each([0.5, 1, 2])("holds a step until its whole chain has run at speed %s", (speed) => {
    const duration = stepDuration({ ...baseStep, packets: chain }, speed);
    expect(duration).toBeGreaterThan(packetTimeline(chain, speed) * 1000);
    expect(duration).toBeCloseTo((5 * 1400 + 800) / speed);
  });

  it("keeps the base interval for short steps", () => {
    expect(stepDuration({ ...baseStep, packets: [] }, 2)).toBe(1600);
    expect(
      stepDuration({
        ...baseStep,
        packets: [{ relation: "a" }, { relation: "b" }],
      }),
    ).toBe(3200);
  });
});

describe("findMarkerErrors", () => {
  it("reports unmatched, unclosed, duplicate and inline markers", () => {
    expect(findMarkerErrors("// [a]\nx\n// [/a]")).toEqual([]);
    expect(findMarkerErrors("// [/a]")).toEqual(['line 1: "[/a]" has no matching opening marker']);
    expect(findMarkerErrors("// [a]\nx")).toEqual(['region "a" is never closed']);
    expect(findMarkerErrors("// [a]\n// [/a]\n// [a]\n// [/a]")).toEqual([
      'line 3: region "a" opened twice',
    ]);
    expect(findMarkerErrors("foo() // [a]")).toEqual(["line 1: marker must be on its own line"]);
    expect(findMarkerErrors("# [a]\nx\n# [/a]")).toEqual([]);
    expect(findMarkerErrors("foo()  # [a]")).toEqual(["line 1: marker must be on its own line"]);
  });
});

describe("parseCode", () => {
  it("strips markers and records nested regions", () => {
    const { text, regions } = parseCode("// [a]\nline1\n// [b]\nline2\n// [/b]\n// [/a]\nline3");
    expect(text).toBe("line1\nline2\nline3");
    expect(regions).toEqual({ a: [1, 2], b: [2, 2] });
  });

  it("accepts Python # markers", () => {
    const { text, regions } = parseCode("# [a]\nx = 1\n    # [b]\n    y = 2\n    # [/b]\n# [/a]");
    expect(text).toBe("x = 1\n    y = 2");
    expect(regions).toEqual({ a: [1, 2], b: [2, 2] });
  });
});
