import { Link } from "react-router-dom";
import { Seo } from "@/components/content/Seo";
import { comparisons } from "@/comparisons/registry";
import { resolveSubject } from "@/lib/crossRefs";

/** Lists every comparison, each as a card naming the subjects it pits against one another. */
export function ComparisonIndexPage() {
  return (
    <div className="space-y-12">
      <Seo
        title="Design Pattern Comparisons"
        description="Compare similar software design and architecture patterns side by side, see when to choose each, and test your decision with a scenario."
      />
      <section className="max-w-3xl">
        <p className="font-mono text-sm text-slate-500">
          // look-alikes, told apart
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-white sm:text-6xl">
          Which should I choose?
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-slate-300">
          Some patterns look almost identical on a class diagram but solve
          different problems. Each comparison walks through one concrete
          problem, lays the options side by side, and ends with a scenario you
          can test yourself against.
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
                  className="group flex h-full flex-col rounded-2xl bg-slate-900/50 p-5 ring-1 ring-slate-800 transition hover:-translate-y-0.5 hover:bg-slate-900 hover:ring-slate-600"
                >
                  <span className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                    {subjects.map((s, i) => (
                      <span key={s.slug} className="flex items-center gap-2">
                        {i > 0 && <span className="text-slate-600">vs</span>}
                        <span style={{ color: s.color }}>{s.name}</span>
                      </span>
                    ))}
                  </span>
                  <span className="mt-2 flex-1 text-sm leading-relaxed text-slate-400">
                    {c.summary}
                  </span>
                  <span className="mt-4 text-xs font-mono text-slate-500 transition group-hover:translate-x-1 group-hover:text-white">
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
