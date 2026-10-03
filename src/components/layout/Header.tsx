import { Link, useLocation } from "react-router-dom";
import { architectures } from "@/architectures/registry";
import { comparisons } from "@/comparisons/registry";
import { areaOf } from "@/lib/areas";
import { patterns } from "@/patterns/registry";

const COUNTS = {
  patterns: { count: patterns.length, unit: "patterns" },
  architecture: { count: architectures.length, unit: "architectures" },
  compare: { count: comparisons.length, unit: "comparisons" },
} as const;

export function Header({
  onMenu,
  menuOpen,
}: {
  onMenu: () => void;
  menuOpen: boolean;
}) {
  const { pathname } = useLocation();
  const area = areaOf(pathname);
  const { count, unit } = COUNTS[area];

  return (
    <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[96rem] items-center gap-2 px-4 sm:gap-3 sm:px-8">
        <button
          type="button"
          onClick={onMenu}
          aria-label="Toggle navigation"
          aria-expanded={menuOpen}
          className="-ml-2 rounded-md p-2 text-slate-300 hover:bg-slate-800 lg:hidden"
        >
          <svg viewBox="0 0 24 24" className="size-6 fill-current">
            <path d="M3 6h18v2H3zm0 5h18v2H3zm0 5h18v2H3z" />
          </svg>
        </button>
        <Link
          to="/"
          className="flex items-center gap-2.5 font-semibold text-white"
        >
          <Logo />
          <span className="hidden sm:inline">
            Design Patterns{" "}
            <span className="font-normal text-slate-400">· interactive</span>
          </span>
        </Link>
        <nav className="flex items-center gap-1 sm:ml-2" aria-label="Areas">
          <HeaderLink to="/" active={area === "patterns"}>
            <span className="min-[400px]:hidden">Patterns</span>
            <span className="hidden min-[400px]:inline">Design patterns</span>
          </HeaderLink>
          <HeaderLink to="/architecture" active={area === "architecture"}>
            Architecture
          </HeaderLink>
          <HeaderLink to="/compare" active={area === "compare"}>
            <span className="sm:hidden">Compare</span>
            <span className="hidden sm:inline">Which should I choose?</span>
          </HeaderLink>
        </nav>
        <span className="ml-auto hidden font-mono text-xs text-slate-500 sm:block">
          {count} {unit}
        </span>
        <a
          href="https://github.com/blcoyote/design-patterns"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="View source on GitHub"
          title="View source on GitHub"
          className="ml-auto rounded-md p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white sm:ml-0 sm:p-2"
        >
          <svg
            viewBox="0 0 24 24"
            className="size-5 fill-current"
            aria-hidden="true"
          >
            <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.3 9.39 7.87 10.91.58.11.79-.25.79-.56v-2.17c-3.2.7-3.87-1.36-3.87-1.36-.53-1.33-1.28-1.68-1.28-1.68-1.05-.72.08-.71.08-.71 1.16.08 1.77 1.19 1.77 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.23-1.28-5.23-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.47.11-3.06 0 0 .97-.31 3.17 1.18a11.02 11.02 0 0 1 5.77 0c2.2-1.49 3.16-1.18 3.16-1.18.63 1.59.24 2.77.12 3.06.74.81 1.18 1.84 1.18 3.1 0 4.43-2.68 5.4-5.24 5.69.41.35.78 1.05.78 2.12v3.15c0 .31.21.67.8.56A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
          </svg>
        </a>
      </div>
    </header>
  );
}

function HeaderLink({
  to,
  active,
  children,
}: {
  to: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      aria-current={active ? "page" : undefined}
      className={`rounded-md px-1.5 py-2 text-sm font-medium whitespace-nowrap transition sm:px-3 sm:py-1.5 ${
        active
          ? "bg-slate-800 text-white"
          : "text-slate-400 hover:bg-slate-900 hover:text-slate-100"
      }`}
    >
      {children}
    </Link>
  );
}

function Logo() {
  return (
    <svg viewBox="0 0 32 32" className="size-7" aria-hidden>
      <rect x="2" y="2" width="12" height="12" rx="3" fill="#34d399" />
      <rect x="18" y="2" width="12" height="12" rx="3" fill="#38bdf8" />
      <rect x="10" y="18" width="12" height="12" rx="3" fill="#c084fc" />
      <path
        d="M8 14v4h8M24 14v4h-8"
        stroke="#64748b"
        strokeWidth="1.5"
        fill="none"
      />
    </svg>
  );
}
