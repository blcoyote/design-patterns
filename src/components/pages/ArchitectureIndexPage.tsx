import { motion } from "motion/react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { paradigmOrder, paradigms } from "@/architectures/paradigms";
import { architectures } from "@/architectures/registry";
import { UsedBadge } from "@/components/content/UsedInThisSite";
import { usedSlugs } from "@/lib/selfUsage";
import type { Paradigm } from "@/types/architecture";

/** Mirrors HomePage, one level zoomed out: architectures instead of design patterns, filtered by paradigm instead of category. */
export function ArchitectureIndexPage() {
  const [filter, setFilter] = useState<Paradigm | "all">("all");
  const shown =
    filter === "all"
      ? architectures
      : architectures.filter((a) => a.paradigm === filter);
  const used = usedSlugs();

  return (
    <div className="space-y-12">
      <section className="max-w-3xl">
        <p className="font-mono text-sm text-slate-500">
          // zoom out from objects to systems
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-white sm:text-6xl">
          {architectures.length} architectural patterns,{" "}
          <span className="bg-gradient-to-r from-rose-300 via-indigo-300 to-lime-300 bg-clip-text text-transparent">
            animated
          </span>
          .
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-slate-300">
          Architectural patterns show how a system is organized and how its
          major parts work together, from a layered application to an
          event-sourced core. A system can combine two or more architectural
          patterns, and each page connects those choices to the design patterns
          used to build them.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to={`/architecture/${architectures[0]?.slug ?? ""}`}
            className="rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-200"
          >
            Start with {architectures[0]?.name}
          </Link>
          <Link
            to="/"
            className="rounded-lg px-5 py-2.5 text-sm font-semibold text-slate-200 ring-1 ring-slate-700 hover:bg-slate-900"
          >
            ← Back to design patterns
          </Link>
        </div>
      </section>

      <section>
        <div
          className="flex flex-wrap items-center gap-2"
          role="group"
          aria-label="Filter by paradigm"
        >
          <FilterChip
            active={filter === "all"}
            onClick={() => setFilter("all")}
          >
            All <span className="text-slate-500">{architectures.length}</span>
          </FilterChip>
          {paradigmOrder.map((p) => (
            <FilterChip
              key={p}
              active={filter === p}
              onClick={() => setFilter(p)}
            >
              <span className={`size-2 rounded-full ${paradigms[p].dot}`} />
              {paradigms[p].label}{" "}
              <span className="text-slate-500">
                {architectures.filter((a) => a.paradigm === p).length}
              </span>
            </FilterChip>
          ))}
        </div>
        {filter !== "all" && (
          <p className="mt-3 text-sm text-slate-400">
            {paradigms[filter].description}
          </p>
        )}

        <motion.ul
          layout
          className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
        >
          {shown.map((a, i) => {
            const meta = paradigms[a.paradigm];
            const designPatternCount = a.commonlyUsedWith.designPatterns.length;
            return (
              <motion.li
                layout
                key={a.slug}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <Link
                  to={`/architecture/${a.slug}`}
                  className="group relative flex h-full flex-col overflow-hidden rounded-2xl bg-slate-900/50 p-5 ring-1 ring-slate-800 transition hover:-translate-y-0.5 hover:bg-slate-900 hover:ring-slate-600"
                >
                  <span
                    className="absolute -top-16 -right-16 size-40 rounded-full opacity-0 blur-3xl transition group-hover:opacity-30"
                    style={{ backgroundColor: meta.color }}
                    aria-hidden
                  />
                  <span className="flex items-center gap-2">
                    <span className={`text-xs font-medium ${meta.text}`}>
                      {meta.label}
                    </span>
                    {used.has(a.slug) && <UsedBadge />}
                  </span>
                  <span className="mt-1 text-xl font-semibold text-white">
                    {a.name}
                  </span>
                  <span className="mt-2 flex-1 text-sm leading-relaxed text-slate-400">
                    {a.summary}
                  </span>
                  <span className="mt-4 flex items-center gap-3 font-mono text-xs text-slate-500">
                    <span>uses {designPatternCount} design patterns</span>
                    <span className="ml-auto text-slate-400 transition group-hover:translate-x-1 group-hover:text-white">
                      →
                    </span>
                  </span>
                </Link>
              </motion.li>
            );
          })}
        </motion.ul>
      </section>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-sm ring-1 transition ${
        active
          ? "bg-slate-800 text-white ring-slate-600"
          : "text-slate-400 ring-slate-800 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}
