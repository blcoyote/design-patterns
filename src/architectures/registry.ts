import { patterns } from "@/patterns/registry";
import type { ArchitectureDefinition, Paradigm } from "@/types/architecture";
import { paradigmOrder } from "./paradigms";
import { validateArchitecture } from "./validate";

/**
 * Every folder in src/architectures/<paradigm>/<slug> with an index.ts exporting
 * `architecture` is picked up automatically. The template at src/architectures/_template is
 * naturally excluded since it isn't nested one level deeper, but it's also excluded
 * explicitly for clarity.
 */
const modules = import.meta.glob<{ architecture: ArchitectureDefinition }>(
  ["./*/*/index.ts", "!./_*/**"],
  {
    eager: true,
  },
);

export const architectures: ArchitectureDefinition[] = Object.values(modules)
  .map((m) => m.architecture)
  .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));

const bySlug = new Map(architectures.map((a) => [a.slug, a]));

export function getArchitecture(slug: string | undefined): ArchitectureDefinition | undefined {
  return slug ? bySlug.get(slug) : undefined;
}

export function byParadigm(): { paradigm: Paradigm; architectures: ArchitectureDefinition[] }[] {
  return paradigmOrder.map((paradigm) => ({
    paradigm,
    architectures: architectures.filter((a) => a.paradigm === paradigm),
  }));
}

export function architectureNeighbours(slug: string) {
  const i = architectures.findIndex((a) => a.slug === slug);
  return { prev: architectures[i - 1], next: architectures[i + 1] };
}

if (import.meta.env.DEV) {
  const designSlugs = patterns.map((p) => p.slug);
  const archSlugs = architectures.map((a) => a.slug);
  for (const a of architectures) {
    const errors = validateArchitecture(a, designSlugs, archSlugs);
    if (errors.length) console.warn(`[architectures] ${a.slug}:\n  ${errors.join("\n  ")}`);
  }
}
