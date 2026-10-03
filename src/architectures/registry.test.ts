import { describe, expect, it } from "vitest";
import { findMarkerErrors, parseCode } from "@/lib/codeRegions";
import { patterns } from "@/patterns/registry";
import type { ArchitectureDefinition } from "@/types/architecture";
import { architectures } from "./registry";
import { validateArchitecture } from "./validate";

const designSlugs = patterns.map((p) => p.slug);
const archSlugs = architectures.map((a) => a.slug);

const modules = import.meta.glob<{ architecture: ArchitectureDefinition }>(
  ["./**/index.ts", "!./_*/**"],
  {
    eager: true,
  },
);

describe("architecture registry", () => {
  it("has unique slugs", () => {
    expect(new Set(archSlugs).size).toBe(archSlugs.length);
  });

  it("every architecture lives at ./<paradigm>/<slug>/index.ts", () => {
    // the glob is deliberately broad, so a misplaced index.ts (wrong depth) fails here instead of going unseen
    expect(Object.keys(modules).length).toBe(architectures.length);
    for (const [path, mod] of Object.entries(modules)) {
      const { architecture } = mod;
      expect(path).toBe(`./${architecture.paradigm}/${architecture.slug}/index.ts`);
    }
  });

  it("every slug matches its folder-friendly format", () => {
    for (const slug of archSlugs) expect(slug).toMatch(/^[a-z0-9-]+$/);
  });

  it.each(architectures.map((a) => [a.slug, a] as const))(
    "%s is internally consistent",
    (_slug, a) => {
      expect(validateArchitecture(a, designSlugs, archSlugs)).toEqual([]);
      expect(a.steps.length).toBeGreaterThan(0);
      expect(a.participants.length).toBeGreaterThan(0);
      // architectures must ship all four languages
      expect(a.code.trim()).not.toBe("");
      expect(a.csharp?.trim()).toBeTruthy();
      expect(a.python?.trim()).toBeTruthy();
      expect(a.go?.trim()).toBeTruthy();
    },
  );

  it.each(architectures.map((a) => [a.slug, a] as const))(
    "%s code has no unclosed or stray markers",
    (_slug, a) => {
      expect(findMarkerErrors(a.code)).toEqual([]);
    },
  );

  const withCSharp = architectures.filter((a) => a.csharp);
  it.each(withCSharp.map((a) => [a.slug, a] as const))(
    "%s csharp code has no unclosed or stray markers",
    (_slug, a) => {
      expect(findMarkerErrors(a.csharp!)).toEqual([]);
    },
  );

  it.each(withCSharp.map((a) => [a.slug, a] as const))(
    "%s csharp has no JavaScript template strings",
    (_slug, a) => {
      // backticks outside comments are invalid C#; they usually mean a TS line was copied over unconverted
      expect(a.csharp!.split("\n").filter((line) => line.split("//")[0].includes("`"))).toEqual([]);
    },
  );

  it.each(withCSharp.map((a) => [a.slug, a] as const))(
    "%s csharp regions match the typescript regions",
    (_slug, a) => {
      const tsRegionIds = Object.keys(parseCode(a.code).regions).sort();
      const csRegionIds = Object.keys(parseCode(a.csharp!).regions).sort();
      expect(csRegionIds).toEqual(tsRegionIds);
    },
  );

  const withPython = architectures.filter((a) => a.python);
  it.each(withPython.map((a) => [a.slug, a] as const))(
    "%s python code has no unclosed or stray markers",
    (_slug, a) => {
      expect(findMarkerErrors(a.python!)).toEqual([]);
    },
  );

  it.each(withPython.map((a) => [a.slug, a] as const))(
    "%s python uses # markers, not //",
    (_slug, a) => {
      // a `// [id]` line in Python is a syntax error; it usually means a marker was copied over unconverted
      expect(a.python!.split("\n").filter((line) => /^\s*\/\/ \[/.test(line))).toEqual([]);
    },
  );

  it.each(withPython.map((a) => [a.slug, a] as const))(
    "%s python regions match the typescript regions",
    (_slug, a) => {
      const tsRegionIds = Object.keys(parseCode(a.code).regions).sort();
      const pyRegionIds = Object.keys(parseCode(a.python!).regions).sort();
      expect(pyRegionIds).toEqual(tsRegionIds);
    },
  );

  it("every architecture ships a go example", () => {
    expect(architectures.every((a) => a.go?.trim())).toBe(true);
  });

  it.each(architectures.map((a) => [a.slug, a] as const))(
    "%s go code has no unclosed or stray markers",
    (_slug, a) => {
      expect(findMarkerErrors(a.go!)).toEqual([]);
    },
  );

  it.each(architectures.map((a) => [a.slug, a] as const))(
    "%s go is a runnable package main file",
    (_slug, a) => {
      expect(a.go).toMatch(/^package main$/m);
      expect(a.go).toMatch(/^func main\(\) \{$/m);
    },
  );

  it.each(architectures.map((a) => [a.slug, a] as const))(
    "%s go regions match the typescript regions",
    (_slug, a) => {
      const tsRegionIds = Object.keys(parseCode(a.code).regions).sort();
      const goRegionIds = Object.keys(parseCode(a.go!).regions).sort();
      expect(goRegionIds).toEqual(tsRegionIds);
    },
  );

  it("architecture cross-references are symmetric", () => {
    const bySlug = new Map(architectures.map((a) => [a.slug, a]));
    for (const a of architectures) {
      for (const ref of a.commonlyUsedWith.architectures) {
        const other = bySlug.get(ref.slug);
        expect(other, `"${ref.slug}" referenced by "${a.slug}" does not exist`).toBeDefined();
        const backRef = other?.commonlyUsedWith.architectures.find((r) => r.slug === a.slug);
        expect(
          backRef,
          `"${other?.slug}" must list "${a.slug}" back in commonlyUsedWith.architectures`,
        ).toBeDefined();
      }
    }
  });
});
