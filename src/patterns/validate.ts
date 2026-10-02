import { parseCode } from '@/lib/codeRegions'
import type { PatternDefinition } from '@/types/pattern'

/** Returns a list of authoring mistakes in a pattern definition (empty if valid). */
export function validatePattern(p: PatternDefinition, allSlugs: string[] = []): string[] {
  const errors: string[] = []
  const { regions } = parseCode(p.code)
  const participantIds = new Set(p.participants.map((x) => x.id))
  const relationIds = new Set(p.relations.map((x) => x.id))
  const ids = new Set([...participantIds, ...relationIds])

  if (ids.size !== p.participants.length + p.relations.length) {
    errors.push('participant/relation ids must be unique')
  }
  const checkRegion = (where: string, region?: string) => {
    if (region && !regions[region]) errors.push(`${where}: unknown code region "${region}"`)
  }

  for (const part of p.participants) checkRegion(`participant ${part.id}`, part.code)
  for (const rel of p.relations) {
    if (!participantIds.has(rel.from)) errors.push(`relation ${rel.id}: unknown from "${rel.from}"`)
    if (!participantIds.has(rel.to)) errors.push(`relation ${rel.id}: unknown to "${rel.to}"`)
    checkRegion(`relation ${rel.id}`, rel.code)
  }
  p.steps.forEach((step, i) => {
    for (const id of step.highlight) {
      if (!ids.has(id)) errors.push(`step ${i + 1}: unknown highlight "${id}"`)
    }
    for (const packet of step.packets ?? []) {
      if (!relationIds.has(packet.relation)) errors.push(`step ${i + 1}: unknown packet relation "${packet.relation}"`)
    }
    for (const id of Object.keys(step.notes ?? {})) {
      if (!participantIds.has(id)) errors.push(`step ${i + 1}: unknown note target "${id}"`)
    }
    checkRegion(`step ${i + 1}`, step.code)
  })
  if (allSlugs.length) {
    for (const slug of p.related) {
      if (!allSlugs.includes(slug)) errors.push(`unknown related pattern "${slug}"`)
    }
  }
  return errors
}
