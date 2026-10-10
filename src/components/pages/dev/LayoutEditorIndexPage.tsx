import { Link } from "react-router-dom";
import { paradigms } from "@/architectures/paradigms";
import { byParadigm } from "@/architectures/registry";
import { categories } from "@/patterns/categories";
import { byCategory } from "@/patterns/registry";

const linkClass =
  "block rounded-control px-3 py-2 text-sm text-fg-body ring-1 ring-control-outline transition hover:bg-surface hover:text-fg";

/** Dev-only entry point of the layout editor: every pattern and architecture, linked to its editor page. */
export function LayoutEditorIndexPage() {
  return (
    <div className="space-y-10">
      <section className="max-w-3xl">
        <p className="font-mono text-sm text-fg-subtle">// dev only</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-fg">Diagram layout editor</h1>
        <p className="mt-3 text-fg-soft">
          Pick a pattern or architecture to open its diagram in the real scene. This page is only
          registered under <code className="font-mono">npm run dev</code>.
        </p>
      </section>

      <section className="space-y-6" aria-label="Design patterns">
        <h2 className="text-xl font-semibold text-fg">Design patterns</h2>
        {byCategory().map(({ category, patterns }) => (
          <div key={category}>
            <h3 className={`mb-2 text-sm font-medium ${categories[category].text}`}>
              {categories[category].label}
            </h3>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {patterns.map((p) => (
                <li key={p.slug}>
                  <Link to={`/dev/layout/patterns/${p.slug}`} className={linkClass}>
                    {p.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section className="space-y-6" aria-label="Architectures">
        <h2 className="text-xl font-semibold text-fg">Architectures</h2>
        {byParadigm().map(({ paradigm, architectures }) => (
          <div key={paradigm}>
            <h3 className={`mb-2 text-sm font-medium ${paradigms[paradigm].text}`}>
              {paradigms[paradigm].label}
            </h3>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {architectures.map((a) => (
                <li key={a.slug}>
                  <Link to={`/dev/layout/architecture/${a.slug}`} className={linkClass}>
                    {a.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    </div>
  );
}
