import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ComparisonTeaser } from '@/components/content/ComparisonTeaser'
import { CrossReferenceBox } from '@/components/content/CrossReferenceBox'
import { BulletList, ProsCons, Section } from '@/components/content/Section'
import { UsedInThisSite } from '@/components/content/UsedInThisSite'
import { PatternExplorer } from '@/components/viz/PatternExplorer'
import { comparisonsFor } from '@/comparisons/registry'
import { architecturesUsing } from '@/lib/crossRefs'
import { usagesOf } from '@/lib/selfUsage'
import { parseStepParam } from '@/lib/stepParam'
import { categories } from '@/patterns/categories'
import { getPattern, neighbours } from '@/patterns/registry'
import { NotFound } from './NotFound'

export function PatternPage() {
  const { slug } = useParams()
  const [searchParams] = useSearchParams()
  const pattern = getPattern(slug)
  if (!pattern) return <NotFound />

  const cat = categories[pattern.category]
  const { prev, next } = neighbours(pattern.slug)
  const related = pattern.related.map(getPattern).filter((p) => p !== undefined)
  const usedByArchitectures = architecturesUsing(pattern.slug)
  const usages = usagesOf(pattern.slug)
  const comparisons = comparisonsFor(pattern.slug)
  const initialStep = parseStepParam(searchParams.get('step'), pattern.steps.length)

  return (
    <article className="space-y-8">
      <header className="max-w-4xl">
        <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ring-1 ${cat.badge}`}>
          <span className={`size-1.5 rounded-full ${cat.dot}`} />
          {cat.label} pattern
        </span>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-white sm:text-5xl">{pattern.name}</h1>
        <p className="mt-4 text-lg leading-relaxed text-slate-300">{pattern.intent}</p>
      </header>

      <PatternExplorer key={`${pattern.slug}:${initialStep ?? 'auto'}`} pattern={pattern} color={cat.color} initialStep={initialStep} />

      <div className="grid gap-6 lg:grid-cols-3">
        <Section title="The problem">{pattern.problem}</Section>
        <Section title="The solution">{pattern.solution}</Section>
        <Section title="Real-world analogy">{pattern.analogy}</Section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="When to use it">
          <BulletList items={pattern.whenToUse} marker="→" markerClass={cat.text} />
        </Section>
        <Section title="Seen in the wild">
          <BulletList items={pattern.realWorld} />
        </Section>
      </div>

      <ProsCons pros={pattern.pros} cons={pattern.cons} />

      {usedByArchitectures.length > 0 && (
        <CrossReferenceBox title={`Architectural patterns that commonly use ${pattern.name}`} architectures={usedByArchitectures} />
      )}

      <ComparisonTeaser comparisons={comparisons} />

      <UsedInThisSite usages={usages} />

      {related.length > 0 && (
        <Section title="Related patterns">
          <div className="flex flex-wrap gap-3">
            {related.map((r) => (
              <Link
                key={r.slug}
                to={`/patterns/${r.slug}`}
                className="group rounded-xl px-4 py-3 ring-1 ring-slate-800 transition hover:bg-slate-900 hover:ring-slate-600"
              >
                <span className={`text-xs ${categories[r.category].text}`}>{categories[r.category].label}</span>
                <span className="block font-semibold text-white">{r.name}</span>
              </Link>
            ))}
          </div>
        </Section>
      )}

      <nav className="flex justify-between gap-4 border-t border-slate-800 pt-6" aria-label="Pattern navigation">
        {prev ? (
          <Link to={`/patterns/${prev.slug}`} className="group text-left">
            <span className="text-xs text-slate-500">← Previous</span>
            <span className="block font-semibold text-slate-200 group-hover:text-white">{prev.name}</span>
          </Link>
        ) : (
          <span />
        )}
        {next && (
          <Link to={`/patterns/${next.slug}`} className="group text-right">
            <span className="text-xs text-slate-500">Next →</span>
            <span className="block font-semibold text-slate-200 group-hover:text-white">{next.name}</span>
          </Link>
        )}
      </nav>
    </article>
  )
}
