import { Link } from 'react-router-dom'
import type { ResolvedRef } from '@/lib/crossRefs'

interface Props {
  title: string
  designPatterns?: ResolvedRef[]
  architectures?: ResolvedRef[]
}

/**
 * Links the two areas together: an architecture's "Commonly used with" box lists the design
 * patterns and sibling architectures it declares, a design pattern's box lists the architectures
 * that reference it back (derived, see `lib/crossRefs`). Ring/tint is deliberately different from
 * `Section` so this reads as a cross-link box, not just another text section.
 */
export function CrossReferenceBox({ title, designPatterns = [], architectures = [] }: Props) {
  if (designPatterns.length === 0 && architectures.length === 0) return null

  return (
    <section className="rounded-2xl bg-slate-900/60 p-6 ring-1 ring-inset ring-sky-500/20">
      <h2 className="flex items-center gap-2 text-xs font-semibold tracking-wider text-sky-300 uppercase">
        <svg viewBox="0 0 24 24" className="size-3.5 fill-current" aria-hidden>
          <path d="M3.9 12a5.1 5.1 0 0 1 5.1-5.1h3v1.8h-3a3.3 3.3 0 1 0 0 6.6h3V17h-3A5.1 5.1 0 0 1 3.9 12zm8-0.9h4.2v1.8H11.9v-1.8zM15 6.9h3a5.1 5.1 0 1 1 0 10.2h-3v-1.8h3a3.3 3.3 0 1 0 0-6.6h-3V6.9z" />
        </svg>
        {title}
      </h2>
      <div className="mt-4 grid gap-6 sm:grid-cols-2">
        <RefGroup label="Design patterns" refs={designPatterns} />
        <RefGroup label="Architectural patterns" refs={architectures} />
      </div>
    </section>
  )
}

function RefGroup({ label, refs }: { label: string; refs: ResolvedRef[] }) {
  if (refs.length === 0) return null
  return (
    <div>
      <p className="text-xs font-medium tracking-wider text-slate-500 uppercase">{label}</p>
      <ul className="mt-2 space-y-2">
        {refs.map((ref) => (
          <li key={ref.slug}>
            <Link
              to={ref.href}
              className="block rounded-xl p-3 ring-1 ring-slate-800 transition hover:bg-slate-900 hover:ring-slate-600"
            >
              <span className="text-sm font-semibold" style={{ color: ref.color }}>
                {ref.name}
              </span>
              <span className="mt-1 block text-sm leading-relaxed text-slate-400">{ref.why}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
