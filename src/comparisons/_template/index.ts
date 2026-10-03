/**
 * TEMPLATE — copy this folder to `src/comparisons/<your-slug>/` and fill it in.
 * Folders starting with "_" are ignored by the registry, so this file never shows up on the site.
 * See README.md → "Adding a comparison" for details.
 *
 * A comparison has no code or diagram of its own: `code` and `steps` below point at region ids
 * and step indices that already exist on the subjects, so re-read those patterns'/architectures'
 * `index.ts` and `example.*` files before writing any claim here. Every value must be literally
 * true of all four languages.
 */
import type { ComparisonDefinition } from "@/types/comparison";

export const comparison: ComparisonDefinition = {
  slug: "my-comparison", // must match the folder name; used in the URL (#/compare/my-comparison)
  title: "Pattern A vs Pattern B",
  order: 99, // position in the comparison index
  summary: "One line shown on the index card.",
  subjects: [
    { kind: "pattern", slug: "pattern-a" },
    { kind: "pattern", slug: "pattern-b" },
  ],
  problem: "The concrete problem either subject could solve.",
  constraints: ["The forces that decide between them, one per line."],
  dimensions: [{ label: "Intent", values: { "pattern-a": "…", "pattern-b": "…" } }],
  options: [
    {
      subject: "pattern-a",
      changes: "What picking this subject changes about the design.",
      chooseWhen: ["…"],
      code: [{ kind: "pattern", slug: "pattern-a", region: "some-region" }],
      steps: [{ kind: "pattern", slug: "pattern-a", step: 0 }],
    },
    {
      subject: "pattern-b",
      changes: "…",
      chooseWhen: ["…"],
      code: [{ kind: "pattern", slug: "pattern-b", region: "some-region" }],
      steps: [{ kind: "pattern", slug: "pattern-b", step: 0 }],
    },
  ],
  noPattern: {
    when: "When the problem is small enough that neither subject earns its weight.",
    instead: "What to write instead (a plain conditional, a function map, …).",
  },
  // overlap: 'Optional note on how the subjects can be combined or where they overlap.',
  scenario: {
    prompt: 'A concrete "which should I choose?" question for the reader.',
    choices: [
      // `option` (a subject slug or 'none') preselects the ADR export when the reader picks this answer
      {
        id: "pattern-a",
        option: "pattern-a",
        label: "Pattern A",
        verdict: "best",
        explanation: "Why this is the best fit.",
      },
      {
        id: "pattern-b",
        option: "pattern-b",
        label: "Pattern B",
        verdict: "poor",
        explanation: "Why this is a poor fit.",
      },
      {
        id: "no-pattern",
        option: "none",
        label: "No pattern",
        verdict: "workable",
        explanation: "Why this is workable but not ideal.",
      },
    ],
  },
};
