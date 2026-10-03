import { motion } from "motion/react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { paradigmOrder, paradigms } from "@/architectures/paradigms";
import { architectures } from "@/architectures/registry";
import { ExplorableCard } from "@/components/content/ExplorableCard";
import { FilterChip } from "@/components/content/FilterChip";
import { Seo } from "@/components/content/Seo";
import { architectureIndexSeoPage } from "@/lib/seoPages";
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
      <Seo page={architectureIndexSeoPage} />
      <section className="max-w-3xl">
        <p className="font-mono text-sm text-slate-500">
          // zoom out from objects to systems
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-white sm:text-6xl">
          {architectures.length} architectural patterns,{" "}
          <span className="bg-linear-to-r from-rose-300 via-indigo-300 to-lime-300 bg-clip-text text-transparent">
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
              <ExplorableCard
                key={a.slug}
                to={`/architecture/${a.slug}`}
                accentColor={meta.color}
                label={meta.label}
                labelClass={`text-xs font-medium ${meta.text}`}
                used={used.has(a.slug)}
                name={a.name}
                summary={a.summary}
                index={i}
                footer={
                  <>
                    <span>uses {designPatternCount} design patterns</span>
                  </>
                }
              />
            );
          })}
        </motion.ul>
      </section>
    </div>
  );
}
