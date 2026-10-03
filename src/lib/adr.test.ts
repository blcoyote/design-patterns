import { describe, expect, it } from "vitest";
import { comparisons } from "@/comparisons/registry";
import { getPattern } from "@/patterns/registry";
import type { ComparisonDefinition } from "@/types/comparison";
import { adrFilename, buildAdr, NO_PATTERN, type AdrSubject } from "./adr";

const comparison = comparisons.find((c) => c.slug === "strategy-vs-state");
if (!comparison) throw new Error('fixture comparison "strategy-vs-state" not found');

function subjectsFor(c: ComparisonDefinition): AdrSubject[] {
  return c.subjects.map((ref) => {
    const pattern = getPattern(ref.slug);
    if (!pattern) throw new Error(`unknown pattern "${ref.slug}"`);
    return {
      slug: pattern.slug,
      name: pattern.name,
      href: `/patterns/${pattern.slug}`,
      pros: pattern.pros,
      cons: pattern.cons,
    };
  });
}

const subjects = subjectsFor(comparison);
const date = "2026-10-03";
const sourceUrl = "https://example.test/design-patterns/#/compare/strategy-vs-state";

describe("buildAdr", () => {
  it("starts with YAML frontmatter containing the expected keys", () => {
    const adr = buildAdr({ comparison, chosen: "strategy", subjects, date, sourceUrl });
    const lines = adr.split("\n");
    expect(lines[0]).toBe("---");
    const end = lines.indexOf("---", 1);
    expect(end).toBeGreaterThan(0);
    const frontmatter = lines.slice(1, end);

    expect(frontmatter.some((l) => l === 'title: "Use Strategy instead of State"')).toBe(true);
    expect(frontmatter).toContain("status: proposed");
    expect(frontmatter).toContain(`date: ${date}`);
    expect(frontmatter).toContain("decision-makers: []");
    expect(frontmatter.some((l) => l.startsWith("tags: ["))).toBe(true);
    expect(frontmatter.some((l) => /^tags:.*"strategy".*"state"/.test(l))).toBe(true);
    expect(frontmatter).toContain(`source: "${sourceUrl}"`);
    expect(frontmatter).toContain('comparison: "strategy-vs-state"');
  });

  it("escapes quotes and backslashes when building the title", () => {
    const tricky = subjects.map((s) =>
      s.slug === "state" ? { ...s, name: 'A "quoted" name with a backslash \\ in it' } : s,
    );
    const adr = buildAdr({ comparison, chosen: "strategy", subjects: tricky, date, sourceUrl });
    const titleLine = adr.split("\n").find((l) => l.startsWith("title:"));
    expect(titleLine).toBeDefined();
    expect(titleLine).toContain('\\"quoted\\"');
    expect(titleLine).toContain("backslash \\\\ in it");
  });

  it('renders the "no pattern" option when chosen is NO_PATTERN', () => {
    const adr = buildAdr({ comparison, chosen: NO_PATTERN, subjects, date, sourceUrl });
    expect(adr).toContain('title: "Use plain code instead of Strategy or State"');
    expect(adr).toContain('Chosen option: "No pattern (plain code)", because');
    expect(adr).toContain("### No pattern (plain code)");
  });

  it("lists every subject under Considered Options", () => {
    const adr = buildAdr({ comparison, chosen: "strategy", subjects, date, sourceUrl });
    const considered = adr.slice(
      adr.indexOf("## Considered Options"),
      adr.indexOf("## Decision Outcome"),
    );
    for (const subject of subjects) {
      expect(considered).toContain(`* ${subject.name}`);
    }
    expect(considered).toContain("* No pattern (plain code)");
  });

  it("states the decision outcome and consequences for the chosen subject", () => {
    const adr = buildAdr({ comparison, chosen: "strategy", subjects, date, sourceUrl });
    expect(adr).toContain('Chosen option: "Strategy", because');
    const strategy = subjects.find((s) => s.slug === "strategy");
    if (!strategy) throw new Error('expected a "strategy" subject');
    for (const pro of strategy.pros) expect(adr).toContain(`Good: ${pro}`);
    for (const con of strategy.cons) expect(adr).toContain(`Bad: ${con}`);
  });

  it("links every subject and the comparison itself in More Information", () => {
    const adr = buildAdr({ comparison, chosen: "strategy", subjects, date, sourceUrl });
    const moreInfo = adr.slice(adr.indexOf("## More Information"));
    for (const subject of subjects) {
      expect(moreInfo).toContain(`(https://example.test/design-patterns/#${subject.href})`);
    }
    expect(moreInfo).toContain(`(${sourceUrl})`);
  });

  it("is deterministic given the same date and url", () => {
    const a = buildAdr({ comparison, chosen: "state", subjects, date, sourceUrl });
    const b = buildAdr({ comparison, chosen: "state", subjects, date, sourceUrl });
    expect(a).toBe(b);
  });

  it("names the file after the decision", () => {
    expect(adrFilename("strategy", subjects)).toBe("0001-use-strategy-instead-of-state.md");
    expect(adrFilename(NO_PATTERN, subjects)).toBe(
      "0001-use-plain-code-instead-of-strategy-or-state.md",
    );
  });
});
