import type { ComparisonDefinition } from "@/types/comparison";

/** Special `chosen` value meaning "none of the subjects — plain code is enough". */
export const NO_PATTERN = "none";

/** Minimal info `buildAdr` needs about a resolved subject. Deliberately not `ResolvedSubject`
 * from `lib/crossRefs` (which carries a whole `ExplorableDefinition`) — this module only needs
 * a handful of fields, and keeping its own shape means it never has to import either registry. */
export interface AdrSubject {
  slug: string;
  name: string;
  href: string;
  pros: string[];
  cons: string[];
}

export interface BuildAdrInput {
  comparison: ComparisonDefinition;
  /** A slug from `comparison.subjects`, or `NO_PATTERN` ('none') for "no pattern at all". */
  chosen: string;
  /** Resolved subjects — one per `comparison.subjects` entry, same order not required. */
  subjects: AdrSubject[];
  /** ISO date (yyyy-mm-dd). Passed in rather than read with `new Date()` so the output stays
   * deterministic and testable. */
  date: string;
  /** Absolute URL of the comparison page the ADR was generated from, e.g.
   * `https://host/#/compare/strategy-vs-state`. The origin + pathname before the `#` is reused
   * to build absolute links to the subjects' own pages in "More information". */
  sourceUrl: string;
}

/** Double-quotes a YAML scalar, escaping backslashes and double quotes. A full YAML writer would
 * be overkill for the handful of plain-text values this frontmatter ever holds. */
function yamlString(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function yamlStringArray(values: string[]): string {
  return `[${values.map(yamlString).join(", ")}]`;
}

function stripTrailingPunctuation(text: string): string {
  return text.replace(/[.!?]+\s*$/, "");
}

/** "A", "A or B", "A, B or C". */
function orList(names: string[]): string {
  return names.length < 2
    ? (names[0] ?? "")
    : `${names.slice(0, -1).join(", ")} or ${names[names.length - 1]}`;
}

/** The decision as a headline: "Use Strategy instead of State", "Use plain code instead of Strategy or State". */
function decisionTitle(chosen: AdrSubject | undefined, subjects: AdrSubject[]): string {
  const others = subjects.filter((s) => s !== chosen).map((s) => s.name);
  return `Use ${chosen?.name ?? "plain code"} instead of ${orList(others)}`;
}

function kebabCase(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Filename for the generated ADR, following MADR's numbered-file convention — a fresh decisions
 * folder starts at `0001`; a project that already has decisions renumbers on adopting this one. */
export function adrFilename(chosen: string, subjects: AdrSubject[]): string {
  return `0001-${kebabCase(
    decisionTitle(
      subjects.find((s) => s.slug === chosen),
      subjects,
    ),
  )}.md`;
}

function bulletList(items: string[]): string {
  return items.length > 0 ? items.map((item) => `* ${item}`).join("\n") : "* (none)";
}

const NO_PATTERN_NAME = "No pattern (plain code)";

function noPatternLines(comparison: ComparisonDefinition): string[] {
  return [
    `* Good: ${comparison.noPattern.instead}`,
    `* Bad: Only fits while this holds: ${stripTrailingPunctuation(comparison.noPattern.when)}. Past that, it stops scaling.`,
  ];
}

function subjectProsAndCons(subject: AdrSubject, comparison: ComparisonDefinition): string {
  const dimensionLines = comparison.dimensions.map(
    (d) => `* **${d.label}:** ${d.values[subject.slug] ?? "—"}`,
  );
  const prosLines = subject.pros.map((p) => `* Good: ${p}`);
  const consLines = subject.cons.map((c) => `* Bad: ${c}`);
  return [`### ${subject.name}`, "", ...dimensionLines, "", ...prosLines, ...consLines].join("\n");
}

function noPatternProsAndCons(comparison: ComparisonDefinition): string {
  return [`### ${NO_PATTERN_NAME}`, "", ...noPatternLines(comparison)].join("\n");
}

/**
 * Renders a comparison and a chosen option as a MADR-style (madr.github.io) architecture
 * decision record, ready to drop into a new project's `docs/decisions/`. Pure and deterministic:
 * every piece of "now" (the date, the page URL) is passed in rather than read from the
 * environment, so the same input always produces the same Markdown.
 */
export function buildAdr(input: BuildAdrInput): string {
  const { comparison, chosen, subjects, date, sourceUrl } = input;
  const chosenSubject = subjects.find((s) => s.slug === chosen);
  const chosenOption = comparison.options.find((o) => o.subject === chosen);
  const chosenName = chosenSubject?.name ?? NO_PATTERN_NAME;
  const title = decisionTitle(chosenSubject, subjects);
  const kinds = [...new Set(comparison.subjects.map((s) => s.kind))];
  const base = sourceUrl.split("#")[0];

  const frontmatter = [
    "---",
    `title: ${yamlString(title)}`,
    "status: proposed",
    `date: ${date}`,
    "decision-makers: []",
    `tags: ${yamlStringArray([...kinds, ...comparison.subjects.map((s) => s.slug)])}`,
    `source: ${yamlString(sourceUrl)}`,
    `comparison: ${yamlString(comparison.slug)}`,
    "---",
  ].join("\n");

  const reasons =
    chosen === NO_PATTERN
      ? [stripTrailingPunctuation(comparison.noPattern.when) + "."]
      : (chosenOption?.chooseWhen ?? []);

  const considered = [...subjects.map((s) => `* ${s.name}`), `* ${NO_PATTERN_NAME}`].join("\n");

  const consequences =
    chosen === NO_PATTERN
      ? noPatternLines(comparison).join("\n")
      : bulletList([
          ...(chosenSubject?.pros.map((p) => `Good: ${p}`) ?? []),
          ...(chosenSubject?.cons.map((c) => `Bad: ${c}`) ?? []),
        ]);

  const prosAndCons = [
    ...subjects.map((s) => subjectProsAndCons(s, comparison)),
    noPatternProsAndCons(comparison),
  ].join("\n\n");

  const moreInfo = [
    ...subjects.map((s) => `* [${s.name}](${base}#${s.href})`),
    `* [${comparison.title} (comparison)](${sourceUrl})`,
  ].join("\n");

  return [
    frontmatter,
    "",
    `# ${title}`,
    "",
    "## Context and Problem Statement",
    "",
    "<!-- Replace with your project's context -->",
    "",
    comparison.problem,
    "",
    "## Decision Drivers",
    "",
    bulletList(comparison.constraints),
    "",
    "## Considered Options",
    "",
    considered,
    "",
    "## Decision Outcome",
    "",
    `Chosen option: "${chosenName}", because these conditions hold:`,
    "",
    bulletList(reasons),
    "",
    "### Consequences",
    "",
    consequences,
    "",
    "## Pros and Cons of the Options",
    "",
    prosAndCons,
    "",
    "## More Information",
    "",
    moreInfo,
    "",
  ].join("\n");
}
