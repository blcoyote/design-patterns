import { parseCode } from "@/lib/codeRegions";
import type { ExplorableDefinition, PatternDefinition } from "@/types/pattern";

/** Returns a list of authoring mistakes in the diagram/steps/code shared by patterns and architectures. */
export function validateDiagram(p: ExplorableDefinition): string[] {
  const errors: string[] = [];
  const { regions } = parseCode(p.code);
  const csRegions = p.csharp ? parseCode(p.csharp).regions : null;
  const pyRegions = p.python ? parseCode(p.python).regions : null;
  const participantIds = new Set(p.participants.map((x) => x.id));
  const relationIds = new Set(p.relations.map((x) => x.id));
  const ids = new Set([...participantIds, ...relationIds]);

  if (ids.size !== p.participants.length + p.relations.length) {
    errors.push("participant/relation ids must be unique");
  }
  const checkRegion = (where: string, region?: string) => {
    if (!region) return;
    if (!regions[region])
      errors.push(`${where}: unknown code region "${region}"`);
    if (csRegions && !csRegions[region])
      errors.push(`${where}: unknown csharp code region "${region}"`);
    if (pyRegions && !pyRegions[region])
      errors.push(`${where}: unknown python code region "${region}"`);
  };

  for (const part of p.participants)
    checkRegion(`participant ${part.id}`, part.code);
  for (const rel of p.relations) {
    if (!participantIds.has(rel.from))
      errors.push(`relation ${rel.id}: unknown from "${rel.from}"`);
    if (!participantIds.has(rel.to))
      errors.push(`relation ${rel.id}: unknown to "${rel.to}"`);
    checkRegion(`relation ${rel.id}`, rel.code);
  }
  p.steps.forEach((step, i) => {
    for (const id of step.highlight) {
      if (!ids.has(id)) errors.push(`step ${i + 1}: unknown highlight "${id}"`);
    }
    for (const [packetIndex, packet] of (step.packets ?? []).entries()) {
      if (!relationIds.has(packet.relation))
        errors.push(
          `step ${i + 1}: unknown packet relation "${packet.relation}"`,
        );
      if (
        packet.after !== undefined &&
        (!Number.isInteger(packet.after) ||
          packet.after < 0 ||
          packet.after >= packetIndex)
      ) {
        errors.push(
          `step ${i + 1}: packet ${packetIndex} must depend on an earlier packet`,
        );
      }
    }
    for (const id of Object.keys(step.notes ?? {})) {
      if (!participantIds.has(id))
        errors.push(`step ${i + 1}: unknown note target "${id}"`);
    }
    checkRegion(`step ${i + 1}`, step.code);
  });
  return errors;
}

/** Returns a list of authoring mistakes in a pattern definition (empty if valid). */
export function validatePattern(
  p: PatternDefinition,
  allSlugs: string[] = [],
): string[] {
  const errors = validateDiagram(p);
  if (allSlugs.length) {
    for (const slug of p.related) {
      if (!allSlugs.includes(slug))
        errors.push(`unknown related pattern "${slug}"`);
    }
  }
  return errors;
}
