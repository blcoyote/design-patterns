import { motion } from 'motion/react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { UsedBadge } from '@/components/content/UsedInThisSite'
import { comparisons } from '@/comparisons/registry'
import { categories, categoryOrder } from '@/patterns/categories'
import { patterns } from '@/patterns/registry'
import { usedSlugs } from '@/lib/selfUsage'
import type { Category } from '@/types/pattern'

const USED_IN_SITE = 'used-in-site'

export function HomePage() {
  const [filter, setFilter] = useState<Category | 'all' | typeof USED_IN_SITE>('all')
  const used = usedSlugs()
  const shown =
    filter === 'all' ? patterns : filter === USED_IN_SITE ? patterns.filter((p) => used.has(p.slug)) : patterns.filter((p) => p.category === filter)

  return (
    <div className="space-y-12">
      <section className="grid items-center gap-8 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <p className="font-mono text-sm text-slate-500">// learn by watching objects talk</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-white sm:text-6xl">
            The top {patterns.length} design patterns,{' '}
            <span className="bg-gradient-to-r from-emerald-300 via-sky-300 to-purple-300 bg-clip-text text-transparent">
              animated
            </span>
            .
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-300">
            Each pattern comes with an interactive diagram. Press play to watch the messages flow, step through the scenario,
            and click any class or arrow to see its role — and the exact lines of TypeScript that implement it.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to={`/patterns/${patterns[0]?.slug ?? ''}`}
              className="rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-200"
            >
              Start with {patterns[0]?.name}
            </Link>
            <a href="#catalogue" className="rounded-lg px-5 py-2.5 text-sm font-semibold text-slate-200 ring-1 ring-slate-700 hover:bg-slate-900">
              Browse all
            </a>
          </div>
        </div>
        <HeroGraphic />
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          to="/architecture"
          className="group flex items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-rose-500/10 via-indigo-500/10 to-lime-500/10 p-5 ring-1 ring-slate-800 transition hover:ring-slate-600"
        >
          <div>
            <p className="text-xs font-mono uppercase tracking-wider text-slate-500">// same explorer, bigger boxes</p>
            <p className="mt-1 text-lg font-semibold text-white">
              Zoom out: <span className="text-slate-300">architectural patterns</span>
            </p>
            <p className="mt-1 text-sm text-slate-400">
              Layered, Hexagonal, DDD, CQRS, Microservices, Event-Driven, MVU and more — see which of the patterns above each one is built from.
            </p>
          </div>
          <span className="shrink-0 text-2xl text-slate-500 transition group-hover:translate-x-1 group-hover:text-white">→</span>
        </Link>

        {comparisons.length > 0 && (
          <Link
            to="/compare"
            className="group flex items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-slate-500/10 to-slate-500/10 p-5 ring-1 ring-slate-800 transition hover:ring-slate-600"
          >
            <div>
              <p className="text-xs font-mono uppercase tracking-wider text-slate-500">// look-alikes, told apart</p>
              <p className="mt-1 text-lg font-semibold text-white">
                Not sure which? <span className="text-slate-300">Which should I choose?</span>
              </p>
              <p className="mt-1 text-sm text-slate-400">
                Patterns that look nearly identical on a class diagram, compared side by side with a scenario to test yourself against.
              </p>
            </div>
            <span className="shrink-0 text-2xl text-slate-500 transition group-hover:translate-x-1 group-hover:text-white">→</span>
          </Link>
        )}
      </div>

      <section id="catalogue" className="scroll-mt-20">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by category">
          <FilterChip active={filter === 'all'} onClick={() => setFilter('all')}>
            All <span className="text-slate-500">{patterns.length}</span>
          </FilterChip>
          {categoryOrder.map((c) => (
            <FilterChip key={c} active={filter === c} onClick={() => setFilter(c)}>
              <span className={`size-2 rounded-full ${categories[c].dot}`} />
              {categories[c].label}{' '}
              <span className="text-slate-500">{patterns.filter((p) => p.category === c).length}</span>
            </FilterChip>
          ))}
          {used.size > 0 && (
            <FilterChip active={filter === USED_IN_SITE} onClick={() => setFilter(USED_IN_SITE)}>
              <UsedBadge />
              Used in this site <span className="text-slate-500">{patterns.filter((p) => used.has(p.slug)).length}</span>
            </FilterChip>
          )}
        </div>
        {filter !== 'all' && filter !== USED_IN_SITE && <p className="mt-3 text-sm text-slate-400">{categories[filter].description}</p>}
        {filter === USED_IN_SITE && (
          <p className="mt-3 text-sm text-slate-400">Patterns this site's own code uses on itself — see each page's "Used in this site" box.</p>
        )}

        <motion.ul layout className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((p, i) => {
            const cat = categories[p.category]
            return (
              <motion.li
                layout
                key={p.slug}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <Link
                  to={`/patterns/${p.slug}`}
                  className="group relative flex h-full flex-col overflow-hidden rounded-2xl bg-slate-900/50 p-5 ring-1 ring-slate-800 transition hover:-translate-y-0.5 hover:bg-slate-900 hover:ring-slate-600"
                >
                  <span
                    className="absolute -top-16 -right-16 size-40 rounded-full opacity-0 blur-3xl transition group-hover:opacity-30"
                    style={{ backgroundColor: cat.color }}
                    aria-hidden
                  />
                  <span className="flex items-center gap-2">
                    <span className={`text-xs font-medium ${cat.text}`}>{cat.label}</span>
                    {used.has(p.slug) && <UsedBadge />}
                  </span>
                  <span className="mt-1 text-xl font-semibold text-white">{p.name}</span>
                  <span className="mt-2 flex-1 text-sm leading-relaxed text-slate-400">{p.summary}</span>
                  <span className="mt-4 flex items-center gap-3 font-mono text-xs text-slate-500">
                    <span>{p.participants.length} participants</span>
                    <span>·</span>
                    <span>{p.steps.length} steps</span>
                    <span className="ml-auto text-slate-400 transition group-hover:translate-x-1 group-hover:text-white">→</span>
                  </span>
                </Link>
              </motion.li>
            )
          })}
        </motion.ul>
      </section>
    </div>
  )
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-sm ring-1 transition ${
        active ? 'bg-slate-800 text-white ring-slate-600' : 'text-slate-400 ring-slate-800 hover:text-white'
      }`}
    >
      {children}
    </button>
  )
}

/** Decorative animated graph: one hub per category exchanging messages. */
function HeroGraphic() {
  const positions = [
    { x: 80, y: 70 },
    { x: 320, y: 70 },
    { x: 320, y: 230 },
    { x: 80, y: 230 },
  ]
  const nodes = categoryOrder.map((c, i) => ({ ...categories[c], ...positions[i % positions.length] }))
  const edges = nodes.map((_, i) => [i, (i + 1) % nodes.length] as const)

  return (
    <svg viewBox="0 0 400 300" className="mx-auto w-full max-w-md" aria-hidden>
      {edges.map(([a, b], i) => {
        const A = nodes[a]
        const B = nodes[b]
        return (
          <g key={i}>
            <line x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke="#334155" strokeWidth="1.5" />
            <motion.circle
              r="5"
              fill={A.color}
              animate={{ cx: [A.x, B.x], cy: [A.y, B.y], opacity: [0, 1, 1, 0] }}
              transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.6, repeatDelay: 0.6, ease: 'easeInOut' }}
            />
          </g>
        )
      })}
      {nodes.map((n, i) => (
        <g key={n.id} transform={`translate(${n.x} ${n.y})`}>
          <motion.rect
            x="-58"
            y="-24"
            width="116"
            height="48"
            rx="12"
            fill="#0f172a"
            stroke={n.color}
            strokeWidth="1.5"
            animate={{ strokeOpacity: [0.4, 1, 0.4] }}
            transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.8 }}
          />
          <text y="5" textAnchor="middle" className="text-[13px] font-semibold" fill="#e2e8f0">
            {n.label}
          </text>
        </g>
      ))}
    </svg>
  )
}
