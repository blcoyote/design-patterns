/**
 * Shape of one `@pattern` tag collected from the source. Kept in its own file, with no Node
 * imports, so `src/types/virtual-modules.d.ts` (type-checked as part of the app) and
 * `patternUsages.ts` (type-checked as part of the Node/Vite config) can both reference the
 * same type without crossing their tsconfig boundaries.
 */
export interface PatternUsage {
  /** Design-pattern or architecture slug named in the tag. */
  slug: string;
  /** Repo-relative path, forward slashes, e.g. `src/lib/crossRefs.ts`. */
  file: string;
  /** 1-based line number of the tagged declaration (the line after the tag comment). */
  line: number;
  explanation: string;
  snippet: string;
}

/**
 * Layout edits to write back into a definition's `index.ts`. Structurally identical to
 * `LayoutOverrides` in `src/lib/layoutEdit.ts`; it is declared here (without imports) so the
 * Node-side patcher type-checks under the Node tsconfig without reaching into `src/`.
 * Only the listed numeric fields are ever touched. An omitted field means "leave as is".
 */
export interface LayoutPatch {
  /** Participant id → new centre position / width. */
  participants: Record<string, { x?: number; y?: number; width?: number }>;
  /** Relation id → new bend. `0` removes the `bend` property (an absent bend means straight). */
  relations: Record<string, { bend?: number }>;
}
