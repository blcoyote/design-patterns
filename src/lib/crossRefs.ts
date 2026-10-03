// @pattern facade: the only module that imports both registries — pages ask it one question instead of combining two registries themselves
import { architectures, getArchitecture } from '@/architectures/registry'
import { paradigms } from '@/architectures/paradigms'
import { categories } from '@/patterns/categories'
import { getPattern, patterns } from '@/patterns/registry'
import type { ArchitectureDefinition } from '@/types/architecture'
import type { SubjectRef } from '@/types/comparison'
import type { ExplorableDefinition } from '@/types/pattern'

/**
 * The only module allowed to import both `patterns/registry` and `architectures/registry`.
 * Keeping the cross-reference logic here (instead of in either registry) is what lets
 * `patterns/registry` stay free of architecture imports.
 */

export interface ResolvedLink {
  slug: string
  name: string
  href: string
  color: string
}

export interface ResolvedRef extends ResolvedLink {
  why: string
}

/** Design patterns an architecture is commonly built with, resolved to link-ready data. */
export function designPatternsUsedBy(architecture: ArchitectureDefinition): ResolvedRef[] {
  return architecture.commonlyUsedWith.designPatterns
    .map((ref) => {
      const resolved = resolvePattern(ref.slug)
      return resolved ? { ...resolved, why: ref.why } : undefined
    })
    .filter((r) => r !== undefined)
}

/** Sibling architectures an architecture is commonly used with, resolved to link-ready data. */
export function architecturesUsedBy(architecture: ArchitectureDefinition): ResolvedRef[] {
  return architecture.commonlyUsedWith.architectures
    .map((ref) => {
      const resolved = resolveArchitecture(ref.slug)
      return resolved ? { ...resolved, why: ref.why } : undefined
    })
    .filter((r) => r !== undefined)
}

// @pattern cqrs: the reverse links are a read model projected from the single write side (commonlyUsedWith)
/**
 * Reverse index: which architectures declare `designSlug` in their `commonlyUsedWith.designPatterns`,
 * and why. Design patterns never declare their own architecture links — this is derived.
 */
export function architecturesUsing(designSlug: string): ResolvedRef[] {
  return architectures
    .flatMap((a) => a.commonlyUsedWith.designPatterns.filter((ref) => ref.slug === designSlug).map((ref) => ({ architecture: a, why: ref.why })))
    .map(({ architecture, why }) => ({ ...resolveArchitecture(architecture.slug)!, why }))
}

// @pattern adapter: resolvePattern and resolveArchitecture turn two different definition shapes into one ResolvedLink
/** Resolves a design-pattern slug to the shape `DetailPanel`'s "Built with" chips and
 * `CrossReferenceBox` need. Returns `undefined` for an unknown slug. */
export function resolvePattern(slug: string): ResolvedLink | undefined {
  const pattern = getPattern(slug)
  if (!pattern) return undefined
  return { slug: pattern.slug, name: pattern.name, href: `/patterns/${pattern.slug}`, color: categories[pattern.category].color }
}

/** Resolves an architecture slug the same way `resolvePattern` resolves a design pattern. */
export function resolveArchitecture(slug: string): ResolvedLink | undefined {
  const architecture = getArchitecture(slug)
  if (!architecture) return undefined
  return { slug: architecture.slug, name: architecture.name, href: `/architecture/${architecture.slug}`, color: paradigms[architecture.paradigm].color }
}

/** All design-pattern slugs referenced by at least one architecture — used to decide whether
 * `PatternPage` should render a `CrossReferenceBox` at all. */
export function patternsReferencedByArchitectures(): Set<string> {
  return new Set(patterns.map((p) => p.slug).filter((slug) => architecturesUsing(slug).length > 0))
}

export interface ResolvedSubject extends ResolvedLink {
  def: ExplorableDefinition
}

// @pattern facade: resolveSubject hides the pattern-vs-architecture branch behind one call, so
// `comparisons/registry.ts` and `comparisons/validate.ts` never import either registry directly
/** Resolves a comparison subject (pattern or architecture) to its definition plus link-ready data. */
export function resolveSubject(ref: SubjectRef): ResolvedSubject | undefined {
  if (ref.kind === 'pattern') {
    const pattern = getPattern(ref.slug)
    return pattern ? { ...resolvePattern(ref.slug)!, def: pattern } : undefined
  }
  const architecture = getArchitecture(ref.slug)
  return architecture ? { ...resolveArchitecture(ref.slug)!, def: architecture } : undefined
}
