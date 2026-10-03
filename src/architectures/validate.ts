import { validateDiagram } from '@/patterns/validate'
import type { ArchitectureDefinition, PatternRef } from '@/types/architecture'

function checkRefs(where: string, refs: PatternRef[], validSlugs: string[], selfSlug?: string): string[] {
  const errors: string[] = []
  const seen = new Set<string>()
  for (const ref of refs) {
    if (seen.has(ref.slug)) errors.push(`${where}: duplicate slug "${ref.slug}"`)
    seen.add(ref.slug)
    if (!ref.why.trim()) errors.push(`${where}: "${ref.slug}" is missing a "why"`)
    if (!validSlugs.includes(ref.slug)) errors.push(`${where}: unknown slug "${ref.slug}"`)
    if (selfSlug && ref.slug === selfSlug) errors.push(`${where}: "${ref.slug}" references itself`)
  }
  return errors
}

/** Returns a list of authoring mistakes in an architecture definition (empty if valid). */
export function validateArchitecture(a: ArchitectureDefinition, designSlugs: string[] = [], archSlugs: string[] = []): string[] {
  const errors = validateDiagram(a)

  errors.push(...checkRefs('commonlyUsedWith.designPatterns', a.commonlyUsedWith.designPatterns, designSlugs))
  errors.push(...checkRefs('commonlyUsedWith.architectures', a.commonlyUsedWith.architectures, archSlugs, a.slug))

  const declaredDesignPatterns = new Set(a.commonlyUsedWith.designPatterns.map((r) => r.slug))
  for (const participant of a.participants) {
    for (const slug of participant.patterns ?? []) {
      if (designSlugs.length && !designSlugs.includes(slug)) {
        errors.push(`participant ${participant.id}: unknown design pattern "${slug}"`)
      }
      if (!declaredDesignPatterns.has(slug)) {
        errors.push(`participant ${participant.id}: "${slug}" must also be listed in commonlyUsedWith.designPatterns`)
      }
    }
  }

  return errors
}
