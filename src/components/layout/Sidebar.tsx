import { useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { byParadigm } from '@/architectures/registry'
import { paradigms } from '@/architectures/paradigms'
import { UsedBadge } from '@/components/content/UsedInThisSite'
import { usedSlugs } from '@/lib/selfUsage'
import { categories } from '@/patterns/categories'
import { byCategory } from '@/patterns/registry'

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { pathname } = useLocation()
  const inArchitectureArea = pathname.startsWith('/architecture')
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const used = usedSlugs()

  const patternGroups = byCategory()
    .map((g) => ({
      ...g,
      patterns: g.patterns.filter((p) => !q || p.name.toLowerCase().includes(q) || p.summary.toLowerCase().includes(q)),
    }))
    .filter((g) => g.patterns.length > 0)

  const architectureGroups = byParadigm()
    .map((g) => ({
      ...g,
      architectures: g.architectures.filter((a) => !q || a.name.toLowerCase().includes(q) || a.summary.toLowerCase().includes(q)),
    }))
    .filter((g) => g.architectures.length > 0)

  const empty = inArchitectureArea ? architectureGroups.length === 0 : patternGroups.length === 0

  return (
    <>
      {open && <div className="fixed inset-0 z-20 bg-black/60 lg:hidden" onClick={onClose} aria-hidden />}
      <aside
        className={`fixed top-14 bottom-0 z-20 w-72 shrink-0 overflow-y-auto border-r border-slate-800 bg-slate-950 px-4 py-6 transition-transform lg:sticky lg:top-14 lg:h-[calc(100vh-3.5rem)] lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <label className="relative block">
          <span className="sr-only">{inArchitectureArea ? 'Search architectures' : 'Search patterns'}</span>
          <svg viewBox="0 0 24 24" className="absolute top-2.5 left-3 size-4 fill-slate-500" aria-hidden>
            <path d="M10 2a8 8 0 0 1 6.3 12.9l5.4 5.4-1.4 1.4-5.4-5.4A8 8 0 1 1 10 2zm0 2a6 6 0 1 0 0 12 6 6 0 0 0 0-12z" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={inArchitectureArea ? 'Search architectures…' : 'Search patterns…'}
            className="w-full rounded-lg bg-slate-900 py-2 pr-3 pl-9 text-sm text-slate-200 ring-1 ring-slate-800 placeholder:text-slate-500 focus:ring-slate-600 focus:outline-none"
          />
        </label>

        {inArchitectureArea ? (
          <nav className="mt-6 space-y-6" aria-label="Architectures">
            {architectureGroups.map(({ paradigm, architectures }) => (
              <div key={paradigm}>
                <p className={`flex items-center gap-2 text-xs font-semibold tracking-wider uppercase ${paradigms[paradigm].text}`}>
                  <span className={`size-2 rounded-full ${paradigms[paradigm].dot}`} />
                  {paradigms[paradigm].label}
                </p>
                <ul className="mt-2 space-y-0.5">
                  {architectures.map((a) => (
                    <li key={a.slug}>
                      <NavLink
                        to={`/architecture/${a.slug}`}
                        onClick={onClose}
                        className={({ isActive }) =>
                          `flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition ${
                            isActive ? 'bg-slate-800 font-medium text-white' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-100'
                          }`
                        }
                      >
                        {a.name}
                        {used.has(a.slug) && <UsedBadge />}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        ) : (
          <nav className="mt-6 space-y-6" aria-label="Patterns">
            {patternGroups.map(({ category, patterns }) => (
              <div key={category}>
                <p className={`flex items-center gap-2 text-xs font-semibold tracking-wider uppercase ${categories[category].text}`}>
                  <span className={`size-2 rounded-full ${categories[category].dot}`} />
                  {categories[category].label}
                </p>
                <ul className="mt-2 space-y-0.5">
                  {patterns.map((p) => (
                    <li key={p.slug}>
                      <NavLink
                        to={`/patterns/${p.slug}`}
                        onClick={onClose}
                        className={({ isActive }) =>
                          `flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition ${
                            isActive ? 'bg-slate-800 font-medium text-white' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-100'
                          }`
                        }
                      >
                        {p.name}
                        {used.has(p.slug) && <UsedBadge />}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        )}
        {empty && <p className="mt-6 text-sm text-slate-500">No {inArchitectureArea ? 'architectures' : 'patterns'} match “{query}”.</p>}

        <div className="mt-8 border-t border-slate-800 pt-4">
          <Link
            to={inArchitectureArea ? '/' : '/architecture'}
            onClick={onClose}
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white"
          >
            {inArchitectureArea ? '← Design patterns' : 'Zoom out: architecture →'}
          </Link>
        </div>
      </aside>
    </>
  )
}
