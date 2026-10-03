import { Link, useParams } from 'react-router-dom'
import { CrossReferenceBox } from '@/components/content/CrossReferenceBox'
import { BulletList, ProsCons, Section } from '@/components/content/Section'
import { PatternExplorer } from '@/components/viz/PatternExplorer'
import { paradigms } from '@/architectures/paradigms'
import { architectureNeighbours, getArchitecture } from '@/architectures/registry'
import { architecturesUsedBy, designPatternsUsedBy } from '@/lib/crossRefs'
import { NotFound } from './NotFound'

/** Mirrors PatternPage, with the paradigm badge/colour instead of category, a cross-reference box
 * linking back to the design patterns this architecture is built from, and a concepts glossary. */
export function ArchitecturePage() {
  const { slug } = useParams()
  const architecture = getArchitecture(slug)
  if (!architecture) return <NotFound />

  const meta = paradigms[architecture.paradigm]
  const { prev, next } = architectureNeighbours(architecture.slug)
  const designPatterns = designPatternsUsedBy(architecture)
  const siblingArchitectures = architecturesUsedBy(architecture)

  return (
    <article className="space-y-8">
      <header className="max-w-4xl">
        <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ring-1 ${meta.badge}`}>
          <span className={`size-1.5 rounded-full ${meta.dot}`} />
          {meta.label} architecture
        </span>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-white sm:text-5xl">{architecture.name}</h1>
        <p className="mt-4 text-lg leading-relaxed text-slate-300">{architecture.intent}</p>
      </header>

      <PatternExplorer key={architecture.slug} pattern={architecture} color={meta.color} />

      <CrossReferenceBox
        title={`Commonly used with ${architecture.name}`}
        designPatterns={designPatterns}
        architectures={siblingArchitectures}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Section title="The problem">{architecture.problem}</Section>
        <Section title="The solution">{architecture.solution}</Section>
        <Section title="Real-world analogy">{architecture.analogy}</Section>
      </div>

      <Section title="Key concepts">
        <dl className="grid gap-4 sm:grid-cols-2">
          {architecture.concepts.map((c) => (
            <div key={c.term}>
              <dt className="font-semibold text-white">{c.term}</dt>
              <dd className="mt-0.5 text-sm leading-relaxed text-slate-400">{c.description}</dd>
            </div>
          ))}
        </dl>
      </Section>

      {architecture.variants && architecture.variants.length > 0 && (
        <Section title="Variants">
          <dl className="grid gap-4 sm:grid-cols-2">
            {architecture.variants.map((v) => (
              <div key={v.name}>
                <dt className="font-semibold text-white">{v.name}</dt>
                <dd className="mt-0.5 text-sm leading-relaxed text-slate-400">{v.description}</dd>
              </div>
            ))}
          </dl>
        </Section>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="When to use it">
          <BulletList items={architecture.whenToUse} marker="→" markerClass={meta.text} />
        </Section>
        <Section title="Seen in the wild">
          <BulletList items={architecture.realWorld} />
        </Section>
      </div>

      <ProsCons pros={architecture.pros} cons={architecture.cons} />

      <nav className="flex justify-between gap-4 border-t border-slate-800 pt-6" aria-label="Architecture navigation">
        {prev ? (
          <Link to={`/architecture/${prev.slug}`} className="group text-left">
            <span className="text-xs text-slate-500">← Previous</span>
            <span className="block font-semibold text-slate-200 group-hover:text-white">{prev.name}</span>
          </Link>
        ) : (
          <span />
        )}
        {next && (
          <Link to={`/architecture/${next.slug}`} className="group text-right">
            <span className="text-xs text-slate-500">Next →</span>
            <span className="block font-semibold text-slate-200 group-hover:text-white">{next.name}</span>
          </Link>
        )}
      </nav>
    </article>
  )
}
