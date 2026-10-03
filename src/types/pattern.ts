import type { ComponentType } from "react";

export type Category =
  | "creational"
  | "structural"
  | "behavioral"
  | "enterprise";

export type ParticipantKind =
  | "class"
  | "interface"
  | "abstract"
  | "client"
  | "object";

/** A box in the diagram: a class, interface, client or runtime object. */
export interface Participant {
  id: string;
  label: string;
  /** Short role in the pattern, e.g. "Concrete Observer". */
  role: string;
  description: string;
  kind?: ParticipantKind;
  /** Centre position in diagram units (default viewBox is 800 × 460). */
  x: number;
  y: number;
  width?: number;
  /**
   * Id of the code region to highlight when selected.
   * Defaults to the participant id if a region with that name exists.
   */
  code?: string;
  /** Slugs of design patterns this box is built with, e.g. `['repository']`. Shown as "Built with" chips. */
  patterns?: string[];
}

export type RelationType =
  | "calls"
  | "creates"
  | "implements"
  | "wraps"
  | "notifies"
  | "holds";

/** An arrow between two participants. */
export interface Relation {
  id: string;
  from: string;
  to: string;
  type: RelationType;
  label?: string;
  description: string;
  /** Bend the arrow sideways (positive/negative) to avoid overlaps. */
  bend?: number;
  code?: string;
}

export interface Packet {
  /** Relation id the packet travels along. */
  relation: string;
  label?: string;
  /** Travel from `to` back to `from` (e.g. a return value). */
  reverse?: boolean;
  /** Start after this earlier packet's animation completes (zero-based index within the step). */
  after?: number;
}

/** One frame of the animated scenario. */
export interface Step {
  title: string;
  description: string;
  /** Participant and relation ids to highlight in this step. */
  highlight: string[];
  packets?: Packet[];
  /** Small badges shown under participants during this step, keyed by participant id. */
  notes?: Record<string, string>;
  /** Code region to highlight while this step is active. */
  code?: string;
}

/** Everything the interactive explorer (`PatternExplorer`) needs to animate and render a diagram. */
export interface ExplorableDefinition {
  slug: string;
  name: string;
  participants: Participant[];
  relations: Relation[];
  steps: Step[];
  /**
   * TypeScript example. Mark regions with `// [id]` … `// [/id]` lines;
   * markers are stripped before display and used for highlighting.
   */
  code: string;
  /**
   * Optional C# example, shown as a second tab next to TypeScript. Use the
   * same `// [id]` … `// [/id]` markers, with the SAME region ids as `code`,
   * so participant/relation/step highlighting works in either language.
   */
  csharp?: string;
  /**
   * Optional Python example, shown as another tab. Same rules as `csharp`,
   * but markers use Python comments: `# [id]` … `# [/id]`.
   */
  python?: string;
  /** Diagram viewBox, defaults to "0 0 800 460". */
  viewBox?: string;
  /** Optional custom scene replacing the generic diagram. */
  Visualization?: ComponentType<VisualizationProps>;
}

export interface VisualizationProps {
  pattern: ExplorableDefinition;
  /** Accent colour (category or paradigm), passed down by PatternExplorer. */
  color: string;
  step: Step | null;
  stepIndex: number;
  speed?: number;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export interface PatternDefinition extends ExplorableDefinition {
  category: Category;
  /** Sort order within its category. */
  order: number;
  /** One line for cards and the sidebar. */
  summary: string;
  intent: string;
  problem: string;
  solution: string;
  analogy: string;
  whenToUse: string[];
  pros: string[];
  cons: string[];
  realWorld: string[];
  /** Slugs of related patterns. */
  related: string[];
}
