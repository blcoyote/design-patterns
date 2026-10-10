import { Link } from "react-router-dom";
import type { ComparisonDefinition } from "@/types/comparison";

/**
 * "Often confused with…" box on a pattern/architecture page, built from `comparisonsFor(slug)`.
 * This is derived (like `CrossReferenceBox`'s reverse links), so a pattern or architecture never
 * has to declare which comparisons mention it.
 */
export function ComparisonTeaser({ comparisons }: { comparisons: ComparisonDefinition[] }) {
  if (comparisons.length === 0) return null;

  return (
    <section className="rounded-panel bg-card shadow-card p-6 ring-1 ring-inset ring-compare/20">
      <h2 className="flex items-center gap-2 text-xs font-semibold tracking-wider text-compare-fg uppercase">
        <svg viewBox="0 0 24 24" className="size-3.5 fill-current" aria-hidden>
          <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm.9 15h-1.8v-1.8h1.8V17zm1.86-6.73-.81.83c-.65.66-1.05 1.2-1.05 2.4h-1.8v-.45c0-.9.4-1.7 1.05-2.36l1.12-1.14c.33-.32.53-.77.53-1.26a1.8 1.8 0 1 0-3.6 0h-1.8a3.6 3.6 0 1 1 7.2 0c0 .72-.3 1.37-.76 1.98z" />
        </svg>
        Often confused with…
      </h2>
      <ul className="mt-4 space-y-2">
        {comparisons.map((c) => (
          <li key={c.slug}>
            <Link
              to={`/compare/${c.slug}`}
              className="block rounded-control p-3 ring-1 ring-card-outline transition hover:bg-surface hover:shadow-raised hover:ring-line-bold"
            >
              <span className="text-sm font-semibold text-compare-fg">{c.title}</span>
              <span className="mt-1 block text-sm leading-relaxed text-fg-muted">{c.summary}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
