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
    filter === "all" ? architectures : architectures.filter((a) => a.paradigm === filter);
  const used = usedSlugs();

  return (
    <div className="space-y-12">
      <Seo page={architectureIndexSeoPage} />
      <section className="max-w-3xl">
        <p className="font-mono text-sm text-fg-subtle">// zoom out from objects to systems</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-fg sm:text-6xl">
          {architectures.length} architectural patterns,{" "}
          <span className="text-fg-muted">animated</span>.
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-fg-soft">
          Architectural patterns show how a system is organized and how its major parts work
          together, from a layered application to an event-sourced core. A system can combine two or
          more architectural patterns, and each page connects those choices to the design patterns
          used to build them.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to={`/architecture/${architectures[0]?.slug ?? ""}`}
            className="rounded-control bg-inverse px-5 py-2.5 text-sm font-semibold text-on-inverse transition hover:bg-inverse-hover"
          >
            Start with {architectures[0]?.name}
          </Link>
          <Link
            to="/"
            className="rounded-control px-5 py-2.5 text-sm font-semibold text-fg-body ring-1 ring-line-strong hover:bg-surface"
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
          <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
            All <span className="text-fg-subtle">{architectures.length}</span>
          </FilterChip>
          {paradigmOrder.map((p) => (
            <FilterChip key={p} active={filter === p} onClick={() => setFilter(p)}>
              <span className={`size-2 rounded-full ${paradigms[p].dot}`} />
              {paradigms[p].label}{" "}
              <span className="text-fg-subtle">
                {architectures.filter((a) => a.paradigm === p).length}
              </span>
            </FilterChip>
          ))}
        </div>
        {filter !== "all" && (
          <p className="mt-3 text-sm text-fg-muted">{paradigms[filter].description}</p>
        )}

        <motion.ul layout className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((a, i) => {
            const meta = paradigms[a.paradigm];
            const designPatternCount = a.commonlyUsedWith.designPatterns.length;
            return (
              <ExplorableCard
                key={a.slug}
                to={`/architecture/${a.slug}`}
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
