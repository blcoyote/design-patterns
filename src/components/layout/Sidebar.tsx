import { useState, type ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { byParadigm } from "@/architectures/registry";
import { paradigms } from "@/architectures/paradigms";
import { UsedBadge } from "@/components/content/UsedInThisSite";
import { comparisons } from "@/comparisons/registry";
import { areaOf } from "@/lib/areas";
import { usedSlugs } from "@/lib/selfUsage";
import { categories } from "@/patterns/categories";
import { byCategory } from "@/patterns/registry";
import { GitHubIcon, REPO_URL } from "./GitHubLink";

export function Sidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { pathname } = useLocation();
  const area = areaOf(pathname);
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const used = usedSlugs();

  const patternGroups = byCategory()
    .map((g) => ({
      ...g,
      patterns: g.patterns.filter(
        (p) =>
          !q ||
          p.name.toLowerCase().includes(q) ||
          p.summary.toLowerCase().includes(q),
      ),
    }))
    .filter((g) => g.patterns.length > 0);

  const architectureGroups = byParadigm()
    .map((g) => ({
      ...g,
      architectures: g.architectures.filter(
        (a) =>
          !q ||
          a.name.toLowerCase().includes(q) ||
          a.summary.toLowerCase().includes(q),
      ),
    }))
    .filter((g) => g.architectures.length > 0);

  const filteredComparisons = comparisons.filter(
    (c) =>
      !q ||
      c.title.toLowerCase().includes(q) ||
      c.summary.toLowerCase().includes(q),
  );

  const empty =
    area === "architecture"
      ? architectureGroups.length === 0
      : area === "compare"
        ? filteredComparisons.length === 0
        : patternGroups.length === 0;
  const emptyLabel =
    area === "architecture"
      ? "architectures"
      : area === "compare"
        ? "comparisons"
        : "patterns";

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-20 bg-black/60 lg:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}
      <aside
        className={`fixed top-14 bottom-0 z-20 w-72 shrink-0 overflow-y-auto border-r border-slate-800 bg-slate-950 px-4 py-6 transition-transform lg:sticky lg:top-14 lg:h-[calc(100vh-3.5rem)] lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <label className="relative block">
          <span className="sr-only">Search {emptyLabel}</span>
          <svg
            viewBox="0 0 24 24"
            className="absolute top-2.5 left-3 size-4 fill-slate-500"
            aria-hidden
          >
            <path d="M10 2a8 8 0 0 1 6.3 12.9l5.4 5.4-1.4 1.4-5.4-5.4A8 8 0 1 1 10 2zm0 2a6 6 0 1 0 0 12 6 6 0 0 0 0-12z" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${emptyLabel}…`}
            className="w-full rounded-lg bg-slate-900 py-2 pr-3 pl-9 text-sm text-slate-200 ring-1 ring-slate-800 placeholder:text-slate-500 focus:ring-slate-600 focus:outline-none"
          />
        </label>

        {area === "architecture" && (
          <nav className="mt-6 space-y-6" aria-label="Architectures">
            {architectureGroups.map(({ paradigm, architectures }) => (
              <SidebarGroup
                key={paradigm}
                label={paradigms[paradigm].label}
                textClass={paradigms[paradigm].text}
                dotClass={paradigms[paradigm].dot}
              >
                {architectures.map((a) => (
                  <li key={a.slug}>
                    <SidebarItem
                      to={`/architecture/${a.slug}`}
                      onSelect={onClose}
                    >
                      {a.name}
                      {used.has(a.slug) && <UsedBadge />}
                    </SidebarItem>
                  </li>
                ))}
              </SidebarGroup>
            ))}
          </nav>
        )}

        {area === "compare" && (
          <nav className="mt-6" aria-label="Comparisons">
            <ul className="space-y-0.5">
              {filteredComparisons.map((c) => (
                <li key={c.slug}>
                  <SidebarItem to={`/compare/${c.slug}`} onSelect={onClose}>
                    {c.title}
                  </SidebarItem>
                </li>
              ))}
            </ul>
          </nav>
        )}

        {area === "patterns" && (
          <nav className="mt-6 space-y-6" aria-label="Patterns">
            {patternGroups.map(({ category, patterns }) => (
              <SidebarGroup
                key={category}
                label={categories[category].label}
                textClass={categories[category].text}
                dotClass={categories[category].dot}
              >
                {patterns.map((p) => (
                  <li key={p.slug}>
                    <SidebarItem to={`/patterns/${p.slug}`} onSelect={onClose}>
                      {p.name}
                      {used.has(p.slug) && <UsedBadge />}
                    </SidebarItem>
                  </li>
                ))}
              </SidebarGroup>
            ))}
          </nav>
        )}

        {empty && (
          <p className="mt-6 text-sm text-slate-500">
            No {emptyLabel} match “{query}”.
          </p>
        )}

        <div className="mt-8 space-y-1 border-t border-slate-800 pt-4">
          {area !== "patterns" && (
            <Link
              to="/"
              onClick={onClose}
              className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white"
            >
              ← Design patterns
            </Link>
          )}
          {area !== "architecture" && (
            <Link
              to="/architecture"
              onClick={onClose}
              className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white"
            >
              {area === "patterns"
                ? "Zoom out: architecture →"
                : "Architecture →"}
            </Link>
          )}
          {area !== "compare" && (
            <Link
              to="/compare"
              onClick={onClose}
              className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white"
            >
              Which should I choose? →
            </Link>
          )}
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClose}
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white lg:hidden"
          >
            <GitHubIcon className="size-4 fill-current" />
            View source on GitHub
          </a>
        </div>
      </aside>
    </>
  );
}

function SidebarItem({
  to,
  onSelect,
  children,
}: {
  to: string;
  onSelect: () => void;
  children: ReactNode;
}) {
  return (
    <NavLink
      to={to}
      onClick={onSelect}
      className={({ isActive }) =>
        `flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition ${
          isActive
            ? "bg-slate-800 font-medium text-white"
            : "text-slate-400 hover:bg-slate-900 hover:text-slate-100"
        }`
      }
    >
      {children}
    </NavLink>
  );
}

function SidebarGroup({
  label,
  textClass,
  dotClass,
  children,
}: {
  label: string;
  textClass: string;
  dotClass: string;
  children: ReactNode;
}) {
  return (
    <div>
      <p
        className={`flex items-center gap-2 text-xs font-semibold tracking-wider uppercase ${textClass}`}
      >
        <span className={`size-2 rounded-full ${dotClass}`} />
        {label}
      </p>
      <ul className="mt-2 space-y-0.5">{children}</ul>
    </div>
  );
}
