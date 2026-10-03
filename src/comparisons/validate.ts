import { parseCode } from '@/lib/codeRegions'
import type { ComparisonDefinition, SubjectRef } from '@/types/comparison'
import type { ExplorableDefinition } from '@/types/pattern'

/** Shape `validateComparison` needs back from a subject reference — just enough to check
 * regions and step ranges, without importing either registry itself (see `lib/crossRefs`). */
export type SubjectResolver = (ref: SubjectRef) => { def: ExplorableDefinition } | undefined

/**
 * Returns a list of authoring mistakes in a comparison definition (empty if valid). Takes the
 * resolver as a parameter — modeled on `DetailPanel`'s `resolvePattern` prop — so this module
 * never imports `patterns/registry` or `architectures/registry` directly.
 */
export function validateComparison(c: ComparisonDefinition, resolveSubject: SubjectResolver): string[] {
  const errors: string[] = []
  const subjectSlugs = new Set(c.subjects.map((s) => s.slug))
  const defsBySlug = new Map<string, ExplorableDefinition>()

  if (subjectSlugs.size !== c.subjects.length) errors.push('subjects: duplicate slug')

  for (const subject of c.subjects) {
    const resolved = resolveSubject(subject)
    if (!resolved) {
      errors.push(`subject "${subject.slug}" (${subject.kind}) does not resolve`)
      continue
    }
    defsBySlug.set(subject.slug, resolved.def)
  }

  for (const dim of c.dimensions) {
    for (const slug of Object.keys(dim.values)) {
      if (!subjectSlugs.has(slug)) errors.push(`dimension "${dim.label}": "${slug}" is not a declared subject`)
    }
    for (const slug of subjectSlugs) {
      if (!(slug in dim.values)) errors.push(`dimension "${dim.label}": missing a value for "${slug}"`)
    }
  }

  const optionSubjects = new Set<string>()
  const checkRegion = (where: string, def: ExplorableDefinition, region: string) => {
    if (!parseCode(def.code).regions[region]) errors.push(`${where}: unknown typescript region "${region}"`)
    if (def.csharp && !parseCode(def.csharp).regions[region]) errors.push(`${where}: unknown csharp region "${region}"`)
    if (def.python && !parseCode(def.python).regions[region]) errors.push(`${where}: unknown python region "${region}"`)
  }

  for (const option of c.options) {
    const where = `option "${option.subject}"`
    if (!subjectSlugs.has(option.subject)) errors.push(`${where}: not a declared subject`)
    optionSubjects.add(option.subject)

    for (const ref of option.code) {
      const def = defsBySlug.get(ref.slug)
      if (!def) {
        errors.push(`${where}: code ref "${ref.slug}" does not resolve`)
        continue
      }
      checkRegion(`${where}: code ref "${ref.slug}"`, def, ref.region)
    }

    for (const ref of option.steps) {
      const def = defsBySlug.get(ref.slug)
      if (!def) {
        errors.push(`${where}: step ref "${ref.slug}" does not resolve`)
        continue
      }
      if (!Number.isInteger(ref.step) || ref.step < 0 || ref.step >= def.steps.length) {
        errors.push(`${where}: step ${ref.step} out of range for "${ref.slug}" (has ${def.steps.length} steps)`)
      }
    }
  }
  for (const slug of subjectSlugs) {
    if (!optionSubjects.has(slug)) errors.push(`subject "${slug}" has no option`)
  }

  const choiceIds = new Set<string>()
  let bestCount = 0
  for (const choice of c.scenario.choices) {
    if (choiceIds.has(choice.id)) errors.push(`scenario: duplicate choice id "${choice.id}"`)
    choiceIds.add(choice.id)
    if (!choice.explanation.trim()) errors.push(`scenario: choice "${choice.id}" is missing an explanation`)
    if (choice.verdict === 'best') bestCount++
    if (choice.option !== undefined && choice.option !== 'none' && !subjectSlugs.has(choice.option)) {
      errors.push(`scenario: choice "${choice.id}" names unknown option "${choice.option}"`)
    }
  }
  if (bestCount !== 1) errors.push(`scenario: expected exactly one "best" choice, found ${bestCount}`)

  return errors
}
