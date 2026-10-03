import { patternUsages } from "virtual:pattern-usages";

/** The site deploys from `main`, so a line number here always matches the deployed code. */
const REPO_BASE = "https://github.com/blcoyote/design-patterns/blob/main";

export interface SelfUsage {
  slug: string;
  file: string;
  line: number;
  explanation: string;
  snippet: string;
  /** GitHub link to the tagged line, opened in a new tab from `UsedInThisSite`. */
  githubUrl: string;
}

const bySlug = new Map<string, SelfUsage[]>();
for (const usage of patternUsages) {
  const resolved: SelfUsage = { ...usage, githubUrl: `${REPO_BASE}/${usage.file}#L${usage.line}` };
  const list = bySlug.get(usage.slug);
  if (list) list.push(resolved);
  else bySlug.set(usage.slug, [resolved]);
}

/** Usages of a pattern or architecture slug tagged in this site's own source, file order. */
export function usagesOf(slug: string): SelfUsage[] {
  return bySlug.get(slug) ?? [];
}

/** Every slug tagged at least once — used to badge cards and sidebar entries. */
export function usedSlugs(): Set<string> {
  return new Set(bySlug.keys());
}
