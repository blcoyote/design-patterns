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
  const [filter, setFilter] = useState<Category | "all" | typeof USED_IN_SITE>("all");
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
          <p className="font-mono text-sm text-fg-subtle">// learn by watching objects talk</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-fg sm:text-6xl">
            The top design patterns, <span className="text-fg-muted">animated</span>.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-fg-soft">
            Each pattern comes with an interactive diagram. Press play to watch the messages flow,
            step through the scenario, and click any class or arrow to see its role — and the exact
            lines of code (TypeScript, C#, Python or Go) that implement it.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to={`/patterns/${patterns[0]?.slug ?? ""}`}
              className="rounded-control bg-inverse px-5 py-2.5 text-sm font-semibold text-on-inverse transition hover:bg-inverse-hover"
            >
              Start with {patterns[0]?.name}
            </Link>
            <a
              href="#catalogue"
              className="rounded-control px-5 py-2.5 text-sm font-semibold text-fg-body ring-1 ring-control-outline hover:bg-surface"
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
          eyebrow="// explore bigger systems"
          title="Explore"
          highlight="architectural patterns"
          description="See how approaches like Layered, Hexagonal, DDD, and CQRS shape whole systems—and how they use design patterns."
        />

        {comparisons.length > 0 && (
          <AreaTeaserCard
            to="/compare"
            variant="comparison"
            eyebrow="// compare similar patterns"
            title="Which pattern"
            highlight="fits my problem?"
            description="See how similar patterns differ, then try a short scenario to find the best fit."
          />
        )}
      </div>

      <section id="catalogue" className="scroll-mt-20">
        <div
          className="flex flex-wrap items-center gap-2"
          role="group"
          aria-label="Filter by category"
        >
          <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
            All <span className="text-fg-subtle">{patterns.length}</span>
          </FilterChip>
          {categoryOrder.map((c) => (
            <FilterChip key={c} active={filter === c} onClick={() => setFilter(c)}>
              <span className={`size-2 rounded-full ${categories[c].dot}`} />
              {categories[c].label}{" "}
              <span className="text-fg-subtle">
                {patterns.filter((p) => p.category === c).length}
              </span>
            </FilterChip>
          ))}
          {used.size > 0 && (
            <FilterChip active={filter === USED_IN_SITE} onClick={() => setFilter(USED_IN_SITE)}>
              <UsedBadge />
              Used in this site{" "}
              <span className="text-fg-subtle">
                {patterns.filter((p) => used.has(p.slug)).length}
              </span>
            </FilterChip>
          )}
        </div>
        {filter !== "all" && filter !== USED_IN_SITE && (
          <p className="mt-3 text-sm text-fg-muted">{categories[filter].description}</p>
        )}
        {filter === USED_IN_SITE && (
          <p className="mt-3 text-sm text-fg-muted">
            Patterns this site's own code uses on itself — see each page's "Used in this site" box.
          </p>
        )}

        <motion.ul layout className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((p, i) => {
            const cat = categories[p.category];
            return (
              <ExplorableCard
                key={p.slug}
                to={`/patterns/${p.slug}`}
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
              stroke="var(--color-diagram-node-stroke)"
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
            fill="var(--color-diagram-node)"
            stroke={n.color}
            strokeWidth="1.5"
            animate={{ strokeOpacity: [0.4, 1, 0.4] }}
            transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.8 }}
          />
          <text
            y="5"
            textAnchor="middle"
            className="text-[13px] font-semibold"
            fill="var(--color-diagram-text)"
          >
            {n.label}
          </text>
        </g>
      ))}
    </svg>
  );
}
