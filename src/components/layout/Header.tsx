import { Link } from 'react-router-dom'
import { patterns } from '@/patterns/registry'

export function Header({ onMenu, menuOpen }: { onMenu: () => void; menuOpen: boolean }) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[96rem] items-center gap-3 px-4 sm:px-8">
        <button
          type="button"
          onClick={onMenu}
          aria-label="Toggle navigation"
          aria-expanded={menuOpen}
          className="rounded-md p-1.5 text-slate-300 hover:bg-slate-800 lg:hidden"
        >
          <svg viewBox="0 0 24 24" className="size-6 fill-current"><path d="M3 6h18v2H3zm0 5h18v2H3zm0 5h18v2H3z" /></svg>
        </button>
        <Link to="/" className="flex items-center gap-2.5 font-semibold text-white">
          <Logo />
          <span>
            Design Patterns <span className="font-normal text-slate-400">· interactive</span>
          </span>
        </Link>
        <span className="ml-auto hidden font-mono text-xs text-slate-500 sm:block">{patterns.length} patterns</span>
      </div>
    </header>
  )
}

function Logo() {
  return (
    <svg viewBox="0 0 32 32" className="size-7" aria-hidden>
      <rect x="2" y="2" width="12" height="12" rx="3" fill="#34d399" />
      <rect x="18" y="2" width="12" height="12" rx="3" fill="#38bdf8" />
      <rect x="10" y="18" width="12" height="12" rx="3" fill="#c084fc" />
      <path d="M8 14v4h8M24 14v4h-8" stroke="#64748b" strokeWidth="1.5" fill="none" />
    </svg>
  )
}
