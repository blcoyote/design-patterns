import type { ExplorableDefinition } from './pattern'

export type Paradigm = 'oo' | 'functional' | 'both'

/** A link to another pattern or architecture, with a one-sentence reason shown in the cross-reference box. */
export interface PatternRef {
  slug: string
  why: string
}

export interface ArchitectureDefinition extends ExplorableDefinition {
  paradigm: Paradigm
  /** Sort order within the architecture index. */
  order: number
  /** One line for cards and the sidebar. */
  summary: string
  intent: string
  problem: string
  solution: string
  analogy: string
  whenToUse: string[]
  pros: string[]
  cons: string[]
  realWorld: string[]
  /** Key vocabulary (for example DDD's Entity, Value Object, Aggregate). Rendered as a glossary grid. */
  concepts: { term: string; description: string }[]
  /** Variants or close relatives worth naming (for example "Clean Architecture", "Onion"). Optional. */
  variants?: { name: string; description: string }[]
  /**
   * Single source of truth for cross-references: only architectures declare links.
   * Design pattern → architecture is derived (see `lib/crossRefs`); architecture ↔ architecture
   * must be declared symmetrically on both sides (enforced by `architectures/registry.test.ts`).
   */
  commonlyUsedWith: {
    designPatterns: PatternRef[]
    architectures: PatternRef[]
  }
}
