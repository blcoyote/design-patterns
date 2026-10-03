import { motion } from "motion/react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { ExplorableCard } from "@/components/content/ExplorableCard";
import { AreaTeaserCard } from "@/components/content/AreaTeaserCard";
import { FilterChip } from "@/components/content/FilterChip";
import { UsedBadge } from "@/components/content/UsedInThisSite";
import { Seo } from "@/components/content/Seo";
import { homeSeoPage } from "@/lib/seoPages";
import { comparisons } from "@/comparisons/registry";
import { categories, categoryOrder } from "@/patterns/categories";
import { patterns } from "@/patterns/registry";
import { usedSlugs } from "@/lib/selfUsage";
import type { Category } from "@/types/pattern";

const USED_IN_SITE = "used-in-site";

export function HomePage() {
  const [filter, setFilter] = useState<Category | "all" | typeof USED_IN_SITE>(
    "all",
  );
  const used = usedSlugs();
  const shown =
    filter === "all"
      ? patterns
      : filter === USED_IN_SITE
        ? patterns.filter((p) => used.has(p.slug))
        : patterns.filter((p) => p.category === filter);

  return (
    <div className="space-y-12">
      <Seo page={homeSeoPage} />
      <section className="grid items-center gap-8 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <p className="font-mono text-sm text-slate-500">
            // learn by watching objects talk
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-white sm:text-6xl">
            The top design patterns,{" "}
            <span className="bg-linear-to-r from-emerald-300 via-sky-300 to-purple-300 bg-clip-text text-transparent">
              animated
            </span>
            .
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-300">
            Each pattern comes with an interactive diagram. Press play to watch
            the messages flow, step through the scenario, and click any class or
            arrow to see its role — and the exact lines of TypeScript that
            implement it.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to={`/patterns/${patterns[0]?.slug ?? ""}`}
              className="rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-200"
            >
              Start with {patterns[0]?.name}
            </Link>
            <a
              href="#catalogue"
              className="rounded-lg px-5 py-2.5 text-sm font-semibold text-slate-200 ring-1 ring-slate-700 hover:bg-slate-900"
            >
              Browse all
            </a>
          </div>
        </div>
        <HeroGraphic />
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <AreaTeaserCard
          to="/architecture"
          variant="architecture"
          eyebrow="// same explorer, bigger boxes"
          title="Zoom out:"
          highlight="architectural patterns"
          description="Layered, Hexagonal, DDD, CQRS, Microservices, Event-Driven, MVU and more — see which of the patterns above each one is built from."
        />

        {comparisons.length > 0 && (
          <AreaTeaserCard
            to="/compare"
            variant="comparison"
            eyebrow="// look-alikes, told apart"
            title="Not sure which?"
            highlight="Which should I choose?"
            description="Patterns that look nearly identical on a class diagram, compared side by side with a scenario to test yourself against."
          />
        )}
      </div>

      <section id="catalogue" className="scroll-mt-20">
        <div
          className="flex flex-wrap items-center gap-2"
          role="group"
          aria-label="Filter by category"
        >
          <FilterChip
            active={filter === "all"}
            onClick={() => setFilter("all")}
          >
            All <span className="text-slate-500">{patterns.length}</span>
          </FilterChip>
          {categoryOrder.map((c) => (
            <FilterChip
              key={c}
              active={filter === c}
              onClick={() => setFilter(c)}
            >
              <span className={`size-2 rounded-full ${categories[c].dot}`} />
              {categories[c].label}{" "}
              <span className="text-slate-500">
                {patterns.filter((p) => p.category === c).length}
              </span>
            </FilterChip>
          ))}
          {used.size > 0 && (
            <FilterChip
              active={filter === USED_IN_SITE}
              onClick={() => setFilter(USED_IN_SITE)}
            >
              <UsedBadge />
              Used in this site{" "}
              <span className="text-slate-500">
                {patterns.filter((p) => used.has(p.slug)).length}
              </span>
            </FilterChip>
          )}
        </div>
        {filter !== "all" && filter !== USED_IN_SITE && (
          <p className="mt-3 text-sm text-slate-400">
            {categories[filter].description}
          </p>
        )}
        {filter === USED_IN_SITE && (
          <p className="mt-3 text-sm text-slate-400">
            Patterns this site's own code uses on itself — see each page's "Used
            in this site" box.
          </p>
        )}

        <motion.ul
          layout
          className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
        >
          {shown.map((p, i) => {
            const cat = categories[p.category];
            return (
              <ExplorableCard
                key={p.slug}
                to={`/patterns/${p.slug}`}
                accentColor={cat.color}
                label={cat.label}
                labelClass={`text-xs font-medium ${cat.text}`}
                used={used.has(p.slug)}
                name={p.name}
                summary={p.summary}
                index={i}
                footer={
                  <>
                    <span>{p.participants.length} participants</span>
                    <span>·</span>
                    <span>{p.steps.length} steps</span>
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

/** Decorative animated graph: one hub per category exchanging messages. */
function HeroGraphic() {
  const positions = [
    { x: 80, y: 70 },
    { x: 320, y: 70 },
    { x: 320, y: 230 },
    { x: 80, y: 230 },
  ];
  const nodes = categoryOrder.map((c, i) => ({
    ...categories[c],
    ...positions[i % positions.length],
  }));
  const edges = nodes.map((_, i) => [i, (i + 1) % nodes.length] as const);

  return (
    <svg viewBox="0 0 400 300" className="mx-auto w-full max-w-md" aria-hidden>
      {edges.map(([a, b], i) => {
        const A = nodes[a];
        const B = nodes[b];
        return (
          <g key={i}>
            <line
              x1={A.x}
              y1={A.y}
              x2={B.x}
              y2={B.y}
              stroke="#334155"
              strokeWidth="1.5"
            />
            <motion.circle
              r="5"
              fill={A.color}
              animate={{
                cx: [A.x, B.x],
                cy: [A.y, B.y],
                opacity: [0, 1, 1, 0],
              }}
              transition={{
                duration: 1.8,
                repeat: Infinity,
                delay: i * 0.6,
                repeatDelay: 0.6,
                ease: "easeInOut",
              }}
            />
          </g>
        );
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
          <text
            y="5"
            textAnchor="middle"
            className="text-[13px] font-semibold"
            fill="#e2e8f0"
          >
            {n.label}
          </text>
        </g>
      ))}
    </svg>
  );
}
