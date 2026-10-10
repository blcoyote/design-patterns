import { Link, useLocation } from "react-router-dom";
import { architectures } from "@/architectures/registry";
import { comparisons } from "@/comparisons/registry";
import { areaOf } from "@/lib/areas";
import { patterns } from "@/patterns/registry";
import { GitHubIcon, REPO_URL } from "./GitHubLink";
import { ThemeToggle } from "./ThemeToggle";

const COUNTS = {
  patterns: { count: patterns.length, unit: "patterns" },
  architecture: { count: architectures.length, unit: "architectures" },
  compare: { count: comparisons.length, unit: "comparisons" },
} as const;

export function Header({ onMenu, menuOpen }: { onMenu: () => void; menuOpen: boolean }) {
  const { pathname } = useLocation();
  const area = areaOf(pathname);
  const { count, unit } = COUNTS[area];

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-canvas">
      <div className="mx-auto flex h-14 max-w-384 items-center gap-2 px-4 sm:gap-3 sm:px-8">
        <button
          type="button"
          onClick={onMenu}
          aria-label="Toggle navigation"
          aria-expanded={menuOpen}
          className="-ml-2 rounded-control p-2 text-fg-soft hover:bg-surface-raised lg:hidden"
        >
          <svg viewBox="0 0 24 24" className="size-6 fill-current">
            <path d="M3 6h18v2H3zm0 5h18v2H3zm0 5h18v2H3z" />
          </svg>
        </button>
        <Link to="/" className="flex items-center gap-2.5 font-semibold text-fg">
          <Logo />
          <span className="hidden sm:inline">
            Design Patterns <span className="font-normal text-fg-muted">· interactive</span>
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
        <span className="ml-auto hidden font-mono text-xs text-fg-subtle sm:block">
          {count} {unit}
        </span>
        <div className="max-lg:hidden">
          <ThemeToggle />
        </div>
        <a
          href={REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="View source on GitHub"
          title="View source on GitHub"
          className="hidden rounded-control p-2 text-fg-muted transition hover:bg-surface-raised hover:text-fg lg:block"
        >
          <GitHubIcon className="size-5 fill-current" />
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
      className={`rounded-control px-1.5 py-2 text-sm font-medium whitespace-nowrap transition sm:px-3 sm:py-1.5 ${
        active ? "bg-surface-raised text-fg" : "text-fg-muted hover:bg-surface hover:text-fg-strong"
      }`}
    >
      {children}
    </Link>
  );
}

function Logo() {
  return (
    <svg viewBox="0 0 32 32" className="size-7" aria-hidden>
      <rect x="2" y="2" width="12" height="12" rx="3" className="fill-cat-creational" />
      <rect x="18" y="2" width="12" height="12" rx="3" className="fill-cat-structural" />
      <rect x="10" y="18" width="12" height="12" rx="3" className="fill-cat-behavioral" />
      <path d="M8 14v4h8M24 14v4h-8" className="stroke-fg-subtle" strokeWidth="1.5" fill="none" />
    </svg>
  );
}
