import { describe, expect, it } from "vitest";
import {
  architecturesUsedBy,
  architecturesUsing,
  designPatternsUsedBy,
  patternsReferencedByArchitectures,
  resolveArchitecture,
  resolvePattern,
  resolveSubject,
} from "./crossRefs";

describe("crossRefs", () => {
  it("resolvePattern resolves a known design pattern", () => {
    expect(resolvePattern("repository")).toEqual({
      slug: "repository",
      name: "Repository",
      href: "/patterns/repository",
      color: expect.any(String),
    });
  });

  it("resolvePattern returns undefined for an unknown slug", () => {
    expect(resolvePattern("does-not-exist")).toBeUndefined();
  });

  it("resolveArchitecture resolves a known architecture", () => {
    expect(resolveArchitecture("layered")).toEqual({
      slug: "layered",
      name: "Layered (N-tier)",
      href: "/architecture/layered",
      color: expect.any(String),
    });
  });

  it("resolveArchitecture returns undefined for an unknown slug", () => {
    expect(resolveArchitecture("does-not-exist")).toBeUndefined();
  });

  it("designPatternsUsedBy resolves every declared design-pattern ref for an architecture", () => {
    const refs = designPatternsUsedBy({
      commonlyUsedWith: {
        designPatterns: [{ slug: "repository", why: "because" }],
        architectures: [],
      },
    } as never);
    expect(refs).toEqual([
      {
        slug: "repository",
        name: "Repository",
        href: "/patterns/repository",
        color: expect.any(String),
        why: "because",
      },
    ]);
  });

  it("architecturesUsing derives the reverse index from architectures that reference a design pattern", () => {
    const refs = architecturesUsing("repository");
    expect(refs.length).toBeGreaterThan(0);
    expect(refs.map((r) => r.name)).toContain("Layered (N-tier)");
    expect(refs.every((r) => r.why.trim().length > 0)).toBe(true);
  });

  it("architecturesUsing returns an empty array for a design pattern no architecture declares", () => {
    expect(architecturesUsing("does-not-exist")).toEqual([]);
  });

  it("patternsReferencedByArchitectures includes every design pattern declared by at least one architecture", () => {
    const referenced = patternsReferencedByArchitectures();
    expect(referenced.has("repository")).toBe(true);
    expect(referenced.has("does-not-exist")).toBe(false);
  });

  it("architecturesUsedBy resolves sibling architecture refs", () => {
    expect(
      architecturesUsedBy({ commonlyUsedWith: { designPatterns: [], architectures: [] } } as never),
    ).toEqual([]);
  });

  it("resolveSubject resolves a pattern subject with its definition", () => {
    const resolved = resolveSubject({ kind: "pattern", slug: "repository" });
    expect(resolved).toMatchObject({
      slug: "repository",
      name: "Repository",
      href: "/patterns/repository",
    });
    expect(resolved?.def.slug).toBe("repository");
  });

  it("resolveSubject resolves an architecture subject with its definition", () => {
    const resolved = resolveSubject({ kind: "architecture", slug: "layered" });
    expect(resolved).toMatchObject({
      slug: "layered",
      name: "Layered (N-tier)",
      href: "/architecture/layered",
    });
    expect(resolved?.def.slug).toBe("layered");
  });

  it("resolveSubject returns undefined for an unknown slug", () => {
    expect(resolveSubject({ kind: "pattern", slug: "does-not-exist" })).toBeUndefined();
    expect(resolveSubject({ kind: "architecture", slug: "does-not-exist" })).toBeUndefined();
  });
});
