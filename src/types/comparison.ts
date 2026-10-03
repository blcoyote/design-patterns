/** A design pattern or an architecture — the two kinds of thing a comparison can compare. */
export interface SubjectRef {
  kind: "pattern" | "architecture";
  slug: string;
}

/** Points at a code region id that must exist in all four language examples of the subject. */
export interface CodeRef extends SubjectRef {
  region: string;
}

/** Points at a 0-based index into the subject's `steps[]`, for "see it animated" deep links. */
export interface StepRef extends SubjectRef {
  step: number;
}

/**
 * A "which should I choose?" comparison between two or three existing patterns/architectures.
 * There is no comparison-specific code or diagram: everything points back at regions and steps
 * that already exist on the subjects, so three-language parity never has to be maintained twice.
 */
export interface ComparisonDefinition {
  slug: string;
  title: string;
  /** Sort order within the comparison index. */
  order: number;
  /** One line for the index card. */
  summary: string;
  /** The 2–3 options being compared. */
  subjects: SubjectRef[];
  /** The concrete problem any of the subjects could solve. */
  problem: string;
  /** Forces that decide between the subjects. */
  constraints: string[];
  /** Side-by-side table: one row per dimension, one value per subject slug. */
  dimensions: { label: string; values: Record<string, string> }[];
  /** One card per subject: what it changes, when to choose it, and links into its own diagram/code. */
  options: {
    subject: string;
    changes: string;
    chooseWhen: string[];
    code: CodeRef[];
    steps: StepRef[];
  }[];
  /** When none of the subjects earn their weight — a plain conditional or function is enough. */
  noPattern: { when: string; instead: string };
  /** Optional note on how the subjects can be combined or where they overlap. */
  overlap?: string;
  scenario: {
    prompt: string;
    choices: {
      id: string;
      label: string;
      verdict: "best" | "workable" | "poor";
      explanation: string;
      /** The option this answer stands for: a subject slug, or 'none' for "no pattern". Preselects
       * the ADR export. Leave it out when the answer is not a single option (e.g. "both"). */
      option?: string;
    }[];
  };
}
