import { Link } from "react-router-dom";
import { Seo } from "@/components/content/Seo";
import { comparisons } from "@/comparisons/registry";
import { resolveSubject } from "@/lib/crossRefs";
import { comparisonIndexSeoPage } from "@/lib/seoPages";

/** Lists every comparison, each as a card naming the subjects it pits against one another. */
export function ComparisonIndexPage() {
  return (
    <div className="space-y-12">
      <Seo page={comparisonIndexSeoPage} />
      <section className="max-w-3xl">
        <p className="font-mono text-sm text-fg-subtle">// look-alikes, told apart</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-fg sm:text-6xl">
          Which should I choose?
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-fg-soft">
          Some patterns look almost identical on a class diagram but solve different problems. Each
          comparison walks through one concrete problem, lays the options side by side, and ends
          with a scenario you can test yourself against.
        </p>
      </section>

      <section>
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {comparisons.map((c) => {
            const subjects = c.subjects
              .map((ref) => resolveSubject(ref))
              .filter((s) => s !== undefined);
            return (
              <li key={c.slug}>
                <Link
                  to={`/compare/${c.slug}`}
                  className="group flex h-full flex-col rounded-2xl bg-surface/50 p-5 ring-1 ring-line transition hover:-translate-y-0.5 hover:bg-surface hover:ring-line-bold"
                >
                  <span className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                    {subjects.map((s, i) => (
                      <span key={s.slug} className="flex items-center gap-2">
                        {i > 0 && <span className="text-fg-faint">vs</span>}
                        <span style={{ color: s.color }}>{s.name}</span>
                      </span>
                    ))}
                  </span>
                  <span className="mt-2 flex-1 text-sm leading-relaxed text-fg-muted">
                    {c.summary}
                  </span>
                  <span className="mt-4 text-xs font-mono text-fg-subtle transition group-hover:translate-x-1 group-hover:text-fg">
                    Compare →
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
